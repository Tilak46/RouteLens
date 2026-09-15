import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import type { OmniRoute, OmniScanResult, FileCandidate } from "./types";
import { isCandidateFilePath, analyzeRouteCandidate, UNIVERSAL_IGNORED_DIRECTORIES } from "./universalFilter";
import { extractRoutesWithTreeSitter } from "./treeSitterEngine";
import { SymbolicMountLinker } from "./mountLinker";
import { isLocalAiAvailable, extractRoutesWithAI } from "./localAiEngine";

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
        if (UNIVERSAL_IGNORED_DIRECTORIES.has(entry.name.toLowerCase())) {
          continue;
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
    // Ignore read errors
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

  const mode = options.mode || (options.enableAi === false ? "ast" : "hybrid");
  const enableAi = mode === "ai" || (mode === "hybrid" && options.enableAi !== false);
  const maxAiRescues = options.maxAiRescues || 10;
  const includeTests = options.includeTests === true;

  log(`[OmniRoute] Initiating universal scan (mode: ${mode}) on: ${rootPath}`);

  // Step 1: Collect and read all candidate code files
  const filePaths = await collectAllFiles(rootPath, rootPath, [], 0, options.abortSignal, options.onHeartbeat);
  log(`[OmniRoute] Found ${filePaths.length} supported source files.`);

  const fileCodeMap = new Map<string, string>();
  const candidateFiles: FileCandidate[] = [];

  for (const f of filePaths) {
    if (options.abortSignal?.aborted) {
      log(`[OmniRoute] Scan cancelled by user during file collection.`);
      break;
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
  }

  log(`[OmniRoute] Identified ${candidateFiles.length} backend candidate route files via universal invariant filter.`);

  // Step 2: Build Symbolic Mount Table across the project
  const mountLinker = new SymbolicMountLinker();
  await mountLinker.buildMountTable(fileCodeMap, projectPath);

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
    for (const candidate of candidateFiles) {
      if (options.abortSignal?.aborted) {
        log(`[OmniRoute] Scan cancelled by user.`);
        break;
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
      }
    }

    log(`[OmniRoute AST] Tree-sitter AST discovered ${astMatchedCount} routes across syntax trees.`);

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

  const durationMs = Math.round(performance.now() - startTime);
  log(`[OmniRoute] Scan complete in ${durationMs}ms: ${uniqueRoutes.length} total unique routes found (${astMatchedCount} AST, ${aiRescuedCount} AI rescued).`);

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
