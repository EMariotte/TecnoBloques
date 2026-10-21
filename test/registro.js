// Prueba con Node lo que no depende de la página en el registro de eventos (src/registro.js; contrato con
// TecnoCircuito, sección 6.1): el C++ sin comentarios, el código del equipo en el nombre del archivo, el resumen de
// bloques y el sobre. Las líneas que arma el registro se revisan contra contrato/evento.schema.json con el revisor de
// TecnoCircuito (..\TecnoCircuito\prototipo\pruebas\contrato_eventos.js, el mismo de su probar:contrato).
// Uso: npm run test:registro
'use strict';
const path = require('path');
const fs = require('fs');
const { quitarComentarios, codigoParaArchivo, limpiarEquipo, resumenBloques, fechaArchivo, crearRegistroEventos } = require('../src/registro.js');

let fallos = 0;
function revisar(condicion, texto) {
  console.log((condicion ? 'OK    ' : 'FALLA ') + texto);
  if (!condicion) fallos++;
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('— El C++ sin comentarios');
const CASOS = [
  ['un comentario de línea', 'int a = 1; // mi nombre\nint b;', 'int a = 1;\nint b;'],
  ['un comentario de bloque en una línea', 'int /* nota */ a;', 'int   a;'],
  ['un comentario de bloque de varias líneas conserva las líneas', 'a;\n/* uno\ndos */\nb;', 'a;\n\n\nb;'],
  ['a/**/b no se pega', 'a/**/b', 'a b'],
  ['una URL entre comillas no se corta', 'Serial.println("http://sena.edu.co"); // ver', 'Serial.println("http://sena.edu.co");'],
  ['/* dentro de un texto', 'const char* t = "/* no es comentario */";', 'const char* t = "/* no es comentario */";'],
  ['una comilla escapada dentro del texto', 'Serial.print("dijo \\"hola\\" // ok"); // fin', 'Serial.print("dijo \\"hola\\" // ok");'],
  ['una barra escapada al final del texto', 'char* r = "C:\\\\"; // ruta', 'char* r = "C:\\\\";'],
  ['un carácter entre comillas simples', "char c = '/'; char d = '\\''; // x", "char c = '/'; char d = '\\'';"],
  ['un texto crudo R"(…)"', 'auto s = R"(a // b /* c */)"; // x', 'auto s = R"(a // b /* c */)";'],
  ['un texto crudo con marca', 'auto s = R"x(a )" // b)x"; // c', 'auto s = R"x(a )" // b)x";'],
  ['saltos de línea de Windows (CRLF)', 'a; // uno\r\nb; /* dos\r\ntres */ c;\r\n', 'a;\r\nb; \r\n c;\r\n'],
  ['una barra al final del comentario lo continúa (sin perder la línea)', 'a; // uno \\\nsigue\nb;', 'a;\n\nb;'],
  // AUD-01: el compilador une las líneas que terminan en \ antes de buscar comentarios; lo contrasta con avr-g++
  // test/registro-preprocesador.js.
  ['/\\ y otra línea con / también es un comentario', 'int v=1; /\\\n/ privado\nint w;', 'int v=1;\n\nint w;'],
  ['/\\ y otra línea con / (CRLF)', 'int v=1; /\\\r\n/ privado\r\nint w;', 'int v=1;\r\n\r\nint w;'],
  ['\\ con espacios antes del salto también une las líneas', 'int v=1; /\\ \n/ privado\nint w;', 'int v=1;\n\nint w;'],
  ['/* y */ partidos por empalmes', 'a; /\\\n* privado *\\\n/ b;', 'a; \n\n b;'],
  ...['R', 'u8R', 'uR', 'UR', 'LR'].map((p) => [`un texto crudo ${p}"(…)" con una comilla adentro`,
    `auto s = ${p}"(a " b // c)"; // privado`, `auto s = ${p}"(a " b // c)";`]),
  ['un nombre que termina en R no abre un texto crudo', 'auto s = xR"(a " // privado)";\nint w;', 'auto s = xR"(a "\nint w;'],
  ['un número 1.R no abre un texto crudo', 'x = 1.R"(a " // privado)";\nint w;', 'x = 1.R"(a "\nint w;'],
  ['el sufijo de un texto ("x"u8R) no abre un texto crudo', 'auto s = "x"u8R"(a " // privado)";\nint w;', 'auto s = "x"u8R"(a "\nint w;'],
  ['un empalme dentro del prefijo sigue siendo texto crudo', 'auto s = u8\\\nR"(a " b)"; // privado', 'auto s = u8\\\nR"(a " b)";'],
  ['un empalme dentro de un texto crudo es texto', 'auto s = R"(a \\\n// b)"; // privado', 'auto s = R"(a \\\n// b)";'],
  ['una marca con espacio no es texto crudo', 'auto s = R"a b(x)a b"; // privado', 'auto s = R"a b(x)a b";'],
  ['un texto partido por un empalme CRLF', 'char* t = "a\\\r\nb // no"; // privado', 'char* t = "a\\\r\nb // no";'],
  ['un carácter partido por un empalme', "char c = '\\\n/'; // privado", "char c = '\\\n/';"],
  ['un \\r solo termina el comentario', 'a; // privado\rb; // otro\r', 'a;\rb;\r'],
  ['un \\r solo, un comentario y un \\n no se juntan en un \\r\\n', 'a;\r// privado\nb;', 'a;\r \nb;'],
  // AUD-01-V1 y V2 (verificación de Codex): números partidos por un empalme y directivas.
  ['1e\\ y otra línea con +R"( es un número, no un texto crudo', '#define M 1e\\\n+R"(a " // privado)"\nint m;', '#define M 1e\\\n+R"(a "\nint m;'],
  ['un /* */ de varias líneas no corta un #define', '#define VALOR (1 /* privado\n */ + 2)\nint d = VALOR;', '#define VALOR (1  \\\n + 2)\nint d = VALOR;'],
  ['lo mismo con CRLF', '#define VALOR (1 /* privado\r\n */ + 2)\r\nint d = VALOR;', '#define VALOR (1  \\\r\n + 2)\r\nint d = VALOR;'],
  ['en #include <avr//io.h> el // es parte del nombre', '#include <avr//io.h> // privado\nint m;', '#include <avr//io.h>\nint m;'],
  ['un /* */ de varias líneas no vuelve directiva un # del medio', 'int a; /* privado\n */ # define Z 1', 'int a;  \\\n # define Z 1'],
  ['un /* */ de varias líneas al inicio deja la directiva como estaba', '/* privado\n */ #define Y 2', '\n #define Y 2'],
  ['varios /* */ seguidos antes de un # del medio de la línea', 'a /* privado\n */ /* otro */ # define Z', 'a  \\\n   # define Z'],
  ['una \\ suelta antes de // queda separada del salto con /**/', 'int a = 1; \\ // privado\nint b;', 'int a = 1; \\/**/\nint b;'],
  ['lo mismo en un #define', '#define M a \\// privado\nint x;', '#define M a \\/**/\nint x;'],
  ['en un #define, un texto crudo no pasa de su línea', '#define F R"x(abc\n// privado\n)x"\nint z;', '#define F R"x(abc\n\n)x"\nint z;'],
  ['fuera de una directiva, sí', 'auto s = R"x(abc\n// no\n)x"; // privado', 'auto s = R"x(abc\n// no\n)x";'],
  ['un comentario de bloque sin cerrar', 'a; /* nunca', 'a;  '],
  ['un texto sin cerrar no se come el resto', 'Serial.print("hola\nint b; // x', 'Serial.print("hola\nint b;'],
  ['la división no es un comentario', 'int x = a / b / c;', 'int x = a / b / c;'],
  ['un programa sin comentarios queda igual', 'void setup() {\n  pinMode(13, OUTPUT);\n}\n', 'void setup() {\n  pinMode(13, OUTPUT);\n}\n'],
];
for (const [nombre, entra, sale] of CASOS) {
  const r = quitarComentarios(entra);
  revisar(r === sale, `${nombre}` + (r === sale ? '' : `: ${JSON.stringify(r)} (esperado ${JSON.stringify(sale)})`));
}
{
  // El código que genera TecnoBloques trae comentarios con el nombre del proyecto y los textos de los bloques.
  const generado = '// Proyecto: LED de Sofía\n// Hecho con TecnoBloques\n#include <Servo.h>\n/* Calibración\n   de Otto */\nvoid setup() {\n  Serial.begin(9600); // velocidad\n  Serial.println("Hola, soy Otto");\n}\nvoid loop() {}\n';
  const r = quitarComentarios(generado);
  revisar(!/Sofía|Hecho con|Calibración|velocidad/.test(r) && r.includes('"Hola, soy Otto"') && r.split('\n').length === generado.split('\n').length,
    'un programa generado: sin los comentarios, con los textos entre comillas y con el mismo número de líneas');
  const largo = ('int a = 1; // x\n' + 'Serial.print("// y");\n').repeat(5000);
  const t0 = Date.now();
  const rl = quitarComentarios(largo);
  revisar(Date.now() - t0 < 500 && !rl.includes('// x') && rl.includes('"// y"'), `un programa de ${(largo.length / 1024).toFixed(0)} KB se limpia en ${Date.now() - t0} ms`);
  // Formas abusivas: muchos R" sin paréntesis, muchos espacios antes de un comentario y muchos empalmes seguidos.
  const abusivo = 'R"'.repeat(30000) + '\n' + ' '.repeat(100000) + 'x // c\n' + ('a ' + ' '.repeat(50) + '\\\n').repeat(5000) + '// d';
  const t1 = Date.now();
  const ra = quitarComentarios(abusivo);
  revisar(Date.now() - t1 < 500 && !ra.includes('// c') && !ra.includes('// d'), `un programa abusivo de ${(abusivo.length / 1024).toFixed(0)} KB se limpia en ${Date.now() - t1} ms`);
}

console.log('— El código del equipo');
for (const [entra, sale] of [['A7', 'A7'], ['  equipo 3  ', 'equipo_3'], ['Ñandú-2', 'Nandu-2'], ['..\\..\\Windows', '______Windows'],
  ['con:prn?*', 'con_prn__'], ['', 'equipo'], ['../', 'equipo'], ['x'.repeat(60), 'x'.repeat(40)]]) {
  const r = codigoParaArchivo(entra);
  revisar(r === sale && /^[A-Za-z0-9_-]+$/.test(r), `para el archivo, ${JSON.stringify(entra)} → ${JSON.stringify(r)}`);
}
revisar(limpiarEquipo('  Equipo\n 3 ') === 'Equipo 3' && limpiarEquipo('   ') === '', 'en la línea va como se escribió, sin espacios de sobra');
revisar(fechaArchivo(new Date(2026, 9, 6, 23, 59).getTime()) === '2026-10-06', 'la fecha del archivo es la local: 2026-10-06');

console.log('— El resumen de bloques');
revisar(igual(resumenBloques(['arduino_setup', 'digital_write', 'digital_write']), { bloques: 3, tipos: { arduino_setup: 1, digital_write: 2 } }), 'cuenta los bloques de cada tipo');
revisar(igual(resumenBloques([]), { bloques: 0, tipos: {} }), 'sin bloques: 0');

console.log('— El sobre');
const lineas = [];
let reloj = 1760600000000;
const reg = crearRegistroEventos({ escribir: (l) => lineas.push(l), versionTB: '0.4.0', versionTC: '0.2.0', ahora: () => reloj, nuevaSesion: () => 's-' + lineas.length });
reg.registrar({ v: 1, t: reloj, origen: 'circuito', tipo: 'cable_agregado', datos: { de: 'placa.D13', a: 'r1.1' } });
revisar(lineas.length === 0 && !reg.activo(), 'sin equipo no se escribe nada');
revisar(reg.empezar('   ') === false && lineas.length === 0, 'un código vacío no empieza la sesión');
reg.empezar(' A7 ', { placa: 'uno', nivel: 1 });
reg.registrar({ v: 1, t: reloj, origen: 'circuito', tipo: 'cable_agregado', datos: { de: 'placa.D13', a: 'r1.1' } });
reg.editor('codigo_compilado', { ok: true, error: null, bytes: 924, codigo: quitarComentarios('void setup() {} // x\nvoid loop() {}\n') });
reloj += 65000;
reg.empezar('B2', { placa: 'nano', nivel: 2 });
reg.terminar();
reg.registrar({ v: 1, t: reloj, origen: 'editor', tipo: 'ejemplo_cargado', datos: { id: 'x' } });
revisar(igual(lineas.map((l) => [l.equipo, l.tipo]), [['A7', 'sesion_iniciada'], ['A7', 'cable_agregado'], ['A7', 'codigo_compilado'], ['A7', 'sesion_terminada'], ['B2', 'sesion_iniciada'], ['B2', 'sesion_terminada']]),
  'cambiar de equipo termina la sesión del anterior; después de terminar no se escribe');
revisar(lineas[3].datos.ms === 65000, 'sesion_terminada lleva cuánto duró: 65000 ms');
revisar(lineas[0].sesion !== lineas[4].sesion && lineas.slice(0, 4).every((l) => l.sesion === lineas[0].sesion), 'cada equipo tiene su sesión');
revisar(lineas.every((l) => l.v === 1 && l.version_tb === '0.4.0' && l.version_tc === '0.2.0'), 'cada línea lleva v y las dos versiones');
{
  const roto = crearRegistroEventos({ escribir: () => { throw new Error('disco lleno'); }, versionTB: '0.4.0', nuevaSesion: () => 's' });
  let ok = true;
  try { roto.empezar('A1', { placa: 'uno', nivel: 1 }); roto.editor('ejemplo_cargado', { id: 'x' }); } catch (e) { ok = false; }
  revisar(ok, 'si no se puede escribir, el registro no interrumpe el trabajo');
}

console.log('— El disco (escritorio/registro-disco.js)');
{
  const os = require('os');
  const { crearRegistroDisco } = require('../escritorio/registro-disco.js');
  const base = path.join(os.tmpdir(), 'tecnobloques-prueba-registro');
  if (path.dirname(path.resolve(base)) !== path.resolve(os.tmpdir())) throw new Error('Ruta temporal inesperada');
  fs.rmSync(base, { recursive: true, force: true });
  const carpeta = path.join(base, 'appdata');
  let reloj2 = new Date(2026, 9, 16, 10, 30).getTime();
  const disco = crearRegistroDisco({ carpeta, ahora: () => reloj2 });
  const linea = (equipo, extra) => ({ v: 1, t: reloj2, origen: 'editor', tipo: 'ejemplo_cargado', datos: { id: 'x' }, equipo, sesion: 's1', version_tb: '0.4.0', version_tc: '0.2.0', ...extra });

  revisar(igual(disco.estado(), { activo: false, tienePin: false, falla: null, configIlegible: false, descartados: null }), 'recién instalado: apagado, sin PIN, sin falla y con la configuración legible');
  revisar(disco.escribir(linea('A7')) === false && !fs.existsSync(path.join(carpeta, 'registros')), 'apagado: no escribe nada ni crea la carpeta');
  revisar(disco.instructor({ accion: 'entrar', pin: '1234' }).motivo === 'sin-pin', 'sin PIN no se puede entrar');
  revisar(disco.instructor({ accion: 'crear-pin', pin: '12a4' }).motivo === 'pin-invalido' && disco.instructor({ accion: 'crear-pin', pin: '123' }).motivo === 'pin-invalido',
    'el PIN es de 4 a 8 dígitos');
  revisar(disco.instructor({ accion: 'crear-pin', pin: '2468' }).ok, 'el instructor crea su PIN');
  const cfg = fs.readFileSync(path.join(carpeta, 'registro-config.json'), 'utf8');
  revisar(!cfg.includes('2468') && /"hash"/.test(cfg), 'el PIN no queda escrito: solo su resumen (scrypt con sal)');
  revisar(disco.instructor({ accion: 'crear-pin', pin: '1111' }).motivo === 'ya-hay-pin', 'no se puede crear otro PIN encima del que hay');
  revisar(disco.instructor({ accion: 'activar', pin: '0000', activo: true }).motivo === 'pin' && !disco.estado().activo, 'con el PIN equivocado no se enciende');
  for (let i = 0; i < 4; i++) disco.instructor({ accion: 'entrar', pin: '9999' });
  const bloqueo = disco.instructor({ accion: 'entrar', pin: '2468' });
  revisar(bloqueo.motivo === 'espera' && bloqueo.segundos === 60, `cinco PIN equivocados seguidos: espera un minuto (${bloqueo.segundos} s), aunque el siguiente sea el correcto`);
  reloj2 += 61000;
  revisar(disco.instructor({ accion: 'activar', pin: '2468', activo: true }).ok && disco.estado().activo, 'pasado el minuto, el instructor enciende el registro');

  revisar(disco.escribir(linea('A7')) && disco.escribir(linea('A7', { tipo: 'sesion_terminada', datos: { ms: 10 } })), 'encendido: escribe');
  const archivo = path.join(carpeta, 'registros', 'A7-2026-10-16.jsonl');
  const leidas = fs.existsSync(archivo) ? fs.readFileSync(archivo, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
  revisar(leidas.length === 2 && leidas[1].tipo === 'sesion_terminada', 'una línea JSON por evento en registros/A7-2026-10-16.jsonl, en orden');
  disco.escribir(linea('..\\..\\..\\x'));
  disco.escribir(linea('../../x'));
  const fueraDeRegistros = fs.readdirSync(base).filter((f) => f !== 'appdata').concat(fs.readdirSync(carpeta).filter((f) => !['registros', 'registro-config.json'].includes(f)));
  revisar(!fueraDeRegistros.length && disco.archivos().every((f) => /^[A-Za-z0-9_-]+-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)),
    `un código con ..\\ no escribe fuera de registros\\ (${disco.archivos().join(', ')})`);
  revisar(!disco.escribir(linea('')) && !disco.escribir(linea('A7', { tipo: 3 })) && !disco.escribir(null) && !disco.escribir('texto'), 'sin equipo o sin tipo no se escribe');
  revisar(!disco.escribir(linea('A7', { datos: { codigo: 'x'.repeat(3 * 1024 * 1024) } })), 'una línea de más de 2 MB no se escribe');

  const usb = path.join(base, 'usb');
  fs.mkdirSync(usb);
  revisar(disco.exportar({ pin: '1357', destino: usb }).motivo === 'pin' && !fs.readdirSync(usb).length, 'exportar con el PIN equivocado no copia nada');
  const exp = disco.exportar({ pin: '2468', destino: usb });
  revisar(exp.ok && exp.archivos === disco.archivos().length && fs.readdirSync(exp.carpeta).filter((f) => f.endsWith('.jsonl')).length === exp.archivos &&
    JSON.parse(fs.readFileSync(path.join(exp.carpeta, 'exportacion.json'), 'utf8')).completa === true && /TecnoBloques-registros-2026-10-16_1031$/.test(exp.carpeta),
    `exportar copia los ${exp.archivos} archivos a ${exp.carpeta && path.basename(exp.carpeta)}`);
  revisar(disco.instructor({ accion: 'cambiar-pin', pin: '2468', nuevoPin: '13579' }).ok && disco.instructor({ accion: 'entrar', pin: '13579' }).ok && !disco.instructor({ accion: 'entrar', pin: '2468' }).ok,
    'el instructor cambia el PIN');
  revisar(disco.instructor({ accion: 'activar', pin: '13579', activo: false }).ok && !disco.escribir(linea('A7')), 'apagado otra vez: no escribe');
  fs.rmSync(base, { recursive: true, force: true });
}

console.log('— El disco cuando falla (AUD-02)');
const esperas = []; // lo que necesita el reloj de reintento: se espera antes del resumen
{
  const os = require('os');
  const { crearRegistroDisco } = require('../escritorio/registro-disco.js');
  const base = path.join(os.tmpdir(), 'tecnobloques-prueba-registro-falla');
  if (path.dirname(path.resolve(base)) !== path.resolve(os.tmpdir())) throw new Error('Ruta temporal inesperada');
  fs.rmSync(base, { recursive: true, force: true });
  const carpeta = path.join(base, 'appdata');
  let reloj3 = new Date(2026, 9, 18, 14, 40).getTime();
  const avisos = [];
  const disco = crearRegistroDisco({ carpeta, ahora: () => reloj3, alCambiar: (f, fin) => avisos.push([f, fin]), reintentoMs: 40 });
  disco.instructor({ accion: 'crear-pin', pin: '2468' });
  disco.instructor({ accion: 'activar', pin: '2468', activo: true });
  const ev = (equipo, sesion, n) => ({ v: 1, t: reloj3, origen: 'editor', tipo: 'bloques_cambiados', datos: { bloques: n, tipos: {} },
    equipo, sesion, version_tb: '0.4.0', version_tc: '0.2.0' });
  const leerDe = (equipo) => {
    const a = path.join(carpeta, 'registros', `${equipo}-2026-10-18.jsonl`);
    return fs.existsSync(a) ? fs.readFileSync(a, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
  };
  revisar(disco.escribir(ev('A7', 's1', 0)) && leerDe('A7').length === 1 && disco.estado().falla === null && !avisos.length, 'con el disco bien: escribe y no avisa nada');

  // Disco lleno: ENOSPC inyectado solo en memoria y solo para esta carpeta.
  const anexar = fs.appendFileSync;
  let lleno = true;
  fs.appendFileSync = function (archivo, ...resto) {
    if (lleno && String(archivo).startsWith(carpeta)) throw Object.assign(new Error('ENOSPC sintético'), { code: 'ENOSPC' });
    return anexar.call(this, archivo, ...resto);
  };
  let desde;
  try {
    reloj3 += 60000;
    desde = reloj3;
    const aceptadas = [1, 2, 3].map((n) => disco.escribir(ev('A7', 's1', n)));
    const f = disco.estado().falla;
    revisar(aceptadas.every(Boolean) && f && f.motivo === 'ENOSPC' && f.desde === desde && f.pendientes === 3 && f.perdidos === 0,
      `disco lleno: escribir no lanza y queda la falla (${f && f.motivo}, ${f && f.pendientes} esperando)`);
    revisar(avisos.length === 1 && avisos[0][0].motivo === 'ENOSPC', 'la falla se avisa una sola vez, no en cada evento');
    revisar(leerDe('A7').length === 1, 'mientras falla, el archivo no cambia');
    const r = disco.instructor({ accion: 'reintentar', pin: '2468' });
    revisar(r.ok && r.falla && r.falla.pendientes === 3, 'reintentar sin espacio: la falla sigue y no se pierde nada');
    revisar(disco.instructor({ accion: 'reintentar', pin: '0000' }).motivo === 'pin', 'reintentar pide el PIN del instructor');
    disco.escribir(ev('B2', 's2', 9)); // otro equipo en el mismo PC, durante la falla
    lleno = false;
    reloj3 += 60000;
    disco.escribir(ev('A7', 's1', 4)); // el siguiente evento la recupera
  } finally { fs.appendFileSync = anexar; }
  const a7 = leerDe('A7');
  const b2 = leerDe('B2');
  revisar(disco.estado().falla === null && avisos.length === 2 && avisos[1][0] === null && avisos[1][1] === 'escrito', 'el siguiente evento la recupera y avisa una vez que se escribió');
  revisar(igual(a7.filter((l) => l.tipo === 'bloques_cambiados').map((l) => l.datos.bloques), [0, 1, 2, 3, 4]), 'lo que esperaba se escribe en orden y sin huecos: 0 1 2 3 4');
  const marcaA7 = a7[a7.length - 1];
  const marcaB2 = b2[b2.length - 1];
  revisar(marcaA7.tipo === 'registro_interrumpido' && marcaA7.sesion === 's1' && marcaA7.version_tb === '0.4.0' &&
    igual(marcaA7.datos, { desde, hasta: desde + 60000, recuperados: 4, perdidos: 0, motivo: 'ENOSPC' }),
    'después, registro_interrumpido de A7: desde, hasta, recuperados 4, perdidos 0, ENOSPC');
  revisar(b2.length === 2 && b2[0].datos.bloques === 9 && marcaB2.tipo === 'registro_interrumpido' && marcaB2.sesion === 's2' && marcaB2.datos.recuperados === 1,
    'y el de B2 en su propio archivo, con su sesión');
  lineas.push(marcaA7, marcaB2); // también se revisan contra el esquema del contrato

  // Un fallo real del sistema de archivos, sin inyectar nada: el archivo del día de solo lectura.
  const archivoA7 = path.join(carpeta, 'registros', 'A7-2026-10-18.jsonl');
  fs.chmodSync(archivoA7, 0o444);
  disco.escribir(ev('A7', 's1', 5));
  const real = disco.estado().falla;
  revisar(real && ['EPERM', 'EACCES'].includes(real.motivo) && real.pendientes === 1, `archivo de solo lectura (fallo real): falla ${real && real.motivo}, 1 esperando`);
  fs.chmodSync(archivoA7, 0o666);
  esperas.push(new Promise((listo) => setTimeout(listo, 200)).then(() => {
    const ultimas = leerDe('A7').slice(-2);
    revisar(disco.estado().falla === null && ultimas[0].datos.bloques === 5 && ultimas[1].tipo === 'registro_interrumpido',
      'arreglado el permiso, el reintento automático la recupera solo (sin otro evento)');

    // La cola tiene tope: lo que no cabe se cuenta como perdido, y queda dicho en registro_interrumpido.
    fs.appendFileSync = function (archivo, ...resto) {
      if (String(archivo).startsWith(carpeta)) throw Object.assign(new Error('ENOSPC sintético'), { code: 'ENOSPC' });
      return anexar.call(this, archivo, ...resto);
    };
    try { for (let n = 0; n < 5003; n++) disco.escribir(ev('A7', 's1', 100 + n)); } finally { fs.appendFileSync = anexar; }
    const llena = disco.estado().falla;
    revisar(llena.pendientes === 5000 && llena.perdidos === 3, `la cola guarda 5000 y cuenta las demás como perdidas (${llena.pendientes} y ${llena.perdidos})`);
    disco.reintentar();
    const marcaTope = leerDe('A7').pop();
    revisar(marcaTope.tipo === 'registro_interrumpido' && marcaTope.datos.recuperados === 5000 && marcaTope.datos.perdidos === 3, 'registro_interrumpido dice recuperados 5000 y perdidos 3');

    // Apagar durante una falla: lo que esperaba se descarta y el aviso dice que fue por apagado (no «se recuperó»).
    fs.chmodSync(archivoA7, 0o444);
    disco.escribir(ev('A7', 's1', 7));
    revisar(disco.instructor({ accion: 'activar', pin: '2468', activo: false }).ok && disco.estado().falla === null && avisos[avisos.length - 1][1] === 'apagado',
      'el instructor apaga durante la falla: se quita el aviso y dice «apagado»');
    fs.chmodSync(archivoA7, 0o666);

    // La configuración que no se puede leer ya no apaga el registro en silencio.
    disco.instructor({ accion: 'activar', pin: '2468', activo: true });
    const config = path.join(carpeta, 'registro-config.json');
    const bueno = fs.readFileSync(config, 'utf8');
    fs.writeFileSync(config, '{ roto');
    revisar(disco.escribir(ev('A7', 's1', 8)) && disco.estado().falla && disco.estado().falla.motivo === 'CONFIG', 'la configuración ilegible es una falla visible (CONFIG), no un apagado callado');
    fs.writeFileSync(config, bueno);
    disco.reintentar();
    revisar(disco.estado().falla === null && leerDe('A7').some((l) => l.tipo === 'bloques_cambiados' && l.datos.bloques === 8), 'con la configuración de vuelta, se escribe lo que esperaba');
    fs.rmSync(base, { recursive: true, force: true });
  }));
}

console.log('— Escrituras a medias y configuración ilegible (AUD-02-V1 y V2)');
{
  const os = require('os');
  const { crearRegistroDisco } = require('../escritorio/registro-disco.js');
  const base = path.join(os.tmpdir(), 'tecnobloques-prueba-registro-medias');
  if (path.dirname(path.resolve(base)) !== path.resolve(os.tmpdir())) throw new Error('Ruta temporal inesperada');
  fs.rmSync(base, { recursive: true, force: true });
  const carpeta = path.join(base, 'appdata');
  const reloj4 = new Date(2026, 9, 18, 15, 30).getTime();
  const nuevoDisco = () => crearRegistroDisco({ carpeta, ahora: () => reloj4, reintentoMs: 60000 });
  let disco = nuevoDisco();
  disco.instructor({ accion: 'crear-pin', pin: '2468' });
  disco.instructor({ accion: 'activar', pin: '2468', activo: true });
  const ev = (n) => ({ v: 1, t: reloj4, origen: 'editor', tipo: 'bloques_cambiados', datos: { bloques: n, tipos: {} },
    equipo: 'D4', sesion: 's4', version_tb: '0.4.0', version_tc: '0.2.0' });
  const archivo = path.join(carpeta, 'registros', 'D4-2026-10-18.jsonl');
  /** Las líneas del archivo: las que se leen como JSON y las que no. */
  const leer = () => {
    const filas = fs.existsSync(archivo) ? fs.readFileSync(archivo, 'utf8').split('\n') : [];
    const sobra = filas.pop(); // después del último \n no debe quedar nada
    const ok = [];
    let malas = sobra ? 1 : 0;
    for (const f of filas) { try { ok.push(JSON.parse(f)); } catch (e) { malas++; } }
    return { ok, malas };
  };
  const anexar = fs.appendFileSync;
  const truncar = fs.truncateSync;
  // Escribe de verdad los primeros bytes y después falla, como un disco que se llena en la mitad de la línea.
  const aMedias = (cuando) => function (a, texto, ...resto) {
    if (String(a).startsWith(carpeta) && cuando(String(texto))) {
      anexar.call(this, a, String(texto).slice(0, 24), ...resto);
      throw Object.assign(new Error('ENOSPC sintético a medias'), { code: 'ENOSPC' });
    }
    return anexar.call(this, a, texto, ...resto);
  };
  try {
    disco.escribir(ev(0));
    let una = true;
    fs.appendFileSync = aMedias(() => { const s = una; una = false; return s; });
    disco.escribir(ev(1));
    revisar(leer().malas === 0 && leer().ok.length === 1 && disco.estado().falla && disco.estado().falla.pendientes === 1,
      'una escritura a medias: el archivo vuelve a su tamaño (sin pedazos) y la línea espera');
    fs.appendFileSync = anexar;
    disco.reintentar();
    let r = leer();
    revisar(r.malas === 0 && igual(r.ok.map((l) => l.tipo === 'registro_interrumpido' ? 'marca' : l.datos.bloques), [0, 1, 'marca']) && r.ok[2].datos.recuperados === 1,
      'al reintentar: 0, 1 y la marca, todas legibles y sin duplicados (recuperados 1)');

    // La marca de recuperación también puede quedar a medias: se corta, espera y sale entera después, una sola vez.
    fs.appendFileSync = function (a, texto, ...resto) {
      if (String(a).startsWith(carpeta)) throw Object.assign(new Error('ENOSPC sintético'), { code: 'ENOSPC' });
      return anexar.call(this, a, texto, ...resto);
    };
    disco.escribir(ev(2));
    fs.appendFileSync = aMedias((t) => t.includes('registro_interrumpido'));
    disco.reintentar();
    revisar(leer().malas === 0 && disco.estado().falla && disco.estado().falla.pendientes === 1, 'la marca a medias se corta y queda esperando');
    fs.appendFileSync = anexar;
    disco.reintentar();
    r = leer();
    revisar(r.malas === 0 && r.ok.filter((l) => l.tipo === 'registro_interrumpido').length === 2 && r.ok[r.ok.length - 1].tipo === 'registro_interrumpido' &&
      r.ok[r.ok.length - 2].datos.bloques === 2 && disco.estado().falla === null, 'y después sale entera, una sola vez, detrás del evento 2');

    // Si tampoco se puede cortar, no se escribe encima del pedazo: se corta antes del siguiente intento.
    fs.appendFileSync = aMedias(() => true);
    fs.truncateSync = function () { fs.truncateSync = truncar; throw Object.assign(new Error('EPERM sintético'), { code: 'EPERM' }); };
    disco.escribir(ev(3));
    revisar(leer().malas === 1, 'una escritura a medias que no se pudo cortar deja el pedazo (por ahora)');
    fs.appendFileSync = anexar;
    fs.truncateSync = truncar;
    disco.reintentar();
    r = leer();
    revisar(r.malas === 0 && r.ok.some((l) => l.datos.bloques === 3), 'antes del siguiente intento se corta el pedazo y la línea sale entera');

    // La app se cerró en la mitad de una escritura: al abrir, el pedazo final se corta antes de escribir.
    fs.appendFileSync = anexar;
    anexar(archivo, '{"v":1,"t":17923');
    disco = nuevoDisco();
    disco.escribir(ev(4));
    r = leer();
    revisar(r.malas === 0 && r.ok[r.ok.length - 1].datos.bloques === 4, 'un pedazo que dejó un cierre de golpe se corta al abrir: el archivo sigue legible');
  } finally { fs.appendFileSync = anexar; fs.truncateSync = truncar; }

  // V2: la configuración existe pero está dañada al abrir la app.
  const config = path.join(carpeta, 'registro-config.json');
  const marca = config + '.recuperando';
  revisar(!fs.existsSync(config + '.tmp'), 'la configuración se guarda entera: no queda el archivo temporal');
  fs.writeFileSync(config, '{ roto');
  disco = nuevoDisco();
  revisar(igual(disco.estado(), { activo: false, tienePin: false, falla: { motivo: 'CONFIG', desde: reloj4, pendientes: 0, perdidos: 0 }, configIlegible: true, descartados: null }),
    'al abrir con la configuración dañada: falla CONFIG y configIlegible desde el arranque, sin esperar un evento (no es lo mismo que recién instalado)');
  revisar(disco.instructor({ accion: 'crear-pin', pin: '1357' }).motivo === 'config-ilegible' && fs.readFileSync(config, 'utf8') === '{ roto',
    'sin la confirmación del instructor no se crea otro PIN encima');
  const tamanoAntes = fs.statSync(archivo).size;
  revisar(disco.escribir(ev(5)) && disco.estado().falla && disco.estado().falla.motivo === 'CONFIG' && fs.statSync(archivo).size === tamanoAntes,
    'un evento con la configuración dañada no se escribe: espera, con la falla CONFIG visible');
  const nuevo = disco.instructor({ accion: 'crear-pin', pin: '1357', reemplazarIlegible: true });
  revisar(nuevo.ok && nuevo.falla === null && fs.statSync(archivo).size === tamanoAntes, 'el PIN nuevo deja el registro apagado: lo que esperaba se descarta y la falla se quita');
  const aparte = fs.readdirSync(carpeta).filter((f) => /^registro-config-ilegible-\d{4}-\d{2}-\d{2}_\d{6}\.json$/.test(f));
  revisar(nuevo.ok && !nuevo.configIlegible && !nuevo.activo && nuevo.tienePin && aparte.length === 1 && fs.readFileSync(path.join(carpeta, aparte[0]), 'utf8') === '{ roto',
    `con la confirmación: PIN nuevo, registro apagado y la dañada guardada aparte (${aparte[0]})`);
  revisar(disco.instructor({ accion: 'entrar', pin: '1357' }).ok && leer().malas === 0, 'el PIN nuevo funciona y los registros guardados no se tocaron');
  // Otro fallo de lectura (no de contenido): la configuración es una carpeta.
  fs.rmSync(config);
  fs.mkdirSync(config);
  disco = nuevoDisco();
  revisar(disco.estado().configIlegible === true, 'si la configuración no se puede ni abrir, también es configIlegible');
  revisar(disco.instructor({ accion: 'crear-pin', pin: '1357', reemplazarIlegible: true }).ok && !disco.estado().configIlegible && fs.statSync(config).isFile(),
    'y también se reemplaza (la carpeta se mueve aparte)');

  // AUD-02-V4: si el disco falla en la mitad del reemplazo, la dañada sigue en su lugar (nunca queda sin configuración).
  const escribirArchivo = fs.writeFileSync;
  const copiar = fs.copyFileSync;
  const renombrar = fs.renameSync;
  const lleno = () => { throw Object.assign(new Error('ENOSPC sintético'), { code: 'ENOSPC' }); };
  // Las dos formas de configuración ilegible × los tres pasos en que puede fallar el disco (la matriz de Codex).
  const pasosV4 = [
    ['al escribir la nueva', () => { fs.writeFileSync = function (a, ...r) { return String(a).endsWith('.tmp') ? lleno() : escribirArchivo.call(this, a, ...r); }; }],
    ['al guardar aparte la dañada', () => {
      fs.copyFileSync = lleno; // un archivo se copia…
      fs.renameSync = function (a, ...r) { return path.resolve(String(a)) === path.resolve(config) ? lleno() : renombrar.call(this, a, ...r); }; // …una carpeta se mueve
    }],
    ['al poner la nueva en su lugar', () => { fs.renameSync = function (a, ...r) { return String(a).endsWith('.tmp') ? lleno() : renombrar.call(this, a, ...r); }; }],
  ];
  const dañar = {
    archivo: () => { fs.rmSync(config, { recursive: true, force: true }); fs.writeFileSync(config, '{ roto'); },
    carpeta: () => { fs.rmSync(config, { recursive: true, force: true }); fs.mkdirSync(config); fs.writeFileSync(path.join(config, 'dentro.txt'), 'sintético'); },
  };
  const intacta = {
    archivo: () => fs.statSync(config).isFile() && fs.readFileSync(config, 'utf8') === '{ roto',
    carpeta: () => fs.statSync(config).isDirectory() && fs.readFileSync(path.join(config, 'dentro.txt'), 'utf8') === 'sintético',
  };
  for (const forma of ['archivo', 'carpeta']) {
    for (const [cuando, romper] of pasosV4) {
      dañar[forma]();
      const apartesAntes = fs.readdirSync(carpeta).filter((f) => f.startsWith('registro-config-ilegible-')).length;
      disco = nuevoDisco();
      let r;
      let lanzo = false;
      romper();
      try { r = disco.instructor({ accion: 'crear-pin', pin: '1357', reemplazarIlegible: true }); } catch (e) { lanzo = true; } finally {
        fs.writeFileSync = escribirArchivo; fs.copyFileSync = copiar; fs.renameSync = renombrar;
      }
      const tras = nuevoDisco().estado(); // como al reiniciar la app
      const apartesDespues = fs.readdirSync(carpeta).filter((f) => f.startsWith('registro-config-ilegible-')).length;
      revisar(!lanzo && r && r.ok === false && r.motivo === 'disco' && intacta[forma]() && !fs.existsSync(config + '.tmp') && apartesDespues === apartesAntes &&
        !fs.existsSync(marca) && tras.configIlegible && tras.falla && tras.falla.motivo === 'CONFIG',
      `${forma}: el disco falla ${cuando}: «disco», sin lanzar; la dañada sigue en su lugar, sin copias ni marca de más, y al reiniciar sigue visible (CONFIG)`);
    }
  }

  // AUD-02-V4 residual: falla el último paso y tampoco se puede devolver la carpeta. La marca recuerda que la
  // recuperación quedó a medias: al reiniciar sigue visible, y el reintento la termina sin mover otra vez la evidencia.
  const apartes = () => fs.readdirSync(carpeta).filter((f) => f.startsWith('registro-config-ilegible-'));
  dañar.carpeta();
  const previasDoble = new Set(apartes());
  const apartesAntesDoble = previasDoble.size;
  disco = nuevoDisco();
  let doble;
  let lanzoDoble = false;
  fs.renameSync = function (a, b, ...r) {
    const final = String(a).endsWith('.tmp');
    const devolver = path.basename(String(a)).startsWith('registro-config-ilegible-') && path.resolve(String(b)) === path.resolve(config);
    return final || devolver ? lleno() : renombrar.call(this, a, b, ...r);
  };
  try { doble = disco.instructor({ accion: 'crear-pin', pin: '1357', reemplazarIlegible: true }); } catch (e) { lanzoDoble = true; } finally { fs.renameSync = renombrar; }
  const movida = apartes().find((f) => !previasDoble.has(f));
  const marcada = fs.existsSync(marca) ? JSON.parse(fs.readFileSync(marca, 'utf8')) : null;
  revisar(!lanzoDoble && doble && doble.motivo === 'disco' && !fs.existsSync(config) && !fs.existsSync(config + '.tmp') && movida && marcada && marcada.aparte === movida &&
    fs.readFileSync(path.join(carpeta, movida, 'dentro.txt'), 'utf8') === 'sintético',
  `carpeta: falla el último paso y también devolverla: «disco», sin lanzar; la evidencia sigue aparte (${movida}) y la marca la nombra`);
  const trasDoble = nuevoDisco(); // como al reiniciar la app
  const estadoDoble = trasDoble.estado();
  revisar(!estadoDoble.activo && !estadoDoble.tienePin && estadoDoble.configIlegible && estadoDoble.falla && estadoDoble.falla.motivo === 'CONFIG' && estadoDoble.falla.pendientes === 0,
    'y al reiniciar no parece recién instalada: falla CONFIG y configIlegible');
  revisar(trasDoble.escribir(ev(5)) && trasDoble.estado().falla.motivo === 'CONFIG' && trasDoble.estado().falla.pendientes === 1,
    'un evento con la recuperación a medias espera, con la falla CONFIG visible (no se descarta como apagado)');
  revisar(trasDoble.instructor({ accion: 'crear-pin', pin: '1357' }).motivo === 'config-ilegible' && fs.existsSync(marca),
    'sin la confirmación del instructor no se crea el PIN encima');
  // El reintento también puede fallar: la marca se queda.
  fs.writeFileSync = function (a, ...r) { return String(a).endsWith('.tmp') ? lleno() : escribirArchivo.call(this, a, ...r); };
  let reintentoLleno;
  try { reintentoLleno = trasDoble.instructor({ accion: 'crear-pin', pin: '1357', reemplazarIlegible: true }); } finally { fs.writeFileSync = escribirArchivo; }
  revisar(reintentoLleno.motivo === 'disco' && fs.existsSync(marca) && !fs.existsSync(config) && nuevoDisco().estado().configIlegible,
    'si el reintento también falla: «disco», la marca se queda y sigue visible al reiniciar');
  const reintento = trasDoble.instructor({ accion: 'crear-pin', pin: '1357', reemplazarIlegible: true });
  revisar(reintento.ok && !reintento.configIlegible && reintento.falla === null && reintento.tienePin && !reintento.activo && fs.statSync(config).isFile() && !fs.existsSync(marca) &&
    apartes().length === apartesAntesDoble + 1 && fs.readFileSync(path.join(carpeta, movida, 'dentro.txt'), 'utf8') === 'sintético',
  'el reintento confirmado termina la recuperación: PIN nuevo, apagado, sin marca y sin mover otra vez la evidencia');
  revisar(nuevoDisco().instructor({ accion: 'entrar', pin: '1357' }).ok && !nuevoDisco().estado().configIlegible, 'y al reiniciar el PIN nuevo funciona');
  // Una marca que quedó (no se pudo borrar) no cuenta si la configuración está en su lugar, y el siguiente guardado la quita.
  fs.writeFileSync(marca, '{}');
  disco = nuevoDisco();
  revisar(!disco.estado().configIlegible && disco.estado().tienePin && disco.instructor({ accion: 'activar', pin: '1357', activo: false }).ok && !fs.existsSync(marca),
    'una marca vieja con la configuración en su lugar no cuenta, y el siguiente guardado la quita');
  // Si ni la marca se puede escribir, no se mueve nada: la carpeta dañada sigue en su lugar.
  dañar.carpeta();
  const apartesAntesMarca = apartes().length;
  disco = nuevoDisco();
  fs.writeFileSync = function (a, ...r) { return path.resolve(String(a)) === path.resolve(marca) ? lleno() : escribirArchivo.call(this, a, ...r); };
  let sinMarca;
  try { sinMarca = disco.instructor({ accion: 'crear-pin', pin: '1357', reemplazarIlegible: true }); } finally { fs.writeFileSync = escribirArchivo; }
  revisar(sinMarca.motivo === 'disco' && intacta.carpeta() && !fs.existsSync(marca) && !fs.existsSync(config + '.tmp') && apartes().length === apartesAntesMarca &&
    nuevoDisco().estado().configIlegible,
  'si no se puede escribir la marca: «disco» y no se mueve nada; la dañada sigue en su lugar y visible');
  dañar.archivo();
  disco = nuevoDisco();
  revisar(disco.instructor({ accion: 'crear-pin', pin: '1357', reemplazarIlegible: true }).ok && !disco.estado().configIlegible, 'con el disco bien, el reemplazo funciona después');
  const guardadas = fs.readdirSync(carpeta).filter((f) => f.startsWith('registro-config-ilegible-'));
  revisar(guardadas.length === new Set(guardadas).size && guardadas.length >= 3 && guardadas.filter((f) => fs.statSync(path.join(carpeta, f)).isFile()).every((f) => fs.readFileSync(path.join(carpeta, f), 'utf8') === '{ roto'),
    `cada reemplazo guarda su dañada con un nombre propio, aunque sean del mismo segundo (${guardadas.length})`);
  fs.writeFileSync = function (a, ...r) { return String(a).endsWith('.tmp') ? lleno() : escribirArchivo.call(this, a, ...r); };
  let apagar;
  try { apagar = disco.instructor({ accion: 'activar', pin: '1357', activo: true }); } finally { fs.writeFileSync = escribirArchivo; }
  revisar(apagar.ok === false && apagar.motivo === 'disco' && JSON.parse(fs.readFileSync(config, 'utf8')).activo === false, 'encender con el disco lleno: «disco» y la configuración no cambia');

  // AUD-02-V3: el pedazo de una línea larga con letras de 2 bytes (UTF-8) se corta en su frontera real.
  disco.instructor({ accion: 'activar', pin: '1357', activo: true });
  const larga = { ...ev(6), tipo: 'codigo_compilado', datos: { ok: true, error: null, bytes: 1, codigo: 'ñ'.repeat(1400000) } };
  revisar(disco.escribir(larga) && leer().malas === 0 && Buffer.byteLength(JSON.stringify(larga)) > 2 * 1024 * 1024,
    `una línea de ${JSON.stringify(larga).length} caracteres (${Buffer.byteLength(JSON.stringify(larga))} bytes) se escribe entera`);
  const previas = leer().ok.length;
  anexar(archivo, '{"v":1,"tipo":"codigo_compilado","datos":{"codigo":"' + 'ñ'.repeat(1250000)); // 2,5 MB sin salto: un cierre de golpe
  disco = nuevoDisco();
  disco.escribir(ev(7));
  const tras = leer();
  revisar(tras.malas === 0 && tras.ok.length === previas + 1 && tras.ok[tras.ok.length - 1].datos.bloques === 7,
    'un pedazo de 2,5 MB con letras de 2 bytes se corta en su frontera real: las líneas previas siguen y la nueva sale entera');
  fs.rmSync(base, { recursive: true, force: true });
}

console.log('— Un evento que no se puede guardar (AUD-07)');
{
  const os = require('os');
  const { crearRegistroDisco } = require('../escritorio/registro-disco.js');
  const REVISOR = path.join(__dirname, '..', '..', 'TecnoCircuito', 'prototipo', 'pruebas', 'contrato_eventos.js');
  const revisarEvento = fs.existsSync(REVISOR) ? require(REVISOR).revisarEvento : null;
  const base = path.join(os.tmpdir(), 'tecnobloques-prueba-registro-descarte');
  if (path.dirname(path.resolve(base)) !== path.resolve(os.tmpdir())) throw new Error('Ruta temporal inesperada');
  fs.rmSync(base, { recursive: true, force: true });
  const carpeta = path.join(base, 'appdata');
  const reloj5 = new Date(2026, 9, 21, 11, 30).getTime();
  const avisos = [];
  const disco = crearRegistroDisco({ carpeta, ahora: () => reloj5, alDescartar: (d) => avisos.push(d), reintentoMs: 60000 });
  disco.instructor({ accion: 'crear-pin', pin: '2468' });
  const SOBRE = { equipo: 'D7', sesion: 's7', version_tb: '0.4.0', version_tc: '0.2.0' };
  const compilado = (relleno, extra) => ({ v: 1, t: reloj5, origen: 'editor', tipo: 'codigo_compilado', datos: { ok: true, error: null, bytes: 1, codigo: relleno }, ...SOBRE, ...extra });
  const archivo = path.join(carpeta, 'registros', 'D7-2026-10-21.jsonl');
  const leer = () => (fs.existsSync(archivo) ? fs.readFileSync(archivo, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  const LIMITE = 2 * 1024 * 1024;
  // Un codigo_compilado cuyo JSON mide exactamente `largo` caracteres, con letras de `ancho` unidades (ñ: 1 unidad y 2
  // bytes; 😀: 2 unidades y 4 bytes)
  const deLargo = (largo, letra = 'x') => {
    const vacio = JSON.stringify(compilado('')).length;
    const ancho = letra.length;
    const falta = largo - vacio;
    return compilado(letra.repeat(Math.floor(falta / ancho)) + 'x'.repeat(falta % ancho));
  };

  revisar(disco.escribir(deLargo(LIMITE + 1)) === false && !leer().length && !avisos.length && disco.estado().descartados === null,
    'control, registro apagado: una línea de más del límite no se escribe ni se cuenta');
  disco.instructor({ accion: 'activar', pin: '2468', activo: true });
  revisar(disco.escribir(compilado('void loop() {}')) && leer().length === 1 && !avisos.length, 'control, un evento pequeño se escribe sin aviso');

  const fronteras = [['x', LIMITE - 1, true], ['x', LIMITE, true], ['x', LIMITE + 1, false], ['ñ', LIMITE, true], ['ñ', LIMITE + 1, false], ['😀', LIMITE, true], ['😀', LIMITE + 1, false], ['漢', LIMITE, true], ['漢', LIMITE + 1, false]];
  for (const [letra, largo, cabe] of fronteras) {
    const antes = leer().length;
    const avisosAntes = avisos.length;
    const l = deLargo(largo, letra);
    const medida = JSON.stringify(l).length;
    const r = disco.escribir(l);
    const nuevas = leer().slice(antes);
    const descarte = nuevas[0] || {};
    revisar(medida === largo && (cabe ? r === true && nuevas.length === 1 && nuevas[0].tipo === 'codigo_compilado' && avisos.length === avisosAntes
      : r === false && nuevas.length === 1 && descarte.tipo === 'evento_descartado' && descarte.sesion === 's7' && descarte.datos.motivo === 'tamano' &&
        descarte.datos.tipo === 'codigo_compilado' && descarte.datos.origen === 'editor' && descarte.datos.largo === largo && descarte.datos.limite === LIMITE && avisos.length === avisosAntes + 1),
    `${largo === LIMITE ? 'justo en el límite' : largo < LIMITE ? 'un carácter antes del límite' : 'un carácter después del límite'} con «${letra}» (${Buffer.byteLength(JSON.stringify(l))} bytes): ${cabe ? 'se escribe' : 'evento_descartado en su lugar y aviso'}`);
  }
  const estado = disco.estado();
  revisar(estado.descartados && estado.descartados.cantidad === 4 && estado.descartados.sinAnotar === 0 && igual(estado.descartados.ultimo, { tipo: 'codigo_compilado', motivo: 'tamano', t: reloj5 }) &&
    igual(avisos[avisos.length - 1], estado.descartados), `el estado cuenta los descartados y el aviso trae lo mismo (${JSON.stringify(estado.descartados)})`);

  // Lo que no se puede convertir a texto: un ciclo, un BigInt y un toJSON que no devuelve nada; y un evento sin tipo
  const ciclo = compilado('x');
  ciclo.datos.yo = ciclo.datos;
  const raros = [['un ciclo', ciclo, 'no_serializable'], ['un BigInt', compilado('x', { datos: { n: 10n } }), 'no_serializable'],
    ['un toJSON que no devuelve nada', { ...compilado('x'), toJSON: () => undefined }, 'no_serializable'], ['sin tipo', { ...compilado('x'), tipo: undefined }, 'sin_tipo'],
    ['un evento del simulador de una corrida', { ...compilado('x'.repeat(LIMITE)), origen: 'simulador', tipo: 'simulacion_iniciada', corrida: 4, ms_sim: 0 }, 'tamano']];
  for (const [nombre, l, motivo] of raros) {
    const antes = leer().length;
    const r = disco.escribir(l);
    const d = leer().slice(antes);
    revisar(r === false && d.length === 1 && d[0].tipo === 'evento_descartado' && d[0].datos.motivo === motivo &&
      (motivo === 'sin_tipo' ? !('tipo' in d[0].datos) : true) && (nombre.includes('corrida') ? d[0].datos.corrida === 4 && d[0].datos.origen === 'simulador' : true),
    `${nombre}: evento_descartado (${motivo}) en su lugar`);
  }
  const antesSinSesion = leer().length;
  const sinSesion = disco.escribir(compilado('x'.repeat(LIMITE + 100), { sesion: undefined }));
  revisar(sinSesion === false && leer().length === antesSinSesion && disco.estado().descartados.sinAnotar === 1 && disco.estado().descartados.cantidad === 10 && avisos.length === 10,
    'sin sesión no se puede anotar: se cuenta como «sin anotar» y se avisa igual');
  const descartes = leer().filter((l) => l.tipo === 'evento_descartado');
  if (revisarEvento) {
    const problemas = descartes.flatMap((l, i) => revisarEvento(l).map((p) => `${i + 1}: ${p}`));
    revisar(!problemas.length && descartes.length === 9, `los ${descartes.length} evento_descartado cumplen contrato/evento.schema.json` + (problemas.length ? ': ' + problemas.join(' | ') : ''));
  } else revisar(false, 'no encuentro el revisor de TecnoCircuito en ' + REVISOR);
  revisar(descartes.every((l) => JSON.stringify(l).length < 1000), 'cada evento_descartado es corto');

  // Con el disco lleno, el evento_descartado espera como cualquier línea y sale en su lugar al recuperarse
  const anexar = fs.appendFileSync;
  fs.appendFileSync = function (a, ...resto) {
    if (String(a).startsWith(carpeta)) throw Object.assign(new Error('ENOSPC sintético'), { code: 'ENOSPC' });
    return anexar.call(this, a, ...resto);
  };
  const antesLleno = leer().length;
  try {
    disco.escribir(compilado('antes'));
    disco.escribir(deLargo(LIMITE + 1));
    disco.escribir(compilado('después'));
  } finally { fs.appendFileSync = anexar; }
  revisar(leer().length === antesLleno && disco.estado().falla && disco.estado().falla.pendientes === 3, 'con el disco lleno, el evento_descartado espera en la cola con los demás');
  disco.reintentar();
  const recuperadas = leer().slice(antesLleno);
  revisar(recuperadas.map((l) => (l.tipo === 'codigo_compilado' ? l.datos.codigo : l.tipo)).join() === 'antes,evento_descartado,después,registro_interrumpido' &&
    recuperadas[3].datos.recuperados === 3, `al recuperarse sale en su lugar, y registro_interrumpido lo cuenta (${recuperadas.map((l) => l.tipo).join(', ')})`);

  // La página: un evento que no cruza a la app (no se puede copiar) deja su evento_descartado, y la app lo cuenta
  const avisosPagina = avisos.length;
  const pagina = crearRegistroEventos({
    escribir: (l) => { if (l.datos && typeof l.datos.f === 'function') throw new Error('An object could not be cloned.'); disco.escribir(l); },
    versionTB: '0.4.0', versionTC: '0.2.0', ahora: () => reloj5, nuevaSesion: () => 's8',
  });
  pagina.empezar('D7', { placa: 'uno', nivel: 1 });
  const antesPagina = leer().length;
  pagina.registrar({ v: 1, t: reloj5, origen: 'simulador', tipo: 'falla', corrida: 5, ms_sim: 10, datos: { tipo: 'led_quemado', componente: 'led1', f: () => 1 } });
  pagina.editor('ejemplo_cargado', { id: 'eco' });
  const dePagina = leer().slice(antesPagina);
  revisar(dePagina.map((l) => l.tipo).join() === 'evento_descartado,ejemplo_cargado' && dePagina[0].sesion === 's8' && igual(dePagina[0].datos, { motivo: 'no_serializable', tipo: 'falla', origen: 'simulador', corrida: 5 }) &&
    avisos.length === avisosPagina + 1 && disco.estado().descartados.ultimo.tipo === 'falla' && (!revisarEvento || !revisarEvento(dePagina[0]).length),
  'la página: un evento que no se puede copiar deja evento_descartado con su sesión, y la app lo cuenta y lo avisa');
  fs.rmSync(base, { recursive: true, force: true });
}

console.log('— Cada exportación en su propia carpeta (AUD-08)');
{
  const os = require('os');
  const crypto = require('crypto');
  const { crearRegistroDisco } = require('../escritorio/registro-disco.js');
  const base = path.join(os.tmpdir(), 'tecnobloques-prueba-registro-exportar');
  if (path.dirname(path.resolve(base)) !== path.resolve(os.tmpdir())) throw new Error('Ruta temporal inesperada');
  fs.rmSync(base, { recursive: true, force: true });
  const carpeta = path.join(base, 'appdata');
  const reloj6 = new Date(2026, 9, 21, 12, 5).getTime(); // el mismo minuto en todas las exportaciones
  const disco = crearRegistroDisco({ carpeta, ahora: () => reloj6, version: '0.4.0' });
  disco.instructor({ accion: 'crear-pin', pin: '2468' });
  disco.instructor({ accion: 'activar', pin: '2468', activo: true });
  const ev = (equipo, n) => ({ v: 1, t: reloj6, origen: 'editor', tipo: 'bloques_cambiados', datos: { bloques: n, tipos: {} }, equipo, sesion: 's-' + equipo, version_tb: '0.4.0', version_tc: '0.2.0' });
  disco.escribir(ev('E1', 1));
  disco.escribir(ev('E2', 1));
  fs.mkdirSync(path.join(carpeta, 'registros', 'una-carpeta.jsonl')); // una carpeta con nombre de registro: no se copia
  const usb = path.join(base, 'usb');
  fs.mkdirSync(usb);
  const sha = (archivo) => crypto.createHash('sha256').update(fs.readFileSync(archivo)).digest('hex');
  const manifiesto = (c) => JSON.parse(fs.readFileSync(path.join(c, 'exportacion.json'), 'utf8'));
  /** Lo que dice exportacion.json coincide con los archivos de la carpeta, byte a byte */
  const cuadra = (c) => { const m = manifiesto(c); return m.archivos.every((a) => sha(path.join(c, a.archivo)) === a.sha256 && fs.statSync(path.join(c, a.archivo)).size === a.bytes); };

  revisar(igual(disco.archivos(), ['E1-2026-10-21.jsonl', 'E2-2026-10-21.jsonl']), 'archivos(): solo los .jsonl que son archivos (una carpeta con ese nombre no cuenta)');
  revisar(disco.exportar({ pin: '0000', destino: usb }).motivo === 'pin' && !fs.readdirSync(usb).length, 'control, con el PIN equivocado no se crea nada');
  const e1 = disco.exportar({ pin: '2468', destino: usb });
  const copiaE1 = path.join(e1.carpeta, 'E1-2026-10-21.jsonl');
  const antes = { bytes: fs.statSync(copiaE1).size, sha: sha(copiaE1) };
  disco.escribir(ev('E1', 2)); // entre las dos exportaciones, E1 cambia
  const e2 = disco.exportar({ pin: '2468', destino: usb });
  revisar(e1.ok && e2.ok && path.basename(e1.carpeta) === 'TecnoBloques-registros-2026-10-21_1205' && path.basename(e2.carpeta) === 'TecnoBloques-registros-2026-10-21_1205-2',
    `dos exportaciones del mismo minuto: dos carpetas (${path.basename(e1.carpeta)} y ${path.basename(e2.carpeta)})`);
  revisar(fs.statSync(copiaE1).size === antes.bytes && sha(copiaE1) === antes.sha && fs.statSync(path.join(e2.carpeta, 'E1-2026-10-21.jsonl')).size > antes.bytes,
    'la primera exportación no cambia (mismos bytes y sha256) y la segunda trae lo nuevo');
  const m1 = manifiesto(e1.carpeta);
  revisar(m1.completa === true && m1.total === 2 && m1.archivos.length === 2 && m1.version_tb === '0.4.0' && m1.t === reloj6 && cuadra(e1.carpeta) && cuadra(e2.carpeta) &&
    !fs.existsSync(path.join(e1.carpeta, 'una-carpeta.jsonl')), 'exportacion.json: completa, con el nombre, los bytes y el sha256 de cada archivo, y cuadra con lo copiado');
  // Lo que ya había en el destino no se toca: una carpeta y un archivo con los nombres siguientes
  fs.mkdirSync(path.join(usb, 'TecnoBloques-registros-2026-10-21_1205-3'));
  fs.writeFileSync(path.join(usb, 'TecnoBloques-registros-2026-10-21_1205-3', 'nota.txt'), 'de otra persona');
  fs.writeFileSync(path.join(usb, 'TecnoBloques-registros-2026-10-21_1205-4'), 'un archivo');
  const e3 = disco.exportar({ pin: '2468', destino: usb });
  revisar(e3.ok && path.basename(e3.carpeta) === 'TecnoBloques-registros-2026-10-21_1205-5' && fs.readdirSync(path.join(usb, 'TecnoBloques-registros-2026-10-21_1205-3')).join() === 'nota.txt' &&
    fs.readFileSync(path.join(usb, 'TecnoBloques-registros-2026-10-21_1205-4'), 'utf8') === 'un archivo', `con nombres ya ocupados (una carpeta y un archivo), usa el siguiente libre: ${path.basename(e3.carpeta)}`);

  // Una copia que falla a mitad: la carpeta queda, exportacion.json dice que está incompleta y la app lo sabe
  const copiar = fs.copyFileSync;
  let copias = 0;
  fs.copyFileSync = function (de, a, ...resto) {
    if (String(a).startsWith(usb) && ++copias === 2) throw Object.assign(new Error('ENOSPC sintético'), { code: 'ENOSPC' });
    return copiar.call(this, de, a, ...resto);
  };
  let e4;
  try { e4 = disco.exportar({ pin: '2468', destino: usb }); } finally { fs.copyFileSync = copiar; }
  const m4 = e4.carpeta && manifiesto(e4.carpeta);
  revisar(e4.ok === false && e4.motivo === 'copia-incompleta' && e4.copiados === 1 && e4.total === 2 && /E2-2026-10-21\.jsonl: ENOSPC/.test(e4.mensaje) &&
    m4.completa === false && m4.archivos.length === 1 && igual(m4.error, { archivo: 'E2-2026-10-21.jsonl', codigo: 'ENOSPC', donde: 'destino' }) && igual(m4.faltan, ['E2-2026-10-21.jsonl']) && e4.codigo === 'ENOSPC' && e4.donde === 'destino' && cuadra(e4.carpeta) && !fs.existsSync(path.join(e4.carpeta, 'E2-2026-10-21.jsonl')),
  `una copia que falla a mitad: «copia-incompleta» (${e4.copiados} de ${e4.total}) y exportacion.json con completa: false y el error`);
  // Si no se puede escribir exportacion.json, tampoco cuenta como completa
  const escribirArchivo = fs.writeFileSync;
  fs.writeFileSync = function (a, ...resto) { if (String(a).endsWith('exportacion.json')) throw Object.assign(new Error('EIO sintético'), { code: 'EIO' }); return escribirArchivo.call(this, a, ...resto); };
  let e5;
  try { e5 = disco.exportar({ pin: '2468', destino: usb }); } finally { fs.writeFileSync = escribirArchivo; }
  revisar(e5.ok === false && e5.motivo === 'copia-incompleta' && e5.copiados === 2 && /exportacion\.json: EIO/.test(e5.mensaje) && !fs.existsSync(path.join(e5.carpeta, 'exportacion.json')),
    'sin exportacion.json, la exportación no se da por completa');
  const e6 = disco.exportar({ pin: '2468', destino: path.join(base, 'usb-que-no-existe') });
  revisar(e6.ok === false && e6.motivo === 'disco' && !fs.existsSync(path.join(base, 'usb-que-no-existe')), 'un destino que ya no existe (se sacó la USB): «disco», sin crear nada');
  revisar(manifiesto(e1.carpeta).archivos.every((a) => sha(path.join(e1.carpeta, a.archivo)) === a.sha256) && sha(copiaE1) === antes.sha, 'después de todo, la primera exportación sigue igual');
  // La historia de dos exportaciones de lo mismo: cada línea se cuenta una vez (INT-06)
  const { leerArchivos, contarHistoria } = require('../herramientas/historia-registro.js');
  const hs = contarHistoria(leerArchivos([e1.carpeta, e2.carpeta]).lineas);
  revisar(hs.length === 2 && hs.find((h) => h.equipo === 'E1').notas.some((n) => /ya había llegado en otro archivo/.test(n)), 'la historia de las dos exportaciones cuenta cada línea una vez');
  fs.rmSync(base, { recursive: true, force: true });
}

console.log('— Lote de la auditoría profunda: configuración, anotación, sesiones y exportación (AUD-07, AUD-11, AUD-14)');
{
  const os = require('os');
  const { crearRegistroDisco } = require('../escritorio/registro-disco.js');
  const base = path.join(os.tmpdir(), 'tecnobloques-prueba-registro-lote');
  if (path.dirname(path.resolve(base)) !== path.resolve(os.tmpdir())) throw new Error('Ruta temporal inesperada');
  fs.rmSync(base, { recursive: true, force: true });
  let n = 0;
  const reloj7 = new Date(2026, 9, 21, 16, 0).getTime();
  const nuevo = (extra = {}) => {
    const carpeta = path.join(base, `caso-${++n}`);
    const avisos = [];
    const d = crearRegistroDisco({ carpeta, ahora: () => (extra.ahora ? extra.ahora() : reloj7), alDescartar: (x) => avisos.push(x), reintentoMs: 60000, version: '0.4.0' });
    d.instructor({ accion: 'crear-pin', pin: '2468' });
    d.instructor({ accion: 'activar', pin: '2468', activo: true });
    return { d, carpeta, avisos, registros: path.join(carpeta, 'registros') };
  };
  const ev = (extra = {}) => ({ v: 1, t: reloj7, origen: 'editor', tipo: 'ejemplo_cargado', datos: { id: 'x' }, equipo: 'L1', sesion: 's1', version_tb: '0.4.0', version_tc: '0.2.0', ...extra });
  const grande = (extra = {}) => ev({ tipo: 'codigo_compilado', datos: { ok: true, error: null, bytes: 1, codigo: 'x'.repeat(2 * 1024 * 1024) }, ...extra });
  const lineasDe = (f) => (fs.existsSync(f.registros) ? fs.readdirSync(f.registros) : []).filter((a) => a.endsWith('.jsonl'))
    .flatMap((a) => fs.readFileSync(path.join(f.registros, a), 'utf8').split('\n').filter(Boolean).map((l) => ({ archivo: a, ...JSON.parse(l) })));
  const lleno = (f, cuerpo) => {
    const anexar = fs.appendFileSync;
    fs.appendFileSync = function (a, ...resto) { if (String(a).startsWith(f.carpeta)) throw Object.assign(new Error('ENOSPC sintético'), { code: 'ENOSPC' }); return anexar.call(this, a, ...resto); };
    try { return cuerpo(); } finally { fs.appendFileSync = anexar; }
  };

  // AUD-11: una configuración que es JSON pero no sirve es ilegible, en los tres caminos, sin lanzar ni escribir
  const sal = '0'.repeat(32), resumen = 'a'.repeat(64);
  const malas = [['null', null], ['un arreglo', []], ['un número', 5], ['un texto', 'x'], ['true', true], ['un objeto vacío', {}], ['encendido sin PIN', { activo: true }],
    ['activo que no es booleano', { activo: 'si', pin: { sal, hash: resumen } }], ['un PIN vacío', { activo: true, pin: {} }], ['una sal que no es hexadecimal', { activo: true, pin: { sal: 'zz', hash: resumen } }],
    ['un resumen corto', { activo: false, pin: { sal, hash: 'ab' } }], ['un PIN que es un arreglo', { activo: false, pin: [] }]];
  for (const [nombre, valor] of malas) {
    const f = nuevo();
    const archivoConfig = path.join(f.carpeta, 'registro-config.json');
    const texto = JSON.stringify(valor);
    fs.writeFileSync(archivoConfig, texto);
    let lanzo = null;
    let entrar = null;
    try { f.d.escribir(ev()); entrar = f.d.instructor({ accion: 'entrar', pin: '2468' }); f.d.reintentar(); } catch (e) { lanzo = e.message; }
    const e = f.d.estado();
    revisar(!lanzo && e.configIlegible && !e.activo && e.falla && e.falla.motivo === 'CONFIG' && entrar && entrar.ok === false && entrar.motivo === 'config-ilegible' &&
      !lineasDe(f).length && fs.readFileSync(archivoConfig, 'utf8') === texto,
    `AUD-11, configuración con ${nombre}: ilegible (CONFIG), sin lanzar, sin escribir ni entrar, y el archivo queda igual${lanzo ? ` (lanzó: ${lanzo})` : ''}`);
  }
  {
    const f = nuevo();
    fs.writeFileSync(path.join(f.carpeta, 'registro-config.json'), JSON.stringify({ activo: true, pin: {} }));
    f.d.escribir(ev());
    const nuevoPin = f.d.instructor({ accion: 'crear-pin', pin: '1357', reemplazarIlegible: true });
    const aparte = fs.readdirSync(f.carpeta).filter((a) => /^registro-config-ilegible-/.test(a));
    revisar(nuevoPin.ok && !nuevoPin.configIlegible && aparte.length === 1 && fs.readFileSync(path.join(f.carpeta, aparte[0]), 'utf8') === '{"activo":true,"pin":{}}' && f.d.instructor({ accion: 'entrar', pin: '1357' }).ok,
      'AUD-11: una configuración mal formada se reemplaza con un PIN nuevo y la dañada queda aparte (como AUD-02-V2)');
  }
  {
    const f = nuevo();
    fs.writeFileSync(path.join(f.carpeta, 'registro-config.json'), JSON.stringify({ activo: false, pin: null }));
    const e = f.d.estado();
    revisar(!e.configIlegible && !e.activo && !e.tienePin && f.d.escribir(ev()) === false, 'control AUD-11: apagado y sin PIN es una configuración válida (como recién instalado)');
  }

  // F05: «anotado» solo cuando el evento_descartado quedó escrito; pendiente mientras espera; sin anotar si se pierde
  {
    const f = nuevo();
    lleno(f, () => f.d.escribir(grande()));
    const espera = f.d.estado().descartados;
    f.d.reintentar();
    const escrito = f.d.estado().descartados;
    revisar(espera.cantidad === 1 && espera.pendientes === 1 && espera.anotados === 0 && escrito.anotados === 1 && escrito.pendientes === 0 && f.avisos[f.avisos.length - 1].anotados === 1 &&
      lineasDe(f).some((l) => l.tipo === 'evento_descartado'), 'F05: con el disco lleno el marcador queda pendiente; al escribirse, anotado (y se avisa)');
  }
  for (const [nombre, llenar] of [['por número de líneas', (f) => { for (let i = 0; i < 5000; i++) f.d.escribir(ev({ datos: { id: 'x-' + i } })); }],
    // 10 líneas de exactamente 2 097 152 caracteres llenan los 20 MiB de la cola: ni el marcador corto cabe
    ['por tamaño', (f) => { const vacia = JSON.stringify(ev({ datos: { id: 'x', relleno: '' } })).length; for (let i = 0; i < 10; i++) f.d.escribir(ev({ datos: { id: 'x', relleno: 'y'.repeat(2 * 1024 * 1024 - vacia) } })); }]]) {
    const f = nuevo();
    lleno(f, () => { llenar(f); f.d.escribir(grande()); });
    const d = f.d.estado().descartados;
    f.d.reintentar();
    revisar(d.cantidad === 1 && d.sinAnotar === 1 && d.pendientes === 0 && !lineasDe(f).some((l) => l.tipo === 'evento_descartado') && lineasDe(f).some((l) => l.tipo === 'registro_interrumpido' && l.datos.perdidos >= 1),
      `F05: con la cola llena ${nombre}, el marcador no cupo: «sin anotar», y registro_interrumpido cuenta la pérdida`);
  }
  {
    const f = nuevo();
    lleno(f, () => f.d.escribir(grande()));
    f.d.instructor({ accion: 'activar', pin: '2468', activo: false });
    const d = f.d.estado().descartados;
    revisar(d.cantidad === 1 && d.sinAnotar === 1 && d.pendientes === 0 && f.avisos[f.avisos.length - 1].sinAnotar === 1, 'F05: si se apaga el registro con el marcador esperando, queda «sin anotar» (y se avisa)');
  }
  {
    const f = nuevo();
    f.d.escribir(grande());
    f.d.escribir(grande({ sesion: 's2', equipo: 'L2' }));
    f.d.escribir(grande({ sesion: 's2', equipo: 'L2' }));
    const d = f.d.estado().descartados;
    revisar(d.cantidad === 3 && d.anotados === 3 && d.sesiones.s1.cantidad === 1 && d.sesiones.s2.cantidad === 2 && d.sesiones.s2.anotados === 2,
      'la cuenta va también por sesión (la esquina avisa solo la del equipo actual)');
  }

  // A-02: el evento_descartado lleva la hora del evento perdido: queda en su lugar y en el archivo de su día
  {
    let ahoraAqui = new Date(2026, 9, 22, 0, 0, 5).getTime(); // la app lo procesa pasada la medianoche
    const f = nuevo({ ahora: () => ahoraAqui });
    const antes = new Date(2026, 9, 21, 23, 59, 59).getTime();
    f.d.escribir(grande({ t: antes }));
    f.d.escribir(ev({ t: antes + 2 }));
    const ls = lineasDe(f);
    const marcador = ls.find((l) => l.tipo === 'evento_descartado');
    revisar(marcador && marcador.t === antes && marcador.archivo === 'L1-2026-10-21.jsonl' && ls.every((l) => l.archivo === 'L1-2026-10-21.jsonl'),
      `A-02: el marcador lleva la hora del perdido y va al archivo de su día (${marcador && marcador.archivo})`);
    ahoraAqui += 1;
    f.d.escribir(grande({ t: 'ayer' }));
    revisar(lineasDe(f).filter((l) => l.tipo === 'evento_descartado').pop().t === ahoraAqui, 'control A-02: sin una hora válida, el marcador lleva la del momento');
  }

  // AUD-14: una carpeta de registros que no se puede leer no es «no hay registros»
  {
    const f = nuevo();
    f.d.escribir(ev());
    const usb = path.join(f.carpeta, 'usb');
    fs.mkdirSync(usb);
    const leerCarpeta = fs.readdirSync;
    fs.readdirSync = function (a, ...resto) { if (path.resolve(String(a)) === path.resolve(f.registros)) throw Object.assign(new Error('EACCES sintético'), { code: 'EACCES' }); return leerCarpeta.call(this, a, ...resto); };
    let r;
    try { r = f.d.exportar({ pin: '2468', destino: usb }); } finally { fs.readdirSync = leerCarpeta; }
    revisar(r.ok === false && r.motivo === 'disco' && r.donde === 'origen' && r.codigo === 'EACCES' && !fs.readdirSync(usb).length, 'AUD-14: sin permiso para leer los registros: «disco», del lado del origen, con su código, sin crear nada');
    const vacio = nuevo();
    revisar(vacio.d.exportar({ pin: '2468', destino: usb }).motivo === 'sin-archivos', 'control AUD-14: una carpeta de registros que todavía no existe sigue siendo «sin archivos»');
  }
  // A-04: una copia que escribe la mitad y falla no deja un .jsonl a medias; O-02: una copia con otro tamaño tampoco
  for (const [nombre, copiaMala] of [['escribe la mitad y falla', (de, a) => { fs.writeFileSync(a, fs.readFileSync(de).subarray(0, 10)); throw Object.assign(new Error('EIO sintético'), { code: 'EIO' }); }],
    ['termina con otro tamaño sin fallar', (de, a) => { fs.writeFileSync(a, fs.readFileSync(de).subarray(0, 10)); }]]) {
    const f = nuevo();
    f.d.escribir(ev());
    f.d.escribir(ev({ equipo: 'L2', sesion: 's2' }));
    const usb = path.join(f.carpeta, 'usb');
    fs.mkdirSync(usb);
    const copiar = fs.copyFileSync;
    let copias = 0;
    fs.copyFileSync = function (de, a, ...resto) { if (String(a).startsWith(usb) && ++copias === 2) return copiaMala(de, a); return copiar.call(this, de, a, ...resto); };
    let r;
    try { r = f.d.exportar({ pin: '2468', destino: usb }); } finally { fs.copyFileSync = copiar; }
    const quedan = fs.readdirSync(r.carpeta).sort();
    const m = JSON.parse(fs.readFileSync(path.join(r.carpeta, 'exportacion.json'), 'utf8'));
    revisar(r.ok === false && r.motivo === 'copia-incompleta' && r.copiados === 1 && quedan.join() === 'L1-2026-10-21.jsonl,exportacion.json' && m.completa === false && m.faltan.join() === 'L2-2026-10-21.jsonl',
      `una copia que ${nombre}: el pedazo se borra, «copia-incompleta» (${r.codigo}) y exportacion.json dice qué falta`);
  }
  {
    const f = nuevo();
    f.d.escribir(ev());
    const usb = path.join(f.carpeta, 'usb');
    fs.mkdirSync(usb);
    for (let i = 1; i <= 1000; i++) fs.mkdirSync(path.join(usb, `TecnoBloques-registros-2026-10-21_1600${i > 1 ? `-${i}` : ''}`));
    const r = f.d.exportar({ pin: '2468', destino: usb });
    revisar(r.ok === false && r.motivo === 'disco' && r.donde === 'destino' && r.codigo === 'TOPE' && fs.readdirSync(usb).length === 1000, 'con 1000 exportaciones del mismo minuto: «disco», del lado del destino, código TOPE, sin crear nada');
  }
  fs.rmSync(base, { recursive: true, force: true });
}

Promise.all(esperas).then(() => {
  console.log('— Las líneas cumplen el esquema del contrato');
  const REVISOR = path.join(__dirname, '..', '..', 'TecnoCircuito', 'prototipo', 'pruebas', 'contrato_eventos.js');
  if (!fs.existsSync(REVISOR)) {
    revisar(false, 'no encuentro el revisor de TecnoCircuito en ' + REVISOR);
  } else {
    const { revisarEvento } = require(REVISOR);
    const problemas = lineas.flatMap((l, i) => revisarEvento(l).map((p) => `${i + 1} (${l.tipo}): ${p}`));
    revisar(!problemas.length, `las ${lineas.length} líneas cumplen contrato/evento.schema.json` + (problemas.length ? ':\n  ' + problemas.join('\n  ') : ''));
  }
  console.log(fallos ? `\n${fallos} FALLA(S)` : '\nTODO BIEN');
  process.exit(fallos ? 1 : 0);
});
