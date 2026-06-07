# DevDash: Status Analysis & Roadmap Ideas

Based on the current state of the codebase, here is an analysis of where DevDash stands, what requires immediate engineering focus, and what new features could elevate the product in the future.

---

## 🟢 Features That Are "Done" (Mature & Stable)
These features provide the core value of the application and are solid. They don't need immediate major overhauls, just standard maintenance.

- **Core Project Management**: Adding, grouping, running, and stopping local projects is robust. Associated child processes are killed cleanly.
- **Integrated Terminal & Logs**: Viewing logs inside the app works seamlessly, reducing window clutter.
- **AI Integrations (Logs & Git)**: The OpenRouter integration to explain terminal errors and generate smart commit messages from Git diffs is mature and highly useful.
- **Ghost Mode (Overlay)**: The minimalist, always-on-top transparent widget is a polished feature for users who want to stay in their IDE.
- **Browser auto-linking**: The ability to detect localhost ports from terminal stdout and provide a 1-click browser link is functional.

---

## 🟡 Features That Need More Work (Current Focus Areas)
These features are either in the MVP (Minimum Viable Product) stage or the design execution stage. **This is where you should dedicate your current development time.**

### 1. API Explorer (The "Zero-Config Postman")
- **State**: The UI looks great, and the basic regex scanner works. However, it lacks enterprise-grade robustness.
- **Immediate Work Needed**:
  - **Upgrade to AST Parsing**: Replace the naive regex scanner with an Abstract Syntax Tree (AST) parser (like Babel or TS compiler API) to accurately understand complex Express/Next.js nested routes.
  - **IPC Request Proxy**: Currently, the frontend `fetch` handles the test requests, which can lead to CORS errors. You need an IPC handler (`api-explorer:execute-request`) so the Electron main process makes the HTTP calls natively.
  - **State Persistence**: Save open tabs, selected environments (e.g., dev/staging URLs), and last-scanned results to `electron-store` so the user doesn't lose their context on app restart.

### 2. God Mode Workspaces & Port Management
- **State**: The design is documented, but it needs to be fully wired into a reliable system.
- **Immediate Work Needed**:
  - **Port Hunter Integration**: Implement the utility that reliably detects Which projects are holding Which ports, allowing the user to selectively kill blocking processes without destroying their whole OS Node environment.
  - **Workspace Composer UI**: Build the front-end wizard allowing users to link a DevDash group to specific external apps (like VS Code, Chrome URLs, Postman) to boot up all at once.

---

## 🚀 Ideas for New Improvements & Features
Once the current focus areas are polished, here are highly valuable features you can add to make DevDash the ultimate local development hub.

### 1. Unified Script Runner
- **The Idea**: Parse every project's `package.json` automatically. Instead of just offering a "Start" button, provide a visual dashboard of all available scripts (`build`, `test`, `lint`, `typecheck`).
- **The Value**: Users can run tests or builds across multiple projects simultaneously with one click.

### 2. Database Viewing integrations
- **The Idea**: Add a lightweight tab that connects to local SQLite files or standard Postgres/Mongo local dev databases.
- **The Value**: Prevents the developer from having to open DBeaver, PGAdmin, or MongoDB Compass just to check if a local API successfully inserted a record.

### 3. Environment Variable (.env) Centralizer
- **The Idea**: A secure, visual editor for `.env` files across all registered projects.
- **The Value**: In full-stack development, keeping frontend and backend `.env` variables (like Database URLs or API keys) in sync is tedious. A UI that highlights missing keys or allows bulk editing would be a massive time-saver.

### 4. Docker Container Awareness
- **The Idea**: Use Docker's CLI or API to detect running local containers.
- **The Value**: If a user's backend relies on a local Redis or Postgres Docker container, DevDash could display its status alongside the Node.js projects, providing a truly unified view of the stack.

### 5. Dependency Health Dashboard
- **The Idea**: Compare dependencies across the user's projects.
- **The Value**: It could alert the user if a project has vulnerabilities (`npm audit`) or visually highlight if the Frontend is using `react@18` while the Admin Panel is still stuck on `react@17`. It could offer a 1-click update button.

### 6. Command Palette (Power User UX)
- **The Idea**: Implement a global shortcut (e.g., `Cmd+K` or `Ctrl+K`) that opens a Spotlight-like search bar.
- **The Value**: Let power users start projects, switch workspaces, or trigger AI without taking their hands off the keyboard.
