# RouteLens (v1.0.1 Early Access) - Getting Started Guide

Welcome to **RouteLens**! This tool is an interactive API Discovery Client & Local Server Manager designed to make testing local backends seamless by automatically scanning your source code files to build your API route tree.

---

## 📥 How to Install

### 🪟 For Windows Users
1. Download **`RouteLens-Windows-1.0.1-Setup.exe`**.
2. Double-click the installer and follow the standard installation wizard.
3. Once completed, RouteLens will launch automatically!

### 🐧 For Linux (Ubuntu/Debian) Users
1. Download **`RouteLens-Linux-1.0.1.zip`** and extract it to a folder of your choice.
2. Open the extracted folder.
3. Right-click the **`routelens`** executable file, select **Properties**, go to the **Permissions** tab, and check the box **"Allow executing file as program"**.
4. Double-click the file (or open a terminal in the directory and run `./routelens`) to launch the application!

---

## 🚀 How to Use (Quick Start)

1. **Add your Backend Project**: 
   - Use the interface to add a local project folder.
   - *Optional:* Click the **Developer Tools** icon (Terminal icon at the bottom-left, passcode: `Tilak@2440`) to paste a Git URL and clone a repository directly into a local folder.
2. **Launch your Server**:
   - Go to the **Local Servers** panel.
   - Click the **Play** button next to your project to run its startup script (e.g. `npm run dev`).
3. **Auto-Scan API Routes**:
   - Switch to the **API Discovery** tab.
   - RouteLens automatically scans your project's controller/route files (Express, Next.js, etc.) and populates a visual directory tree of all active endpoints.
4. **Send & Test Requests**:
   - Select any scanned endpoint from the sidebar.
   - Fill in headers, query parameters, or request body.
   - Hit **Send** to inspect the response payload, headers, and status code in real-time.

---

## ⚠️ Important Beta Information

- **Early Access Expiry**: To prevent misuse, this early access beta build is set to expire on **August 28, 2026**.
- **Get Updates**: When the testing period ends, the app will show a notice. Simply contact Tilak to receive the latest version:
  - **Email**: tilakbuilds@gmail.com
  - **Reddit DM**: u/OutrageousSalt8997 (or DM MrSanito)
- **Feedback**: Please share your bugs, suggestions, and feedback directly to help improve RouteLens!
