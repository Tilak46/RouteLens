# Agent Guidelines & Constraints

## Git Guidelines
- **Target Remote & Branch**: Always push to the `routelens` remote and `tilak` branch (`git push routelens tilak`).
- **Logical Milestone Commits**: Commit changes logically when meaningful, well-tested architectural milestones or feature improvements are completed and verified (not after every trivial edit). Maintain clear, conventional commit messages.

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

## Windows PowerShell & Execution Reliability
- **Zero Inline Multi-Line Shell Code**: On Windows PowerShell, NEVER execute inline multi-line code via `npx tsx -e '...'`, `node -e '...'`, `python -c '...'`, or single-quoted bash-style strings. PowerShell quote escaping and newline processing will freeze the process waiting for stdin, causing background task hangs.
- **Mandatory Standalone Scratch Files**: ALWAYS write diagnostic, test, and extraction scripts as dedicated `.ts`, `.js`, or `.py` files in the conversation's `scratch/` directory, and execute them cleanly with `npx tsx <path>` or `python <path>`.
- **Zero Silent Hanging Tasks**: Never leave background tasks hanging with empty logs. Ensure commands terminate cleanly, have explicit error handling, and never prompt for interactive input.
