/* ================= Monitor serial para analizar: registro, CSV y graficador =================
 * Pedido por Efraín el 9 oct 2026 (Fase 2d). Lo que llega por el monitor serial, de la placa real o del simulador,
 * se guarda línea por línea con su hora y los números que trae. De ahí salen el CSV y el gráfico.
 *
 * Formatos que entiende cada línea:
 *   «temp:25.3 luz:512», «temp=25.3», «Temperatura: 25.3 C»  → una variable por etiqueta
 *   «min 430 max 431 prom 430.5» (como validar_adc)            → etiqueta y número, en pares
 *   «512 3.7 1» o «512,3.7,1» (como el graficador del IDE)    → valor1, valor2, valor3
 *   «Inicio» (solo texto)                                       → la línea, sin números
 * «nan», «inf» y «ovf» (lo que imprime Arduino con un número inválido) quedan como un hueco.
 *
 * La parte del registro no toca la página: se prueba con Node (test/graficador.js). */

const NUMERO = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;
const NO_NUMERO = /^[-+]?(?:nan|inf|ovf)$/i;
const REGISTRO_MAX = 20000; // a 10 líneas por segundo, más de media hora
const ETIQUETAS_MAX = 40; // columnas de números como máximo (las que lleguen después quedan solo en la línea)
// Una etiqueta empieza con letra o «_»: «1:512» o «12:30» no son etiquetas (serían una columna nueva por cada lectura).
const ETIQUETA = /^[A-Za-z_ÁÉÍÓÚÜÑáéíóúüñ]/;

/** Un número de Arduino («25.3», «-4», «1e3»), NaN si es «nan»/«inf»/«ovf», o undefined si no es número. */
function valorSerial(t) {
  if (NUMERO.test(t)) return Number(t);
  if (NO_NUMERO.test(t)) return NaN;
  return undefined;
}

/** Los números de una línea: [[etiqueta, valor], …] en el orden en que aparecen. */
function leerValores(linea) {
  // «a: 1», «a = 1» y «a:1» quedan iguales; después se separa por espacios, comas, punto y coma o tabulaciones.
  const fichas = String(linea).trim().replace(/\s*[:=]\s*/g, ':').split(/[\s,;]+/).filter(Boolean);
  const valores = [];
  const sueltos = [];
  let etiqueta = null; // una palabra que espera su número («min» en «min 430»)
  for (const f of fichas) {
    const dosPuntos = f.indexOf(':');
    if (dosPuntos > 0 && ETIQUETA.test(f)) {
      const nombre = f.slice(0, dosPuntos);
      const resto = f.slice(dosPuntos + 1);
      const v = valorSerial(resto);
      if (v !== undefined) { valores.push([nombre, v]); etiqueta = null; }
      else etiqueta = resto === '' ? nombre : null; // «Temperatura:» espera el número que sigue
      continue;
    }
    if (dosPuntos > 0) { // «12:30» o «1:512»: dos números, no una etiqueta
      for (const parte of f.split(':')) {
        const v = valorSerial(parte);
        if (v === undefined) continue;
        if (etiqueta !== null) { valores.push([etiqueta, v]); etiqueta = null; } else sueltos.push(v);
      }
      continue;
    }
    const v = valorSerial(f);
    if (v === undefined) { etiqueta = ETIQUETA.test(f) ? f : null; continue; } // una palabra: la etiqueta del número que sigue
    if (etiqueta !== null) { valores.push([etiqueta, v]); etiqueta = null; }
    else sueltos.push(v);
  }
  // Números sin etiqueta: valor1, valor2… (como el graficador del IDE de Arduino)
  sueltos.forEach((v, i) => valores.push(['valor' + (i + 1), v]));
  // Si una etiqueta se repite en la misma línea, queda la última
  const vistos = new Map();
  for (const [k, v] of valores) vistos.set(k, v);
  return [...vistos];
}

/** El registro del monitor: líneas completas con su hora (ms), su origen y sus valores. */
function crearRegistro(max = REGISTRO_MAX) {
  const r = {
    lineas: [], // { t, origen, linea, valores: { etiqueta: número } }
    etiquetas: [], // en el orden en que aparecieron por primera vez (así cada una conserva su color)
    version: 0, // sube con cada línea nueva: el gráfico solo se repinta si cambió
  };
  const conocidas = new Set(); // las etiquetas, para buscarlas rápido
  const parcial = {}; // origen → lo que llegó sin fin de línea todavía
  const base = {}; // origen → ms que se suman (para que el tiempo siga cuando se reconecta o se simula de nuevo)
  const ultimo = {}; // origen → último ms registrado
  let trasCR = {}; // origen → el trozo anterior terminó en \r (un \n al empezar el siguiente no es otra línea)

  /** Agrega un trozo de texto. `t`: ms desde que se conectó la placa o desde que empezó la simulación. */
  r.agregar = (texto, origen, t) => {
    let s = String(texto).replace(/\0/g, '');
    if (trasCR[origen] && s.startsWith('\n')) s = s.slice(1);
    trasCR[origen] = s.endsWith('\r');
    s = s.replace(/\r\n?/g, '\n');
    const partes = ((parcial[origen] || '') + s).split('\n');
    parcial[origen] = partes.pop();
    const tiempo = (base[origen] || 0) + Math.max(0, Number(t) || 0);
    for (const linea of partes) {
      const valores = {};
      for (const [k, v] of leerValores(linea)) {
        if (!conocidas.has(k)) {
          if (r.etiquetas.length >= ETIQUETAS_MAX) continue;
          conocidas.add(k);
          r.etiquetas.push(k);
        }
        valores[k] = v;
      }
      r.lineas.push({ t: tiempo, origen, linea, valores });
      ultimo[origen] = tiempo;
    }
    if (r.lineas.length > max + Math.ceil(max / 20)) r.lineas.splice(0, r.lineas.length - max); // por bloques: barato
    if (partes.length) r.version++;
  };
  /** Una conexión o simulación nueva: el tiempo de ese origen sigue desde donde iba (no vuelve a 0). */
  r.continuar = (origen) => {
    base[origen] = ultimo[origen] !== undefined ? ultimo[origen] + 1 : 0;
    parcial[origen] = '';
    trasCR[origen] = false;
  };
  r.limpiar = () => {
    r.lineas.length = 0;
    r.etiquetas.length = 0;
    conocidas.clear();
    for (const k of Object.keys(parcial)) parcial[k] = '';
    for (const k of Object.keys(base)) delete base[k];
    for (const k of Object.keys(ultimo)) delete ultimo[k];
    trasCR = {};
    r.version++;
  };
  /** El CSV para Excel en español: separado por «;», coma decimal y marca UTF-8 (para las tildes). */
  r.csv = () => {
    const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? String(v).replace('.', ',') : '');
    // Un texto que empieza con = + - @ (como «=== Inicio ===») Excel lo tomaría como fórmula: va con un apóstrofo.
    const texto = (s) => '"' + (/^[=+\-@\t\r]/.test(String(s)) ? "'" : '') + String(s).replace(/"/g, '""') + '"';
    const filas = [['t_ms', 'origen', 'linea', ...r.etiquetas.map(texto)].join(';')];
    for (const l of r.lineas) {
      filas.push([Math.round(l.t), l.origen, texto(l.linea), ...r.etiquetas.map((k) => (k in l.valores ? num(l.valores[k]) : ''))].join(';'));
    }
    return '﻿' + filas.join('\r\n') + '\r\n';
  };
  return r;
}

/* ---------------- Graficador (en la página) ----------------
 * Dibuja en un canvas, sin librerías (funciona sin internet). Una línea por variable, en el color que le toca por
 * su orden de llegada (8 colores de una paleta probada para daltonismo; ver --serie-1 a --serie-8 en style.css).
 * Solo se dibuja mientras está a la vista, y solo cuando llega algo nuevo o se mueve el mouse. */
const SERIES_MAX = 8;

// Marcas «redondas» para los ejes: 1, 2, 5 × 10^n
function marcasEje(min, max, cuantas) {
  const paso0 = (max - min) / Math.max(1, cuantas);
  if (!(paso0 > 0) || !Number.isFinite(paso0)) return [min];
  const p10 = Math.pow(10, Math.floor(Math.log10(paso0)));
  const paso = [1, 2, 5, 10].map((m) => m * p10).find((p) => p >= paso0) || p10 * 10;
  const r = [];
  const desde = Math.ceil(min / paso);
  // Con números enormes, sumar el paso puede no cambiar nada: se cuenta por índice y con tope
  for (let n = 0; n < 50; n++) {
    const v = (desde + n) * paso;
    if (v > max + paso * 1e-9) break;
    r.push(v);
  }
  return r.length ? r : [min];
}

function crearGraficador(caja, registro) {
  const doc = caja.ownerDocument;
  const nuevo = (tag, attrs = {}, ...hijos) => {
    const e = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    e.append(...hijos);
    return e;
  };
  const opciones = (lista) => lista.map(([v, t]) => nuevo('option', { value: v }, t));
  const leyenda = nuevo('div', { class: 'graf-leyenda', role: 'group', 'aria-label': 'Variables del gráfico' });
  const selVentana = nuevo('select', { 'aria-label': 'Tiempo que se ve' }, ...opciones([['5000', '5 s'], ['10000', '10 s'], ['30000', '30 s'], ['60000', '60 s']]));
  selVentana.value = '10000';
  const selEscala = nuevo('select', { 'aria-label': 'Escala' }, ...opciones([['auto', 'Escala automática'], ['1023', '0 a 1023 (analogRead)'], ['5', '0 a 5 V']]));
  const btnPausa = nuevo('button', { type: 'button', class: 'btn chico', 'aria-pressed': 'false' }, '⏸ Pausar');
  const nota = nuevo('span', { class: 'graf-nota', 'aria-live': 'polite' });
  const lienzo = nuevo('canvas', { class: 'graf-canvas', role: 'img', 'aria-label': 'Gráfico del monitor serial' });
  const tip = nuevo('div', { class: 'graf-tip', hidden: '' });
  const vacio = nuevo('p', { class: 'graf-vacio' },
    'Todavía no hay números para graficar. El programa debe imprimir líneas como «temp:25 luz:512», «min 430 max 431» o números separados por espacios.');
  const area = nuevo('div', { class: 'graf-area' }, lienzo, tip, vacio);
  caja.append(nuevo('div', { class: 'graf-barra' }, leyenda, nuevo('span', { class: 'graf-hueco' }), nota, selVentana, selEscala, btnPausa), area);

  const ocultas = new Set(); // etiquetas que el aprendiz apagó
  let visible = false;
  let pausa = null; // { tFin } mientras está en pausa
  let pintado = -1;
  let cuadro = 0;
  let raton = null; // x del mouse sobre el canvas (px CSS)
  let etiquetasEnLeyenda = '';

  const colorDe = (k) => `var(--serie-${registro.etiquetas.indexOf(k) + 1})`;

  function pintarLeyenda() {
    const clave = registro.etiquetas.join('\u0000'); // marcar una casilla no rehace la leyenda (no pierde el foco)
    if (clave === etiquetasEnLeyenda) return;
    etiquetasEnLeyenda = clave;
    leyenda.textContent = '';
    registro.etiquetas.forEach((k, i) => {
      if (i >= SERIES_MAX) return;
      const casilla = nuevo('input', { type: 'checkbox' });
      casilla.checked = !ocultas.has(k);
      casilla.addEventListener('change', () => { if (casilla.checked) ocultas.delete(k); else ocultas.add(k); pedir(); });
      leyenda.append(nuevo('label', { class: 'graf-serie' }, casilla, nuevo('span', { class: 'graf-muestra', style: `background:${colorDe(k)}` }), k));
    });
    if (registro.etiquetas.length > SERIES_MAX) {
      leyenda.append(nuevo('span', { class: 'graf-nota' }, `y ${registro.etiquetas.length - SERIES_MAX} más (se grafican las primeras ${SERIES_MAX}; todas van en el CSV)`));
    }
  }

  // Las líneas que se ven: las del último origen (placa o simulador), dentro de la ventana de tiempo.
  function datos() {
    const L = registro.lineas;
    if (!L.length) return null;
    // La placa y el simulador llevan relojes distintos: se grafica uno (el del último dato, o el de la pausa)
    const origen = pausa ? pausa.origen : L[L.length - 1].origen;
    const tFin = pausa ? pausa.tFin : L[L.length - 1].t;
    let tIni = tFin - Number(selVentana.value);
    const filas = [];
    for (let i = L.length - 1; i >= 0; i--) {
      if (L[i].origen !== origen) continue;
      if (L[i].t < tIni - 1000) break;
      if (L[i].t <= tFin) filas.push(L[i]);
    }
    filas.reverse();
    // Mientras no se llena la ventana, el gráfico empieza en el primer dato (las líneas usan todo el ancho)
    if (filas.length && filas[0].t > tIni) tIni = Math.min(filas[0].t, tFin - 1000);
    const series = registro.etiquetas.slice(0, SERIES_MAX).filter((k) => !ocultas.has(k) && filas.some((f) => k in f.valores));
    return { filas, series, tIni, tFin, origen };
  }

  const textoNumero = (v) => (Math.abs(v) >= 1000 || Number.isInteger(v) ? String(Math.round(v * 100) / 100) : String(+v.toPrecision(4))).replace('.', ',');

  const aLaVista = () => visible && caja.offsetParent !== null; // otra pestaña o la vista de bloques: no se dibuja
  function pintar() {
    cuadro = 0;
    if (!aLaVista()) return;
    pintado = registro.version;
    pintarLeyenda();
    const d = datos();
    const conDatos = d && d.series.length;
    vacio.hidden = !!conDatos;
    nota.textContent = pausa ? 'En pausa: el registro sigue guardando' : d ? (d.origen === 'simulador' ? 'Simulador · tiempo simulado' : 'Placa') : '';
    const dpr = window.devicePixelRatio || 1;
    const W = lienzo.clientWidth;
    const H = lienzo.clientHeight;
    if (lienzo.width !== Math.round(W * dpr) || lienzo.height !== Math.round(H * dpr)) {
      lienzo.width = Math.round(W * dpr);
      lienzo.height = Math.round(H * dpr);
    }
    const g = lienzo.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    tip.hidden = true;
    if (!conDatos || W < 50 || H < 50) return;

    const css = getComputedStyle(caja);
    const tinta = css.getPropertyValue('--ink').trim();
    const suave = css.getPropertyValue('--muted').trim();
    const linea = css.getPropertyValue('--line').trim();
    const colores = Object.fromEntries(d.series.map((k) => [k, css.getPropertyValue(`--serie-${registro.etiquetas.indexOf(k) + 1}`).trim()]));

    // Escala vertical
    let yMin;
    let yMax;
    if (selEscala.value === '1023') [yMin, yMax] = [0, 1023];
    else if (selEscala.value === '5') [yMin, yMax] = [0, 5];
    else {
      yMin = Infinity;
      yMax = -Infinity;
      for (const f of d.filas) for (const k of d.series) {
        const v = f.valores[k];
        if (f.t >= d.tIni && Number.isFinite(v)) { yMin = Math.min(yMin, v); yMax = Math.max(yMax, v); }
      }
      if (!Number.isFinite(yMin)) [yMin, yMax] = [0, 1];
      if (yMax - yMin <= Math.abs(yMax) * 1e-9) { const d = Math.max(1, Math.abs(yMax) * 0.01); yMin -= d; yMax += d; }
      const margen = (yMax - yMin) * 0.08;
      yMin -= margen;
      yMax += margen;
    }
    g.font = '11px system-ui, sans-serif';
    const ticksY = marcasEje(yMin, yMax, Math.max(2, Math.floor(H / 50)));
    const izq = Math.max(...ticksY.map((v) => g.measureText(textoNumero(v)).width)) + 12;
    // Espacio a la derecha para la etiqueta al final de cada línea (con 4 variables o menos), medido con su texto
    const ultimoDe = (k) => {
      for (let i = d.filas.length - 1; i >= 0; i--) if (Number.isFinite(d.filas[i].valores[k])) return d.filas[i].valores[k];
      return null;
    };
    const ultimos = Object.fromEntries(d.series.map((k) => [k, ultimoDe(k)]));
    const der = d.series.length <= 4
      ? 24 + Math.max(0, ...d.series.map((k) => (ultimos[k] === null ? 0 : g.measureText(`${k} ${textoNumero(ultimos[k])}`).width)))
      : 16;
    const arriba = 10;
    const abajo = 24;
    const ancho = W - izq - der;
    const alto = H - arriba - abajo;
    const X = (t) => izq + ((t - d.tIni) / (d.tFin - d.tIni || 1)) * ancho;
    const Y = (v) => arriba + (1 - (v - yMin) / (yMax - yMin || 1)) * alto;

    // Rejilla y ejes (discretos)
    g.lineWidth = 1;
    g.strokeStyle = linea;
    g.fillStyle = suave;
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    for (const v of ticksY) {
      const y = Math.round(Y(v)) + 0.5;
      g.beginPath(); g.moveTo(izq, y); g.lineTo(izq + ancho, y); g.stroke();
      g.fillText(textoNumero(v), izq - 6, y);
    }
    g.textAlign = 'center';
    g.textBaseline = 'top';
    for (const s of marcasEje(d.tIni / 1000, d.tFin / 1000, Math.max(2, Math.floor(ancho / 90)))) {
      const x = X(s * 1000);
      if (s < 0 || x < izq - 1 || x > izq + ancho + 1) continue; // antes de empezar no hay tiempo que mostrar
      g.fillText(textoNumero(s) + ' s', x, arriba + alto + 6);
    }

    // Las líneas (2 px); un «nan» corta la línea
    g.save();
    g.beginPath(); g.rect(izq, arriba - 2, ancho, alto + 4); g.clip();
    g.lineWidth = 2;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    for (const k of d.series) {
      g.strokeStyle = colores[k];
      g.beginPath();
      let enLinea = false;
      let puntos = 0;
      for (const f of d.filas) {
        if (!(k in f.valores)) continue;
        const v = f.valores[k];
        if (!Number.isFinite(v)) { enLinea = false; continue; }
        const x = X(f.t);
        const y = Y(v);
        if (enLinea) g.lineTo(x, y); else g.moveTo(x, y);
        enLinea = true;
        puntos++;
      }
      g.stroke();
      if (puntos === 1) { // un solo punto: que se vea
        const f = d.filas.find((x) => Number.isFinite(x.valores[k]));
        g.fillStyle = colores[k];
        g.beginPath(); g.arc(X(f.t), Y(f.valores[k]), 4, 0, Math.PI * 2); g.fill();
      }
    }
    g.restore();

    // Etiqueta al final de cada línea (con 4 variables o menos): el último valor, sin pisarse entre ellas
    if (d.series.length <= 4) {
      const finales = d.series.filter((k) => ultimos[k] !== null).map((k) => ({ k, v: ultimos[k], y: Y(ultimos[k]) })).sort((a, b) => a.y - b.y);
      for (let i = 1; i < finales.length; i++) finales[i].y = Math.max(finales[i].y, finales[i - 1].y + 14);
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      for (const e of finales) {
        const y = Math.min(Math.max(e.y, arriba + 6), arriba + alto);
        g.fillStyle = colores[e.k];
        g.beginPath(); g.arc(izq + ancho + 8, y, 3.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = tinta;
        g.fillText(`${e.k} ${textoNumero(e.v)}`, izq + ancho + 15, y);
      }
    }

    // Al pasar el mouse: una línea vertical en la muestra más cercana y sus valores
    if (raton !== null && raton >= izq && raton <= izq + ancho) {
      const tRaton = d.tIni + ((raton - izq) / ancho) * (d.tFin - d.tIni);
      let cerca = null;
      for (const f of d.filas) if (d.series.some((k) => k in f.valores) && (!cerca || Math.abs(f.t - tRaton) < Math.abs(cerca.t - tRaton))) cerca = f;
      if (cerca && cerca.t >= d.tIni) {
        const x = Math.round(X(cerca.t)) + 0.5;
        g.strokeStyle = suave;
        g.lineWidth = 1;
        g.beginPath(); g.moveTo(x, arriba); g.lineTo(x, arriba + alto); g.stroke();
        for (const k of d.series) {
          const v = cerca.valores[k];
          if (!Number.isFinite(v)) continue;
          g.fillStyle = colores[k];
          g.beginPath(); g.arc(x, Y(v), 4, 0, Math.PI * 2); g.fill();
        }
        tip.textContent = '';
        tip.append(nuevo('b', {}, `${textoNumero(cerca.t / 1000)} s`));
        for (const k of d.series) {
          if (!(k in cerca.valores)) continue;
          const v = cerca.valores[k];
          tip.append(nuevo('div', {}, nuevo('span', { class: 'graf-muestra', style: `background:${colorDe(k)}` }), `${k} ${Number.isFinite(v) ? textoNumero(v) : '—'}`));
        }
        tip.hidden = false;
        const anchoTip = tip.offsetWidth;
        tip.style.left = (x + 12 + anchoTip > W ? x - 12 - anchoTip : x + 12) + 'px';
        tip.style.top = arriba + 4 + 'px';
      }
    }
  }

  function pedir() {
    if (!aLaVista()) return;
    if (!cuadro) cuadro = requestAnimationFrame(pintar);
  }
  // Mientras está a la vista, revisa unas 30 veces por segundo si llegó algo nuevo (y solo entonces repinta).
  // Nota: el fin de línea se trata aquí, en limpiarSerial (texto del monitor) y en salidaSim, con la misma regla.
  let reloj = 0;
  function vigilar() {
    if (registro.version !== pintado && !pausa) pedir();
  }

  lienzo.addEventListener('pointermove', (e) => { raton = e.offsetX; pedir(); });
  lienzo.addEventListener('pointerleave', () => { raton = null; pedir(); });
  selVentana.addEventListener('change', () => pedir());
  selEscala.addEventListener('change', () => pedir());
  btnPausa.addEventListener('click', () => {
    const L = registro.lineas;
    pausa = pausa ? null : { tFin: L.length ? L[L.length - 1].t : 0, origen: L.length ? L[L.length - 1].origen : null };
    btnPausa.textContent = pausa ? '▶ Seguir' : '⏸ Pausar';
    btnPausa.setAttribute('aria-pressed', String(!!pausa));
    pedir();
  });
  new ResizeObserver(() => pedir()).observe(area);

  return {
    mostrar(si) {
      visible = !!si;
      clearInterval(reloj);
      if (visible) { reloj = setInterval(vigilar, 33); pedir(); }
    },
    /** Para las pruebas: qué se ve ahora. */
    estado() {
      const d = datos();
      return { series: d ? d.series : [], filas: d ? d.filas.length : 0, pausa: !!pausa, ocultas: [...ocultas], origen: d ? d.origen : null };
    },
  };
}

if (typeof module !== 'undefined') module.exports = { leerValores, crearRegistro, valorSerial, marcasEje };
