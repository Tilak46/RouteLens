import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import type { OmniRoute, OmniScanResult, FileCandidate } from "./types";
import type { ScanProgressUpdate } from "../../../../types";
import { isCandidateFilePath, analyzeRouteCandidate, UNIVERSAL_IGNORED_DIRECTORIES } from "./universalFilter";
import { extractRoutesWithTreeSitter } from "./treeSitterEngine";
import { SymbolicMountLinker } from "./mountLinker";
import { isLocalAiAvailable, extractRoutesWithAI } from "./localAiEngine";
import { PolyglotFactoryRouteResolver } from "./factoryRouteResolver";

async function collectAllFiles(
  dir: string,
  rootPath: string,
  fileList: string[] = [],
  depth: number = 0,
  abortSignal?: AbortSignal,
  onHeartbeat?: () => void,
): Promise<string[]> {
  if (depth > 12 || fileList.length >= 20000 || abortSignal?.aborted) return fileList;
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (fileList.length >= 20000 || abortSignal?.aborted) break;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const dirName = entry.name.toLowerCase();
        if (UNIVERSAL_IGNORED_DIRECTORIES.has(dirName)) {
          if ((dirName === "build" || dirName === "dist" || dirName === "out") && depth > 1) {
            // Nested feature folder (e.g. router/build/build.go), not a top-level build artifact
          } else {
            continue;
          }
        }
        await collectAllFiles(fullPath, rootPath, fileList, depth + 1, abortSignal, onHeartbeat);
      } else if (entry.isFile()) {
        if (isCandidateFilePath(fullPath, rootPath)) {
          fileList.push(fullPath);
        }
      }
    }
    onHeartbeat?.();
  } catch {
    // Ignore permissions / inaccessible directory errors cleanly
  }
  return fileList;
}

export interface OmniScanOptions {
  enableAi?: boolean;
  maxAiRescues?: number;
  includeTests?: boolean;
  mode?: "hybrid" | "ast" | "ai";
  abortSignal?: AbortSignal;
  onHeartbeat?: () => void;
  onProgress?: (progress: ScanProgressUpdate) => void;
  perFileTimeoutMs?: number;
}

export async function scanOmniRoutes(
  projectPath: string,
  options: OmniScanOptions = {},
): Promise<OmniScanResult> {
  const rootPath = path.resolve(projectPath);
  const startTime = performance.now();
  const logs: string[] = [];
  const log = (msg: string) => logs.push(msg);

  let lastProgressTime = 0;
  const emitProgress = (
    phase: ScanProgressUpdate["phase"],
    percent: number,
    message: string,
    current: number,
    total: number,
    routesFound: number,
    currentFile?: string,
    force = false,
  ) => {
    const now = Date.now();
    if (force || now - lastProgressTime >= 80) {
      lastProgressTime = now;
      options.onProgress?.({
        projectPath,
        phase,
        percent,
        message,
        current,
        total,
        routesFound,
        currentFile,
      });
    }
  };

  const mode = options.mode || (options.enableAi === false ? "ast" : "hybrid");
  const enableAi = mode === "ai" || (mode === "hybrid" && options.enableAi !== false);
  const maxAiRescues = options.maxAiRescues || 10;
  const includeTests = options.includeTests === true;

  log(`[OmniRoute] Initiating universal scan (mode: ${mode}) on: ${rootPath}`);
  emitProgress("discovering", 2, "Indexing project source files...", 0, 0, 0, undefined, true);

  // Step 1: Collect and read all candidate code files
  const tCollect = performance.now();
  const filePaths = await collectAllFiles(rootPath, rootPath, [], 0, options.abortSignal, options.onHeartbeat);
  log(`[OmniRoute] Found ${filePaths.length} supported source files in ${Math.round(performance.now() - tCollect)}ms.`);

  const fileCodeMap = new Map<string, string>();
  const candidateFiles: FileCandidate[] = [];

  const tRead = performance.now();
  let readFileCount = 0;
  for (const f of filePaths) {
    if (options.abortSignal?.aborted) {
      log(`[OmniRoute] Scan cancelled by user during file collection.`);
      break;
    }
    readFileCount++;
    if (readFileCount % 50 === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    try {
      const content = await fs.promises.readFile(f, "utf-8");
      fileCodeMap.set(f, content);
      const candidate = analyzeRouteCandidate(f, content, projectPath);
      // Skip client UI code and skip unit test files unless explicitly requested
      if (candidate.hasRouteSignals && !candidate.isClientUi && (includeTests || !candidate.isTestFile)) {
        candidateFiles.push(candidate);
      }
    } catch {
      // Ignore read errors
    }
    options.onHeartbeat?.();
    const pct = Math.min(25, Math.round((readFileCount / Math.max(1, filePaths.length)) * 25));
    emitProgress(
      "discovering",
      pct,
      `Scanning source files (${readFileCount}/${filePaths.length})...`,
      readFileCount,
      filePaths.length,
      0,
      path.relative(rootPath, f).replace(/\\/g, "/"),
    );
  }
  log(`[OmniRoute] Read ${filePaths.length} files & identified ${candidateFiles.length} candidate files in ${Math.round(performance.now() - tRead)}ms.`);

  // Step 2: Build Symbolic Mount Table across the project
  emitProgress("linking", 30, "Mapping controller mount hierarchy...", candidateFiles.length, candidateFiles.length, 0, undefined, true);
  const tMount = performance.now();
  const mountLinker = new SymbolicMountLinker();
  await mountLinker.buildMountTable(fileCodeMap, projectPath);
  log(`[OmniRoute] Mount table built in ${Math.round(performance.now() - tMount)}ms.`);

  const allRoutes: OmniRoute[] = [];
  const rescueCandidates: FileCandidate[] = [];
  let astMatchedCount = 0;
  let aiRescuedCount = 0;

  const perFileTimeoutMs = options.perFileTimeoutMs ?? 15_000;

  async function safeExtractCandidate(candidate: FileCandidate): Promise<OmniRoute[]> {
    let timeoutId: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Extraction timed out after ${perFileTimeoutMs}ms`));
      }, perFileTimeoutMs);
    });

    try {
      const extractPromise = extractRoutesWithTreeSitter(candidate, mountLinker);
      return await Promise.race([extractPromise, timeoutPromise]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  if (mode === "ai") {
    // Mode B: Pure AI-First Extraction on top candidates
    log(`[OmniRoute AI-First] Running semantic extraction on top ${Math.min(candidateFiles.length, maxAiRescues)} candidate files...`);
    const sorted = [...candidateFiles].sort((a, b) => b.routeScore - a.routeScore);
    for (let i = 0; i < Math.min(sorted.length, maxAiRescues); i++) {
      if (options.abortSignal?.aborted) {
        log(`[OmniRoute AI-First] Scan cancelled by user.`);
        break;
      }
      const target = sorted[i];
      try {
        const aiRoutes = await extractRoutesWithAI(target);
        if (aiRoutes.length > 0) {
          aiRescuedCount += aiRoutes.length;
          allRoutes.push(...aiRoutes);
          log(`[OmniRoute AI-First] Extracted ${aiRoutes.length} routes from ${target.relativePath}`);
        }
      } catch (err: any) {
        log(`[OmniRoute AI-First] Error on ${target.relativePath}: ${err.message}`);
      } finally {
        options.onHeartbeat?.();
      }
    }
  } else {
    // Mode A (AST) or Hybrid: Run Tree-sitter Universal AST with Per-File Isolation
    const tExtract = performance.now();
    let extractCount = 0;
    for (const candidate of candidateFiles) {
      if (options.abortSignal?.aborted) {
        log(`[OmniRoute] Scan cancelled by user.`);
        break;
      }

      extractCount++;
      if (extractCount % 5 === 0) {
        await new Promise((resolve) => setImmediate(resolve));
      }

      try {
        const matched = await safeExtractCandidate(candidate);
        if (matched.length > 0) {
          astMatchedCount += matched.length;
          allRoutes.push(...matched);
        } else if (candidate.routeScore >= 3) {
          rescueCandidates.push(candidate);
        }
      } catch (err: any) {
        log(`[OmniRoute] Skipped candidate file ${candidate.relativePath}: ${err?.message || err}`);
      } finally {
        options.onHeartbeat?.();
        const pct = Math.min(85, 35 + Math.round((extractCount / Math.max(1, candidateFiles.length)) * 50));
        emitProgress(
          "parsing",
          pct,
          `Parsing endpoints in ${candidate.relativePath} (${extractCount}/${candidateFiles.length})...`,
          extractCount,
          candidateFiles.length,
          allRoutes.length,
          candidate.relativePath,
        );
      }
    }

    log(`[OmniRoute AST] Tree-sitter AST discovered ${astMatchedCount} routes across syntax trees in ${Math.round(performance.now() - tExtract)}ms.`);

    // Step 4: Layer 2 - Polyglot Factory Route Resolution
    emitProgress("factory", 90, "Synthesizing dynamic factory routes...", candidateFiles.length, candidateFiles.length, allRoutes.length, undefined, true);
    const tFactory = performance.now();
    try {
      const factoryResolver = new PolyglotFactoryRouteResolver();
      const factoryRoutes = await factoryResolver.resolveAll(candidateFiles, fileCodeMap, rootPath);
      if (factoryRoutes.length > 0) {
        log(`[OmniRoute Factory] Layer 2 synthesized ${factoryRoutes.length} factory-generated routes in ${Math.round(performance.now() - tFactory)}ms.`);
        allRoutes.push(...factoryRoutes);
      }
    } catch (err: any) {
      log(`[OmniRoute Factory] Layer 2 resolution error: ${err?.message || err}`);
    }

    // If hybrid, rescue ambiguous files
    if (mode === "hybrid" && enableAi && rescueCandidates.length > 0) {
      const aiAvailable = isLocalAiAvailable();
      if (aiAvailable) {
        log(`[OmniRoute Hybrid] Dispatching ${Math.min(rescueCandidates.length, maxAiRescues)} ambiguous files to Local AI safety net...`);
        for (let i = 0; i < Math.min(rescueCandidates.length, maxAiRescues); i++) {
          if (options.abortSignal?.aborted) {
            log(`[OmniRoute Hybrid] Scan cancelled by user.`);
            break;
          }
          const rescueTarget = rescueCandidates[i];
          try {
            const aiRoutes = await extractRoutesWithAI(rescueTarget);
            if (aiRoutes.length > 0) {
              aiRescuedCount += aiRoutes.length;
              allRoutes.push(...aiRoutes);
            }
          } catch (err: any) {
            log(`[OmniRoute AI] Error during AI rescue: ${err.message}`);
          } finally {
            options.onHeartbeat?.();
          }
        }
      }
    }
  }

  // Step 5: Deduplicate routes by method + path + file
  const seen = new Set<string>();
  const uniqueRoutes: OmniRoute[] = [];
  for (const r of allRoutes) {
    const key = `${r.method.toUpperCase()}:${r.path}:${r.file}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueRoutes.push(r);
    }
  }

  emitProgress("finalizing", 98, "Organizing endpoint hierarchy...", candidateFiles.length, candidateFiles.length, uniqueRoutes.length, undefined, true);

  const durationMs = Math.round(performance.now() - startTime);
  log(`[OmniRoute] Scan complete in ${durationMs}ms: ${uniqueRoutes.length} total unique routes found (${astMatchedCount} AST, ${aiRescuedCount} AI rescued).`);
  emitProgress("done", 100, `Complete: ${uniqueRoutes.length} routes detected`, candidateFiles.length, candidateFiles.length, uniqueRoutes.length, undefined, true);

  return {
    routes: uniqueRoutes,
    candidateFilesCount: candidateFiles.length,
    totalFilesScanned: filePaths.length,
    fastMatchedRoutesCount: astMatchedCount,
    aiRescuedRoutesCount: aiRescuedCount,
    logs,
    durationMs,
  };
}
