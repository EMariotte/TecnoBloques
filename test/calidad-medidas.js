// Medidas de test:calidad que se pueden reconstruir (AUD-33, H2 de COD-20261116-002).
// - evaluarE6: el presupuesto D3 (DISENO-I6-CALIDAD, aceptado por Efraín) como función pura y sin redondear: abrir la
//   tarea y primera foto de A y B ≤ C0 + 20 %, memoria tras un bloque ≤ C0 + 50 MB. No cambia D3: lo escribe una vez.
// - texto: la comparación con valor, límite, referencia y exceso (o margen) en dos decimales; «45 ≤ 45» que falla ya
//   no se puede leer.
// - nombreArchivo e identidad: cada corrida guarda su JSON con nombre propio y con lo que la identifica.
// - revisarArchivo: recalcula la evaluación desde los tiempos guardados y la compara con la guardada.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const MB = 1048576;
const D3 = { abrir: 1.2, foto: 1.2, memoriaMB: 50 };

function evaluarE6(t) {
  const c = t.C0, salida = [];
  for (const variante of ['A', 'B']) {
    const r = t[variante];
    const fila = (medida, valor, referencia, limite, unidad) => {
      const cumple = valor !== null && valor !== undefined && referencia !== null && referencia !== undefined && valor <= limite;
      salida.push({ variante, medida, valor: valor ?? null, referencia: referencia ?? null, limite, exceso: valor === null || valor === undefined ? null : valor - limite, unidad, cumple });
    };
    fila('abrir', r.abrir, c.abrir, c.abrir * D3.abrir, 'ms');
    fila('foto', r.foto, c.foto, c.foto === null ? null : c.foto * D3.foto, 'ms');
    fila('memoria', r.heap, c.heap, c.heap + D3.memoriaMB * MB, 'B');
  }
  return salida;
}

const ms2 = (x) => `${x.toFixed(2)} ms`;
const mb2 = (x) => `${(x / MB).toFixed(2)} MB`;
const NOMBRE = { abrir: 'abrir la tarea', foto: 'primera foto', memoria: 'memoria tras un bloque' };
function texto(e) {
  const f = e.unidad === 'B' ? mb2 : ms2;
  const regla = e.medida === 'memoria' ? `C0 ${f(e.referencia)} + 50 MB` : `C0 ${e.referencia === null ? '—' : f(e.referencia)} + 20 %`;
  if (e.valor === null) return `E6 (${e.variante}): ${NOMBRE[e.medida]} sin medida (D3: ${regla})`;
  const dif = e.exceso > 0 ? `exceso +${f(e.exceso)}` : `margen ${f(-e.exceso)}`;
  return `E6 (${e.variante}): ${NOMBRE[e.medida]} ${f(e.valor)} ≤ ${f(e.limite)} (D3: ${regla}; ${dif})`;
}

function nombreArchivo(modos, inicio, pid) {
  const p = (n) => String(n).padStart(2, '0');
  const d = new Date(inicio);
  const sello = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  return `calidad${modos.length ? '-' + modos.map((m) => m.slice(2)).join('-') : ''}-${sello}-${pid}.json`;
}

const sha256 = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function git(raiz, args) { try { return execFileSync('git', args, { cwd: raiz, encoding: 'utf8' }).trim(); } catch (e) { return null; } }
function identidad({ raiz, modos, args }) {
  const html = path.join(raiz, 'dist', 'TecnoBloques.html');
  let simulador = null;
  if (fs.existsSync(html)) { const m = fs.readFileSync(html, 'utf8').match(/TB_SIMULADOR_ORIGEN\s*=\s*"([a-z]+)"/); simulador = m ? m[1] : null; }
  const estado = git(raiz, ['status', '--short']);
  return {
    version: JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8')).version,
    git: { head: git(raiz, ['rev-parse', 'HEAD']), sucio: estado === null ? null : estado.length > 0, cambios: estado ? estado.split('\n') : [] },
    prueba: { archivo: 'test/calidad-app.js', sha256: sha256(path.join(raiz, 'test', 'calidad-app.js')) },
    html: fs.existsSync(html) ? { archivo: 'dist/TecnoBloques.html', sha256: sha256(html), simulador } : null,
    // R1 de COD-20261116-003: los bytes del evaluador y las reglas que aplicó, aunque haya cambios sin commit
    evaluador: { archivo: 'test/calidad-medidas.js', sha256: sha256(__filename), d3: D3 },
    modos, args, inicio: new Date().toISOString(), node: process.version, plataforma: `${process.platform} ${process.arch}`,
  };
}

// Revisión de un JSON guardado (r1, F01 de COD-20261116-003). Primero la completitud: qué fases piden sus modos, cuáles
// declara y si terminó. Estados: «completa» (terminó con todas sus fases y todo cuadra), «parcial» (un checkpoint: no
// terminó; se describe sin excepciones, pero no se aprueba) e «invalida» (falta o no cuadra algo). Con la fase de
// recursos, E6 debe tener C0, A y B con números y la evaluación sus seis comparaciones, con todos sus campos iguales a
// los recalculados; si hay medidas exactas, cada mediana tiene que salir de ellas. Solo «completa» es ok.
const FASES = ['fallos', 'recursos', 'aria', 'web'];
const CAMPOS = ['variante', 'medida', 'valor', 'referencia', 'limite', 'exceso', 'unidad', 'cumple'];
const esNumero = (x) => typeof x === 'number' && Number.isFinite(x);
const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
function revisarArchivo(j) {
  const problemas = [];
  let comparaciones = 0, variantes = [];
  const fin = (estado) => ({ ok: estado === 'completa' && problemas.length === 0, estado: problemas.length && estado === 'completa' ? 'invalida' : estado, comparaciones, variantes, problemas });
  if (!j || typeof j !== 'object') { problemas.push('no es un objeto'); return fin('invalida'); }
  const id = j.identidad;
  if (!id || !id.prueba || !id.git || !Array.isArray(id.modos)) problemas.push('sin identidad o sin sus modos');
  if (!Array.isArray(j.fases) || j.fases.some((f) => !FASES.includes(f))) problemas.push('sin fases o con una fase desconocida');
  if (typeof j.terminada !== 'boolean') problemas.push('sin «terminada»');
  if (problemas.length) return fin('invalida');
  // r2 (F01 de COD-20261116-004): cada modo tiene que ser uno de los cuatro, antes de derivar las fases; si no, un
  // modo desconocido dejaba sin fases esperadas y una corrida vacía pasaba por «completa». [] son los cuatro.
  const raros = id.modos.filter((m) => typeof m !== 'string' || !FASES.includes(m.slice(2)) || !m.startsWith('--'));
  if (raros.length) { problemas.push(`modos desconocidos ${JSON.stringify(raros)}`); return fin('invalida'); }
  const esperadas = id.modos.length ? FASES.filter((f) => id.modos.includes('--' + f)) : FASES;
  if (j.fases.some((f) => !esperadas.includes(f))) problemas.push(`fases ${JSON.stringify(j.fases)} fuera de sus modos ${JSON.stringify(id.modos)}`);
  // E6: lo que haya, sin excepciones
  const E6 = j.E6;
  if (E6 !== undefined && (E6 === null || typeof E6 !== 'object')) problemas.push('E6 no es un objeto');
  else if (E6) {
    variantes = ['C0', 'A', 'B'].filter((v) => E6[v] !== undefined);
    for (const v of variantes) {
      const t = E6[v];
      if (!t || !esNumero(t.abrir) || !(t.foto === null || esNumero(t.foto)) || !esNumero(t.heap)) { problemas.push(`E6 ${v}: abrir, foto o memoria no son números`); continue; }
      for (const [campo, exactas] of [['abrir', 'abrirExactas'], ['foto', 'fotoExactas']]) {
        if (t[exactas] === undefined) continue;
        if (!Array.isArray(t[exactas]) || !t[exactas].length || !t[exactas].every(esNumero)) problemas.push(`E6 ${v}: ${exactas} no es una lista de números`);
        else if (mediana(t[exactas]) !== t[campo]) problemas.push(`E6 ${v}: ${campo} ${t[campo]} no es la mediana de ${exactas} (${mediana(t[exactas])})`);
      }
    }
  }
  if (!j.terminada) return fin('parcial');
  // Terminada: todas sus fases; con recursos, E6 entero y su evaluación
  const faltan = esperadas.filter((f) => !j.fases.includes(f));
  if (faltan.length) problemas.push(`terminada sin las fases ${faltan.join(', ')}`);
  if (j.fases.includes('recursos')) {
    if (!E6 || variantes.length !== 3) problemas.push(`con recursos, E6 debe tener C0, A y B (tiene ${variantes.join(', ') || 'nada'})`);
    else if (!problemas.some((p) => p.startsWith('E6'))) {
      const nueva = evaluarE6(E6), guardada = Array.isArray(j.evaluacionE6) ? j.evaluacionE6 : [];
      if (guardada.length !== nueva.length) problemas.push(`evaluación con ${guardada.length} comparaciones, se esperaban ${nueva.length}`);
      for (const e of nueva) {
        const g = guardada.find((x) => x && x.variante === e.variante && x.medida === e.medida);
        if (!g) { problemas.push(`falta ${e.variante}/${e.medida}`); continue; }
        const distintos = CAMPOS.filter((c) => g[c] !== e[c]);
        if (distintos.length) problemas.push(`${e.variante}/${e.medida}: ${distintos.join(', ')} no coinciden con lo recalculado`);
        else comparaciones++;
      }
    }
  } else if (E6 || j.evaluacionE6) problemas.push('E6 sin la fase de recursos');
  return fin('completa');
}

// Consumidor: node test/calidad-medidas.js --revisar <archivo.json | carpeta>. Revisa cada corrida (en una carpeta, los
// calidad*-AAAAMMDD-HHMMSS-pid.json), escribe las comparaciones recalculadas y sale 0 solo si hay al menos una y todas
// son «completa».
function consumidor(destino) {
  let archivos = [];
  try {
    archivos = fs.statSync(destino).isDirectory()
      ? fs.readdirSync(destino).filter((f) => /^calidad(-[a-z-]+)?-\d{8}-\d{6}-\d+\.json$/.test(f)).map((f) => path.join(destino, f))
      : [destino];
  } catch (e) { console.log(`no se puede leer ${destino}: ${e.code || e.message}`); return 1; }
  // r2: se presenta desde el resultado validado (F03: un JSON null cortaba la carpeta), y el resumen separa la validez
  // estructural, que decide la salida, de las comparaciones de D3 que no cumplen, que se muestran y no se ocultan.
  let malos = 0, d3total = 0, d3no = 0;
  for (const f of archivos) {
    let j = null;
    try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.log(`${path.basename(f)}: no se puede leer (${e.message})`); malos++; continue; }
    const r = revisarArchivo(j);
    const fases = j && typeof j === 'object' && Array.isArray(j.fases) ? JSON.stringify(j.fases) : '—';
    console.log(`${path.basename(f)}: ${r.estado}; fases ${fases}; ${r.comparaciones} comparaciones${r.problemas.length ? '; problemas: ' + r.problemas.join('; ') : ''}`);
    if (r.ok && j.E6) for (const e of evaluarE6(j.E6)) { d3total++; if (!e.cumple) d3no++; console.log(`  ${texto(e)} → ${e.cumple ? 'cumple' : 'NO cumple'}`); }
    if (!r.ok) malos++;
  }
  const validos = archivos.length - malos;
  console.log(`${archivos.length} archivo(s): ${validos} estructuralmente ${validos === 1 ? 'válido' : 'válidos'}, ${malos} ${malos === 1 ? 'inválido' : 'inválidos'}`);
  if (d3total) console.log(`D3: ${d3no} de ${d3total} comparaciones no cumplen (se informa; esta revisión no reemplaza la salida de test:calidad)`);
  return archivos.length && !malos ? 0 : 1;
}

module.exports = { evaluarE6, texto, nombreArchivo, identidad, revisarArchivo, D3 };
if (require.main === module) {
  const i = process.argv.indexOf('--revisar');
  if (i < 0 || !process.argv[i + 1]) { console.log('Uso: node test/calidad-medidas.js --revisar <archivo.json | carpeta>'); process.exit(2); }
  process.exit(consumidor(process.argv[i + 1]));
}
