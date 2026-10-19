// Puente entre el editor (página web) y la app: solo expone estas funciones, nada más de Node.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tbEscritorio', {
  info: () => ipcRenderer.invoke('tb:info'),
  puertos: () => ipcRenderer.invoke('tb:puertos'),
  preferirPuerto: (p) => ipcRenderer.invoke('tb:preferir-puerto', p),
  cancelar: () => ipcRenderer.invoke('tb:cancelar'),
  alActualizacion: (fn) => { ipcRenderer.on('tb:actualizacion', (_e, d) => fn(d)); },
  /** datos = {codigo, fqbn, puerto, soloCompilar} → {ok, etapa, salida, memoria} */
  subir: (datos) => ipcRenderer.invoke('tb:subir', datos),
  /** datos = {codigo, fqbn} → {ok, etapa, salida, memoria, hex}: compila sin subir, para el simulador */
  compilarHex: (datos) => ipcRenderer.invoke('tb:compilar-hex', datos),
  /** Registro de eventos por equipo (contrato con TecnoCircuito, sección 6.1) */
  registro: {
    estado: () => ipcRenderer.invoke('tb:registro-estado'),
    /** {accion: 'crear-pin' | 'entrar' | 'activar' | 'cambiar-pin' | 'reintentar', pin, nuevoPin, activo} */
    instructor: (peticion) => ipcRenderer.invoke('tb:registro-instructor', peticion),
    exportar: (pin) => ipcRenderer.invoke('tb:registro-exportar', { pin }),
    escribir: (linea) => ipcRenderer.send('tb:registrar', linea),
    /** fn({falla, fin}): falla = {motivo, desde, pendientes, perdidos} o null; fin = 'escrito' | 'apagado' al terminar */
    alFalla: (fn) => { ipcRenderer.on('tb:registro-falla', (_e, d) => fn(d)); },
  },
  alProgreso: (fn) => {
    const h = (_e, m) => fn(m);
    ipcRenderer.on('tb:progreso', h);
    return () => ipcRenderer.removeListener('tb:progreso', h);
  }
});
