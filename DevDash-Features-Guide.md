# DevDash: Your Development Command Center

DevDash is a unified, Electron-based desktop application designed to streamline local development. It acts as a central hub to manage, run, and monitor multiple local projects, eliminating the need to juggle multiple terminal windows and distinct tools.

Below is a comprehensive guide to all the features and functionalities provided by DevDash, along with instructions on how to use them.

---

## 1. Project Management
**Feature:** Easily add, edit, track, and remove local development projects. You can start or stop projects directly from the UI with a single click.
**How to use:** 
- Navigate to the **Projects** view. 
- Click **Add Project**, select your local project folder, and enter the start command you typically use (e.g., `npm run dev` or `yarn start`). 
- Once added, use the **Play/Stop toggle** on the project card to run or terminate the project.

## 2. Group Organization
**Feature:** Organize related projects into logical groups (e.g., "Frontend", "Backend", "Microservices") to keep your workspace tidy and accessible.
**How to use:** 
- In the **Projects** view, click **Add Group** to create a structured category. 
- Use the **Manage Groups** button to assign or reassign your existing projects to these groups.

## 3. Integrated Terminal Logs & AI Log Explanation
**Feature:** View real-time terminal output for running projects without opening a separate terminal window. Includes an AI integration to instantly explain complex errors or logs.
**How to use:** 
- Click the **Logs** button (terminal icon) on any running project to open the Log Viewer. 
- If you encounter an error, use the integrated AI button to get a plain-English explanation of the problem and potential fixes (powered by OpenRouter).

## 4. Git Integration & AI Commit Generation
**Feature:** Keep track of your Git repository status directly within the app, view uncommitted changes, and automatically generate smart commit messages using AI.
**How to use:** 
- Look for the Git summary section on a project card to see current branch and uncommitted changes. 
- Click the Git icon to open the **Git Sheet**, review your diffs, and click the AI generation button to draft a meaningful commit message based on your code changes. *(Note: Requires configuring the `OPENROUTER_API_KEY` in your `.env` file).*

## 5. God Mode Workspaces (Automation)
**Feature:** Configure groups of interconnected projects to launch simultaneously with a single click. Perfect for full-stack environments.
**How to use:** 
- Navigate to the **Workspaces** view. 
- Click **New Automation** (God Mode Workspace), give it a name, and select the projects that must run together. 
- Click **Launch** on the created workspace to start all selected projects at once. You can also pin your most-used workspaces for quick access.

## 6. API Explorer
**Feature:** Automatically scan your backend projects (like Express.js or Next.js) to discover, document, and list API endpoints. It acts as a built-in Postman, parsing abstract syntax trees (AST) to extract routes.
**How to use:** 
- Open the **API Explorer** view. 
- Select a backend project from your list. DevDash will scan the codebase and present a structured list of available API routes, methods (GET, POST, etc.), and paths directly in the UI.

## 7. Ghost Mode (Always-On-Top Widget)
**Feature:** A sleek, minimalist, transparent overlay that lets you control your ongoing projects without the main app window cluttering your screen.
**How to use:** 
- Toggle **Ghost Mode** from the main app or via shortcut. 
- The main window will hide, and a small widget will appear as an overlay on your screen. You can use this widget to quickly start/stop projects or launch God Mode workspaces while staying focused in your primary IDE.

## 8. Auto-URL Detection & Browser Integration
**Feature:** DevDash automatically detects when a local server successfully starts and binds to a port, providing instant access to its local URL.
**How to use:** 
- Start a web project. Once it binds to a localhost port, DevDash extracts the URL from the terminal output and provides a clickable link/icon on the project card to open it directly in your default browser.

## 9. Robust Process Management
**Feature:** Advanced system monitoring under the hood that ensures clean process termination.
**How to use:** 
- Works automatically in the background. When you stop a project, DevDash safely kills all associated child process trees, ensuring no "zombie" Node.js processes are left eating up your CPU or holding ports hostage.
