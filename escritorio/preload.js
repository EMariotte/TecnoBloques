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
    /**
     * fn({cantidad, anotados, pendientes, sinAnotar, ultimo: {tipo, motivo, t}, sesiones}): un evento no se pudo guardar
     * (AUD-07). Su evento_descartado está anotado (escrito), pendiente (espera al disco) o sin anotar; `sesiones`, por
     * sesión. La cuenta es desde que se abrió la app.
     */
    alDescarte: (fn) => { ipcRenderer.on('tb:registro-descartado', (_e, d) => fn(d)); },
  },
  /**
   * Estudio A/B (EST-002, I2). estado() → {variante: 'C0' | 'A' | 'B', hayClase, hayLista, grupos, danado}, sin PIN.
   * entrar({clase, grupo}) → {ok, equipo} o {ok: false, motivo, mensaje}. Para cambiarlo, registro.instructor con
   * accion 'estudio-ver' | 'estudio-variante' {variante} | 'estudio-lista' {lista} | 'estudio-clase' {codigo} | 'estudio-reiniciar'.
   */
  estudio: {
    estado: () => ipcRenderer.invoke('tb:estudio'),
    entrar: (datos) => ipcRenderer.invoke('tb:estudio-entrar', datos),
  },
  alProgreso: (fn) => {
    const h = (_e, m) => fn(m);
    ipcRenderer.on('tb:progreso', h);
    return () => ipcRenderer.removeListener('tb:progreso', h);
  }
});
