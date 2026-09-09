import type { Method } from "../../../types";

export type OmniFramework =
  | "express"
  | "fastapi"
  | "flask"
  | "django"
  | "starlette"
  | "gin"
  | "fiber"
  | "echo"
  | "next-pages"
  | "next-app"
  | "nest"
  | "aspnet"
  | "spring"
  | "laravel"
  | "custom"
  | "unknown";

export type OmniRoute = {
  id: string;
  framework: OmniFramework;
  method: Method;
  path: string;
  file: string; // absolute file path
  summary?: string;
  params?: string[];
  body?: string[];
  query?: string[];
  confidence: "high" | "medium" | "low";
  source: "fast_matcher" | "local_ai" | "ast" | "tree_sitter";
};

export type FileCandidate = {
  filePath: string;
  relativePath: string;
  language: string;
  content: string;
  routeScore: number;
  hasRouteSignals: boolean;
  isClientUi?: boolean;
  isTestFile?: boolean;
};

export type OmniScanResult = {
  routes: OmniRoute[];
  candidateFilesCount: number;
  totalFilesScanned: number;
  fastMatchedRoutesCount: number;
  aiRescuedRoutesCount: number;
  logs: string[];
  durationMs: number;
};
