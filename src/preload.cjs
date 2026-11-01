const { contextBridge, ipcRenderer } = require('electron');

// Keep in sync with ACTIONS in src/main.js. Each call resolves to { ok, data } or { ok: false, code, message }.
const ACTIONS = ['getState', 'previewExpense', 'createAccount', 'setup', 'addExpense', 'addIncome', 'addTransfer', 'setGoal', 'checkBalance'];
contextBridge.exposeInMainWorld('margine', Object.fromEntries(ACTIONS.map((n) => [n, (arg) => ipcRenderer.invoke(n, arg)])));
