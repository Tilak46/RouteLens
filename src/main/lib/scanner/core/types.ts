import type { File } from "@babel/types";
import type { Method } from "../../../../types";

export type FrameworkId = "express" | "next-pages" | "next-app" | "nest";

export type DetectedRoute = {
  id: string;
  framework: FrameworkId;
  method: Method;
  path: string;
  file: string; // absolute file path
  handler?: string;
  middlewares?: string[];
  description?: string;
  pathParams?: string[];
  inferredBodyFields?: string[];
  inferredQueryFields?: string[];
};

export type AstCacheStats = {
  hits: number;
  misses: number;
  errors: number;
};

export type ScannerContext = {
  rootPath: string;
  files: string[];
  log: (msg: string) => void;
  getAst: (filePath: string) => Promise<File | null>;
  resolveImport: (fromFile: string, importSource: string) => string | null;
  astStats: () => AstCacheStats;
};

export interface FrameworkParser {
  id: FrameworkId;
  detectProject(ctx: ScannerContext): Promise<boolean> | boolean;
  parseRoutes(ctx: ScannerContext): Promise<DetectedRoute[]>;
}
