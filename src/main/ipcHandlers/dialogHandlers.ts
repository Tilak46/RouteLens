import { BrowserWindow, dialog, ipcMain } from "electron";

let getMainWindow: () => BrowserWindow | null;

export function registerDialogHandlers(
  getMainWindowFn: () => BrowserWindow | null,
) {
  getMainWindow = getMainWindowFn;

  ipcMain.handle("dialog:openDirectory", async () => {
    const mainWindow = getMainWindow();
    const options: any = {
      title: "Select Project Folder",
      buttonLabel: "Select Folder",
      properties: ["openDirectory", "createDirectory"],
    };

    const { canceled, filePaths } = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);

    if (!canceled && filePaths.length > 0) {
      return filePaths[0];
    }
    return null;
  });

  ipcMain.handle("dialog:selectAppFile", async () => {
    const mainWindow = getMainWindow();
    const options: any = {
        title: "Select Application",
        buttonLabel: "Select App",
        properties: ["openFile"],
        filters: [
            { name: "Executables", extensions: ["exe", "lnk", "app", "bat", "cmd"] },
            { name: "All Files", extensions: ["*"] }
        ]
    };

    const { canceled, filePaths } = mainWindow
        ? await dialog.showOpenDialog(mainWindow, options)
        : await dialog.showOpenDialog(options);
    
    if (!canceled && filePaths.length > 0) {
        return filePaths[0];
    }
    return null;
  });

  ipcMain.handle("dialog:selectFile", async () => {
    const mainWindow = getMainWindow();
    const options: any = {
      title: "Select File",
      buttonLabel: "Select File",
      properties: ["openFile"],
    };

    const { canceled, filePaths } = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);

    if (!canceled && filePaths.length > 0) {
      return filePaths[0];
    }
    return null;
  });
}
