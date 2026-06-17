const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const startUrl = process.env.ELECTRON_START_URL;

  if (startUrl) {
    win.loadURL(startUrl);
    return;
  }

  const fornecedoresHtml = path.join(__dirname, "../dist/fornecedores/index.html");
  const mainHtml = path.join(__dirname, "../dist/index.html");

  if (fs.existsSync(fornecedoresHtml)) {
    win.loadFile(fornecedoresHtml);
    return;
  }

  if (fs.existsSync(mainHtml)) {
    win.loadFile(mainHtml);
    return;
  }

  win.loadURL("data:text/html;charset=utf-8,<h2>Build output não encontrado</h2><p>Falta dist/index.html</p>");
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});