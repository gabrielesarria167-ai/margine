import { app, BrowserWindow, dialog, ipcMain, nativeTheme } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, LedgerError } from './db.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
// Keep in sync with src/preload.cjs (a sandboxed preload cannot import this file).
const ACTIONS = ['getState', 'createAccount', 'setup', 'addExpense', 'addIncome', 'addTransfer', 'addCategory', 'renameCategory', 'deleteCategory', 'setGoal', 'checkBalance'];
let db;

// One writer per database. app.quit() is not immediate, so a second instance must also skip start-up below.
const primary = app.requestSingleInstanceLock();
if (!primary) app.quit();
app.commandLine.appendSwitch('lang', 'it-IT'); // Italian date inputs and number pickers, whatever the system locale

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 960, minHeight: 640,
    show: false,
    title: 'Margine',
    icon: path.join(dir, 'renderer', 'logo.png'), // Windows/Linux window icon; macOS uses the bundle icon
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1C1E20' : '#ECEDE9', // matches --canvas, avoids a flash
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 18, y: 18 } } : {}),
    webPreferences: { preload: path.join(dir, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(dir, 'renderer', 'index.html'));
}

app.on('second-instance', () => {
  const [win] = BrowserWindow.getAllWindows();
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

if (primary) app.whenReady().then(() => {
  if (!app.isPackaged) app.dock?.setIcon(path.join(dir, '..', 'build', 'icon.png')); // dev only: packaged builds get build/icon.* from electron-builder
  db = openDb(path.join(app.getPath('userData'), 'margine.db'));
  for (const name of ACTIONS) {
    ipcMain.handle(name, (_e, arg) => {
      try { return { ok: true, data: db[name](arg) }; }
      catch (e) {
        if (e instanceof LedgerError) return { ok: false, code: e.code, message: e.message };
        console.error(e);
        return { ok: false, code: 'INTERNAL', message: 'Errore imprevisto. I dati non sono stati modificati.' };
      }
    });
  }
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
}).catch((e) => { // without this a broken database means no window and no message
  console.error(e);
  dialog.showErrorBox('Margine non si apre', e.message);
  app.quit();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('will-quit', () => db?.close());
