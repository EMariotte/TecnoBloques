// TecnoBloques escritorio — ventana de Electron que abre el mismo editor (dist/TecnoBloques.html)
// y le agrega lo que el navegador no puede: compilar y subir con arduino-cli.
'use strict';
const { app, BrowserWindow, ipcMain, session, shell, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { Arduino } = require('./arduino');
const { crearRegistroDisco } = require('./registro-disco');

const recursos = app.isPackaged ? process.resourcesPath : path.join(__dirname, 'recursos');
const arduino = new Arduino({ recursos, trabajo: path.join(app.getPath('userData'), 'arduino') });
// Registro de eventos por equipo: %APPDATA%\TecnoBloques\registros\ (contrato con TecnoCircuito, sección 6.1). Si el
// disco falla, la página lo sabe por tb:registro-falla y lo muestra (AUD-02); si un evento no se puede guardar, por
// tb:registro-descartado (AUD-07).
const registroEventos = crearRegistroDisco({
  carpeta: app.getPath('userData'),
  version: app.getVersion(),
  alCambiar: (falla, fin) => { if (ventana && !ventana.isDestroyed()) ventana.webContents.send('tb:registro-falla', { falla, fin }); },
  alDescartar: (descartados) => { if (ventana && !ventana.isDestroyed()) ventana.webContents.send('tb:registro-descartado', descartados); }
});
let ventana = null;
let puertoPreferido = null; // lo elige el aprendiz en el editor; lo usa el monitor serial (Web Serial)
let ocupado = false;
// Herramientas de desarrollo (F12): con ellas se podría apagar el registro desde la consola. En la app instalada
// solo se abren después de que el instructor entra con su PIN en esta sesión. En desarrollo quedan libres, salvo con
// TB_HERRAMIENTAS=instructor (así lo prueba test/registro-app.js); la variable solo restringe, nunca abre.
const herramientasLibres = !app.isPackaged && process.env.TB_HERRAMIENTAS !== 'instructor';
let instructorAutorizado = false;
const puedeAbrirHerramientas = () => herramientasLibres || instructorAutorizado;

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
  // F12 abre las herramientas de desarrollo, solo para el instructor (ver puedeAbrirHerramientas)
  ventana.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F12' && puedeAbrirHerramientas()) ventana.webContents.toggleDevTools();
  });
  // Si se abrieran por otro camino, se cierran. Electron avisa devtools-opened cuando terminan de cargar (de 0,4 a más
  // de 0,8 s con el PC lento), pero se ven y se pueden usar desde antes: mientras no haya PIN, un vigía las cierra en
  // cuanto aparecen (AUD-06). Con el PIN, el vigía se apaga hasta cerrar la app.
  ventana.webContents.on('devtools-opened', () => { if (!puedeAbrirHerramientas()) ventana.webContents.closeDevTools(); });
  const esta = ventana;
  const vigia = setInterval(() => {
    if (puedeAbrirHerramientas() || esta.isDestroyed()) clearInterval(vigia);
    else if (esta.webContents.isDevToolsOpened()) esta.webContents.closeDevTools();
  }, 50);
  esta.on('closed', () => clearInterval(vigia));
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
// Simulador TecnoCircuito: compila sin subir y devuelve el .hex (contrato con TecnoCircuito, sección 5).
ipcMain.handle('tb:compilar-hex', async (e, datos) => {
  if (ocupado) return { ok: false, etapa: 'ocupado', salida: 'Ya se está compilando o subiendo un programa.' };
  if (!arduino.disponible()) return { ok: false, etapa: 'sin-arduino', salida: 'No se encontró arduino-cli.' };
  ocupado = true;
  try {
    return await arduino.compilarHex(datos, (m) => { if (!e.sender.isDestroyed()) e.sender.send('tb:progreso', m); });
  } finally { ocupado = false; }
});

/* ---------- Registro de eventos (apagado por defecto; lo enciende el instructor con su PIN) ---------- */
// Ningún dato del registro (una configuración dañada, por ejemplo) debe tumbar un manejador del IPC (AUD-11)
ipcMain.handle('tb:registro-estado', () => { try { return registroEventos.estado(); } catch (e) { return { activo: false, tienePin: false, falla: { motivo: 'CONFIG', desde: Date.now(), pendientes: 0, perdidos: 0 }, configIlegible: true, descartados: null }; } });
ipcMain.handle('tb:registro-instructor', (_e, peticion) => {
  let r;
  try { r = registroEventos.instructor(peticion || {}); } catch (e) { return { ok: false, motivo: 'disco', mensaje: e.message }; }
  if (r.ok) instructorAutorizado = true; // el PIN correcto también habilita F12 hasta cerrar la app
  return r;
});
ipcMain.handle('tb:registro-exportar', async (_e, { pin } = {}) => {
  const r = await dialog.showOpenDialog(ventana, { title: 'Elige dónde copiar los registros (por ejemplo, la USB)', properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0]) return { ok: false, motivo: 'cancelado' };
  try { return registroEventos.exportar({ pin, destino: r.filePaths[0] }); } catch (e) { return { ok: false, motivo: 'disco', mensaje: e.message }; }
});
// Una línea por evento, en orden: send (no invoke) para que el último evento salga aunque la ventana se esté cerrando.
// escribir() no lanza: si el disco falla, la línea espera y la página recibe tb:registro-falla; si la línea no se puede
// guardar, queda su evento_descartado y la página recibe tb:registro-descartado (AUD-07).
ipcMain.on('tb:registrar', (_e, linea) => { try { registroEventos.escribir(linea); } catch (e) { console.error('registro:', e); } });

/* ---------- Actualización automática desde GitHub Releases ---------- */
// Registro de la actualización: %APPDATA%\TecnoBloques\registro-actualizacion.txt (se reinicia si pasa de 1 MB)
function registro(nivel, ...partes) {
  try {
    const archivo = path.join(app.getPath('userData'), 'registro-actualizacion.txt');
    if (fs.existsSync(archivo) && fs.statSync(archivo).size > 1048576) fs.writeFileSync(archivo, '');
    const texto = partes.map(p => (p instanceof Error ? (p.stack || p.message) : typeof p === 'string' ? p : JSON.stringify(p))).join(' ');
    fs.appendFileSync(archivo, `${new Date().toISOString()} [${nivel}] ${texto}\n`);
  } catch (e) { /* sin permiso de escritura: no molestar */ }
}
/** Avisa al editor cómo va la actualización (muestra un aviso discreto abajo). */
function avisarEditor(datos) { if (ventana && !ventana.isDestroyed()) ventana.webContents.send('tb:actualizacion', datos); }

function buscarActualizacion() {
  if (!app.isPackaged) return;
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); } catch (e) { registro('error', 'No se pudo cargar electron-updater', e); return; }
  autoUpdater.logger = {
    info: (...a) => registro('info', ...a), warn: (...a) => registro('aviso', ...a),
    error: (...a) => registro('error', ...a), debug: () => {}
  };
  autoUpdater.disableWebInstaller = true;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  registro('info', `TecnoBloques ${app.getVersion()} busca versiones nuevas`);
  autoUpdater.on('update-available', (info) => avisarEditor({ estado: 'bajando', version: info.version, porcentaje: 0 }));
  let ultimo = -1;
  autoUpdater.on('download-progress', (p) => {
    const pc = Math.floor(p.percent || 0);
    if (pc !== ultimo) { ultimo = pc; avisarEditor({ estado: 'bajando', porcentaje: pc }); }
  });
  autoUpdater.on('update-downloaded', async (info) => {
    avisarEditor({ estado: 'lista', version: info.version });
    const r = await dialog.showMessageBox(ventana, {
      type: 'info', title: 'TecnoBloques', buttons: ['Reiniciar ahora', 'Más tarde'], defaultId: 0, cancelId: 1,
      message: `Hay una versión nueva de TecnoBloques (${info.version}).`,
      detail: 'Ya se descargó. Si eliges "Más tarde", se instala sola cuando cierres la app. Guarda tu proyecto antes de reiniciar.'
    });
    if (r.response === 0) autoUpdater.quitAndInstall();
  });
  // Sin internet o sin versiones publicadas: no se molesta al aprendiz, pero queda en el registro
  autoUpdater.on('error', (e) => { registro('error', e); avisarEditor({ estado: 'error' }); });
  autoUpdater.checkForUpdates().catch((e) => registro('error', e));
}

app.whenReady().then(() => {
  configurarSerial();
  crearVentana();
  setTimeout(buscarActualizacion, 5000);
});
app.on('window-all-closed', () => app.quit());
// Si el disco falló, un último intento de escribir lo que espera antes de cerrar.
app.on('will-quit', () => { try { registroEventos.reintentar(); } catch (e) { console.error('registro:', e); } });
