# Agent Guidelines & Constraints

## Git Guidelines
- Do NOT perform any git commit or git push commands unless explicitly requested or approved by the user. Keep all code edits local.

## Problem Identification & Code Changes
- Before making ANY code changes to fix an issue, edgecase, or important task, you must:
  1. Identify and explain the root cause of the problem.
  2. Present the possible fixes or solutions to the user first.
  3. Wait for the user's feedback or approval before starting any code modifications.

## Mandatory Architectural Standard: Systemic Engineering Over Micro-Patching
- **Zero Symptom-Patching**: Never fix an issue by creating narrow, heuristic micro-patches (e.g. guessing property names like requiring `handler:`, ad-hoc string matching) that only fit the immediate repo in front of you.
- **Root-Cause Architectural Boundaries**: Always solve problems at the true architectural boundary (e.g. Framework File Roles: `page.tsx` is UI View vs. `route.ts` is Server Route; Language ECMAScript module export boundaries).
- **Mandatory Adversarial Stress-Testing Upfront**: Before proposing or applying ANY solution, you MUST internally stress-test it against real-world architectures:
  - *"What happens in API gateways and reverse proxies?"*
  - *"What happens in convention-based dynamic routers?"*
  - *"Does this belong in universal filtering, language-level parsing, or framework-specific handling?"*
  - If a proposed rule breaks ANY valid production pattern, reject it immediately and design the proper systemic solution.
- **Do Not Rely on User Pushback**: Think deeply and comprehensively on the first attempt. Never propose a half-baked patch and wait for the user to point out obvious blind spots.
