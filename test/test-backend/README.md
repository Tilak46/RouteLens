# Test Backend Fixtures (for DevDash API Scanner)

This folder contains 4 small Express backends with increasing difficulty.

Scan each folder separately in DevDash (API Explorer → Add Project → Choose Folder...).

Folders:

- `noob-express/` — simplest inline routes.
- `intermediate-express/` — routers + basic mounts.
- `good-express/` — nested mounts, `v1` prefix, middleware-in-mount, `.route()` chains.
- `excellent-express/` — patterns that many scanners struggle with (named exports, router factories, non-literal mount paths).

Tip: If the scan shows duplicates, that usually means a router is being treated as both mounted and unmounted.
