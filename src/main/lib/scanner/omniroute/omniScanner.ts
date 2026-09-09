import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import type { OmniRoute, OmniScanResult, FileCandidate } from "./types";
import { isCandidateFilePath, analyzeRouteCandidate } from "./universalFilter";
import { fastMatchRoutes } from "./fastMatcher";
import { extractRoutesWithTreeSitter } from "./treeSitterEngine";
import { SymbolicMountLinker } from "./mountLinker";
import { isLocalAiAvailable, extractRoutesWithAI } from "./localAiEngine";

async function collectAllFiles(dir: string, rootPath: string, fileList: string[] = []): Promise<string[]> {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const seg = entry.name;
        if (
          seg === "node_modules" ||
          seg === ".git" ||
          seg === ".next" ||
          seg === "dist" ||
          seg === "build" ||
          seg === "out" ||
          seg === "coverage" ||
          seg === "vendor" ||
          seg === "public"
        ) {
          continue;
        }
        await collectAllFiles(fullPath, rootPath, fileList);
      } else if (entry.isFile()) {
        if (isCandidateFilePath(fullPath, rootPath)) {
          fileList.push(fullPath);
        }
      }
    }
  } catch {
    // Ignore read errors
  }
  return fileList;
}

export async function scanOmniRoutes(
  projectPath: string,
  options: { enableAi?: boolean; maxAiRescues?: number } = {},
): Promise<OmniScanResult> {
  const startTime = performance.now();
  const logs: string[] = [];
  const log = (msg: string) => logs.push(msg);

  const enableAi = options.enableAi !== false;
  const maxAiRescues = options.maxAiRescues || 5;

  log(`[OmniRoute] Initiating universal hybrid scan on: ${projectPath}`);

  // Step 1: Collect and read all candidate code files
  const filePaths = await collectAllFiles(projectPath, projectPath);
  log(`[OmniRoute] Found ${filePaths.length} supported source files.`);

  const fileCodeMap = new Map<string, string>();
  const candidateFiles: FileCandidate[] = [];

  for (const f of filePaths) {
    try {
      const content = await fs.promises.readFile(f, "utf-8");
      fileCodeMap.set(f, content);
      const candidate = analyzeRouteCandidate(f, content, projectPath);
      // Skip client-side UI code to prevent client Axios/fetch calls from polluting server routes
      if (candidate.hasRouteSignals && !candidate.isClientUi) {
        candidateFiles.push(candidate);
      }
    } catch {
      // Ignore read errors
    }
  }

  log(`[OmniRoute] Identified ${candidateFiles.length} backend candidate route files via universal invariant filter.`);

  // Step 2: Build Symbolic Mount Table across the project
  const mountLinker = new SymbolicMountLinker();
  mountLinker.buildMountTable(fileCodeMap, projectPath);

  const allRoutes: OmniRoute[] = [];
  const rescueCandidates: FileCandidate[] = [];
  let astMatchedCount = 0;

  // Step 3: Run Tree-sitter Universal AST on all candidate files using resolved mounts
  for (const candidate of candidateFiles) {
    let matched = await extractRoutesWithTreeSitter(candidate, mountLinker);
    // If Tree-sitter doesn't support the language or returns 0, try fastMatcher as auxiliary fallback
    if (matched.length === 0) {
      const fastMatches = fastMatchRoutes(candidate, mountLinker);
      if (fastMatches.length > 0) {
        matched = fastMatches;
      }
    }

    if (matched.length > 0) {
      astMatchedCount += matched.length;
      allRoutes.push(...matched);
    } else if (candidate.routeScore >= 3) {
      // Has strong route signals, but standard patterns didn't match (likely custom wrapper or loop)
      rescueCandidates.push(candidate);
    }
  }

  log(`[OmniRoute] Tree-sitter AST discovered ${astMatchedCount} routes across syntax trees.`);

  // Step 4: Run On-Device AI Rescue on ambiguous / custom wrapper files
  let aiRescuedCount = 0;
  if (enableAi && rescueCandidates.length > 0) {
    const aiAvailable = isLocalAiAvailable();
    if (aiAvailable) {
      log(`[OmniRoute] Dispatching ${Math.min(rescueCandidates.length, maxAiRescues)} ambiguous files to Local AI safety net...`);
      for (let i = 0; i < Math.min(rescueCandidates.length, maxAiRescues); i++) {
        const rescueTarget = rescueCandidates[i];
        log(`[OmniRoute AI] Analyzing ${rescueTarget.relativePath} (${rescueTarget.language})...`);
        try {
          const aiRoutes = await extractRoutesWithAI(rescueTarget);
          if (aiRoutes.length > 0) {
            aiRescuedCount += aiRoutes.length;
            allRoutes.push(...aiRoutes);
            log(`[OmniRoute AI] Rescued ${aiRoutes.length} routes from ${rescueTarget.relativePath}!`);
          }
        } catch (err: any) {
          log(`[OmniRoute AI] Error during AI rescue: ${err.message}`);
        }
      }
    } else {
      log(`[OmniRoute] Local AI model not loaded; skipped AI rescue for ${rescueCandidates.length} custom files.`);
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
