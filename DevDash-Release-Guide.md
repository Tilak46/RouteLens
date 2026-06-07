# DevDash Release & Distribution Guide

This guide will teach you how to build the standalone `.exe` installer for DevDash so you can distribute it to your friends and users.

## 1. Prerequisites (Already Done For You)
To build a proper Windows installer, the project needs `electron-builder` configured. I have already updated your project files to handle this:
*   Updated `electron-builder.json5` with the correct `appId` (`com.devdash.app`) and `productName` (`DevDash`).
*   Added a new script to your `package.json` called `build:win`.

## 2. How to Build the `.exe`
Whenever you are ready to create a new release, open your terminal in the `c:\building-future\devdash` directory and run:

```bash
npm run build:win
```

**What happens when you run this?**
1.  **Vite Build**: It first runs `electron-vite build` to compile your React frontend and Node.js backend into optimized production files (in the `out` folder).
2.  **Electron Builder**: It then runs `electron-builder` which takes those compiled files and packages them into a single, standalone Windows installer (`.exe`).

## 3. Locating the Built File
Once the command finishes successfully, look inside your project folder for a directory named `release` (or `release/1.0.0` depending on the version in `package.json`).

Inside, you will find a file named something like:
`DevDash-Windows-1.0.0-Setup.exe`

**This is the file you give to your friends!**

## 4. Distributing to Users
Since you want to create a website for users to download the app, here is the standard workflow:

### Option A: Direct Hosting (Simple but costs bandwidth)
1.  Upload the `.exe` file directly to your website's hosting server (e.g., in a `/downloads` folder).
2.  On your website, create a download button that links directly to `https://yourwebsite.com/downloads/DevDash-Windows-1.0.0-Setup.exe`.

### Option B: GitHub Releases (Recommended & Free)
1.  Create a public repository for DevDash on GitHub (even if the code is private, you can have a public repo just for releases).
2.  Go to the "Releases" tab on GitHub and click "Draft a new release".
3.  Upload your `.exe` file as an asset to that release.
4.  On your website, your download button simply links to the GitHub release asset URL. This saves you server bandwidth and makes it easy to track download counts.

## 5. Important Notes on Windows SmartScreen
When your friends download and run the `.exe` for the first time, Windows might show a scary blue "Windows protected your PC" popup. 

*   **Why?** Because the `.exe` is not digitally signed with an EV Code Signing Certificate (which costs hundreds of dollars a year).
*   **The Fix:** Tell your friends to click **"More info"** and then **"Run anyway"**. This is completely normal for indie desktop apps.
