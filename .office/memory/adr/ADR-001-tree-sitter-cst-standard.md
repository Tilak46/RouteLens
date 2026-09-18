# ADR-001: Mandatory Tree-sitter CST Architecture over Babel

## Status
Accepted (2026-09-10)

## Context
RouteLens V1 used Babel AST visitors (`@babel/parser`, `@babel/traverse`), strictly limited to JavaScript/TypeScript. Supporting multi-language backends (Go, Python, Java, C#, PHP, Rust) requires a universal, fault-tolerant parser.

## Decision
All route extraction must be powered by WebAssembly-compiled Tree-sitter Concrete Syntax Trees (`web-tree-sitter`).
1. Parser runs in 1-3ms per file with ultra-compact memory footprint (~5MB per grammar).
2. Never throw fatal exceptions on syntax errors or partial code.
3. Universal across all 10 supported programming languages.

## Consequences
- Deprecate legacy Babel `src/main/lib/scanner/core/`.
- All new framework extractors must be written as Tree-sitter CST queries in `src/main/lib/scanner/omniroute/treeSitterEngine.ts`.
