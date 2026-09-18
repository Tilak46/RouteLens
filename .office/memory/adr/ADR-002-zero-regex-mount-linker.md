# ADR-002: Zero-Regex Standard in SymbolicMountLinker and Parsers

## Status
Accepted (2026-09-11)

## Context
Previous iterations used regular expressions to detect route calls, calculate prefixes, and estimate potential routes. Regexes fail on chained methods, multiline declarations, dynamic variable identifiers, and commented-out code, causing phantom duplicate routes or silent route omissions.

## Decision
1. Eliminate 100% of regular expressions from `mountLinker.ts` and `treeSitterEngine.ts`.
2. All import tracing, export resolution, and prefix mounting must be performed via Tree-sitter AST queries in `SymbolicMountLinker`.
3. String extraction must read literal AST nodes or evaluate lexical scopes via bounded symbolic abstract interpretation.

## Consequences
- 33 phantom duplicate routes eliminated in production repos.
- Multi-tier named and star re-exports reliably resolved across modules.
