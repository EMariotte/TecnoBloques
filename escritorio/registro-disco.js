// Registro de eventos en disco (contrato con TecnoCircuito, sección 6.1). Solo lo usa el proceso principal: la
// página nunca toca el disco. Guarda la configuración del instructor (encendido y PIN) y escribe una línea JSON
// por evento en <carpeta>/registros/<equipo>-<fecha>.jsonl. Se prueba con Node: test/registro.js.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { codigoParaArchivo, fechaArchivo } = require('../src/registro.js');

const LINEA_MAX = 2 * 1024 * 1024; // una línea con el circuito y el código completos cabe de sobra
const INTENTOS = 5; // PIN equivocado: después de 5 seguidos, espera un minuto
const ESPERA_MS = 60000;

function crearRegistroDisco({ carpeta, ahora = () => Date.now() }) {
  const archivoConfig = path.join(carpeta, 'registro-config.json');
  const registros = path.join(carpeta, 'registros');
  let fallidos = 0;
  let bloqueadoHasta = 0;

  function leer() {
    try { return JSON.parse(fs.readFileSync(archivoConfig, 'utf8')); } catch (e) { return { activo: false, pin: null }; }
  }
  function guardar(c) {
    fs.mkdirSync(carpeta, { recursive: true });
    fs.writeFileSync(archivoConfig, JSON.stringify(c, null, 1));
  }
  const resumen = (pin) => {
    const sal = crypto.randomBytes(16).toString('hex');
    return { sal, hash: crypto.scryptSync(String(pin), sal, 32).toString('hex') };
  };
  const pinValido = (pin) => typeof pin === 'string' && /^\d{4,8}$/.test(pin);
  function comprobar(pin) {
    const c = leer();
    if (!c.pin) return { ok: false, motivo: 'sin-pin' };
    if (ahora() < bloqueadoHasta) return { ok: false, motivo: 'espera', segundos: Math.ceil((bloqueadoHasta - ahora()) / 1000) };
    const esperado = Buffer.from(c.pin.hash, 'hex');
    const dado = crypto.scryptSync(String(pin || ''), c.pin.sal, 32);
    if (esperado.length === dado.length && crypto.timingSafeEqual(esperado, dado)) { fallidos = 0; return { ok: true, config: c }; }
    if (++fallidos >= INTENTOS) { fallidos = 0; bloqueadoHasta = ahora() + ESPERA_MS; }
    return { ok: false, motivo: 'pin' };
  }

  return {
    carpeta: registros,
    /** Lo que puede saber la página sin PIN: si el registro está encendido y si ya hay PIN. */
    estado() {
      const c = leer();
      return { activo: !!c.activo, tienePin: !!c.pin };
    },
    /**
     * Lo que pide el instructor. accion: 'crear-pin' (solo si no hay), 'entrar', 'activar' ({activo}),
     * 'cambiar-pin' ({nuevoPin}). Todas menos 'crear-pin' piden el PIN.
     */
    instructor({ accion, pin, nuevoPin, activo } = {}) {
      if (accion === 'crear-pin') {
        if (leer().pin) return { ok: false, motivo: 'ya-hay-pin' };
        if (!pinValido(pin)) return { ok: false, motivo: 'pin-invalido' };
        guardar({ activo: false, pin: resumen(pin) });
        return { ok: true, ...this.estado() };
      }
      const r = comprobar(pin);
      if (!r.ok) return r;
      if (accion === 'activar') guardar({ ...r.config, activo: !!activo });
      else if (accion === 'cambiar-pin') {
        if (!pinValido(nuevoPin)) return { ok: false, motivo: 'pin-invalido' };
        guardar({ ...r.config, pin: resumen(nuevoPin) });
      } else if (accion !== 'entrar') return { ok: false, motivo: 'accion' };
      return { ok: true, ...this.estado(), archivos: this.archivos().length };
    },
    /** Escribe una línea. Con el registro apagado, o una línea que no es un evento con equipo, no escribe nada. */
    escribir(linea) {
      if (!leer().activo) return false;
      if (!linea || typeof linea !== 'object' || typeof linea.equipo !== 'string' || !linea.equipo.trim() || typeof linea.tipo !== 'string') return false;
      const texto = JSON.stringify(linea);
      if (texto.length > LINEA_MAX) return false;
      fs.mkdirSync(registros, { recursive: true });
      const nombre = `${codigoParaArchivo(linea.equipo)}-${fechaArchivo(typeof linea.t === 'number' ? linea.t : ahora())}.jsonl`;
      fs.appendFileSync(path.join(registros, nombre), texto + '\n');
      return true;
    },
    archivos() {
      try { return fs.readdirSync(registros).filter((f) => f.endsWith('.jsonl')); } catch (e) { return []; }
    },
    /** Copia los .jsonl a una carpeta nueva dentro de `destino`. Pide el PIN. */
    exportar({ pin, destino }) {
      const r = comprobar(pin);
      if (!r.ok) return r;
      const archivos = this.archivos();
      if (!archivos.length) return { ok: false, motivo: 'sin-archivos' };
      const d = new Date(ahora());
      const sello = `${fechaArchivo(ahora())}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
      const carpetaDestino = path.join(destino, `TecnoBloques-registros-${sello}`);
      fs.mkdirSync(carpetaDestino, { recursive: true });
      for (const f of archivos) fs.copyFileSync(path.join(registros, f), path.join(carpetaDestino, f));
      return { ok: true, carpeta: carpetaDestino, archivos: archivos.length };
    },
  };
}

module.exports = { crearRegistroDisco };
