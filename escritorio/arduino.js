// TecnoBloques escritorio — compilar y subir con arduino-cli.
// Módulo de Node sin Electron, para poder probarlo solo: node escritorio/prueba-arduino.js
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Dónde está arduino-cli y sus datos (núcleo AVR + librerías).
 * 1) El paquete que trae la app (resources/arduino o escritorio/recursos/arduino en desarrollo).
 * 2) La variable ARDUINO_CLI.
 * 3) El arduino-cli del Arduino IDE 2 (usa los datos del IDE).
 */
function ubicarArduino(recursos) {
  const paquete = recursos && path.join(recursos, 'arduino');
  if (paquete && fs.existsSync(path.join(paquete, 'arduino-cli.exe'))) {
    return {
      cli: path.join(paquete, 'arduino-cli.exe'),
      env: { ARDUINO_DIRECTORIES_DATA: path.join(paquete, 'datos'), ARDUINO_DIRECTORIES_USER: path.join(paquete, 'usuario') },
      origen: 'paquete'
    };
  }
  if (process.env.ARDUINO_CLI && fs.existsSync(process.env.ARDUINO_CLI)) return { cli: process.env.ARDUINO_CLI, env: {}, origen: 'ARDUINO_CLI' };
  const ide = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Arduino IDE', 'resources', 'app', 'lib', 'backend', 'resources', 'arduino-cli.exe');
  if (fs.existsSync(ide)) return { cli: ide, env: {}, origen: 'Arduino IDE' };
  return null;
}

class Arduino {
  /** @param {{recursos?: string, trabajo?: string}} op  trabajo = carpeta escribible para el boceto y la compilación */
  constructor(op) {
    this.ubicacion = ubicarArduino(op.recursos);
    this.trabajo = op.trabajo || path.join(os.tmpdir(), 'TecnoBloques');
  }
  disponible() { return !!this.ubicacion; }

  /** Ejecuta arduino-cli y devuelve {codigo, salida}. `alSalir` recibe cada trozo de texto (para mostrar avance). */
  correr(args, alSalir) {
    return new Promise((resolver) => {
      if (!this.ubicacion) { resolver({ codigo: -1, salida: 'No se encontró arduino-cli.' }); return; }
      const env = Object.assign({}, process.env, this.ubicacion.env, {
        ARDUINO_BUILD_CACHE_PATH: path.join(this.trabajo, 'cache'),
        ARDUINO_UPDATER_ENABLE_NOTIFICATION: 'false',
        ARDUINO_LOCALE: 'en' // los errores se traducen aquí; en inglés son predecibles
      });
      let salida = '';
      let p;
      try {
        p = spawn(this.ubicacion.cli, args.concat(['--no-color']), { env, windowsHide: true });
      } catch (e) { resolver({ codigo: -1, salida: e.message }); return; }
      const tomar = (d) => { const t = d.toString(); salida += t; if (alSalir) alSalir(t); };
      p.stdout.on('data', tomar);
      p.stderr.on('data', tomar);
      p.on('error', (e) => { salida += e.message; });
      p.on('close', (codigo) => resolver({ codigo, salida }));
    });
  }

  /** Puertos serie con lo que se sabe de la placa conectada. */
  async puertos() {
    const r = await this.correr(['board', 'list', '--format', 'json']);
    if (r.codigo !== 0) return { ok: false, puertos: [], salida: r.salida };
    let datos;
    try { datos = JSON.parse(r.salida); } catch (e) { return { ok: false, puertos: [], salida: r.salida }; }
    const lista = (datos.detected_ports || datos.ports || datos || []);
    const puertos = (Array.isArray(lista) ? lista : []).map((d) => {
      const port = d.port || d;
      if (!port || port.protocol !== 'serial') return null;
      const props = port.properties || {};
      const vid = String(props.vid || '').toLowerCase().replace('0x', '');
      const placa = (d.matching_boards || [])[0];
      return {
        direccion: port.address,
        nombre: placa ? placa.name : nombrePorVid(vid),
        fqbn: placa ? placa.fqbn : null,
        usb: !!vid
      };
    }).filter(Boolean);
    return { ok: true, puertos };
  }

  /** Escribe el boceto, compila y (si hay puerto) sube. `progreso` recibe {etapa, texto}. */
  async subir({ codigo, fqbn, puerto, soloCompilar }, progreso) {
    const aviso = (etapa, texto) => progreso && progreso({ etapa, texto });
    const carpeta = path.join(this.trabajo, 'TecnoBloques');
    const build = path.join(this.trabajo, 'build', fqbn.replace(/[^a-z0-9]+/gi, '_'));
    fs.mkdirSync(carpeta, { recursive: true });
    fs.mkdirSync(build, { recursive: true });
    fs.writeFileSync(path.join(carpeta, 'TecnoBloques.ino'), codigo, 'utf8');

    aviso('compilar', '');
    const c = await this.correr(['compile', '--fqbn', fqbn, '--build-path', build, '--warnings', 'default', carpeta], (t) => aviso('compilar', t));
    const memoria = leerMemoria(c.salida);
    if (c.codigo !== 0) return { ok: false, etapa: 'compilar', salida: c.salida, memoria };
    if (soloCompilar || !puerto) return { ok: true, etapa: 'compilar', salida: c.salida, memoria };

    aviso('subir', '');
    const s = await this.correr(['upload', '-p', puerto, '--fqbn', fqbn, '--input-dir', build, carpeta], (t) => aviso('subir', t));
    return { ok: s.codigo === 0, etapa: 'subir', salida: c.salida + '\n' + s.salida, memoria };
  }
}

function nombrePorVid(vid) {
  return { '1a86': 'placa con chip CH340 (clon)', 2341: 'Arduino', '2a03': 'Arduino', '0403': 'placa con chip FTDI', '10c4': 'placa con chip CP210x' }[vid] || 'dispositivo serie';
}

/** "Sketch uses 3452 bytes (10%)…" → {flash: 10, ram: 13} */
function leerMemoria(t) {
  const f = /Sketch uses \d+ bytes \((\d+)%\)/.exec(t);
  const r = /Global variables use \d+ bytes \((\d+)%\)/.exec(t);
  return { flash: f ? Number(f[1]) : null, ram: r ? Number(r[1]) : null };
}

module.exports = { Arduino, ubicarArduino, leerMemoria };
