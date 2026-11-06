// Contraste del verde de la interfaz (UX-004): lee las variables de src/style.css en el tema claro y en el oscuro
// y comprueba cada pareja donde entra --accent. Texto normal pide 4,5:1 (WCAG 2.2, 1.4.3); bordes, foco y puntos,
// 3:1 (1.4.11). El logotipo (.marca .bloques, .acerca-marca) está exento, pero se mide igual. No usa navegador:
// si una regla nueva usa --accent sobre otro fondo, hay que sumarla aquí.
// Uso: npm run test:contraste
'use strict';
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'style.css'), 'utf8');
let fallos = 0;
function revisar(condicion, texto) {
  console.log((condicion ? 'OK    ' : 'FALLA ') + texto);
  if (!condicion) fallos++;
}

function variables(selector) {
  const i = css.indexOf(selector + ' {');
  if (i < 0) throw new Error('No está el bloque ' + selector);
  const bloque = css.slice(i, css.indexOf('}', i));
  const v = {};
  for (const m of bloque.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) v[m[1]] = m[2].toLowerCase();
  return v;
}
function luminancia(hex) {
  const c = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function relacion(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// [texto o trazo, fondo, mínimo, dónde]
const PAREJAS = [
  ['accent-ink', 'accent', 4.5, 'botón principal (.btn.primario) y opción elegida (.segmentado)'],
  ['accent', 'accent-soft', 4.5, 'estado serial conectado (.estado-serial.on)'],
  ['accent', 'code-bg', 4.5, 'mensajes enviados del monitor y del simulador (.enviado)'],
  ['accent', 'panel', 4.5, 'texto verde sobre el panel (firma de TecnoCircuito)'],
  ['accent', 'bg', 3, 'foco (:focus-visible) y bordes en hover sobre el fondo'],
  ['accent', 'panel', 3, 'foco, divisor y puntos sobre el panel'],
  ['accent', 'panel-2', 3, 'foco y bordes sobre el panel secundario']
];

const TEMAS = [['claro', variables(':root')], ['oscuro', variables(':root[data-theme="dark"]')]];
for (const [tema, v] of TEMAS) {
  for (const [frente, fondo, minimo, donde] of PAREJAS) {
    if (!v[frente] || !v[fondo]) { revisar(false, `${tema}: faltan --${frente} o --${fondo}`); continue; }
    const r = relacion(v[frente], v[fondo]);
    revisar(r >= minimo, `${tema}: ${donde}: --${frente} ${v[frente]} sobre --${fondo} ${v[fondo]} = ${r.toFixed(2)}:1 (pide ${minimo}:1)`);
  }
}

// El tema oscuro por preferencia del sistema repite los valores de [data-theme="dark"]
const sistema = (() => {
  const i = css.indexOf('@media (prefers-color-scheme: dark)');
  const j = css.indexOf(':root:not([data-theme="light"]) {', i);
  const bloque = css.slice(j, css.indexOf('}', j));
  const v = {};
  for (const m of bloque.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) v[m[1]] = m[2].toLowerCase();
  return v;
})();
const oscuro = TEMAS[1][1];
revisar(['accent', 'accent-soft', 'accent-ink', 'bg', 'panel', 'panel-2', 'code-bg'].every((k) => sistema[k] === oscuro[k]),
  'el oscuro del sistema y el elegido a mano usan los mismos colores');

console.log(fallos ? `\n${fallos} falla(s)` : '\nTodo en verde');
process.exit(fallos ? 1 : 0);
