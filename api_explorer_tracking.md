# 🗺️ API Explorer (Auto-Discovery) - Feature Tracking

**Goal:** a "Zero-Config Postman" that scans your codebase to automatically discover and test API endpoints.

**User Experience Target (clarified):**

- When the user opens **API Explorer** from the sidebar, they can **select a project** (from existing DevDash projects or by picking a folder).
- Each selected project opens as a **tab** (browser-style) so they can quickly switch between projects.
- When switching tabs, DevDash scans the project and builds the API tree automatically.
- Clicking an endpoint loads it into the Request panel; clicking **Send** performs a real request.

## ✅ Accomplished So Far

We have successfully built the **Frontend UI** (The "Face") and made the MVP backend functional.

- [x] **Sidebar Tree:** A recursive folder structure to navigate nested routes (e.g., `TravelAgent > E Visa > Application`).
- [x] **Request Panel:** A full-featured editor with Method badges (GET/POST), URL bar, and Tabs for Body/Headers/Auth.
- [x] **Response Panel:** A clean JSON viewer with status metrics (Time, Size, Status Code).
- [x] **Integration:** Added to the main Dashboard Sidebar and Router.
- [x] **Refactoring:** Polished the UI to match the native app theme (removed modal borders) and cleaned up circular dependencies.

### ✅ What is working now (MVP)

- [x] **Main-process scanner exists**: `src/main/lib/apiScanner.ts`
  - Scans `*.ts/*.js/*.tsx/*.jsx` (excluding common build folders)
  - Extracts Express-style routes: `app.get('/path')`, `router.post('/path')`, etc.
  - Builds a **folder tree based on URL path segments** (drops `api/` and `v1/v2` prefixes)
- [x] **IPC is wired**: `api-explorer:scan-project` in `src/main/ipcHandlers/apiExplorerHandlers.ts`
- [x] **Preload exposes scan API**: `scanProject(path)` in `src/preload/index.ts`
- [x] **Renderer uses real scan data**: `src/renderer/views/ApiExplorerView.tsx`
- [x] **Project tabs UX** (browser-style) added at the top of API Explorer
  - Add tab from existing DevDash projects
  - Or pick a folder manually
- [x] **Send button runs real fetch** (no longer mocked): `src/renderer/components/api-explorer/RequestPanel.tsx`

---

## 🧯 What was wrong before (why it felt “not working”)

- The UI was calling `apiClient.scanProject(...)`, but **preload did not expose** `scanProject`, so the renderer silently fell back to the dummy function (`API not ready`) and always returned an empty tree.
- The API Explorer view was **hardcoded** to scan `c:\building-future\devdash\src`, not the user-selected project.
- The **Send** button in RequestPanel returned a **mock response** via `setTimeout`, not a real HTTP request.

## 🚧 Remaining Work (Next Steps)

### 1) Scanner upgrades (accuracy)

Current scanner is regex-based (fast MVP). Next improvements:

- **AST parsing** (babel / ts parser) to properly discover routes in more patterns.
- Handle **nested routers** with `app.use('/prefix', router)` and imported routers.
- Support additional frameworks (optional): NestJS decorators, Fastify, Next.js route handlers.

### 2) Request execution (robustness)

Right now, the renderer uses `fetch(url, ...)`. Next improvements:

- Add optional IPC: `api-explorer:execute-request(req)` so requests run in Node (avoids CORS/mixed-content issues).
- Implement Headers/Auth tabs for real (currently placeholders).

### 3) Project tabs (persistence & quality)

- Persist open tabs + base URLs (electron-store) so API Explorer restores tabs on restart.
- Allow per-tab environment presets (dev/stage/prod base URLs).
- Add a small “scan status” and last scanned time per tab.

---

## 🧪 Quick Test Checklist

1. Open API Explorer
2. Click **Add** → select an existing DevDash project (or “Choose Folder”)
3. Confirm the left sidebar fills with detected API folders/routes
4. Click a route → Request panel loads
5. Hit **Send** → Response panel shows real response (or a network error if the server isn’t running)

## 🛠️ Next Session Plan (recommended)

1. Add `api-explorer:execute-request` IPC proxy (fix CORS issues reliably)
2. Store + restore project tabs/baseUrl
3. AST-based router mounting resolution (`app.use('/api', router)`) to match real-world backends
