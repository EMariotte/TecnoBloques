// Revisa lo que se va a distribuir (DIST-003, verificación de Codex del 1 nov): una carpeta win-unpacked, que es lo
// mismo que lleva el instalador. No puede llevar el inventario de la instalación de Arduino del PC donde se armó (su
// id y su secreto) ni sus cachés de descargas (F02), y el NOTICE tiene que nombrar avr8js, que va dentro de
// TecnoCircuito (F01). Lo usa empaquetar.js después de armar; también se corre a mano:
//   node escritorio/revisar-paquete.js <carpeta win-unpacked>
'use strict';
const fs = require('fs');
const path = require('path');

function revisarPaquete(winUnpacked) {
  const recursos = path.join(winUnpacked, 'resources');
  const problemas = [];
  for (const rel of ['arduino/datos/inventory.yaml', 'arduino/datos/staging', 'arduino/datos/tmp']) {
    if (fs.existsSync(path.join(recursos, rel))) problemas.push(`lleva ${rel} (datos de la instalación de Arduino del PC donde se armó)`);
  }
  (function revisar(dir) {
    if (!fs.existsSync(dir)) return problemas.push('no trae resources/arduino');
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) revisar(f);
      else if (/\.ya?ml$/i.test(e.name) && /^\s*secret\s*:/m.test(fs.readFileSync(f, 'utf8'))) problemas.push(`${path.relative(recursos, f)} tiene un campo «secret»`);
    }
  })(path.join(recursos, 'arduino'));
  let notice = '';
  try { notice = require('@electron/asar').extractFile(path.join(recursos, 'app.asar'), 'NOTICE').toString(); } catch (e) { /* abajo */ }
  if (!/avr8js/.test(notice) || !/MIT/.test(notice)) problemas.push('el NOTICE no nombra avr8js (MIT)');
  return problemas;
}

if (require.main === module) {
  const dir = process.argv[2];
  if (!dir) { console.error('Uso: node escritorio/revisar-paquete.js <carpeta win-unpacked>'); process.exit(2); }
  const problemas = revisarPaquete(dir);
  if (problemas.length) { console.error('No se puede distribuir así:\n- ' + problemas.join('\n- ')); process.exit(1); }
  console.log('Contenido revisado: sin inventario ni cachés de Arduino del PC, y el NOTICE nombra avr8js.');
}

module.exports = { revisarPaquete };
