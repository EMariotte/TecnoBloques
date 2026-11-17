// AUD-33 (H2 de COD-20261116-002): las medidas de test:calidad se pueden reconstruir.
// Prueba sin Electron de test/calidad-medidas.js (evaluación de D3 sin redondear, texto con valor, límite y exceso,
// nombre único por corrida, identidad y revisión de un JSON guardado), y con Electron el checkpoint por fase:
// `calidad-app.js --web --abortar-tras web` termina a propósito después de la fase y deja su JSON con la fase hecha.
// Uso: npm run test:calidad-medidas [-- --sin-electron]
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const RAIZ = path.join(__dirname, '..');
let fallos = 0;
function revisar(condicion, texto) {
  console.log((condicion ? 'OK    ' : 'FALLA ') + texto);
  if (!condicion) fallos++;
}
let M = null;
try { M = require('./calidad-medidas'); } catch (e) { revisar(false, `test/calidad-medidas.js existe y carga (${e.code || e.message})`); }
const MB = 1048576;
const tiemposBase = (abrirA, abrirC0 = 37.4) => ({
  C0: { abrir: abrirC0, foto: 1800, arranque: 60, heap: 7 * MB },
  A: { abrir: abrirA, foto: 1700, arranque: 62, heap: 7.3 * MB },
  B: { abrir: 41, foto: 1750, arranque: 63, heap: 7.3 * MB },
});
const buscar = (ev, v, medida) => (ev || []).find((e) => e.variante === v && e.medida === medida);

if (M) {
  // ---- Fronteras de D3 que el redondeo a ms escondía («45 ≤ 45» y falla)
  let ev = M.evaluarE6(tiemposBase(44.9));
  let a = buscar(ev, 'A', 'abrir');
  revisar(a && a.cumple === false && Math.abs(a.limite - 44.88) < 1e-9 && Math.abs(a.exceso - 0.02) < 1e-9,
    `D3 sin redondear: A 44,90 ms frente a C0 37,40 ms + 20 % (44,88 ms) no cumple, exceso +0,02 ms (${JSON.stringify(a)})`);
  const t = a ? M.texto(a) : '';
  revisar(/44\.90 ms/.test(t) && /44\.88 ms/.test(t) && /37\.40 ms/.test(t) && /exceso \+0\.02 ms/.test(t),
    `el texto muestra valor, límite, referencia y exceso con dos decimales («${t}»)`);
  revisar(Math.round(44.9) === Math.round(44.88), 'control: esas dos cifras redondeadas a ms son iguales (45 y 45), como en el log que no se podía reconstruir');
  ev = M.evaluarE6(tiemposBase(37.4 * 1.2));
  a = buscar(ev, 'A', 'abrir');
  revisar(a && a.cumple === true && a.exceso <= 0, `en el límite exacto cumple (≤): ${a && a.valor} ≤ ${a && a.limite}`);
  ev = M.evaluarE6(tiemposBase(44.87));
  a = buscar(ev, 'A', 'abrir');
  revisar(a && a.cumple === true && /margen 0\.01 ms/.test(M.texto(a)), `por debajo del límite cumple y el texto dice su margen («${a && M.texto(a)}»)`);
  const sinFoto = tiemposBase(40); sinFoto.B.foto = null;
  ev = M.evaluarE6(sinFoto);
  revisar(buscar(ev, 'B', 'foto') && buscar(ev, 'B', 'foto').cumple === false, 'sin primera foto, E6 no cumple');
  const memoria = tiemposBase(40); memoria.A.heap = 7 * MB + 50 * MB + 1;
  ev = M.evaluarE6(memoria);
  revisar(buscar(ev, 'A', 'memoria') && buscar(ev, 'A', 'memoria').cumple === false && buscar(ev, 'B', 'memoria').cumple === true,
    'memoria: C0 + 50 MB y un byte más no cumple; B dentro sí');
  revisar(ev.length === 6 && ['A', 'B'].every((v) => ['abrir', 'foto', 'memoria'].every((m) => buscar(ev, v, m))),
    `la evaluación tiene las seis comparaciones de D3 (A y B × abrir, foto, memoria): ${ev.length}`);

  // ---- Nombre único por corrida
  const n1 = M.nombreArchivo(['--recursos'], new Date('2026-11-16T22:10:05.123Z'), 101);
  const n2 = M.nombreArchivo(['--recursos'], new Date('2026-11-16T22:10:05.123Z'), 102);
  const n3 = M.nombreArchivo([], new Date('2026-11-16T22:10:06Z'), 101);
  revisar(n1 !== n2 && n1 !== n3 && /^calidad-recursos-\d{8}-\d{6}-101\.json$/.test(n1) && /^calidad-\d{8}-\d{6}-101\.json$/.test(n3),
    `nombre único por corrida, con sus modos (${n1}, ${n2}, ${n3})`);

  // ---- Identidad: versión, prueba y HTML con su hash
  const id = M.identidad({ raiz: RAIZ, modos: ['--web'], args: ['--web'] });
  const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  const html = path.join(RAIZ, 'dist', 'TecnoBloques.html');
  revisar(id.version === require(path.join(RAIZ, 'package.json')).version && id.prueba.sha256 === sha(path.join(__dirname, 'calidad-app.js')) &&
    (!fs.existsSync(html) || id.html.sha256 === sha(html)) && /^[0-9a-f]{40}$/.test(id.git.head) && typeof id.git.sucio === 'boolean' && Array.isArray(id.modos),
    `identidad de la corrida: versión ${id.version}, HEAD ${id.git && id.git.head && id.git.head.slice(0, 7)}, prueba y HTML con su sha256, simulador ${id.html && id.html.simulador}`);

  // ---- Revisión de un JSON guardado: se reconstruye la evaluación y se detecta lo alterado
  const guardado = { identidad: M.identidad({ raiz: RAIZ, modos: ['--recursos'], args: ['--recursos'] }), fases: ['recursos'], terminada: true, E6: tiemposBase(44.9) };
  guardado.evaluacionE6 = M.evaluarE6(guardado.E6);
  let r = M.revisarArchivo(guardado);
  revisar(r.ok && r.comparaciones === 6, `un JSON completo se reconstruye: ${r.comparaciones} comparaciones iguales (${r.problemas.join('; ') || 'sin problemas'})`);
  const alterado1 = JSON.parse(JSON.stringify(guardado)); buscar(alterado1.evaluacionE6, 'A', 'abrir').cumple = true;
  const alterado2 = JSON.parse(JSON.stringify(guardado)); alterado2.E6.A.abrir = 44.8;
  const alterado3 = JSON.parse(JSON.stringify(guardado)); delete alterado3.identidad;
  revisar(!M.revisarArchivo(alterado1).ok && !M.revisarArchivo(alterado2).ok && !M.revisarArchivo(alterado3).ok,
    'control: un «cumple» cambiado, un valor cambiado o la identidad borrada se rechazan');

  // ---- r1, F01 de COD-20261116-003: completitud según modos, fases y terminación, en la función y en el consumidor real
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-calidad-revisar-'));
  const consumidor = (j, nombre) => {
    const f = path.join(tmp, nombre + '.json');
    fs.writeFileSync(f, JSON.stringify(j));
    const p = spawnSync(process.execPath, [path.join(__dirname, 'calidad-medidas.js'), '--revisar', f], { encoding: 'utf8' });
    return { status: p.status, salida: String(p.stdout) + String(p.stderr) };
  };
  const exactas = (x) => [x - 2, x - 1, x, x + 1, x + 2];
  const completa = () => {
    const E6 = tiemposBase(44.9);
    for (const v of ['C0', 'A', 'B']) { E6[v].abrirExactas = exactas(E6[v].abrir); E6[v].fotoExactas = exactas(E6[v].foto); }
    return { identidad: M.identidad({ raiz: RAIZ, modos: [], args: [] }), fases: ['fallos', 'recursos', 'aria', 'web'], terminada: true, E6, evaluacionE6: M.evaluarE6(E6), E9web: { variante: 'C0' } };
  };
  const seguro = (j) => { try { return M.revisarArchivo(j); } catch (e) { return { lanzo: String(e) }; } };
  let c = completa(), r1 = seguro(c), k = consumidor(c, 'completa');
  revisar(r1.ok && r1.estado === 'completa' && r1.comparaciones === 6 && k.status === 0, `F01 control: una corrida completa es «completa», 6 comparaciones; el consumidor sale 0 (${r1.estado}; salida ${k.status})`);
  c = completa(); delete c.E6; delete c.evaluacionE6; r1 = seguro(c); k = consumidor(c, 'sin-e6');
  revisar(!r1.ok && r1.estado === 'invalida' && k.status !== 0, `F01: completa con recursos pero sin E6 ni evaluación se rechaza y el consumidor no sale 0 (${r1.estado}: ${(r1.problemas || []).join('; ')}; salida ${k.status})`);
  for (const [nombre, vars] of [['C0', ['C0']], ['C0+A', ['C0', 'A']]]) {
    c = completa(); c.terminada = false; c.fases = ['fallos'];
    for (const v of ['C0', 'A', 'B']) if (!vars.includes(v)) delete c.E6[v];
    delete c.evaluacionE6;
    r1 = seguro(c); k = consumidor(c, 'parcial-' + nombre);
    revisar(!r1.lanzo && !r1.ok && r1.estado === 'parcial' && k.status !== 0, `F01: un checkpoint con E6 de ${nombre} es «parcial», sin excepción, y no se aprueba (${r1.lanzo || r1.estado}; salida ${k.status})`);
  }
  for (const [campo, valor] of [['referencia', 0], ['exceso', -5], ['unidad', 'B']]) {
    c = completa(); buscar(c.evaluacionE6, 'A', 'abrir')[campo] = valor;
    r1 = seguro(c); k = consumidor(c, 'alterado-' + campo);
    revisar(!r1.ok && k.status !== 0, `F01: «${campo}» alterado en A/abrir se rechaza (${(r1.problemas || []).length} problemas; salida ${k.status})`);
  }
  c = completa(); c.E6.A.abrir = 44.95; c.evaluacionE6 = M.evaluarE6(c.E6); r1 = seguro(c);
  revisar(!r1.ok && /mediana/.test((r1.problemas || []).join(' ')), `F01: una mediana que no sale de sus medidas exactas se rechaza (${(r1.problemas || []).join('; ')})`);
  c = completa(); c.E6.A.abrir = 'x'; r1 = seguro(c);
  revisar(!r1.lanzo && !r1.ok && r1.estado === 'invalida', `F01: un tiempo que no es número se rechaza sin excepción (${r1.lanzo || r1.estado})`);
  c = completa(); c.fases = ['fallos', 'recursos', 'web']; r1 = seguro(c);
  revisar(!r1.ok && r1.estado === 'invalida', `F01: «terminada» sin una de las fases de sus modos se rechaza (${r1.estado}: ${(r1.problemas || []).join('; ')})`);
  c = { identidad: M.identidad({ raiz: RAIZ, modos: ['--web'], args: ['--web'] }), fases: ['web'], terminada: true, E9web: { variante: 'C0' } };
  r1 = seguro(c); k = consumidor(c, 'web-completa');
  revisar(r1.ok && r1.estado === 'completa' && r1.comparaciones === 0 && k.status === 0, `F01 control: un --web completo sin E6 es válido y el consumidor sale 0 (${r1.estado}; salida ${k.status})`);
  k = (() => { const p = spawnSync(process.execPath, [path.join(__dirname, 'calidad-medidas.js'), '--revisar', path.join(tmp, 'no-existe')], { encoding: 'utf8' }); return p.status; })();
  revisar(k !== 0, `F01: el consumidor sin archivos que revisar no sale 0 (salida ${k})`);

  // ---- r2, F01 y F03 de COD-20261116-004 y el resumen del consumidor
  const carpeta = (nombre, archivos) => {
    const d = path.join(tmp, nombre); fs.mkdirSync(d);
    archivos.forEach((j, i) => fs.writeFileSync(path.join(d, `calidad-2026111${i}-120000-${100 + i}.json`), JSON.stringify(j)));
    const p = spawnSync(process.execPath, [path.join(__dirname, 'calidad-medidas.js'), '--revisar', d], { encoding: 'utf8' });
    return { status: p.status, salida: String(p.stdout) + String(p.stderr) };
  };
  const sinFases = (modos) => { const j = completa(); j.identidad.modos = modos; j.fases = []; delete j.E6; delete j.evaluacionE6; delete j.E9web; return j; };
  for (const [nombre, modos] of [['desconocido', ['--recurso']], ['mezclado', ['--recursos', '--recurso']], ['no-texto', [5]]]) {
    const j = sinFases(modos); if (nombre === 'mezclado') { const c2 = completa(); j.fases = ['recursos']; j.E6 = c2.E6; j.evaluacionE6 = c2.evaluacionE6; }
    r1 = seguro(j); k = consumidor(j, 'modo-' + nombre); const kc = carpeta('modo-' + nombre, [j, completa()]);
    revisar(!r1.lanzo && !r1.ok && r1.estado === 'invalida' && k.status !== 0 && kc.status !== 0 && /1 inválido/.test(kc.salida),
      `F01 r2: modos ${JSON.stringify(modos)} → «invalida» sin excepción; el consumidor no sale 0, solo (${k.status}) ni en carpeta con uno válido (${kc.status}) (${r1.lanzo || (r1.problemas || []).join('; ')})`);
  }
  for (const [modos, fases] of [[['--web'], ['web']], [['--recursos'], ['recursos']], [[], ['fallos', 'recursos', 'aria', 'web']]]) {
    const j = completa(); j.identidad.modos = modos; j.fases = fases; if (!fases.includes('recursos')) { delete j.E6; delete j.evaluacionE6; }
    r1 = seguro(j);
    revisar(r1.ok && r1.estado === 'completa', `F01 r2, control: modos ${JSON.stringify(modos)} con fases ${JSON.stringify(fases)} sigue «completa» (${r1.estado}: ${(r1.problemas || []).join('; ')})`);
  }
  k = consumidor(null, 'nulo');
  revisar(k.status === 1 && !/TypeError|at .*calidad-medidas/.test(k.salida) && /nulo\.json: invalida/.test(k.salida) && /1 inválido/.test(k.salida),
    `F03: un JSON null se describe como inválido, sin excepción, y el consumidor sale 1 («${k.salida.trim().split('\n').join(' | ')}»)`);
  k = carpeta('nulo-y-valido', [null, completa()]);
  revisar(k.status === 1 && !/TypeError/.test(k.salida) && /: invalida/.test(k.salida) && /: completa/.test(k.salida) && /2 archivo\(s\): 1 estructuralmente válido, 1 inválido/.test(k.salida),
    `F03: en una carpeta [null, válido] se describen los dos y el resumen cuenta un inválido (salida ${k.status}; «${k.salida.trim().split('\n').slice(-2).join(' | ')}»)`);
  // Resumen: la validez estructural va aparte de D3; una corrida íntegra que no cumple D3 se muestra, no se oculta
  c = completa(); k = consumidor(c, 'no-cumple-d3');
  revisar(k.status === 0 && /NO cumple/.test(k.salida) && /1 estructuralmente válido, 0 inválidos/.test(k.salida) && /D3: 1 de 6 comparaciones no cumplen/.test(k.salida) && /no reemplaza/.test(k.salida),
    `resumen: una corrida íntegra con A/abrir fuera de D3 es estructuralmente válida (salida 0) y el resumen dice aparte que 1 de 6 no cumple (${k.salida.trim().split('\n').slice(-2).join(' | ')})`);
  fs.rmSync(tmp, { recursive: true, force: true });

  // ---- r1, R1 de COD-20261116-003: la identidad nombra los bytes del evaluador
  const idR1 = M.identidad({ raiz: RAIZ, modos: [], args: [] });
  revisar(idR1.evaluador && idR1.evaluador.archivo === 'test/calidad-medidas.js' && idR1.evaluador.sha256 === sha(path.join(__dirname, 'calidad-medidas.js')) && JSON.stringify(idR1.evaluador.d3) === JSON.stringify(M.D3),
    `R1: la identidad lleva el sha256 de test/calidad-medidas.js y las reglas de D3 aplicadas (${idR1.evaluador && idR1.evaluador.sha256 && idR1.evaluador.sha256.slice(0, 12)})`);
}

// ---- Checkpoint por fase, con Electron: abortar a propósito después de la fase web conserva lo hecho
if (!process.argv.includes('--sin-electron')) {
  const dir = path.join(os.tmpdir(), 'tecnobloques-prueba-calidad-medidas');
  if (path.dirname(path.resolve(dir)) !== path.resolve(os.tmpdir())) throw new Error('Ruta temporal inesperada');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'ELECTRON_RUN_AS_NODE'));
  const correr = (extra) => spawnSync(process.execPath, [path.join(__dirname, 'calidad-app.js'), '--web', '--medidas', dir, ...extra], { cwd: RAIZ, env, encoding: 'utf8', timeout: 180000 });
  const leer = () => fs.readdirSync(dir).filter((f) => /^calidad-web-.*\.json$/.test(f)).map((f) => ({ f, j: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }));
  let p = correr(['--abortar-tras', 'web']);
  let js = leer();
  revisar(p.status === 3 && js.length === 1 && js[0].j.terminada === false && JSON.stringify(js[0].j.fases) === '["web"]' && js[0].j.E9web && js[0].j.identidad,
    `abortar después de la fase web: salida ${p.status} (3 a propósito) y su JSON conserva la fase (${js.map((x) => `${x.f}: fases ${JSON.stringify(x.j.fases)}, terminada ${x.j.terminada}`).join('; ') || 'sin JSON'})`);
  p = correr([]);
  js = leer();
  const completo = js.find((x) => x.j.terminada === true);
  revisar(p.status === 0 && js.length === 2 && completo && JSON.stringify(completo.j.fases) === '["web"]',
    `una corrida completa deja otro JSON, terminado, sin pisar el anterior (salida ${p.status}; ${js.length} archivos)`);
  if (p.status !== 0) console.log(String(p.stdout).slice(-1500), String(p.stderr).slice(-800));
}

console.log(fallos ? `\n${fallos} FALLA(S)` : '\nTODO BIEN');
process.exit(fallos ? 1 : 0);
