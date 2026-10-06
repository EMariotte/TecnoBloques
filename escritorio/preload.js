// Puente entre el editor (página web) y la app: solo expone estas funciones, nada más de Node.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tbEscritorio', {
  info: () => ipcRenderer.invoke('tb:info'),
  puertos: () => ipcRenderer.invoke('tb:puertos'),
  preferirPuerto: (p) => ipcRenderer.invoke('tb:preferir-puerto', p),
  cancelar: () => ipcRenderer.invoke('tb:cancelar'),
  /** datos = {codigo, fqbn, puerto, soloCompilar} → {ok, etapa, salida, memoria} */
  subir: (datos) => ipcRenderer.invoke('tb:subir', datos),
  alProgreso: (fn) => {
    const h = (_e, m) => fn(m);
    ipcRenderer.on('tb:progreso', h);
    return () => ipcRenderer.removeListener('tb:progreso', h);
  }
});
