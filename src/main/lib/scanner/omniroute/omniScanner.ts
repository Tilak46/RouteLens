import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import type { OmniRoute, OmniScanResult, FileCandidate } from "./types";
import { isCandidateFilePath, analyzeRouteCandidate } from "./universalFilter";
import { fastMatchRoutes } from "./fastMatcher";
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
          seg === "vendor"
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

  log(`[OmniRoute] Initiating multi-language scan on: ${projectPath}`);

  // Step 1: Collect all candidate code files
  const filePaths = await collectAllFiles(projectPath, projectPath);
  log(`[OmniRoute] Found ${filePaths.length} supported source files.`);

  const candidateFiles: FileCandidate[] = [];
  for (const f of filePaths) {
    try {
      const content = await fs.promises.readFile(f, "utf-8");
      const candidate = analyzeRouteCandidate(f, content, projectPath);
      if (candidate.hasRouteSignals) {
        candidateFiles.push(candidate);
      }
    } catch {
      // Ignore read errors
    }
  }

  log(`[OmniRoute] Identified ${candidateFiles.length} candidate route files via universal invariant filter.`);

  const allRoutes: OmniRoute[] = [];
  const rescueCandidates: FileCandidate[] = [];
  let fastMatchedCount = 0;

  // Step 2: Run Fast Matcher on all candidate files (sub-millisecond tier)
  for (const candidate of candidateFiles) {
    const matched = fastMatchRoutes(candidate);
    if (matched.length > 0) {
      fastMatchedCount += matched.length;
      allRoutes.push(...matched);
    } else if (candidate.routeScore >= 3) {
      // Has strong route signals (paths + verbs or inside route folder), but standard patterns didn't match!
      rescueCandidates.push(candidate);
    }
  }

  log(`[OmniRoute] Fast matcher discovered ${fastMatchedCount} routes across standard patterns.`);

  // Step 3: Run On-Device AI Rescue on ambiguous / custom wrapper files
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

  // Step 4: Deduplicate routes by method + path + file
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
  log(`[OmniRoute] Scan complete in ${durationMs}ms: ${uniqueRoutes.length} total unique routes found (${fastMatchedCount} fast, ${aiRescuedCount} AI rescued).`);

  return {
    routes: uniqueRoutes,
    candidateFilesCount: candidateFiles.length,
    totalFilesScanned: filePaths.length,
    fastMatchedRoutesCount: fastMatchedCount,
    aiRescuedRoutesCount: aiRescuedCount,
    logs,
    durationMs,
  };
}
