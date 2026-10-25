// Contrasta quitarComentarios (src/registro.js; el C++ del evento codigo_compilado, contrato con TecnoCircuito,
// sección 6.1) con el preprocesador real: avr-g++ -E -std=gnu++11, el mismo compilador y estándar de la placa.
// Por cada programa (casos fijos y miles al azar con una semilla fija) revisa tres cosas:
//   1. El compilador ve lo mismo: -E del original y -E del limpio dan los mismos símbolos.
//   2. No queda ningún comentario: -E -CC (que conserva los comentarios, también los de un #define) y -E del limpio
//      dan lo mismo.
//   3. El limpio tiene las mismas líneas que el original, y limpiarlo otra vez no lo cambia.
// Las tres usan -dD, que muestra cada #define aunque no se use (AUD-01-V3), y -undef. Para no mezclar los comentarios
// de las cabeceras del sistema, los #include van a cabeceras vacías de prueba (-nostdinc); aparte, los programas que
// compilan se compilan antes y después de limpiarlos con las cabeceras reales (-mmcu=atmega328p).
// Los espacios se comparan juntados en uno (-P no conserva la disposición); el texto exacto lo revisa test/registro.js.
// Una \ suelta justo antes de un comentario se separa del salto con un comentario vacío /**/ (si no, sería un
// empalme); es lo único que la revisión de comentarios deja pasar. No se disculpa ninguna otra diferencia.
// Solo datos sintéticos. Necesita el avr-gcc de escritorio/recursos/arduino (o AVR_GXX con la ruta de avr-g++).
// Uso: npm run test:registro-preprocesador   (CASOS=5000 y SEMILLA=7 cambian la parte al azar)
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { quitarComentarios } = require('../src/registro.js');

let fallos = 0;
function revisar(condicion, texto) {
  console.log((condicion ? 'OK    ' : 'FALLA ') + texto);
  if (!condicion) fallos++;
}

function buscarCompilador() {
  if (process.env.AVR_GXX) return process.env.AVR_GXX;
  const herramientas = path.join(__dirname, '..', 'escritorio', 'recursos', 'arduino', 'datos', 'packages', 'arduino', 'tools', 'avr-gcc');
  if (!fs.existsSync(herramientas)) return null;
  for (const version of fs.readdirSync(herramientas).sort().reverse()) {
    for (const nombre of ['avr-g++.exe', 'avr-g++']) {
      const ruta = path.join(herramientas, version, 'bin', nombre);
      if (fs.existsSync(ruta)) return ruta;
    }
  }
  return null;
}
const compilador = buscarCompilador();
if (!compilador || !fs.existsSync(compilador)) {
  console.log('NO EJECUTADA: falta avr-g++ (escritorio/recursos/arduino o AVR_GXX). No cuenta como aprobada.');
  process.exit(1);
}
const version = spawnSync(compilador, ['-dumpversion'], { encoding: 'utf8', windowsHide: true }).stdout.trim();
console.log(`Compilador: avr-g++ ${version} (-E -P -dD -undef -x c++ -std=gnu++11)`);

const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'tecnobloques-preprocesador-'));
// Las cabeceras vacías de prueba que pueden nombrar los #include de los casos y del generador.
for (const cabecera of ['avr/io.h', 'a/b.h']) {
  fs.mkdirSync(path.join(carpeta, path.dirname(cabecera)), { recursive: true });
  fs.writeFileSync(path.join(carpeta, cabecera), '');
}
const BASE = ['-x', 'c++', '-std=gnu++11', '-nostdinc', '-I.'];
const juntar = (s) => s.replace(/\s+/g, ' ').trim();
const lineas = (s) => (s.match(/\r\n|\r|\n/g) || []).length;

/** Preprocesa varios programas en una llamada: cada uno en su archivo, que empieza con su marca ARCHIVO_n. */
function preprocesar(programas, conComentarios) {
  const nombres = programas.map((p, n) => {
    const nombre = `p${n}.cpp`;
    fs.writeFileSync(path.join(carpeta, nombre), `ARCHIVO_${n}\n${p}`);
    return nombre;
  });
  const r = spawnSync(compilador, ['-E', '-P', '-dD', '-undef', ...(conComentarios ? ['-CC'] : []), ...BASE, ...nombres],
    { cwd: carpeta, encoding: 'utf8', windowsHide: true, maxBuffer: 256 * 1024 * 1024 });
  if (r.error) throw r.error;
  const partes = r.stdout.split(/ARCHIVO_(\d+)/);
  const salida = new Array(programas.length).fill(null);
  for (let k = 1; k < partes.length; k += 2) salida[Number(partes[k])] = partes[k + 1];
  if (salida.some((s) => s === null)) throw new Error('El compilador no devolvió todos los archivos:\n' + r.stderr.slice(0, 2000));
  return salida.map(juntar);
}

/** ¿Compila el programa para la placa (Uno), con las cabeceras reales? Devuelve el primer error, o '' si compila. */
function errorAlCompilar(programa) {
  const r = spawnSync(compilador, ['-fsyntax-only', '-x', 'c++', '-std=gnu++11', '-mmcu=atmega328p', '-'],
    { input: programa, encoding: 'utf8', windowsHide: true });
  if (r.error) throw r.error;
  return r.status === 0 ? '' : (r.stderr.split(/\r?\n/).find((l) => /error/.test(l)) || `salida ${r.status}`);
}

/** Revisa los tres puntos de arriba para cada programa; devuelve los que fallan, con el motivo. */
function contrastar(programas) {
  const fallan = [];
  for (let desde = 0; desde < programas.length; desde += 200) {
    const lote = programas.slice(desde, desde + 200);
    const limpios = lote.map(quitarComentarios);
    const original = preprocesar(lote, false);
    const limpio = preprocesar(limpios, false);
    const limpioC = preprocesar(limpios, true);
    lote.forEach((p, n) => {
      const motivos = [];
      if (original[n] !== limpio[n]) motivos.push('el compilador ve otra cosa');
      // El /**/ que separa una \ suelta del salto no lleva nada: se quita de los dos lados (también si está en un texto).
      const sinVacio = (s) => juntar(s.split('/**/').join(' '));
      if (sinVacio(limpioC[n]) !== sinVacio(limpio[n])) motivos.push('quedó un comentario');
      if (lineas(p) !== lineas(limpios[n])) motivos.push('cambió el número de líneas');
      // Limpiar otra vez lo limpio no lo cambia: la historia revisa así que el C++ del registro no tenga comentarios (REG-005, TB-1)
      if (quitarComentarios(limpios[n]) !== limpios[n]) motivos.push('limpiarlo otra vez lo cambia');
      if (motivos.length) fallan.push({ programa: p, limpio: limpios[n], motivos, original: original[n], preprocesadoLimpio: limpio[n], conComentarios: limpioC[n] });
    });
  }
  return fallan;
}

try {
  console.log('— Los casos del informe de auditoría (AUD-01) y sus vecinos');
  // [nombre, programa, marcas que deben salir (en comentarios), marcas que deben quedar (en textos)]
  const CASOS = [
    ['informe: /\\ y otra línea con / (LF)', 'int valor=1; /\\\n/ MARCADOR_PRIVADO_SINTETICO\n', ['MARCADOR'], []],
    ['informe: u8R"(…)" con una comilla adentro', 'const auto s = u8R"(a " b)"; // MARCADOR_PRIVADO_SINTETICO\n', ['MARCADOR'], ['u8R"(a " b)"']],
    ['/\\ y otra línea con / (CRLF)', 'int v=1; /\\\r\n/ CMUNO\r\nint w;\r\n', ['CMUNO'], []],
    ['/\\, espacios y otra línea con /', 'int v=1; /\\  \n/ CMUNO\nint w;\n', ['CMUNO'], []],
    ['/* y */ partidos por empalmes', 'int v; /\\\n* CMUNO *\\\n/ int w;\n', ['CMUNO'], []],
    ['*\\ y otra línea con / cierra el bloque', 'int v; /* CMUNO *\\\r\n/ int w; // CMDOS\n', ['CMUNO', 'CMDOS'], []],
    ['// con empalmes al final de dos líneas', 'int v; // CMUNO \\\n CMDOS \\\r\n CMTRES\nint w;\n', ['CMUNO', 'CMDOS', 'CMTRES'], []],
    ['un \\r solo termina el comentario', 'int v; // CMUNO\rint w = 2;\r', ['CMUNO'], []],
    ...['R', 'u8R', 'uR', 'UR', 'LR'].map((p) => [`${p}"(…)" con comilla, // y /* adentro`,
      `const auto s = ${p}"(a " // b /* c)"; // CMUNO\n`, ['CMUNO'], [`${p}"(a " // b /* c)"`]]),
    ['LR con marca y )" adentro', 'auto s = LR"x(a )" // b)x"; /* CMUNO */\n', ['CMUNO'], ['LR"x(a )" // b)x"']],
    ['un empalme dentro de un texto crudo es texto', 'auto s = R"(a \\\n// LTUNO)"; // CMUNO\n', ['CMUNO'], ['R"(a \\\n// LTUNO)"']],
    ['un nombre que termina en R no abre un texto crudo', 'auto s = xR"(a " // CMUNO)";\nint w;\n', ['CMUNO'], []],
    ['xx\\ y otra línea con R" es el nombre xxR', 'auto s = xx\\\nR"(a " // CMUNO)";\nint w;\n', ['CMUNO'], []],
    ['un número 1.R no abre un texto crudo', 'auto s = 1.R"(a " // CMUNO)";\nint w;\n', ['CMUNO'], []],
    ['$ no es parte de un nombre: a$R"(…)" es un texto crudo', 'auto s = a$R"(a " // LTUNO)"; // CMUNO\n', ['CMUNO'], ['R"(a " // LTUNO)"']],
    ['a$xR no abre un texto crudo', 'auto s = a$xR"(a " // CMUNO)";\nint w;\n', ['CMUNO'], []],
    ['un empalme dentro del prefijo: sigue siendo texto crudo', 'auto s = u8\\\nR"(a " b)"; // CMUNO\n', ['CMUNO'], ['R"(a " b)"']],
    ['un empalme entre R y la comilla: sigue siendo texto crudo', 'auto s = R\\\r\n"(a " b)"; // CMUNO\n', ['CMUNO'], ['"(a " b)"']],
    ['un empalme después de la comilla: no es texto crudo', 'auto s = R"\\\n(a " b)"; // LTUNO\n', [], ['// LTUNO']],
    ['empalmes con \\f y \\v antes del salto', 'int v; /\\\f\n/ CMUNO\nint w; /\\\v\r\n* CMDOS */\n', ['CMUNO', 'CMDOS'], []],
    ['el sufijo de un texto ("x"u8R) no abre un texto crudo', 'auto s = "x"u8R"(a " // CMUNO)";\nint w;\n', ['CMUNO'], []],
    ['el sufijo después de un empalme', 'auto s = "x"\\\nu8R"(a " // CMUNO)";\nint w;\n', ['CMUNO'], []],
    ['el sufijo de un carácter y de un texto crudo', "auto s = 'x'uR\"(a \" // CMUNO)\"; auto t = R\"(x)\"LR\"(a \" // CMDOS)\";\n", ['CMUNO', 'CMDOS'], []],
    ['un texto sin cerrar no tiene sufijo', 'auto s = "x\nu8R"(a " // LTUNO)"; // CMUNO\n', ['CMUNO'], ['u8R"(a " // LTUNO)"']],
    ['un \\r solo antes de un comentario y un \\n después', 'int v;\r// CMUNO\nint w;\r/* CMDOS\r */\nint z;\n', ['CMUNO', 'CMDOS'], []],
    ['una marca con espacio vuelve al texto común', 'auto s = R"a b(x)a b"; // CMUNO\nint z;\n', ['CMUNO'], ['"a b(x)a b"']],
    ['una marca de 17 vuelve al texto común', 'auto s = R"abcdefghijklmnopq(x)abcdefghijklmnopq"; // CMUNO\n', ['CMUNO'], []],
    ['una marca con tilde, $ o @ vuelve al texto común', 'auto s = a$R"á/*\'"; R"$(x " /* CMUNO)$"; R"@(x " // CMDOS)@";\n', ['CMUNO', 'CMDOS'], []],
    ['una marca con los signos que sí valen', 'auto s = R"#<>%:;.?*+-/^&|~(x " // LTUNO)#<>%:;.?*+-/^&|~"; auto t = R"!=,\'"_{}[](y " // LTDOS)!=,\'"_{}[]";\n', [], ['// LTUNO', '// LTDOS']],
    ['una marca de 16 es un texto crudo', 'auto s = R"abcdefghijklmnop(x // LTUNO)abcdefghijklmnop";\n', [], ['// LTUNO']],
    ['un texto partido por un empalme CRLF', 'char* t = "a\\\r\nb // LTUNO"; // CMUNO\r\n', ['CMUNO'], ['b // LTUNO"']],
    ['un carácter partido por un empalme', "char c = '\\\n/'; // CMUNO\n", ['CMUNO'], ["'\\\n/'"]],
    ['un escape partido por un empalme (\\ y \\" juntos)', 'char* t = "\\\\\n" // LTUNO"; // CMUNO\n', ['CMUNO'], ['// LTUNO"']],
    ['\\\\ y un empalme: el texto se cierra antes', 'char* t = "\\\\\n\\" // CMUNO"; int w;\n', ['CMUNO'], []],
    ['textos con tildes', 'Serial.println("Hola, Sofía /* LTUNO */"); // Calibración CMUNO\n', ['CMUNO', 'Calibración'], ['"Hola, Sofía /* LTUNO */"']],
    // AUD-01-V1 y V2: directivas. -dD muestra cada #define; -CC, sus comentarios.
    ['V1: #define con 1e\\ y otra línea con +R"(…" (LF)', '#define M 1e\\\n+R"(a " // CMUNO)"\nint main(){return 0;}\n', ['CMUNO'], []],
    ['V1: lo mismo con CRLF', '#define M 1e\\\r\n+R"(a " // CMUNO)"\r\nint main(){return 0;}\r\n', ['CMUNO'], []],
    ['V1: fuera de una directiva', 'auto x = 0x1p\\\n-LR"(a " // CMUNO)";\nint w;\n', ['CMUNO'], []],
    ['V2: /* */ de varias líneas dentro de un #define', '#define VALOR (1 /* CMUNO\n */ + 2)\nint dato = VALOR;\n', ['CMUNO'], []],
    ['V2: lo mismo con CRLF y dos saltos', '#define VALOR (1 /* CMUNO\r\n CMDOS \r\n */ + 2)\r\nint dato = VALOR;\r\n', ['CMUNO', 'CMDOS'], []],
    ['V2: #include <avr//io.h>', '#include <avr//io.h>\nint main(){return 0;}\n', [], ['<avr//io.h>']],
    ['#include con espacios, un comentario antes y otro después', '  #  include /* CMUNO */ <avr//io.h> // CMDOS\n', ['CMUNO', 'CMDOS'], ['<avr//io.h>']],
    ['#include "a//b.h" y %:include <a//b.h>', '#include "a//b.h" // CMUNO\n%:include <a//b.h>\n', ['CMUNO'], ['"a//b.h"', '<a//b.h>']],
    ['#include_next e #import', '#include_next <a//b.h> /* CMUNO */\n#import <a//b.h>\n', ['CMUNO'], ['#include_next <a//b.h>', '#import <a//b.h>']],
    ['< sin cerrar en un #include se lee como siempre', '#include <a // CMUNO\nint v;\n', ['CMUNO'], []],
    ['en un #define, < no es el nombre de un archivo', '#define MENOR(a, b) ((a) < (b)) // CMUNO\nint v = MENOR(1, 2) > 0;\n', ['CMUNO'], []],
    ['textos dentro de una macro: no son comentarios', '#define T "x // LTUNO"\n#define U R"(y " // LTDOS)" /* CMUNO */\nint main(){return 0;}\n', ['CMUNO'], ['"x // LTUNO"', 'R"(y " // LTDOS)"']],
    ['un // con empalme dentro de un #define', '#define K 1 // CMUNO \\\n CMDOS\nint k = K;\n', ['CMUNO', 'CMDOS'], []],
    ['un # en medio de la línea no se vuelve directiva', 'int a; /* CMUNO\n */ # define Z 1\nint z;\n', ['CMUNO'], []],
    ['un /* */ de varias líneas antes del # sigue siendo directiva', '/* CMUNO\n */ #define Y 2\nint y = Y;\n', ['CMUNO'], []],
    ['varios /* */ seguidos antes de un # del medio de la línea', 'int a; /* CMUNO\n */ /* CMDOS */ # define Z 1\nint z;\n', ['CMUNO', 'CMDOS'], []],
    ['un /* */ con un empalme, otro con CRLF y un #', 'LR# /* CMUNO \\\v\n *//* CMDOS\r\n */#\r\nint z;\n', ['CMUNO', 'CMDOS'], []],
    // En una directiva, un texto crudo no pasa de su línea (sí de un empalme): lo que sigue se lee como siempre.
    ['un texto crudo de varias líneas en un #define', '#define F R"x(abc\n// CMUNO\n)x"\nint z;\n', ['CMUNO'], []],
    ['lo mismo con CRLF y sin cerrar', '#define F R"x(abc\r\n// CMUNO\r\nint z;\r\n', ['CMUNO'], []],
    ['un texto crudo con empalme en un #define', '#define F R"x(abc\\\n// LTUNO\n// CMUNO\nint z;\n', ['CMUNO'], ['// LTUNO']],
    ['cerrado después del empalme, y un comentario', '#define F R"x(abc\\\nsigue)x" // CMUNO\nint z;\n', ['CMUNO'], ['R"x(abc\\\nsigue)x"']],
    ['fuera de una directiva sí pasa de línea', 'auto s = R"x(abc\n// LTUNO\n)x"; // CMUNO\n', ['CMUNO'], ['// LTUNO']],
    // Una \ suelta antes de un comentario: /**/ la separa del salto (antes se volvía un empalme).
    ['una \\ suelta antes de //', 'int a = 1; \\ // CMUNO\nint b;\n', ['CMUNO'], []],
    ['una \\ suelta antes de un /* */ con salto', 'int a = 1; \\/* CMUNO\n*/ int b;\n', ['CMUNO'], []],
    ['una \\ y un \\f antes de //', 'int a = 1; \\\f// CMUNO\r\nint b;\r\n', ['CMUNO'], []],
    ['una \\ suelta en un #define', '#define M a \\// CMUNO\nint x;\n', ['CMUNO'], []],
  ];
  // AUD-01-V1: las 40 variantes del informe de Codex (e/E/p/P, + y -, los cinco prefijos), con LF y con CRLF.
  const VARIANTES_V1 = ['\n', '\r\n'].flatMap((s) => ['e', 'E', 'p', 'P'].flatMap((e) => ['+', '-'].flatMap((signo) =>
    ['R', 'u8R', 'uR', 'UR', 'LR'].map((p) => `#define M 1${e}\\${s}${signo}${p}"(a " // CMUNO)"${s}int main(){return 0;}${s}`))));
  const fallanFijos = contrastar(CASOS.map((c) => c[1]));
  for (const [nombre, programa, salen, quedan] of CASOS) {
    const limpio = quitarComentarios(programa);
    const f = fallanFijos.find((x) => x.programa === programa); // ningún caso fijo tiene una \ suelta
    const ok = !f && salen.every((m) => !limpio.includes(m)) && quedan.every((m) => limpio.includes(m));
    revisar(ok, nombre + (ok ? '' : `: ${JSON.stringify(limpio)}${f ? ' · ' + f.motivos.join(', ') : ''}`));
  }
  {
    const fallanV1 = contrastar(VARIANTES_V1);
    const conMarca = VARIANTES_V1.filter((p) => quitarComentarios(p).includes('CMUNO'));
    revisar(!fallanV1.length && !conMarca.length, `V1: las ${VARIANTES_V1.length} variantes (40 con LF y 40 con CRLF) sin el comentario` +
      (fallanV1.length || conMarca.length ? ` · fallan ${fallanV1.length}, con el comentario ${conMarca.length}` : ''));
  }

  console.log('— Programas válidos: compilan antes y después de limpiarlos (cabeceras reales, Uno)');
  for (const [nombre, programa] of [
    ['V1: #define con 1e\\ y otra línea (LF)', '#define M 1e\\\n+R"(a " // CMUNO)"\nint main(){return 0;}\n'],
    ['V1: lo mismo con CRLF', '#define M 1e\\\r\n+R"(a " // CMUNO)"\r\nint main(){return 0;}\r\n'],
    ['V2: /* */ de varias líneas dentro de un #define', '#define VALOR (1 /* CMUNO\n */ + 2)\nint dato = VALOR;\n'],
    ['V2: #include <avr//io.h>', '#include <avr//io.h>\nint main(){return 0;}\n'],
    ['textos dentro de una macro', '#define T "x // LTUNO"\n#define U R"(y " // LTDOS)" /* CMUNO */\nint main(){return 0;}\n'],
    ['una \\ suelta en un #define que no se usa', '#define M a \\// CMUNO\nint x;\nint main(){return x;}\n'],
    ['un programa como los de TecnoBloques', '// Proyecto: CMUNO\n#include <avr/io.h>\n#define LED 13 /* el pin\n   del LED */\nvoid setup() { DDRB |= 1 << 5; } // CMDOS\nint main(){ setup(); return 0; }\n'],
  ]) {
    const antes = errorAlCompilar(programa);
    const despues = antes ? '' : errorAlCompilar(quitarComentarios(programa));
    revisar(!antes && !despues, nombre + (antes ? `: el original no compila (${antes})` : despues ? `: el limpio no compila (${despues})` : ''));
  }

  console.log('— Programas al azar contra el compilador');
  let semilla = Number(process.env.SEMILLA || 20261018) >>> 0;
  const azar = () => { // mulberry32: la misma semilla da los mismos programas
    semilla = (semilla + 0x6D2B79F5) >>> 0;
    let t = semilla;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const uno = (lista) => lista[Math.floor(azar() * lista.length)];
  const EMPALMES = ['\\\n', '\\\r\n', '\\ \n', '\\\t\r\n', '\\\f\r', '\\\v\n'];
  const SALTOS = ['\n', '\r\n', '\r'];
  const dentro = () => uno(['a', ' ', '//', '/*', '*/', '/', '*', 'ñ', ')', '(', 'x"', ')x', uno(EMPALMES), uno(SALTOS)]);
  const PIEZAS = [
    () => uno(['int a = 1;', 'x = y / z;', 'a$R', '$', 'xx', 'v', '_k', '1.', '0x1F', '1e+5', ';', ' ', '\t', '(', ')', '=']),
    () => uno(['1e', '1E', '0x1p', '.5e', '+', '-', '<', '>', '#']),
    () => uno(['\n#define M ', '\n # define F(x) ', '\n%:define D ', '\n#include <avr//io.h>\n', '\n#include "a//b.h"\n',
      '\n#include /* CM */ <a//b.h> // CM\n', '\n#if 1 \n']),
    () => uno(['R', 'u8R', 'uR', 'UR', 'LR', 'u8', 'L', 'xR', 'Rx']),
    () => uno(SALTOS),
    () => uno(EMPALMES),
    () => uno(['/', '*', '"', "'"]),
    () => `"${Array.from({ length: Math.floor(azar() * 4) }, () => uno(['a', '//', '/*', '*/', '\\"', '\\\\', "'", ' ', 'á', uno(EMPALMES)])).join('')}"`,
    () => uno(["'/'", "'\\''", "'\"'", "'*'", "'\\\\'"]),
    () => { const m = uno(['', 'x', 'ab', 'á', '$', '#~']); return `${uno(['R', 'u8R', 'uR', 'UR', 'LR'])}"${m}(${Array.from({ length: Math.floor(azar() * 4) }, dentro).join('')})${m}"`; },
    () => `// CM ${uno(['', '/*', '"', 'á', uno(EMPALMES) + 'CM'])}`,
    () => `/* CM ${uno(['', '//', '"', '*', uno(SALTOS), uno(EMPALMES)])} */`,
    () => `/${uno(EMPALMES)}${uno(['/', '*'])} CM ${uno(['', '*/', '*' + uno(EMPALMES) + '/'])}`,
  ];
  const cuantos = Number(process.env.CASOS || 2000);
  const programas = Array.from({ length: cuantos }, () =>
    Array.from({ length: 4 + Math.floor(azar() * 20) }, () => uno(PIEZAS)()).join(''));
  const t0 = Date.now();
  const fallan = contrastar(programas);
  revisar(fallan.length === 0, `${cuantos} programas al azar (semilla ${process.env.SEMILLA || 20261018}): el compilador ve lo mismo, sin comentarios y con las mismas líneas` +
    (fallan.length ? ` · fallan ${fallan.length}` : '') + ` (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  for (const f of fallan.slice(0, 5)) console.log('      ' + JSON.stringify(f));

} finally {
  fs.rmSync(carpeta, { recursive: true, force: true });
}

console.log(fallos ? `\n${fallos} FALLAS` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
