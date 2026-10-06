// TecnoBloques escritorio — ventana de Electron que abre el mismo editor (dist/TecnoBloques.html)
// y le agrega lo que el navegador no puede: compilar y subir con arduino-cli.
'use strict';
const { app, BrowserWindow, ipcMain, session, shell, dialog, Menu } = require('electron');
const path = require('path');
const { Arduino } = require('./arduino');

const recursos = app.isPackaged ? process.resourcesPath : path.join(__dirname, 'recursos');
const arduino = new Arduino({ recursos, trabajo: path.join(app.getPath('userData'), 'arduino') });
let ventana = null;
let puertoPreferido = null; // lo elige el aprendiz en el editor; lo usa el monitor serial (Web Serial)
let ocupado = false;

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (ventana) { if (ventana.isMinimized()) ventana.restore(); ventana.focus(); } });

function crearVentana() {
  ventana = new BrowserWindow({
    width: 1366, height: 860, minWidth: 900, minHeight: 600,
    title: 'TecnoBloques', backgroundColor: '#eef1ec', show: false,
    icon: path.join(__dirname, process.platform === 'win32' ? 'icono.ico' : 'icono.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  Menu.setApplicationMenu(null);
  ventana.loadFile(path.join(__dirname, '..', 'dist', 'TecnoBloques.html'));
  ventana.once('ready-to-show', () => ventana.show());
  // Enlaces externos en el navegador, nunca dentro de la app
  ventana.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  ventana.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); } });
  // F12 abre las herramientas de desarrollo (para el instructor)
  ventana.webContents.on('before-input-event', (e, input) => { if (input.type === 'keyDown' && input.key === 'F12') ventana.webContents.toggleDevTools(); });
}

function configurarSerial() {
  const s = session.defaultSession;
  // El monitor serial del editor usa Web Serial: aquí se elige solo el puerto que el aprendiz escogió en el editor
  s.on('select-serial-port', (evento, lista, _wc, responder) => {
    evento.preventDefault();
    const elegido = lista.find(p => p.portName === puertoPreferido) || (lista.length === 1 ? lista[0] : null);
    responder(elegido ? elegido.portId : '');
  });
  s.setPermissionCheckHandler((_wc, permiso) => permiso === 'serial' || permiso === 'clipboard-sanitized-write' || permiso === 'clipboard-read');
  s.setDevicePermissionHandler((d) => d.deviceType === 'serial');
}

ipcMain.handle('tb:info', () => ({
  version: app.getVersion(), arduino: arduino.ubicacion ? arduino.ubicacion.origen : null, empaquetada: app.isPackaged
}));
ipcMain.handle('tb:puertos', () => arduino.puertos());
ipcMain.handle('tb:cancelar', () => arduino.cancelar());
ipcMain.handle('tb:preferir-puerto', (_e, p) => { puertoPreferido = p || null; return true; });
ipcMain.handle('tb:subir', async (e, datos) => {
  if (ocupado) return { ok: false, etapa: 'ocupado', salida: 'Ya se está compilando o subiendo un programa.' };
  if (!arduino.disponible()) return { ok: false, etapa: 'sin-arduino', salida: 'No se encontró arduino-cli.' };
  ocupado = true;
  try {
    return await arduino.subir(datos, (m) => { if (!e.sender.isDestroyed()) e.sender.send('tb:progreso', m); });
  } finally { ocupado = false; }
});

/* ---------- Actualización automática desde GitHub Releases ---------- */
function buscarActualizacion() {
  if (!app.isPackaged) return;
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); } catch (e) { return; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-downloaded', async (info) => {
    const r = await dialog.showMessageBox(ventana, {
      type: 'info', title: 'TecnoBloques', buttons: ['Reiniciar ahora', 'Más tarde'], defaultId: 0, cancelId: 1,
      message: `Hay una versión nueva de TecnoBloques (${info.version}).`,
      detail: 'Ya se descargó. Si eliges "Más tarde", se instala sola cuando cierres la app. Guarda tu proyecto antes de reiniciar.'
    });
    if (r.response === 0) autoUpdater.quitAndInstall();
  });
  autoUpdater.on('error', () => { /* sin internet o sin versiones publicadas: no molestar */ });
  autoUpdater.checkForUpdates().catch(() => {});
}

app.whenReady().then(() => {
  configurarSerial();
  crearVentana();
  setTimeout(buscarActualizacion, 5000);
});
app.on('window-all-closed', () => app.quit());
