/* =====================================================================
   TecnoBloques — interfaz: espacio de bloques, código, Mis bloques,
   proyectos y monitor serial
   ===================================================================== */
'use strict';

let espacio = null;
let embebidos = {};
let ultimo = { codigo: '', avisos: [], externos: [] };
const estado = { texto: null, vista: 'dividido', baudiosManual: false };
const CLAVE_NIVEL = 'tecnobloques.nivel.v1';
const $ = (id) => document.getElementById(id);

/* ---------- Almacenamiento local seguro ---------- */
const CLAVE_LIB = 'tecnobloques.misBloques.v1';
const CLAVE_AUTO = 'tecnobloques.autoguardado.v1';
const CLAVE_PREF = 'tecnobloques.preferencias.v1';
let libCache = null;
function leerLibreria() {
  if (libCache) return libCache;
  try {
    const t = localStorage.getItem(CLAVE_LIB);
    libCache = t ? (JSON.parse(t).bloques || {}) : {};
  } catch (e) { libCache = {}; }
  return libCache;
}
function escribirLibreria(lib) {
  libCache = lib;
  try { localStorage.setItem(CLAVE_LIB, JSON.stringify({ app: 'TecnoBloques', version: 1, bloques: lib })); return true; }
  catch (e) { mostrarToast('No se pudo guardar en este navegador. Exporta tu librería para no perderla.'); return false; }
}
function guardarLocal(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
function leerLocal(k) { try { const t = localStorage.getItem(k); return t ? JSON.parse(t) : null; } catch (e) { return null; } }

/* ---------- Utilidades de interfaz ---------- */
function el(tag, props, ...hijos) {
  const e = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) e.setAttribute(k, v);
  }
  for (const h of hijos.flat()) if (h !== null && h !== undefined) e.append(h.nodeType ? h : document.createTextNode(String(h)));
  return e;
}
let toastTimer = null;
function mostrarToast(msg) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}
let modalCancelar = null;
function modal({ titulo, cuerpo, botones, cancelar, alAbrir }) {
  $('modalTitulo').textContent = titulo;
  const c = $('modalCuerpo'); c.innerHTML = '';
  (Array.isArray(cuerpo) ? cuerpo : [cuerpo]).forEach(n => c.append(typeof n === 'string' ? el('p', null, n) : n));
  const a = $('modalAcciones'); a.innerHTML = '';
  modalCancelar = cancelar || null;
  (botones || [{ texto: 'Cerrar', primario: true }]).forEach(b => {
    a.append(el('button', {
      type: 'button', class: 'btn' + (b.primario ? ' primario' : ''),
      onclick: async () => { const r = b.accion ? await b.accion() : undefined; if (r !== false) cerrarModal(false); }
    }, b.texto));
  });
  $('modal').hidden = false;
  setTimeout(() => {
    const f = c.querySelector('input, textarea, select') || a.querySelector('.primario') || a.querySelector('button');
    if (f) f.focus();
    if (alAbrir) alAbrir();
  }, 20);
}
function cerrarModal(porCancelar) {
  $('modal').hidden = true;
  const cb = modalCancelar; modalCancelar = null;
  if (porCancelar && cb) cb();
}
$('modal').addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarModal(true); });
$('modal').addEventListener('mousedown', (e) => { if (e.target === $('modal')) cerrarModal(true); });

async function copiarTexto(t) {
  try { await navigator.clipboard.writeText(t); mostrarToast('Copiado al portapapeles'); return true; }
  catch (e) { return false; }
}
function descargar(nombre, contenido, tipo) {
  try {
    const url = URL.createObjectURL(new Blob([contenido], { type: tipo || 'text/plain' }));
    const a = el('a', { href: url, download: nombre });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (e) { /* el visor puede bloquear descargas */ }
}
function modalExportar(titulo, nombreArchivo, contenido, tipo, explicacion) {
  const ta = el('textarea', { readonly: 'readonly', 'aria-label': 'Contenido' }); ta.value = contenido;
  modal({
    titulo,
    cuerpo: [explicacion ? el('p', null, explicacion) : null, el('p', { class: 'muted' }, 'Archivo: ', el('code', null, nombreArchivo)), ta,
      el('p', { class: 'muted' }, 'Si la descarga no inicia (por ejemplo en la vista previa de Claude), usa Copiar y pégalo donde lo necesites.')].filter(Boolean),
    botones: [
      { texto: 'Copiar', accion: async () => { if (!(await copiarTexto(contenido))) { ta.focus(); ta.select(); mostrarToast('Selecciona y copia con Ctrl+C'); } return false; } },
      { texto: 'Descargar', primario: true, accion: () => { descargar(nombreArchivo, contenido, tipo); return false; } },
      { texto: 'Cerrar' }
    ]
  });
}
function nombreArchivoBase() {
  return (nombreC($('nombreProyecto').value || 'proyecto').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'proyecto');
}

/* ---------- Diálogos de Blockly (prompt/confirm del navegador no funcionan en todos lados) ---------- */
Blockly.dialog.setAlert((msg, cb) => modal({ titulo: 'Aviso', cuerpo: msg, botones: [{ texto: 'Entendido', primario: true, accion: () => { cb && cb(); } }], cancelar: cb }));
Blockly.dialog.setConfirm((msg, cb) => modal({
  titulo: 'Confirmar', cuerpo: msg,
  botones: [{ texto: 'Cancelar', accion: () => cb(false) }, { texto: 'Aceptar', primario: true, accion: () => cb(true) }],
  cancelar: () => cb(false)
}));
Blockly.dialog.setPrompt((msg, def, cb) => {
  const inp = el('input', { class: 'entrada', value: def || '', 'aria-label': msg });
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); cerrarModal(false); cb(inp.value); } });
  modal({
    titulo: msg, cuerpo: inp,
    botones: [{ texto: 'Cancelar', accion: () => cb(null) }, { texto: 'Aceptar', primario: true, accion: () => cb(inp.value) }],
    cancelar: () => cb(null)
  });
});

/* ---------- Tema de Blockly ---------- */
const ESTILOS_BLOQUES = {
  logic_blocks: { colourPrimary: COL.logica }, loop_blocks: { colourPrimary: COL.bucles },
  math_blocks: { colourPrimary: COL.mate }, text_blocks: { colourPrimary: COL.texto },
  variable_blocks: { colourPrimary: COL.variables }, procedure_blocks: { colourPrimary: COL.funciones }
};
const FUENTE = { family: '"Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif', weight: 'bold', size: 11 };
const TEMA_CLARO = Blockly.Theme.defineTheme('tecno_claro', {
  base: Blockly.Themes.Classic, blockStyles: ESTILOS_BLOQUES, fontStyle: FUENTE, startHats: false,
  componentStyles: {
    workspaceBackgroundColour: '#f6f8f4', toolboxBackgroundColour: '#fbfcfa', toolboxForegroundColour: '#15211a',
    flyoutBackgroundColour: '#eef2ec', flyoutForegroundColour: '#56655c', flyoutOpacity: 0.97,
    scrollbarColour: '#98a69d', insertionMarkerColour: '#2c8a1c', insertionMarkerOpacity: 0.35, cursorColour: '#2c8a1c'
  }
});
const TEMA_OSCURO = Blockly.Theme.defineTheme('tecno_oscuro', {
  base: Blockly.Themes.Classic, blockStyles: ESTILOS_BLOQUES, fontStyle: FUENTE, startHats: false,
  componentStyles: {
    workspaceBackgroundColour: '#101813', toolboxBackgroundColour: '#131c16', toolboxForegroundColour: '#e3ebe5',
    flyoutBackgroundColour: '#18231c', flyoutForegroundColour: '#93a399', flyoutOpacity: 0.97,
    scrollbarColour: '#4a5a50', insertionMarkerColour: '#5cc94a', insertionMarkerOpacity: 0.35, cursorColour: '#5cc94a'
  }
});
function esOscuro() {
  const t = document.documentElement.getAttribute('data-theme');
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
}
function aplicarTema() {
  if (espacio) espacio.setTheme(esOscuro() ? TEMA_OSCURO : TEMA_CLARO);
  if (typeof simulador !== 'undefined' && simulador.lienzo) simulador.lienzo.ponerTema(esOscuro() ? 'oscuro' : 'claro');
}

/* ---------- Imágenes internas de Blockly (sin servidores externos) ---------- */
const PREFIJO_MEDIA = 'tbmedia/';
function reemplazarMedia(raiz) {
  const media = window.TB_MEDIA || {};
  raiz.querySelectorAll('image').forEach(img => {
    const h = img.getAttribute('href') || img.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '';
    if (h.startsWith(PREFIJO_MEDIA)) {
      const d = media[h.slice(PREFIJO_MEDIA.length)];
      if (d) { img.setAttribute('href', d); img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', d); }
    }
  });
}
new MutationObserver((muts) => {
  for (const m of muts) {
    if (m.type === 'attributes') { if (m.target.tagName === 'image') reemplazarMedia(m.target.parentNode || document); }
    else m.addedNodes.forEach(n => { if (n.nodeType === 1) { if (n.tagName === 'image') reemplazarMedia(n.parentNode); else reemplazarMedia(n); } });
  }
}).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['href', 'xlink:href'] });

/* ---------- Caja de herramientas ---------- */
const num = (v) => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
const txt = (v) => ({ shadow: { type: 'text', fields: { TEXT: v } } });
const B = (type, extra) => Object.assign({ kind: 'block', type }, extra || {});
const TOOLBOX = {
  kind: 'categoryToolbox',
  contents: [
    { kind: 'category', name: 'Lógica', colour: COL.logica, contents: [
      B('controls_if'), B('controls_if', { extraState: { hasElse: true } }),
      B('logic_compare', { inputs: { A: num(0), B: num(0) } }), B('logic_operation'), B('logic_negate'), B('logic_boolean')
    ] },
    { kind: 'category', name: 'Bucles', colour: COL.bucles, contents: [
      B('controls_repeat_ext', { inputs: { TIMES: num(10) } }), B('controls_whileUntil'),
      B('bucle_para', { inputs: { DESDE: num(1), HASTA: num(10), PASO: num(1) } }), B('controls_flow_statements')
    ] },
    { kind: 'category', name: 'Matemáticas', colour: COL.mate, contents: [
      B('math_number'), B('math_arithmetic', { inputs: { A: num(1), B: num(1) } }), B('math_single', { inputs: { NUM: num(9) } }),
      B('math_modulo', { inputs: { DIVIDEND: num(10), DIVISOR: num(3) } }),
      B('mapear', { inputs: { A: num(0), B: num(1023), C: num(0), D: num(255) } }),
      B('math_constrain', { inputs: { VALUE: num(50), LOW: num(0), HIGH: num(100) } }),
      B('math_random_int', { inputs: { FROM: num(1), TO: num(6) } }), B('math_round', { inputs: { NUM: num(3.1) } }), B('es_valido')
    ] },
    { kind: 'category', name: 'Texto', colour: COL.texto, contents: [
      B('text'), B('texto_unir', { inputs: { A: txt('Temp: '), B: num(0) } }), B('caracter'), B('text_length', { inputs: { VALUE: txt('hola') } }),
      B('texto_a_numero', { inputs: { V: txt('42') } })
    ] },
    { kind: 'category', name: 'Variables', colour: COL.variables, custom: 'VARIABLES_TB' },
    { kind: 'category', name: 'Listas y matrices', colour: COL.listas, contents: [
      B('lista_crear'), B('lista_vacia'), B('matriz_crear'),
      B('lista_elemento', { inputs: { I: num(0) } }), B('lista_poner', { inputs: { I: num(0), V: num(0) } }), B('lista_largo'),
      B('lista_para_cada'),
      B('matriz_elemento', { inputs: { F: num(0), C: num(0) } }), B('matriz_poner', { inputs: { F: num(0), C: num(0), V: num(0) } }),
      B('matriz_tamano')
    ] },
    { kind: 'category', name: 'Funciones', colour: COL.funciones, custom: 'FUNCIONES_TB' },
    { kind: 'category', name: 'Mis bloques', colour: COL.mis, custom: 'MIS_BLOQUES_TB' },
    { kind: 'sep' },
    { kind: 'category', name: 'Entradas y salidas', colour: COL.es, contents: [
      B('pin_nombre'), B('escribir_digital'), B('leer_digital'), B('pin_modo'), B('escribir_pwm', { inputs: { V: num(128) } }), B('leer_analogo'),
      B('escribir_digital_valor', { inputs: { V: { shadow: { type: 'logic_boolean' } } } }),
      B('tono', { inputs: { F: num(440), D: num(200) } }), B('sin_tono'), B('pin_valor')
    ] },
    { kind: 'category', name: 'Tiempo', colour: COL.tiempo, contents: [
      B('esperar', { inputs: { MS: num(1000) } }), B('esperar_seg', { inputs: { S: num(1) } }), B('millis'),
      B('cada_ms', { inputs: { MS: num(500) } })
    ] },
    { kind: 'category', name: 'Monitor serial', colour: COL.serial, contents: [
      B('serial_iniciar'), B('serial_imprimir', { inputs: { V: txt('Hola') } }), B('serial_disponible'), B('serial_leer_texto'),
      B('serial_leer_caracter'), B('serial_leer_numero')
    ] },
    { kind: 'category', name: 'Bluetooth', colour: COL.bt, contents: [
      B('bt_iniciar'), B('bt_enviar', { inputs: { V: txt('Hola') } }), B('bt_disponible'), B('bt_leer_caracter'), B('bt_leer_texto')
    ] },
    { kind: 'category', name: 'I2C', colour: COL.i2c, contents: [
      B('i2c_buscar'), B('i2c_enviar', { inputs: { V: num(0) } }), B('i2c_pedir', { inputs: { N: num(1) } }), B('i2c_disponible'), B('i2c_leer')
    ] },
    { kind: 'sep' },
    { kind: 'category', name: 'Motores (shield)', colour: COL.motores, contents: [
      B('motor_dc', { inputs: { VEL: num(200) } }), B('motor_detener'), B('motores_detener_todos'),
      B('motor_paso', { inputs: { RPM: num(10), N: num(100) } })
    ] },
    { kind: 'category', name: 'Servos', colour: COL.servos, contents: [
      B('servo_mover', { inputs: { A: num(90) } }),
      { kind: 'label', text: 'Controlador de 16 servos (PCA9685)' },
      B('pca_iniciar'), B('pca_servo', { inputs: { A: num(90) } }), B('pca_soltar'), B('pca_pwm', { inputs: { V: num(2048) } }),
      B('pca_calibracion')
    ] },
    { kind: 'category', name: 'Sensores', colour: COL.sensores, contents: [
      B('dht_leer'), B('ultrasonido'), B('es_valido'),
      { kind: 'label', text: 'Sensor de movimiento (MPU6050)' },
      B('mpu_iniciar'), B('mpu_angulo'), B('mpu_dato')
    ] },
    { kind: 'category', name: 'Pantalla LCD', colour: COL.lcd, contents: [
      B('lcd_iniciar'), B('lcd_escribir', { inputs: { V: txt('Hola'), C: num(0), F: num(0) } }),
      B('lcd_escribir_aqui', { inputs: { V: num(0) } }), B('lcd_cursor_mover', { inputs: { C: num(0), F: num(1) } }),
      B('lcd_limpiar'), B('lcd_borrar_fila', { inputs: { F: num(1) } }),
      B('lcd_simbolo_crear'), B('lcd_simbolo_mostrar', { inputs: { C: num(15), F: num(0) } }),
      B('lcd_desplazar'), B('lcd_pantalla'), B('lcd_cursor'), B('lcd_luz')
    ] },
    { kind: 'category', name: 'Matriz LED', colour: COL.matriz, contents: [
      B('matriz_iniciar'), B('matriz_dibujo'), B('matriz_borrar'), B('matriz_animacion'),
      B('matriz_texto', { inputs: { V: txt('HOLA') } }), B('matriz_punto', { inputs: { X: num(3), Y: num(3) } }),
      B('matriz_brillo', { inputs: { V: num(4) } })
    ] },
    { kind: 'category', name: 'Otto humanoide', colour: COL.otto, contents: [
      B('otto_iniciar'), B('otto_brazos_iniciar'), B('otto_calibracion'), { kind: 'label', text: 'Moverse' },
      B('otto_caminar', { inputs: { N: num(2) } }), B('otto_girar', { inputs: { N: num(2) } }), B('otto_pierna', { inputs: { N: num(1) } }),
      B('otto_baile', { inputs: { N: num(2) } }), B('otto_saltar', { inputs: { N: num(1) } }), B('otto_reposo'), B('otto_relajar'),
      B('otto_mover_servo', { inputs: { A: num(90) } }), B('otto_coreografia', { inputs: { MS: num(500) } }), B('otto_velocidad'),
      { kind: 'label', text: 'Brazos' }, B('otto_brazos'),
      { kind: 'label', text: 'Sonidos y gestos' }, B('otto_sonido'), B('otto_gesto'), B('otto_tono', { inputs: { F: num(440), D: num(200) } }),
      B('otto_sonido_deslizante', { inputs: { A: num(880), B: num(2093) } }),
      { kind: 'label', text: 'Boca (matriz LED)' }, B('otto_boca_iniciar'), B('otto_boca'), B('otto_boca_animacion'), B('otto_boca_dibujo'), B('otto_boca_borrar'),
      B('otto_boca_texto', { inputs: { V: txt('HOLA') } }), B('otto_boca_punto', { inputs: { X: num(3), Y: num(3) } }),
      B('otto_boca_brillo', { inputs: { V: num(4) } }),
      { kind: 'label', text: 'Sensor de distancia' }, B('ultrasonido')
    ] },
    { kind: 'sep' },
    { kind: 'category', name: 'C++ libre', colour: COL.cpp, contents: [B('cpp_linea'), B('cpp_expresion'), B('cpp_global')] }
  ]
};

/* ---------- Niveles ---------- */
const NOMBRE_NIVEL = { 1: 'Explorador', 2: 'Constructor', 3: 'Inventor' };
/** Nivel en que aparece cada bloque. Los niveles se suman: el 2 trae todo lo del 1. */
const NIVEL_BLOQUE = {
  // 1 · Explorador: secuencia, esperar, repetir, decidir con un sensor, el robot
  controls_if: 1, logic_compare: 1, controls_repeat_ext: 1, math_number: 1, math_random_int: 1, text: 1,
  escribir_digital: 1, leer_digital: 1, tono: 1, sin_tono: 1, esperar_seg: 1, serial_imprimir: 1,
  motor_dc: 1, motores_detener_todos: 1, servo_mover: 1, ultrasonido: 1,
  lcd_iniciar: 1, lcd_escribir: 1, lcd_limpiar: 1, lcd_simbolo_crear: 1, lcd_simbolo_mostrar: 1,
  otto_caminar: 1, otto_girar: 1, otto_saltar: 1, otto_baile: 1, otto_gesto: 1, otto_sonido: 1, otto_brazos: 1, otto_reposo: 1,
  fn_call: 1, fn_call_val: 1, programa: 1,
  // 2 · Constructor: variables, operadores, sensores analógicos, comunicación, bloques propios simples
  logic_operation: 2, logic_negate: 2, logic_boolean: 2, controls_whileUntil: 2, bucle_para: 2,
  math_arithmetic: 2, mapear: 2, texto_unir: 2, caracter: 2, var_set: 2, var_get: 2, var_cambiar: 2, fn_def: 2,
  pin_nombre: 2, leer_analogo: 2, escribir_pwm: 2, esperar: 2,
  serial_iniciar: 2, serial_disponible: 2, serial_leer_texto: 2, serial_leer_caracter: 2,
  bt_iniciar: 2, bt_enviar: 2, bt_disponible: 2, bt_leer_caracter: 2, bt_leer_texto: 2,
  motor_detener: 2, dht_leer: 2,
  lcd_escribir_aqui: 2, lcd_cursor_mover: 2, lcd_borrar_fila: 2, lcd_desplazar: 2, lcd_pantalla: 2, lcd_luz: 2,
  otto_iniciar: 2, otto_brazos_iniciar: 2, otto_calibracion: 2, otto_pierna: 2, otto_tono: 2,
  // Matriz LED (LedControl) y boca de Otto (OttoDIYLib)
  matriz_iniciar: 1, matriz_dibujo: 1, matriz_borrar: 1, otto_boca: 1, otto_boca_dibujo: 1, otto_boca_borrar: 1,
  matriz_animacion: 2, matriz_texto: 2, matriz_punto: 2, matriz_brillo: 2,
  otto_boca_iniciar: 2, otto_boca_texto: 2, otto_boca_punto: 2, otto_boca_brillo: 2,
  otto_relajar: 2, otto_boca_animacion: 2, otto_coreografia: 3, otto_mover_servo: 3, otto_velocidad: 3, otto_sonido_deslizante: 3,
  // 3 · Inventor: funciones con parámetros, tipos, tiempo sin delay, C++
  controls_flow_statements: 3, math_single: 3, math_modulo: 3, math_constrain: 3, math_round: 3, es_valido: 3,
  text_length: 3, texto_a_numero: 3, fn_param: 3, pin_modo: 3, escribir_digital_valor: 3, pin_valor: 3,
  millis: 3, cada_ms: 3, serial_leer_numero: 3, motor_paso: 3, lcd_cursor: 3,
  lista_crear: 3, lista_vacia: 3, matriz_crear: 3, lista_elemento: 3, lista_poner: 3, lista_largo: 3,
  lista_para_cada: 3, matriz_elemento: 3, matriz_poner: 3, matriz_tamano: 3,
  // Librerías I2C: lo básico en el nivel 2, lo detallado en el 3
  i2c_buscar: 2, mpu_iniciar: 2, mpu_angulo: 2, pca_iniciar: 2, pca_servo: 2, pca_soltar: 2,
  i2c_enviar: 3, i2c_pedir: 3, i2c_disponible: 3, i2c_leer: 3, mpu_dato: 3, pca_pwm: 3, pca_calibracion: 3,
  cpp_linea: 3, cpp_expresion: 3, cpp_global: 3
};
const NIVEL_CATEGORIA = { VARIABLES_TB: 2, FUNCIONES_TB: 2, MIS_BLOQUES_TB: 1 };
const nivelDe = (tipo) => NIVEL_BLOQUE[tipo] || 3;

/** Caja de herramientas con solo los bloques del nivel (sin categorías vacías ni separadores sobrantes). */
function toolboxNivel(n) {
  const items = [];
  for (const c of TOOLBOX.contents) {
    if (c.kind !== 'category') { items.push(c); continue; }
    if (c.custom) { if ((NIVEL_CATEGORIA[c.custom] || 1) <= n) items.push(c); continue; }
    const visibles = c.contents.filter(i => i.kind !== 'block' || nivelDe(i.type) <= n);
    // Un título (label) sin bloques debajo en este nivel también se quita
    const contents = visibles.filter((i, k) => i.kind !== 'label' || (visibles[k + 1] && visibles[k + 1].kind === 'block'));
    if (contents.some(i => i.kind === 'block')) items.push(Object.assign({}, c, { contents }));
  }
  const limpio = items.filter((c, i, a) => c.kind !== 'sep' || (i > 0 && i < a.length - 1 && a[i - 1].kind !== 'sep'));
  return { kind: 'categoryToolbox', contents: limpio };
}
/** Nivel más alto que usa el programa (para avisar si está por encima del nivel elegido). */
function nivelNecesario() {
  let n = 1;
  for (const b of espacio.getAllBlocks(false)) {
    if (b.isShadow()) continue;
    n = Math.max(n, nivelDe(b.type));
    if (b.type === 'fn_def' && (b.getFieldValue('TIPO') !== 'void' || b.getFieldValue('NPARAM') !== '0')) n = 3;
  }
  if (espacio.getVariableMap().getAllVariables().some(v => !TIPOS_VAR_N2.some(t => t[1] === v.getType()))) n = 3;
  return n;
}
/** Cambia el nivel. Con `cambiarVistaInicial`, el nivel 1 abre en Bloques y los demás en Dividido. */
function ponerNivel(n, opciones) {
  n = [1, 2, 3].includes(Number(n)) ? Number(n) : 3;
  const o = opciones || {};
  const cambio = n !== nivelActual;
  nivelActual = n;
  document.querySelectorAll('#niveles button').forEach(b => {
    const activo = Number(b.dataset.nivel) === n;
    b.setAttribute('aria-pressed', String(activo));
    b.textContent = activo ? `${n} · ${NOMBRE_NIVEL[n]}` : b.dataset.nivel;
  });
  $('btnEditar').hidden = n < 3 && !estado.texto;
  try { localStorage.setItem(CLAVE_NIVEL, String(n)); } catch (e) { /* sin almacenamiento */ }
  if (!espacio) return;
  espacio.updateToolbox(toolboxNivel(n));
  if (cambio && o.vista) cambiarVista(n === 1 ? 'bloques' : 'dividido');
  if (cambio && o.aviso) mostrarToast(`Nivel ${n} · ${NOMBRE_NIVEL[n]}`);
  if (cambio) programarActualizacion();
}
function nivelGuardado() {
  try { return Number(localStorage.getItem(CLAVE_NIVEL)) || 1; } catch (e) { return 1; }
}

/* ---------- Categorías dinámicas ---------- */
function sombraPara(tipo) {
  if (tipo === 'String') return txt('');
  if (tipo === 'bool') return { shadow: { type: 'logic_boolean' } };
  if (tipo === 'char') return { shadow: { type: 'caracter', fields: { C: 'A' } } };
  return num(0);
}
function itemLlamada(f) {
  const inputs = {};
  (f.params || []).forEach((p, i) => { inputs['ARG' + i] = sombraPara(p.tipo); });
  return { kind: 'block', type: f.tipo === 'void' ? 'fn_call' : 'fn_call_val', extraState: { nombre: f.nombre, tipo: f.tipo, params: f.params || [] }, inputs };
}
function flyoutVariables(ws) {
  const items = [{ kind: 'button', text: 'Crear variable…', callbackkey: 'CREAR_VAR' }];
  const vars = ws.getVariableMap().getAllVariables();
  if (!vars.length) {
    items.push({ kind: 'label', text: 'Cada variable tiene un tipo: entero, decimal, texto…' });
    return items;
  }
  const v0 = vars[vars.length - 1];
  items.push(B('var_set', { fields: { VAR: { id: v0.getId() } }, inputs: { V: sombraPara(v0.getType()) } }));
  const numerica = vars.slice().reverse().find(v => ['int', 'long', 'float', 'char'].includes(v.getType()));
  if (numerica) items.push(B('var_cambiar', { fields: { VAR: { id: numerica.getId() } }, inputs: { V: num(1) } }));
  items.push({ kind: 'label', text: 'Tus variables' });
  vars.slice().sort((a, b) => a.getName().localeCompare(b.getName())).forEach(v => {
    items.push(B('var_get', { fields: { VAR: { id: v.getId() } } }));
  });
  return items;
}
function flyoutFunciones(ws) {
  const items = [B('fn_def', { fields: { NAME: 'mi_bloque' } })];
  if (nivelActual >= 3) items.push(B('fn_param'));
  items.push({ kind: 'button', text: '¿Cómo funcionan?', callbackkey: 'AYUDA_MIS' });
  const defs = ws.getBlocksByType('fn_def', false);
  if (defs.length) {
    items.push({ kind: 'label', text: 'Bloques de este programa' });
    defs.map(firmaDeBloque).sort((a, b) => a.nombre.localeCompare(b.nombre)).forEach(f => items.push(itemLlamada(f)));
  }
  return items;
}
function flyoutMisBloques(ws) {
  const items = [
    { kind: 'button', text: 'Importar librería…', callbackkey: 'IMPORTAR_LIB' },
    { kind: 'button', text: 'Exportar librería…', callbackkey: 'EXPORTAR_LIB' },
    { kind: 'button', text: 'Administrar…', callbackkey: 'ADMIN_LIB' }
  ];
  const lib = leerLibreria();
  const nombres = Object.keys(lib).sort((a, b) => a.localeCompare(b));
  if (!nombres.length) {
    items.push({ kind: 'label', text: 'Aún no hay bloques guardados.' });
    items.push({ kind: 'label', text: 'Crea uno en Funciones y usa clic derecho → Guardar en Mis bloques.' });
  } else {
    items.push({ kind: 'label', text: 'Guardados en este navegador' });
    nombres.forEach(n => items.push(itemLlamada(firmaDeDef(lib[n]))));
  }
  const soloProyecto = Object.keys(embebidos).filter(n => !lib[n]);
  if (soloProyecto.length) {
    items.push({ kind: 'label', text: 'Venían dentro de este proyecto' });
    soloProyecto.forEach(n => items.push(itemLlamada(firmaDeDef(embebidos[n]))));
  }
  return items;
}

/* ---------- Variables ---------- */
function dialogoCrearVariable() {
  const nombre = el('input', { class: 'entrada', id: 'nuevaVarNombre', placeholder: 'por ejemplo: velocidad', autocomplete: 'off' });
  const tipos = nivelActual >= 3 ? TIPOS_VAR : TIPOS_VAR_N2;
  const tipo = el('select', { id: 'nuevaVarTipo', class: 'entrada' }, tipos.map(t => el('option', { value: t[1] }, t[0])));
  const error = el('p', { class: 'error' });
  const crear = () => {
    const n = nombre.value.trim();
    if (!n) { error.textContent = 'Escribe un nombre.'; return false; }
    if (espacio.getVariableMap().getVariable(n)) { error.textContent = 'Ya existe una variable con ese nombre.'; return false; }
    espacio.getVariableMap().createVariable(n, tipo.value);
    espacio.getToolbox() && espacio.getToolbox().refreshSelection();
    mostrarToast(`Variable "${n}" creada (${NOMBRE_TIPO[tipo.value]})`);
    return true;
  };
  nombre.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (crear()) cerrarModal(false); } });
  modal({
    titulo: 'Crear variable',
    cuerpo: [el('label', { for: 'nuevaVarNombre' }, 'Nombre', nombre), el('label', { for: 'nuevaVarTipo' }, 'Tipo', tipo),
      el('p', { class: 'muted' }, nivelActual >= 3
        ? 'Entero para contar, decimal para medidas como la temperatura, carácter para los comandos de Bluetooth, texto para mensajes.'
        : 'Número entero para contar, número decimal para medidas como la temperatura, texto para mensajes, letra para los comandos de Bluetooth (\'A\', \'S\'…) y sí / no para recordar si algo pasó.'), error],
    botones: [{ texto: 'Cancelar' }, { texto: 'Crear', primario: true, accion: crear }]
  });
}

/* ---------- Mis bloques ---------- */
function quitarIds(o) {
  if (Array.isArray(o)) return o.map(quitarIds);
  if (o && typeof o === 'object') { const r = {}; for (const k of Object.keys(o)) if (k !== 'id' && k !== 'x' && k !== 'y') r[k] = quitarIds(o[k]); return r; }
  return o;
}
function mismaDef(a, b) { return JSON.stringify(quitarIds(a.cuerpo)) === JSON.stringify(quitarIds(b.cuerpo)); }
function defDeBloque(b) {
  const f = firmaDeBloque(b);
  return {
    nombre: f.nombre, tipo: f.tipo, params: f.params,
    cuerpo: Blockly.serialization.blocks.save(b, { addCoordinates: false, addNextBlocks: false }),
    descripcion: (b.getCommentText && b.getCommentText()) || '', actualizado: Date.now()
  };
}
function llamadasDentro(b) {
  return b.getDescendants(false).filter(x => x.type === 'fn_call' || x.type === 'fn_call_val').map(x => x.firma_.nombre);
}
function recolectarParaGuardar(b, lista, vistos) {
  const n = b.getFieldValue('NAME');
  if (vistos.has(n)) return;
  vistos.add(n);
  lista.push(defDeBloque(b));
  for (const nombre of llamadasDentro(b)) {
    const def = espacio.getBlocksByType('fn_def', false).find(x => x.getFieldValue('NAME') === nombre);
    if (def) recolectarParaGuardar(def, lista, vistos);
    else if (embebidos[nombre] && !leerLibreria()[nombre] && !vistos.has(nombre)) { vistos.add(nombre); lista.push(embebidos[nombre]); }
  }
}
function guardarEnMisBloques(b) {
  const lista = []; recolectarParaGuardar(b, lista, new Set());
  const lib = Object.assign({}, leerLibreria());
  const choques = lista.filter(d => lib[d.nombre] && !mismaDef(lib[d.nombre], d));
  const hacer = () => {
    lista.forEach(d => { lib[d.nombre] = d; });
    if (escribirLibreria(lib)) {
      const extra = lista.length > 1 ? ` (y ${lista.length - 1} bloque(s) que usa)` : '';
      mostrarToast(`"${lista[0].nombre}" quedó en Mis bloques${extra}`);
    }
    espacio.getToolbox() && espacio.getToolbox().refreshSelection();
    programarActualizacion();
  };
  if (!choques.length) return hacer();
  modal({
    titulo: 'Ya existe en Mis bloques',
    cuerpo: [el('p', null, 'Estos bloques ya estaban guardados con otra versión:'), el('ul', null, choques.map(d => el('li', null, d.nombre))),
      el('p', { class: 'muted' }, 'Si los reemplazas, los programas que los usen tomarán la versión nueva la próxima vez que los abras.')],
    botones: [{ texto: 'Cancelar' }, { texto: 'Reemplazar', primario: true, accion: hacer }]
  });
}
function traerDefinicion(nombre) {
  const r = buscarDefinicion(nombre);
  if (!r || !r.def) return;
  const nuevo = Blockly.serialization.blocks.append(r.def.cuerpo, espacio);
  const m = espacio.getMetricsManager().getViewMetrics(true);
  nuevo.moveTo(new Blockly.utils.Coordinate(m.left + 40, m.top + 40));
  nuevo.select && nuevo.select();
  mostrarToast(`Ya puedes editar "${nombre}". Cuando termines, clic derecho → Guardar en Mis bloques.`);
}
function exportarLibreria() {
  const lib = leerLibreria();
  if (!Object.keys(lib).length) return modal({ titulo: 'Tu librería está vacía', cuerpo: 'Guarda primero algún bloque: en Funciones crea "definir bloque" y usa clic derecho → Guardar en Mis bloques.' });
  modalExportar('Exportar Mis bloques', 'mis_bloques.tblib.json',
    JSON.stringify({ app: 'TecnoBloques-libreria', version: 1, exportado: new Date().toISOString(), bloques: lib }, null, 1), 'application/json',
    `Guarda este archivo en tu USB o carpeta. En otro computador usa Mis bloques → Importar. Contiene ${Object.keys(lib).length} bloque(s).`);
}
function leerArchivoTexto(archivo) {
  return new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => mal(r.error); r.readAsText(archivo); });
}
function modalAbrirTexto({ titulo, explicacion, alLeer }) {
  const inputArchivo = el('input', { type: 'file', accept: '.json,application/json', id: 'archivoModal', class: 'entrada' });
  const ta = el('textarea', { placeholder: '…o pega aquí el contenido del archivo', 'aria-label': 'Contenido del archivo' });
  const error = el('p', { class: 'error' });
  inputArchivo.addEventListener('change', async () => {
    const f = inputArchivo.files && inputArchivo.files[0];
    if (f) ta.value = await leerArchivoTexto(f);
  });
  modal({
    titulo,
    cuerpo: [el('p', null, explicacion), el('label', { for: 'archivoModal' }, 'Archivo', inputArchivo), ta, error],
    botones: [{ texto: 'Cancelar' }, {
      texto: 'Abrir', primario: true, accion: () => {
        let datos;
        try { datos = JSON.parse(ta.value); } catch (e) { error.textContent = 'El contenido no es un archivo válido de TecnoBloques.'; return false; }
        const r = alLeer(datos);
        if (typeof r === 'string') { error.textContent = r; return false; }
        return r;
      }
    }]
  });
}
function importarLibreria() {
  modalAbrirTexto({
    titulo: 'Importar librería de bloques', explicacion: 'Elige un archivo .tblib.json exportado desde TecnoBloques.',
    alLeer: (d) => {
      if (!d || !d.bloques || typeof d.bloques !== 'object') return 'Ese archivo no es una librería de bloques.';
      const lib = Object.assign({}, leerLibreria());
      const nuevos = Object.values(d.bloques).filter(x => x && x.nombre && x.cuerpo);
      const choques = nuevos.filter(x => lib[x.nombre] && !mismaDef(lib[x.nombre], x));
      const aplicar = (reemplazar) => {
        let n = 0;
        nuevos.forEach(x => { if (!lib[x.nombre] || reemplazar) { lib[x.nombre] = x; n++; } });
        escribirLibreria(lib);
        espacio.getToolbox() && espacio.getToolbox().refreshSelection();
        programarActualizacion();
        mostrarToast(`${n} bloque(s) importado(s)`);
      };
      if (!choques.length) { aplicar(true); return true; }
      setTimeout(() => modal({
        titulo: 'Algunos bloques ya existen',
        cuerpo: [el('p', null, 'Estos nombres ya están en tu librería con otra versión:'), el('ul', null, choques.map(x => el('li', null, x.nombre)))],
        botones: [{ texto: 'Conservar los míos', accion: () => aplicar(false) }, { texto: 'Reemplazar', primario: true, accion: () => aplicar(true) }]
      }), 30);
      return true;
    }
  });
}
function administrarLibreria() {
  const lib = leerLibreria();
  const nombres = Object.keys(lib).sort((a, b) => a.localeCompare(b));
  const lista = el('div');
  const pintar = () => {
    lista.innerHTML = '';
    const actual = leerLibreria();
    const ns = Object.keys(actual).sort((a, b) => a.localeCompare(b));
    if (!ns.length) lista.append(el('p', { class: 'muted' }, 'No hay bloques guardados.'));
    ns.forEach(n => {
      const d = actual[n];
      const firma = `${n}(${(d.params || []).map(p => p.nombre + ': ' + NOMBRE_TIPO[p.tipo]).join(', ')})` + (d.tipo !== 'void' ? ' → ' + NOMBRE_TIPO[d.tipo] : '');
      lista.append(el('div', { class: 'fila-lib' }, el('span', null, el('code', null, firma)),
        el('button', { type: 'button', class: 'btn chico', onclick: () => {
          const copia = Object.assign({}, leerLibreria()); delete copia[n]; escribirLibreria(copia); pintar();
          espacio.getToolbox() && espacio.getToolbox().refreshSelection(); programarActualizacion();
        } }, 'Borrar')));
    });
  };
  pintar();
  modal({
    titulo: 'Mis bloques', cuerpo: [el('p', { class: 'muted' }, `Guardados en este navegador (${nombres.length}). Si borras los datos del navegador se pierden: exporta una copia.`), lista],
    botones: [{ texto: 'Exportar…', accion: () => { setTimeout(exportarLibreria, 30); } }, { texto: 'Cerrar', primario: true }]
  });
}
function ayudaMisBloques() {
  modal({
    titulo: 'Bloques propios en 3 pasos',
    cuerpo: [el('ul', null,
      el('li', null, 'En Funciones arrastra "definir bloque", ponle nombre (por ejemplo ', el('code', null, 'avanzar'), ') y, si quieres, parámetros con su tipo.'),
      el('li', null, 'Arma adentro lo que debe hacer. Úsalo en tu programa desde Funciones.'),
      el('li', null, 'Clic derecho sobre "definir bloque" → Guardar en Mis bloques. Desde ese momento aparece en Mis bloques en cualquier programa de este navegador.')),
      el('p', { class: 'muted' }, 'Las variables que uses dentro de un bloque guardado son propias de ese bloque. Al guardar un proyecto, se lleva una copia de los bloques propios que usa, así funciona en otro computador. Para llevar toda tu librería, usa Exportar.')]
  });
}

/* ---------- Actualización del código ---------- */
let temporizador = null;
function programarActualizacion() { clearTimeout(temporizador); temporizador = setTimeout(actualizar, 120); }
let avisados = [];
let firmaPines = '';
function actualizar() {
  if (!espacio) return;
  // Si cambió algún nombre de pin, los menús de pines muestran el texto nuevo ("LedRojo (12)")
  const f = JSON.stringify([nombresDePines().map(n => [n.nombre, n.pin]), nombresDeCanales()]);
  if (f !== firmaPines) { firmaPines = f; refrescarPines(); }
  Blockly.Events.setGroup(true);
  try {
    espacio.getAllBlocks(false).forEach(b => { if (b.refrescar_ && !b.isInFlyout) b.refrescar_(); });
  } finally { Blockly.Events.setGroup(false); }
  ultimo = generarPrograma(espacio);
  const necesario = nivelNecesario();
  if (necesario > nivelActual) {
    ultimo.avisos.push({ msg: `Este programa usa bloques del nivel ${necesario} (${NOMBRE_NIVEL[necesario]}). Funcionan igual; para verlos en la caja de bloques, cambia al nivel ${necesario}.`, id: null, tipo: 'info' });
  }
  pintarCodigo();
  pintarAvisos();
  sugerirBaudios();
  autoguardar();
}
function pintarAvisos() {
  avisados.forEach(id => { const b = espacio.getBlockById(id); if (b) b.setWarningText(null, 'tb'); });
  avisados = [];
  const cont = $('avisos'); cont.innerHTML = '';
  const vistos = new Set();
  ultimo.avisos.forEach(a => {
    if (vistos.has(a.msg)) return; vistos.add(a.msg);
    if (a.id) { const b = espacio.getBlockById(a.id); if (b) { b.setWarningText(a.msg, 'tb'); avisados.push(a.id); } }
    cont.append(el('button', {
      type: 'button', class: 'aviso' + (a.tipo === 'info' ? ' info' : ''),
      onclick: () => { if (a.id) { const b = espacio.getBlockById(a.id); if (b) { espacio.centerOnBlock(a.id); b.select && b.select(); } } }
    }, el('b', null, a.tipo === 'info' ? 'Nota' : 'Revisa'), el('span', null, a.msg)));
  });
}

/* ---------- Resaltado de C++ ---------- */
const PAL_KW = new Set('if else for while do switch case default break continue return static const volatile true false new delete sizeof struct class public private'.split(' '));
const PAL_TIPO = new Set('int long float double bool boolean char byte String void unsigned signed short uint8_t int16_t uint16_t uint32_t int32_t word size_t Servo DHT SoftwareSerial LiquidCrystal_I2C AF_DCMotor AF_Stepper Otto'.split(' '));
const PAL_CONST = new Set('HIGH LOW INPUT OUTPUT INPUT_PULLUP FORWARD BACKWARD RELEASE LEFT RIGHT SMALL MEDIUM BIG SINGLE DOUBLE INTERLEAVE MICROSTEP DHT11 DHT22 NAN'.split(' '));
function escaparHTML(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function resaltarLinea(linea) {
  if (/^\s*#/.test(linea)) {
    const i = linea.indexOf('//');
    return i >= 0 ? `<span class="tk-pre">${escaparHTML(linea.slice(0, i))}</span><span class="tk-com">${escaparHTML(linea.slice(i))}</span>` : `<span class="tk-pre">${escaparHTML(linea)}</span>`;
  }
  const re = /(\/\/.*$)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b0x[0-9A-Fa-f]+\b|\b\d+(?:\.\d+)?(?:UL|L|U|f)?\b)|([A-Za-z_]\w*)(\s*\()?/g;
  let out = '', ultimoI = 0, m;
  while ((m = re.exec(linea))) {
    out += escaparHTML(linea.slice(ultimoI, m.index));
    ultimoI = re.lastIndex;
    if (m[1]) out += `<span class="tk-com">${escaparHTML(m[1])}</span>`;
    else if (m[2]) out += `<span class="tk-str">${escaparHTML(m[2])}</span>`;
    else if (m[3]) out += `<span class="tk-num">${m[3]}</span>`;
    else if (m[4]) {
      const w = m[4];
      let cls = PAL_KW.has(w) ? 'tk-kw' : PAL_TIPO.has(w) ? 'tk-type' : PAL_CONST.has(w) ? 'tk-num' : m[5] ? 'tk-fn' : '';
      out += cls ? `<span class="${cls}">${w}</span>` : w;
      if (m[5]) out += escaparHTML(m[5]);
    }
  }
  return out + escaparHTML(linea.slice(ultimoI));
}
function pintarCodigo() {
  const codigo = ultimo.codigo;
  const pre = $('codigo');
  const arriba = pre.scrollTop;
  pre.innerHTML = codigo.replace(/\n$/, '').split('\n').map((l, i) => `<span class="ln">${i + 1}</span>${resaltarLinea(l)}`).join('\n');
  pre.scrollTop = arriba;
}
function codigoActual() { return estado.texto ? $('editor').value : ultimo.codigo; }

/* ---------- Modo texto (editar C++) ---------- */
function entrarModoTexto(codigo, base) {
  estado.texto = { base: base !== undefined ? base : ultimo.codigo };
  const ed = $('editor'); ed.value = codigo !== undefined ? codigo : ultimo.codigo;
  ed.hidden = false; $('codigo').hidden = true;
  $('avisoTexto').hidden = false;
  $('btnEditar').textContent = 'Volver a bloques';
  $('btnEditar').hidden = false;
  $('estadoCodigo').textContent = 'Editando el C++ a mano';
  $('estadoCodigo').classList.add('editando');
  if (estado.vista === 'bloques') cambiarVista('dividido');
  seleccionarPestana('codigo');
  ed.focus();
  autoguardar();
}
function salirModoTexto(forzar) {
  if (!estado.texto) return;
  const cambiado = $('editor').value !== estado.texto.base;
  const salir = () => {
    estado.texto = null;
    $('editor').hidden = true; $('codigo').hidden = false;
    $('avisoTexto').hidden = true;
    $('btnEditar').textContent = 'Editar C++';
    $('btnEditar').hidden = nivelActual < 3;  // editar C++ a mano es del nivel 3
    $('estadoCodigo').textContent = 'Se actualiza con cada bloque';
    $('estadoCodigo').classList.remove('editando');
    programarActualizacion();
  };
  if (!cambiado || forzar) return salir();
  modal({
    titulo: 'Cambiaste el código a mano',
    cuerpo: [el('p', null, 'Los bloques no pueden leer C++ escrito a mano, así que al volver se muestra otra vez el código de los bloques.'),
      el('p', { class: 'muted' }, 'Para no perder tu versión, cópiala o descárgala antes. Si quieres conservar solo una parte, pégala en un bloque "C++ libre".')],
    botones: [
      { texto: 'Seguir editando' },
      { texto: 'Copiar mi código y volver', accion: async () => { await copiarTexto($('editor').value); salir(); } },
      { texto: 'Descartar y volver', primario: true, accion: salir }
    ]
  });
}
$('editor').addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const t = e.target, s = t.selectionStart, f = t.selectionEnd;
    t.value = t.value.slice(0, s) + '  ' + t.value.slice(f);
    t.selectionStart = t.selectionEnd = s + 2;
  }
});
$('editor').addEventListener('input', () => autoguardar());

/* ---------- Vistas y pestañas ---------- */
// Vistas: bloques · dividido (bloques y panel) · codigo (solo el panel) · circuito (solo el circuito, si hay simulador).
// En las vistas de «solo panel», la pestaña y la vista van juntas: elegir la pestaña Circuito pasa a la vista Circuito.
let pestanaActual = 'codigo';
function cambiarVista(v) {
  if (v === 'circuito' && !simulador.disponible) v = 'dividido';
  estado.vista = v;
  $('principal').dataset.vista = v;
  document.querySelectorAll('#vistas button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.vista === v)));
  if (v === 'circuito') ponerPestanas('circuito');
  else if (v === 'codigo' && pestanaActual === 'circuito') ponerPestanas('codigo');
  $('btnAmpliarCircuito').textContent = v === 'circuito' ? 'Reducir' : 'Ampliar';
  $('btnAmpliarCircuito').title = v === 'circuito' ? 'Volver a ver los bloques al lado' : 'Ver solo el circuito, en toda la ventana';
  setTimeout(() => { if (espacio) Blockly.svgResize(espacio); }, 30);
  guardarPreferencias({ vista: v });
}
function ponerPestanas(p) {
  pestanaActual = p;
  $('tCodigo').setAttribute('aria-selected', String(p === 'codigo'));
  $('tSerial').setAttribute('aria-selected', String(p === 'serial'));
  $('tCircuito').setAttribute('aria-selected', String(p === 'circuito'));
  $('pCodigo').hidden = p !== 'codigo';
  $('pSerial').hidden = p !== 'serial';
  $('pCircuito').hidden = p !== 'circuito';
}
function seleccionarPestana(p) {
  ponerPestanas(p);
  if ((p === 'serial' || p === 'circuito') && estado.vista === 'bloques') cambiarVista('dividido');
  else if (estado.vista === 'circuito' && p !== 'circuito') cambiarVista('codigo');
  else if (estado.vista === 'codigo' && p === 'circuito') cambiarVista('circuito');
}
function guardarPreferencias(cambios) {
  guardarLocal(CLAVE_PREF, Object.assign({}, leerLocal(CLAVE_PREF) || {}, cambios));
}

/* ---------- Divisor entre los bloques y el panel: se arrastra para agrandar el circuito o el código ---------- */
const ANCHO_PANEL_MIN = 320, ANCHO_BLOQUES_MIN = 280, ANCHO_DIVISOR = 6;
let anchoPanel = null; // px; null = el 40 % de siempre
function ponerAnchoPanel(px) {
  const p = $('principal');
  anchoPanel = px ? Math.round(Math.max(ANCHO_PANEL_MIN, Math.min(px, p.clientWidth - ANCHO_BLOQUES_MIN - ANCHO_DIVISOR))) : null;
  if (anchoPanel) p.style.setProperty('--ancho-panel', anchoPanel + 'px');
  else p.style.removeProperty('--ancho-panel');
}
function iniciarDivisor(guardado) {
  const d = $('divisor'), p = $('principal');
  let arrastre = null, cuadro = 0;
  const reacomodar = () => { cuadro = 0; if (espacio) Blockly.svgResize(espacio); };
  const terminar = () => { reacomodar(); guardarPreferencias({ anchoPanel }); };
  if (guardado) ponerAnchoPanel(guardado);
  d.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    d.setPointerCapture(e.pointerId);
    arrastre = { derecha: p.getBoundingClientRect().right };
    d.classList.add('arrastrando'); p.classList.add('redimensionando');
  });
  d.addEventListener('pointermove', (e) => {
    if (!arrastre) return;
    ponerAnchoPanel(arrastre.derecha - e.clientX - ANCHO_DIVISOR / 2);
    if (!cuadro) cuadro = requestAnimationFrame(reacomodar);
  });
  const soltar = () => {
    if (!arrastre) return;
    arrastre = null;
    d.classList.remove('arrastrando'); p.classList.remove('redimensionando');
    terminar();
  };
  d.addEventListener('pointerup', soltar);
  d.addEventListener('pointercancel', soltar);
  d.addEventListener('dblclick', () => { ponerAnchoPanel(null); terminar(); });
  d.addEventListener('keydown', (e) => {
    const paso = e.key === 'ArrowLeft' ? 40 : e.key === 'ArrowRight' ? -40 : 0;
    if (!paso) return;
    e.preventDefault();
    ponerAnchoPanel($('panel').getBoundingClientRect().width + paso);
    terminar();
  });
  // Si la ventana se achica, el panel no puede dejar los bloques sin espacio.
  window.addEventListener('resize', () => { if (anchoPanel) ponerAnchoPanel(anchoPanel); });
}

/* ---------- Proyectos ---------- */
// Formato del archivo .tbq.json (ver "Proyecto" en CLAUDE.md). Sube solo si cambia el significado de un campo.
const FORMATO_PROYECTO = 1;
const TB_VERSION = window.TB_VERSION || '0.0.0';
const CAMPOS_PROYECTO = ['app', 'version', 'nombre', 'placa', 'nivel', 'bloques', 'embebidos', 'texto', 'creadoCon', 'guardado'];
// Campos que esta versión no conoce (por ejemplo "circuito", de TecnoCircuito): se guardan de vuelta tal cual
let extrasProyecto = {};
/** -1, 0 o 1 al comparar dos versiones "0.2.10" con "0.2.9". Sin versión cuenta como 0. */
function compararVersiones(a, b) {
  const x = String(a || '0').split('.').map(n => parseInt(n, 10) || 0), y = String(b || '0').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0) ? 1 : -1; }
  return 0;
}
/** ¿El proyecto se hizo con una versión de TecnoBloques más nueva que esta? */
function proyectoMasNuevo(p) {
  return (p.version || 1) > FORMATO_PROYECTO || compararVersiones(p.creadoCon, TB_VERSION) > 0;
}
function proyectoActual() {
  const lib = leerLibreria();
  const usados = {};
  (ultimo.externos || []).forEach(n => { const d = embebidos[n] || lib[n]; if (d) usados[n] = d; });
  return Object.assign({}, extrasProyecto, {
    app: 'TecnoBloques', version: FORMATO_PROYECTO, nombre: $('nombreProyecto').value, placa: placaActual, nivel: nivelActual,
    bloques: Blockly.serialization.workspaces.save(espacio), embebidos: usados,
    texto: estado.texto ? $('editor').value : null, creadoCon: TB_VERSION, guardado: new Date().toISOString()
  });
}
let autoTimer = null;
function autoguardar() { clearTimeout(autoTimer); autoTimer = setTimeout(() => { if (espacio) guardarLocal(CLAVE_AUTO, proyectoActual()); }, 600); }
function cargarProyecto(p, silencioso, sinRespaldo) {
  if (!p || p.app !== 'TecnoBloques' || !p.bloques) return 'Ese archivo no es un proyecto de TecnoBloques.';
  if (estado.texto) salirModoTexto(true);
  const previo = proyectoActual(); // si este no abre, se vuelve al anterior (el autoguardado no queda vacío)
  const masNuevo = proyectoMasNuevo(p);
  embebidos = p.embebidos || {};
  extrasProyecto = {};
  Object.keys(p).forEach(k => { if (!CAMPOS_PROYECTO.includes(k)) extrasProyecto[k] = p[k]; });
  if (p.placa && PLACAS[p.placa]) { placaActual = p.placa; $('placa').value = p.placa; }
  if ([1, 2, 3].includes(p.nivel)) ponerNivel(p.nivel, { vista: !silencioso, aviso: !silencioso });
  $('nombreProyecto').value = p.nombre || 'Mi proyecto';
  Blockly.Events.disable();
  try { espacio.clear(); } finally { Blockly.Events.enable(); }
  try { Blockly.serialization.workspaces.load(p.bloques, espacio); }
  catch (e) {
    if (!sinRespaldo) cargarProyecto(previo, true, true);
    if (masNuevo) return `Este proyecto se hizo con TecnoBloques ${p.creadoCon || 'más nuevo'} y usa bloques que esta versión (${TB_VERSION}) no conoce. Actualiza TecnoBloques para abrirlo.`;
    return 'No se pudo abrir el proyecto: ' + e.message;
  }
  asegurarPrograma();
  encuadrar();
  if (p.texto) setTimeout(() => entrarModoTexto(p.texto, ''), 200);
  if (!silencioso) {
    if (masNuevo) avisarProyectoNuevo(p, revisarVersiones);
    else revisarVersiones();
  }
  abrirLienzo(); // el circuito del proyecto (si lo trae) en la pestaña Circuito
  programarActualizacion();
  return true;
}
/** El proyecto viene de una versión más nueva: se abre igual, pero puede faltar algo. Luego sigue `despues`. */
function avisarProyectoNuevo(p, despues) {
  setTimeout(() => modal({
    titulo: 'Este proyecto es de una versión más nueva',
    cuerpo: [el('p', null, `Se hizo con TecnoBloques ${p.creadoCon || 'más nuevo'} y aquí tienes la ${TB_VERSION}. Puede que algo no funcione igual.`),
      el('p', null, 'Pídele al instructor que actualice TecnoBloques en este computador.')],
    botones: [{ texto: 'Entendido', primario: true, accion: () => { setTimeout(despues, 60); } }]
  }), 60);
}
/** Si Mis bloques tiene una versión distinta de un bloque que trae el proyecto, pregunta cuál usar. */
function revisarVersiones() {
  const lib = leerLibreria();
  const distintos = Object.keys(embebidos).filter(n => lib[n] && !mismaDef(lib[n], embebidos[n]));
  if (!distintos.length) return;
  setTimeout(() => modal({
    titulo: 'Hay otra versión de tus bloques',
    cuerpo: [el('p', null, 'Este proyecto trae una copia de estos bloques, y en Mis bloques tienes una versión distinta:'),
      el('ul', null, distintos.map(n => el('li', null, n, el('span', { class: 'muted' }, (lib[n].actualizado || 0) > (embebidos[n].actualizado || 0) ? ' (la de Mis bloques es más nueva)' : ' (la del proyecto es más nueva)'))))],
    botones: [
      { texto: 'Usar la del proyecto' },
      { texto: 'Usar la de Mis bloques', primario: true, accion: () => { distintos.forEach(n => delete embebidos[n]); programarActualizacion(); } }
    ]
  }), 60);
}
function asegurarPrograma() {
  if (!espacio.getBlocksByType('programa', false).length) {
    const b = espacio.newBlock('programa'); b.initSvg(); b.render(); b.moveBy(40, 40);
  }
}
function nuevoProyecto() {
  if (estado.texto) salirModoTexto(true);
  embebidos = {};
  extrasProyecto = {};
  espacio.clear();
  asegurarPrograma();
  $('nombreProyecto').value = 'Mi proyecto';
  abrirLienzo();
  programarActualizacion();
}
function cargarXML(xml) {
  Blockly.Events.disable();
  try { espacio.clear(); } finally { Blockly.Events.enable(); }
  Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(xml), espacio);
  asegurarPrograma();
  encuadrar();
}
/** Lleva la esquina superior izquierda de los bloques a la vista. */
function encuadrar() {
  setTimeout(() => {
    const bb = espacio.getBlocksBoundingBox();
    const s = espacio.scale;
    espacio.scroll(24 - bb.left * s, 24 - bb.top * s);
  }, 30);
}

/* ---------- Ejemplos ---------- */
const LLAMADA = (f) => `<mutation firma='${JSON.stringify(f)}'></mutation>`;
const N = (v) => `<shadow type="math_number"><field name="NUM">${v}</field></shadow>`;
const EJEMPLOS = [
  {
    id: 'carro', nombre: 'Carro Bluetooth', placa: 'uno',
    desc: 'Shield L293D, DHT11, LCD 16x2 y comandos por Bluetooth. Incluye un bloque propio.',
    xml: `<xml xmlns="https://developers.google.com/blockly/xml">
<variables><variable type="char" id="v_cmd">comando</variable><variable type="float" id="v_temp">temperatura</variable></variables>
<block type="programa" x="40" y="40">
 <statement name="SETUP">
  <block type="serial_iniciar"><field name="B">9600</field>
   <next><block type="bt_iniciar"><field name="RX">A1</field><field name="TX">A2</field><field name="B">9600</field>
    <next><block type="lcd_iniciar"><field name="DIR">0x27</field><field name="T">16x2</field></block></next>
   </block></next>
  </block>
 </statement>
 <statement name="LOOP">
  <block type="var_set"><field name="VAR" id="v_temp" variabletype="float">temperatura</field>
   <value name="V"><block type="dht_leer"><field name="T">DHT11</field><field name="PIN">A0</field><field name="M">C</field></block></value>
   <next><block type="lcd_escribir">
    <value name="V"><block type="texto_unir"><value name="A"><shadow type="text"><field name="TEXT">Temp: </field></shadow></value><value name="B"><block type="var_get"><field name="VAR" id="v_temp" variabletype="float">temperatura</field></block></value></block></value>
    <value name="C">${N(0)}</value><value name="F">${N(0)}</value>
    <next><block type="controls_if">
     <value name="IF0"><block type="bt_disponible"></block></value>
     <statement name="DO0">
      <block type="var_set"><field name="VAR" id="v_cmd" variabletype="char">comando</field><value name="V"><block type="bt_leer_caracter"></block></value>
       <next><block type="controls_if"><mutation elseif="1"></mutation>
        <value name="IF0"><block type="logic_compare"><field name="OP">EQ</field><value name="A"><block type="var_get"><field name="VAR" id="v_cmd" variabletype="char">comando</field></block></value><value name="B"><block type="caracter"><field name="C">A</field></block></value></block></value>
        <statement name="DO0"><block type="fn_call">${LLAMADA({ nombre: 'avanzar', tipo: 'void', params: [{ nombre: 'velocidad', tipo: 'int' }] })}<value name="ARG0">${N(200)}</value></block></statement>
        <value name="IF1"><block type="logic_compare"><field name="OP">EQ</field><value name="A"><block type="var_get"><field name="VAR" id="v_cmd" variabletype="char">comando</field></block></value><value name="B"><block type="caracter"><field name="C">S</field></block></value></block></value>
        <statement name="DO1"><block type="motores_detener_todos"></block></statement>
       </block></next>
      </block>
     </statement>
     <next><block type="serial_imprimir"><field name="NL">TRUE</field><value name="V"><block type="var_get"><field name="VAR" id="v_temp" variabletype="float">temperatura</field></block></value>
      <next><block type="esperar"><value name="MS">${N(500)}</value></block></next>
     </block></next>
    </block></next>
   </block></next>
  </block>
 </statement>
</block>
<block type="fn_def" x="660" y="40">
 <field name="NAME">avanzar</field><field name="TIPO">void</field><field name="NPARAM">1</field><field name="P0N">velocidad</field><field name="P0T">int</field>
 <statement name="BODY">
  <block type="motor_dc"><field name="M">1</field><field name="DIR">FORWARD</field><value name="VEL"><block type="fn_param"><field name="P">velocidad</field></block></value>
   <next><block type="motor_dc"><field name="M">2</field><field name="DIR">FORWARD</field><value name="VEL"><block type="fn_param"><field name="P">velocidad</field></block></value></block></next>
  </block>
 </statement>
</block>
</xml>`
  },
  {
    id: 'otto', nombre: 'Otto humanoide esquiva', placa: 'nano',
    desc: 'Camina, saluda con los brazos y esquiva obstáculos con el ultrasonido.',
    xml: `<xml xmlns="https://developers.google.com/blockly/xml">
<block type="programa" x="40" y="40">
 <statement name="SETUP">
  <block type="otto_iniciar"><field name="YL">2</field><field name="YR">3</field><field name="RL">4</field><field name="RR">5</field><field name="BUZ">13</field>
   <next><block type="otto_brazos_iniciar"><field name="IZQ">6</field><field name="DER">7</field>
    <next><block type="otto_sonido"><field name="S">S_connection</field>
     <next><block type="otto_brazos"><field name="A">SAL_IZQ</field>
      <next><block type="fn_call">${LLAMADA({ nombre: 'bailar', tipo: 'void', params: [] })}</block></next>
     </block></next>
    </block></next>
   </block></next>
  </block>
 </statement>
 <statement name="LOOP">
  <block type="controls_if"><mutation else="1"></mutation>
   <value name="IF0"><block type="logic_compare"><field name="OP">LT</field>
    <value name="A"><block type="ultrasonido"><field name="TRIG">8</field><field name="ECHO">9</field></block></value>
    <value name="B">${N(15)}</value></block></value>
   <statement name="DO0">
    <block type="otto_sonido"><field name="S">S_surprise</field>
     <next><block type="otto_brazos"><field name="A">ARRIBA</field>
      <next><block type="otto_caminar"><field name="DIR">BACKWARD</field><field name="T">1000</field><value name="N">${N(2)}</value>
       <next><block type="otto_girar"><field name="DIR">LEFT</field><field name="T">1000</field><value name="N">${N(3)}</value>
        <next><block type="otto_brazos"><field name="A">FRENTE</field></block></next>
       </block></next>
      </block></next>
     </block></next>
    </block>
   </statement>
   <statement name="ELSE">
    <block type="otto_caminar"><field name="DIR">FORWARD</field><field name="T">1000</field><value name="N">${N(1)}</value></block>
   </statement>
  </block>
 </statement>
</block>
<block type="fn_def" x="660" y="40">
 <field name="NAME">bailar</field><field name="TIPO">void</field><field name="NPARAM">0</field>
 <statement name="BODY">
  <block type="otto_baile"><field name="MOV">moonwalker|LEFT</field><field name="H">MEDIUM</field><field name="T">1000</field><value name="N">${N(2)}</value>
   <next><block type="otto_baile"><field name="MOV">crusaito|FORWARD</field><field name="H">MEDIUM</field><field name="T">1000</field><value name="N">${N(2)}</value>
    <next><block type="otto_brazos"><field name="A">ALETEAR</field>
     <next><block type="otto_gesto"><field name="G">OttoHappy</field></block></next>
    </block></next>
   </block></next>
  </block>
 </statement>
</block>
</xml>`
  },
  {
    id: 'eco', nombre: 'Eco serial y LED', placa: 'uno',
    desc: 'Escribe "on" u "off" en el monitor serial para prender el LED del pin 13.',
    xml: `<xml xmlns="https://developers.google.com/blockly/xml">
<variables><variable type="String" id="v_msg">mensaje</variable></variables>
<block type="programa" x="40" y="40">
 <statement name="SETUP">
  <block type="serial_iniciar"><field name="B">9600</field>
   <next><block type="serial_imprimir"><field name="NL">TRUE</field><value name="V"><shadow type="text"><field name="TEXT">Escribe on u off</field></shadow></value></block></next>
  </block>
 </statement>
 <statement name="LOOP">
  <block type="controls_if">
   <value name="IF0"><block type="serial_disponible"></block></value>
   <statement name="DO0">
    <block type="var_set"><field name="VAR" id="v_msg" variabletype="String">mensaje</field><value name="V"><block type="serial_leer_texto"></block></value>
     <next><block type="serial_imprimir"><field name="NL">TRUE</field>
      <value name="V"><block type="texto_unir"><value name="A"><shadow type="text"><field name="TEXT">Recibí: </field></shadow></value><value name="B"><block type="var_get"><field name="VAR" id="v_msg" variabletype="String">mensaje</field></block></value></block></value>
      <next><block type="controls_if"><mutation elseif="1"></mutation>
       <value name="IF0"><block type="logic_compare"><field name="OP">EQ</field><value name="A"><block type="var_get"><field name="VAR" id="v_msg" variabletype="String">mensaje</field></block></value><value name="B"><block type="text"><field name="TEXT">on</field></block></value></block></value>
       <statement name="DO0"><block type="escribir_digital"><field name="PIN">13</field><field name="EST">HIGH</field></block></statement>
       <value name="IF1"><block type="logic_compare"><field name="OP">EQ</field><value name="A"><block type="var_get"><field name="VAR" id="v_msg" variabletype="String">mensaje</field></block></value><value name="B"><block type="text"><field name="TEXT">off</field></block></value></block></value>
       <statement name="DO1"><block type="escribir_digital"><field name="PIN">13</field><field name="EST">LOW</field></block></statement>
      </block></next>
     </block></next>
    </block>
   </statement>
  </block>
 </statement>
</block>
</xml>`
  }
];
function cargarEjemplo(ej) {
  if (estado.texto) salirModoTexto(true);
  embebidos = {};
  extrasProyecto = {};
  placaActual = ej.placa; $('placa').value = ej.placa;
  $('nombreProyecto').value = ej.nombre;
  cargarXML(ej.xml);
  ponerNivel(nivelNecesario(), { vista: true, aviso: true });
  refrescarPines();
  abrirLienzo();
  programarActualizacion();
}

/* ---------- Placa ---------- */
function refrescarPines() {
  if (!espacio) return;
  espacio.getAllBlocks(false).forEach(b => b.inputList.forEach(inp => inp.fieldRow.forEach(f => {
    if (f instanceof CampoPin || f instanceof CampoCanal) { f.doValueUpdate_(f.getValue()); f.forceRerender(); }
  })));
}

/* ---------- Monitor serial (Web Serial) ---------- */
const serial = { puerto: null, lector: null, bucle: null, conectado: false, inicioLinea: true, trasCR: false, historial: [], posHist: -1 };
const FINES = { '': '', '\\n': '\n', '\\r': '\r', '\\r\\n': '\r\n' };
function notaSerial(html) { const n = $('notaSerial'); n.innerHTML = html; n.hidden = !html; }
function uiSerial() {
  const on = serial.conectado;
  const simulando = !on && typeof simulador !== 'undefined' && !!simulador.sim;
  $('estadoSerial').textContent = on ? `Conectado a ${$('baudios').value}` : simulando ? 'Simulación' : 'Desconectado';
  $('estadoSerial').classList.toggle('on', on || simulando);
  $('btnConectar').textContent = on ? 'Desconectar' : 'Conectar';
  $('baudios').disabled = on;
  $('puntoSerial').classList.toggle('on', on);
  $('puntoMonitor').classList.toggle('on', on);
  $('btnMonitor').title = on ? 'Monitor serial conectado' : 'Ver y enviar mensajes a la placa';
}
/** Botón de la barra: muestra el monitor (aunque se esté en la vista Bloques) y se conecta si hace falta. */
function abrirMonitor() {
  seleccionarPestana('serial');
  if (!serial.conectado) conectarSerial();
}
function hora() { const d = new Date(); return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0'); }
function recortarSalida() {
  const s = $('salidaSerial');
  while (s.childNodes.length > 4000) s.removeChild(s.firstChild);
}
/** Quita los caracteres nulos (el Uno original los manda al reiniciarse y se veían como espacios) y deja
 *  \r, \n y \r\n como un solo salto, aunque el \r y el \n lleguen en trozos distintos. */
function limpiarSerial(texto) {
  let limpio = '';
  for (const ch of texto) {
    if (ch === '\0') continue;
    if (ch === '\r') { limpio += '\n'; serial.trasCR = true; continue; }
    if (ch === '\n' && serial.trasCR) { serial.trasCR = false; continue; }
    serial.trasCR = false;
    limpio += ch;
  }
  return limpio;
}
function agregarSalida(texto) {
  const s = $('salidaSerial');
  const conHora = $('chkHora').checked;
  let buf = '';
  for (const ch of limpiarSerial(texto)) {
    if (serial.inicioLinea && conHora && ch !== '\n') { if (buf) s.append(buf); buf = ''; s.append(el('span', { class: 'ts' }, hora() + ' → ')); }
    serial.inicioLinea = false;
    buf += ch;
    if (ch === '\n') serial.inicioLinea = true;
  }
  if (buf) s.append(buf);
  recortarSalida();
  if ($('chkAuto').checked) s.scrollTop = s.scrollHeight;
}
function lineaEspecial(texto, clase) {
  const s = $('salidaSerial');
  if (!serial.inicioLinea) { s.append('\n'); serial.inicioLinea = true; }
  s.append(el('span', { class: clase }, texto + '\n'));
  recortarSalida();
  if ($('chkAuto').checked) s.scrollTop = s.scrollHeight;
}
async function leerBucle() {
  const dec = new TextDecoder();
  while (serial.conectado && serial.puerto && serial.puerto.readable) {
    serial.lector = serial.puerto.readable.getReader();
    try {
      while (true) {
        const { value, done } = await serial.lector.read();
        if (done) break;
        if (value) agregarSalida(dec.decode(value, { stream: true }));
      }
    } catch (e) {
      if (serial.conectado) lineaEspecial('Error de lectura: ' + e.message, 'sistema');
    } finally {
      try { serial.lector.releaseLock(); } catch (e) { /* ya liberado */ }
      serial.lector = null;
    }
    if (!serial.conectado) break;
    await new Promise(r => setTimeout(r, 50));
    if (!serial.puerto || !serial.puerto.readable) break;
  }
  if (serial.conectado) {
    serial.conectado = false;
    try { await serial.puerto.close(); } catch (e) { /* ya cerrado */ }
    serial.puerto = null;
    uiSerial();
    lineaEspecial('La placa se desconectó.', 'sistema');
  }
}
async function conectarSerial() {
  if (!('serial' in navigator)) {
    notaSerial('<b>Este navegador no permite usar el puerto serie aquí.</b> Abre el editor como archivo local (<code>TecnoBloques.html</code>) en Chrome o Edge de computador. Firefox, Safari y los celulares no tienen Web Serial.');
    return;
  }
  if (escritorio) {
    if (!$('puerto').value) { notaSerial('<b>Elige el puerto de la placa</b> en la barra de arriba (Puerto). Si no aparece, conéctala por USB.'); return; }
    await escritorio.preferirPuerto($('puerto').value);
  }
  if (simulador.sim) { detenerSimulacion(); lineaEspecial('Simulación detenida: ahora el monitor usa la placa real.', 'sistema'); }
  try {
    const p = await navigator.serial.requestPort();
    await p.open({ baudRate: parseInt($('baudios').value, 10) });
    serial.puerto = p; serial.conectado = true; serial.inicioLinea = true; serial.trasCR = false;
    notaSerial('');
    uiSerial();
    const info = p.getInfo ? p.getInfo() : {};
    lineaEspecial(`Conectado a ${$('baudios').value} baudios${info.usbVendorId ? ` (USB ${info.usbVendorId.toString(16)}:${(info.usbProductId || 0).toString(16)})` : ''}. La placa se reinicia al conectar.`, 'sistema');
    serial.bucle = leerBucle();
  } catch (e) {
    if (e.name === 'NotFoundError') return; // la persona cerró la ventana sin elegir
    if (e.name === 'SecurityError' || e.name === 'NotAllowedError') {
      notaSerial('<b>Esta vista no deja abrir puertos serie.</b> Abre el editor como archivo local (<code>TecnoBloques.html</code>) en Chrome o Edge para usar el monitor.');
    } else if (e.name === 'InvalidStateError' || /open|busy|Failed/i.test(e.message)) {
      notaSerial('<b>No se pudo abrir el puerto.</b> Probablemente otro programa lo tiene abierto (Arduino IDE, otro monitor o pestaña). Ciérralo y vuelve a intentar.');
    } else {
      notaSerial('<b>No se pudo conectar:</b> ' + escaparHTML(e.message));
    }
  }
}
async function desconectarSerial() {
  if (!serial.puerto) return;
  serial.conectado = false;
  try { if (serial.lector) await serial.lector.cancel(); } catch (e) { /* nada */ }
  try { await serial.bucle; } catch (e) { /* nada */ }
  try { await serial.puerto.close(); } catch (e) { /* nada */ }
  serial.puerto = null;
  uiSerial();
  lineaEspecial('Desconectado.', 'sistema');
}
async function enviarSerial(texto) {
  const fin = FINES[$('finLinea').value] || '';
  if (!serial.conectado && simulador.sim) { // simulando: el mensaje le llega al programa simulado
    simulador.sim.serialEnviar(texto + fin);
    lineaEspecial('→ ' + texto, 'enviado');
    return;
  }
  if (!serial.conectado || !serial.puerto || !serial.puerto.writable) { lineaEspecial('Conecta la placa para enviar mensajes.', 'sistema'); return; }
  const w = serial.puerto.writable.getWriter();
  try {
    await w.write(new TextEncoder().encode(texto + fin));
    lineaEspecial('→ ' + texto, 'enviado');
  } catch (e) {
    lineaEspecial('No se pudo enviar: ' + e.message, 'sistema');
  } finally { w.releaseLock(); }
}
function sugerirBaudios() {
  if (serial.conectado || estado.baudiosManual) return;
  const m = /Serial\.begin\((\d+)\)/.exec(ultimo.codigo);
  if (m) $('baudios').value = m[1];
}
if ('serial' in navigator) {
  navigator.serial.addEventListener('disconnect', (e) => { if (serial.puerto && e.target === serial.puerto) { /* leerBucle lo maneja */ } });
}

/* ---------- Subir (fase 2) ---------- */
const NOMBRES_LIB = {
  AFMotor_R4: 'AFMotor R4 Compatible (búscala como "AFMotor R4")', DHT: 'DHT sensor library (Adafruit) + Adafruit Unified Sensor',
  LiquidCrystal_I2C: 'LiquidCrystal I2C (Frank de Brabander)', Otto: 'OttoDIYLib', Servo: 'Servo (ya viene con el IDE)',
  SoftwareSerial: 'SoftwareSerial (ya viene con el IDE)', Wire: 'Wire (ya viene con el IDE)',
  MPU6050_light: 'MPU6050_light (rfetick)', Adafruit_PWMServoDriver: 'Adafruit PWM Servo Driver Library (+ Adafruit BusIO)',
  LedControl: 'LedControl (Eberhard Fahle)'
};
function librerias() {
  return [...(ultimo.codigo.matchAll(/#include <([^>.]+)\.h>/g))].map(m => NOMBRES_LIB[m[1]] || m[1]);
}
/** Versión web (casa): no hay compilador; se explica cómo seguir. */
function modalSubir() {
  if (escritorio) return subirPlaca();
  const p = placa();
  const libs = librerias();
  modal({
    titulo: 'Para subir el programa',
    cuerpo: [
      el('p', null, 'En el aula, la app TecnoBloques sube el programa con un botón. Desde aquí puedes:'),
      el('ul', null,
        el('li', null, el('b', null, 'Guardar tu proyecto'), ' y abrirlo en la app del aula.'),
        el('li', null, el('b', null, 'Usar Arduino IDE:'), ` copia el código, elige la placa ${p.nombre} y su puerto COM, y súbelo.`),
        libs.length ? el('li', null, 'Librerías que necesita este programa en Arduino IDE: ', libs.join('; '), '.') : el('li', null, 'Este programa no necesita librerías extra.'))
    ],
    botones: [{ texto: 'Copiar código', accion: async () => { await copiarTexto(codigoActual()); return false; } }, { texto: 'Cerrar', primario: true }]
  });
}

/* ---------- App de escritorio: puerto y subir ---------- */
const escritorio = window.tbEscritorio || null;
const CLAVE_PUERTO = 'tecnobloques.puerto.v1';
const puertos = { lista: [], firma: '', ocupado: false };
async function refrescarPuertos() {
  if (!escritorio || puertos.ocupado || document.hidden) return;
  let r;
  try { r = await escritorio.puertos(); } catch (e) { return; }
  const lista = (r.puertos || []).slice().sort((a, b) => (b.usb - a.usb) || a.direccion.localeCompare(b.direccion, undefined, { numeric: true }));
  const firma = JSON.stringify(lista);
  if (firma === puertos.firma) return;
  puertos.firma = firma; puertos.lista = lista;
  const sel = $('puerto');
  const previo = sel.value || leerLocal(CLAVE_PUERTO);
  sel.innerHTML = '';
  if (!lista.length) sel.append(el('option', { value: '' }, 'Conecta la placa por USB'));
  lista.forEach(p => sel.append(el('option', { value: p.direccion }, `${p.direccion} · ${p.nombre}`)));
  const usb = lista.find(p => p.usb);
  sel.value = lista.some(p => p.direccion === previo) ? previo : ((usb || lista[0] || {}).direccion || '');
  escritorio.preferirPuerto(sel.value);
}
/** Clave de PLACAS que corresponde a lo que detectó arduino-cli (si lo sabe). */
function placaDetectada(puerto) {
  const p = puertos.lista.find(x => x.direccion === puerto);
  if (!p || !p.fqbn) return null;
  return Object.keys(PLACAS).find(k => PLACAS[k].fqbn.startsWith(p.fqbn)) || null;
}
async function subirPlaca(forzar) {
  const puerto = $('puerto').value;
  if (!puerto) {
    modal({ titulo: 'No encuentro la placa', cuerpo: [el('ul', null,
      el('li', null, 'Conecta la placa con el cable USB y espera unos segundos: el puerto aparece solo arriba, en "Puerto".'),
      el('li', null, 'Si no aparece, prueba otro cable (algunos solo cargan y no pasan datos) u otro puerto USB.'),
      el('li', null, 'Las placas con chip CH340 (clones) necesitan su driver; el instalador de TecnoBloques lo ofrece.'))] });
    return;
  }
  const detectada = placaDetectada(puerto);
  if (!forzar && detectada && !PLACAS[detectada].fqbn.startsWith(placa().fqbn.split(':').slice(0, 3).join(':'))) {
    modal({
      titulo: 'La placa no coincide',
      cuerpo: [el('p', null, `En ${puerto} hay un ${PLACAS[detectada].nombre}, pero arriba elegiste ${placa().nombre}.`)],
      botones: [
        { texto: 'Subir igual', accion: () => { setTimeout(() => subirPlaca(true), 50); } },
        { texto: `Cambiar a ${PLACAS[detectada].nombre}`, primario: true, accion: () => {
          placaActual = detectada; $('placa').value = detectada; refrescarPines(); actualizar(); setTimeout(() => subirPlaca(true), 50);
        } }
      ]
    });
    return;
  }
  if (!estado.texto) actualizar(); // el código más reciente de los bloques
  const reconectar = serial.conectado;
  if (reconectar) await desconectarSerial(); // el puerto no se puede compartir con la carga
  puertos.ocupado = true;
  const etapa = el('p', { class: 'subir-etapa' }, 'Preparando tu programa…');
  const pista = el('p', { class: 'muted' }, 'No desconectes la placa hasta que termine.');
  modal({ titulo: `Subir a ${placa().nombre}`, cuerpo: [etapa, el('div', { class: 'subir-barra' }, el('span')), pista],
    botones: [{ texto: 'Cancelar', accion: () => { etapa.textContent = 'Cancelando…'; if (escritorio.cancelar) escritorio.cancelar(); return false; } }] });
  const quitar = escritorio.alProgreso((m) => {
    if (m.etapa === 'compilar') etapa.textContent = 'Preparando tu programa…';
    if (m.etapa !== 'subir') return;
    // avrdude reintenta 10 veces si la placa no contesta (casi un minuto): se muestra el intento y la causa probable
    const x = /attempt (\d+) of (\d+): not in sync/i.exec(m.texto || '');
    if (x) {
      etapa.textContent = `La placa no contesta (intento ${x[1]} de ${x[2]})…`;
      pista.textContent = `¿Elegiste la placa correcta arriba? Ahora está "${placa().nombre}". Si no es esa, pulsa Cancelar y cámbiala.`;
    } else if (!/no contesta|Cancelando/.test(etapa.textContent)) etapa.textContent = `Subiendo a ${puerto}…`;
  });
  let r;
  try { r = await escritorio.subir({ codigo: codigoActual(), fqbn: placa().fqbn, puerto }); }
  catch (e) { r = { ok: false, etapa: 'app', salida: e.message }; }
  finally { quitar(); puertos.ocupado = false; }
  if (r.ok) {
    const m = r.memoria || {};
    const cuerpo = [el('p', null, 'Tu programa ya está en la placa.')];
    if (m.flash !== null && m.flash !== undefined) cuerpo.push(el('p', { class: 'subir-memoria' }, `Usa el ${m.flash} % de la memoria de programa y el ${m.ram} % de la memoria de variables.`));
    if (m.ram >= 75) cuerpo.push(el('p', null, el('b', null, 'Ojo: '), 'la memoria de variables está casi llena y la placa puede comportarse raro. Usa menos textos largos o variables.'));
    const usaSerial = /Serial\.begin\(/.test(codigoActual());
    if (usaSerial && !reconectar) cuerpo.push(el('p', { class: 'muted' }, 'Puedes abrir el monitor serial cuando quieras con el botón «Monitor serial» de arriba.'));
    modal({ titulo: '¡Listo!', cuerpo, botones: usaSerial && !reconectar
      ? [{ texto: 'Abrir monitor serial', accion: () => setTimeout(abrirMonitor, 300) }, { texto: 'Cerrar', primario: true }]
      : [{ texto: 'Cerrar', primario: true }] });
    if (reconectar) setTimeout(conectarSerial, 1500);
  } else {
    const ex = explicarError(r, puerto);
    modal({ titulo: ex.titulo, cuerpo: ex.cuerpo.concat([el('details', { class: 'subir-detalle' }, el('summary', null, 'Ver el mensaje completo'), el('pre', null, r.salida || ''))]) });
  }
}
/** Traduce lo que dicen el compilador y avrdude a algo que un aprendiz pueda arreglar. */
function explicarError(r, puerto) {
  const s = r.salida || '';
  if (r.etapa === 'sin-arduino') return { titulo: 'Falta el compilador', cuerpo: [el('p', null, 'Esta instalación no tiene el compilador de Arduino. Reinstala TecnoBloques.')] };
  if (r.etapa === 'cancelado') return { titulo: 'Subida cancelada', cuerpo: [el('p', null, 'No se cambió nada en la placa. Revisa la placa y el puerto de arriba y vuelve a intentarlo.')] };
  if (r.etapa === 'ocupado') return { titulo: 'Espera un momento', cuerpo: [el('p', null, 'Ya se está subiendo un programa.')] };
  if (r.etapa === 'compilar') {
    const lib = /fatal error: ([\w]+)\.h: No such file/.exec(s);
    if (lib) return { titulo: 'Falta una librería', cuerpo: [el('p', null, `Este computador no tiene la librería ${NOMBRES_LIB[lib[1]] || lib[1]}. Pídele al instructor que actualice TecnoBloques.`)] };
    if (/Sketch too big|text section exceeds/.test(s)) return { titulo: 'El programa no cabe', cuerpo: [el('p', null, `Es muy grande para la memoria del ${placa().nombre}. Quita bloques que no uses o textos largos, o usa un Arduino Mega.`)] };
    if (/data section exceeds|not enough memory/i.test(s)) return { titulo: 'No alcanza la memoria', cuerpo: [el('p', null, 'El programa usa más memoria de variables de la que tiene la placa. Usa menos textos largos o variables.')] };
    const lineas = codigoActual().split('\n');
    const errores = [...s.matchAll(/TecnoBloques\.ino:(\d+):\d+: error: (.*)/g)].slice(0, 5).map(m => {
      const n = Number(m[1]);
      return el('li', null, `Línea ${n}: ${traducirErrorCpp(m[2])}`, el('code', null, (lineas[n - 1] || '').trim()));
    });
    return { titulo: 'El programa tiene un error', cuerpo: [
      el('p', null, estado.texto || /cpp_/.test(JSON.stringify(Blockly.serialization.workspaces.save(espacio)))
        ? 'Revisa el C++ que escribiste a mano o en los bloques "C++ libre":' : 'El compilador encontró esto:'),
      errores.length ? el('ul', { class: 'subir-errores' }, errores) : el('p', null, 'Mira el mensaje completo abajo.')] };
  }
  if (/not in sync|not responding|getsync|protocol error/i.test(s)) return placaNoResponde();
  if (/can't open device|cannot open port|unable to open port|Access is denied|Acceso denegado|ser_open/i.test(s)) {
    return { titulo: `No se pudo abrir ${puerto}`, cuerpo: [el('ul', null,
      el('li', null, 'Revisa que la placa siga conectada.'),
      el('li', null, 'Cierra el Arduino IDE u otro programa que esté usando el puerto.'),
      el('li', null, 'Si cambiaste la placa de USB, elige otra vez el puerto arriba.'))] };
  }
  if (/stk500|timeout/i.test(s)) return placaNoResponde();
  return { titulo: 'No se pudo subir el programa', cuerpo: [el('p', null, 'Mira el mensaje completo abajo. Si se repite, desconecta y vuelve a conectar la placa.')] };
}
function placaNoResponde() {
  // Con un Nano se sugiere la otra opción de cargador; con otra placa, las dos (quizá es un Nano)
  const otra = placaActual === 'nano' ? `prueba "${PLACAS.nano_old.nombre}"`
    : placaActual === 'nano_old' ? `prueba "${PLACAS.nano.nombre}"`
      : `prueba "${PLACAS.nano.nombre}" o "${PLACAS.nano_old.nombre}"`;
  return { titulo: 'La placa no responde', cuerpo: [el('ul', null,
    el('li', null, el('b', null, 'Revisa que la placa elegida arriba sea la correcta'), ` (ahora: ${placa().nombre}). Si es un Nano, ${otra}.`),
    el('li', null, 'Prueba otro cable USB: algunos solo cargan y no pasan datos.'),
    el('li', null, 'Desconecta lo que esté en los pines 0 y 1 (por ejemplo un Bluetooth) mientras subes.'))] };
}
function traducirErrorCpp(m) {
  let x;
  if ((x = /'([^']+)' was not declared in this scope/.exec(m))) return `"${x[1]}" no existe. Revisa que esté creado (variable, bloque o pin con nombre) y bien escrito.`;
  if ((x = /expected '(.+?)' before/.exec(m))) return `falta un "${x[1]}".`;
  if (/expected primary-expression/.test(m)) return 'hay algo incompleto o un símbolo de más.';
  if (/redefinition of|previously declared|conflicting declaration/.test(m)) return 'algo está definido dos veces.';
  if (/too few arguments/.test(m)) return 'a un bloque o función le faltan datos.';
  if (/too many arguments/.test(m)) return 'un bloque o función recibe más datos de los que necesita.';
  if (/stray '\\/.test(m)) return 'hay un carácter raro (quizá una comilla “curva”). Escríbelo de nuevo.';
  return m;
}

/* ---------- Simulador TecnoCircuito (proyecto hermano; ver «Proyecto hermano» en CLAUDE.md) ---------- */
// El paquete window.TecnoCircuito lo embebe build.js (copia local con --simulador-local, o una versión etiquetada).
// Solo se ofrece en la app de escritorio, porque el .hex lo compila arduino-cli. El circuito se guarda en
// extrasProyecto.circuito: TecnoBloques lo guarda y lo devuelve sin interpretarlo (formato del contrato, sección 4).
const CONTRATO_TC = 1;
const simulador = {
  disponible: !!(escritorio && escritorio.compilarHex && window.TecnoCircuito && TecnoCircuito.CONTRATO === CONTRATO_TC &&
    typeof TecnoCircuito.crearLienzo === 'function' && typeof TecnoCircuito.crearSimulador === 'function'),
  lienzo: null,
  sim: null,
  codigo: '', // el C++ que se está simulando, para avisar si el programa cambió
  compilando: false,
  eventos: [], // registro de esta sesión (pendiente: alias del aprendiz y archivo .jsonl)
  reloj: 0
};
function registrarEventoSim(ev) {
  simulador.eventos.push(ev);
  if (simulador.eventos.length > 2000) simulador.eventos.shift();
}
function notaCircuito(texto) { $('notaCircuito').textContent = texto || ''; $('notaCircuito').hidden = !texto; }
/** Crea el lienzo con el circuito del proyecto actual (al abrir, al cambiar de proyecto o de placa). */
function abrirLienzo() {
  if (!simulador.disponible) return;
  detenerSimulacion();
  try { if (simulador.lienzo) simulador.lienzo.destruir(); } catch (e) { /* ya no estaba */ }
  simulador.lienzo = null;
  $('lienzoCircuito').innerHTML = '';
  $('fallasSim').innerHTML = ''; $('fallasSim').hidden = true;
  const placas = TecnoCircuito.PLACAS || [];
  if (!placas.includes(placaActual)) {
    const nombres = placas.map(k => (PLACAS[k] || {}).nombre || k).join(', ');
    notaCircuito(`El simulador por ahora solo tiene: ${nombres}. Cambia la placa arriba para armar y simular el circuito.`);
    uiSimulador();
    return;
  }
  notaCircuito('');
  try {
    simulador.lienzo = TecnoCircuito.crearLienzo($('lienzoCircuito'), {
      placa: placaActual, circuito: extrasProyecto.circuito || null, tema: esOscuro() ? 'oscuro' : 'claro', alEvento: registrarEventoSim
    });
    simulador.lienzo.alCambiar((c) => { extrasProyecto.circuito = c; autoguardar(); });
  } catch (e) {
    notaCircuito('No se pudo abrir el circuito: ' + e.message);
  }
  uiSimulador();
}
async function simular() {
  if (!simulador.disponible || simulador.compilando) return;
  seleccionarPestana('circuito');
  if (!simulador.lienzo) return;
  detenerSimulacion();
  if (!estado.texto) actualizar(); // el código más reciente de los bloques
  const codigo = codigoActual();
  simulador.compilando = true;
  uiSimulador('Preparando tu programa…');
  let r;
  try { r = await escritorio.compilarHex({ codigo, fqbn: placa().fqbn }); }
  catch (e) { r = { ok: false, etapa: 'app', salida: e.message }; }
  simulador.compilando = false;
  if (!r.ok || !r.hex) {
    uiSimulador();
    const ex = explicarError(r, '');
    modal({ titulo: ex.titulo, cuerpo: ex.cuerpo.concat([el('details', { class: 'subir-detalle' }, el('summary', null, 'Ver el mensaje completo'), el('pre', null, r.salida || ''))]) });
    return;
  }
  try {
    const sim = TecnoCircuito.crearSimulador({ lienzo: simulador.lienzo, placa: placaActual, hex: r.hex, modo: 'realista', alEvento: registrarEventoSim });
    sim.alSerial((t) => { agregarSalida(t); salidaSim(t); });
    $('salidaSim').textContent = '';
    sim.alFalla((f) => {
      $('fallasSim').append(el('li', null, f.mensaje));
      $('fallasSim').hidden = false;
      mostrarToast(f.mensaje);
    });
    sim.alEstado(() => uiSimulador());
    if (serial.conectado) await desconectarSerial(); // el monitor muestra la simulación
    $('fallasSim').innerHTML = ''; $('fallasSim').hidden = true;
    simulador.sim = sim;
    simulador.codigo = codigo;
    lineaEspecial('Simulación: aquí sale lo que imprime el programa simulado, y lo que envíes le llega a él.', 'sistema');
    sim.iniciar();
  } catch (e) {
    modal({ titulo: 'No se pudo simular', cuerpo: [el('p', null, e.message)] });
  }
  uiSimulador();
}
/** Monitor pequeño de la pestaña Circuito: así se ve el circuito y se escribe al programa a la vez. */
function salidaSim(texto, clase) {
  const s = $('salidaSim');
  const t = String(texto).replace(/\0/g, '').replace(/\r\n?/g, '\n');
  if (clase) s.append(el('span', { class: clase }, t));
  else s.append(t);
  while (s.childNodes.length > 400) s.removeChild(s.firstChild);
  s.scrollTop = s.scrollHeight;
}
function enviarSim(texto) {
  if (!simulador.sim) { mostrarToast('Pulsa «Simular» primero.'); return; }
  const fin = FINES[$('finLinea').value] || '';
  simulador.sim.serialEnviar(texto + fin);
  salidaSim('→ ' + texto + '\n', 'enviado');
  lineaEspecial('→ ' + texto, 'enviado');
}
function detenerSimulacion() {
  const sim = simulador.sim;
  if (!sim) return;
  simulador.sim = null;
  // Contrato 1: destruir() detiene y libera el Worker. Los paquetes anteriores solo tenían _destruir().
  try { if (sim.destruir) sim.destruir(); else if (sim._destruir) sim._destruir(); else sim.detener(); } catch (e) { /* ya estaba detenida */ }
  uiSimulador();
  uiSerial();
}
/** El circuito como imagen SVG (lienzo.exportarSVG, contrato 1): para la documentación del proyecto o una evidencia en TecnoRuta. */
function guardarImagenCircuito() {
  const lienzo = simulador.lienzo;
  if (!lienzo || typeof lienzo.exportarSVG !== 'function') { mostrarToast('Esta versión del simulador no guarda imágenes.'); return; }
  const svg = lienzo.exportarSVG();
  const nombre = nombreArchivoBase() + '-circuito.svg';
  const vista = el('img', { class: 'vista-imagen', alt: 'Vista previa del circuito', src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) });
  modal({
    titulo: 'Guardar imagen del circuito',
    cuerpo: [el('p', null, 'Es una imagen SVG: se ve nítida a cualquier tamaño y se puede pegar en Word, en una presentación o subir a TecnoRuta como evidencia.'),
      vista, el('p', { class: 'muted' }, 'Archivo: ', el('code', null, nombre))],
    botones: [
      { texto: 'Descargar', primario: true, accion: () => { descargar(nombre, svg, 'image/svg+xml'); return false; } },
      { texto: 'Cerrar' }
    ]
  });
}
/** El circuito como netlist de KiCad (lienzo.exportarNetlist, contrato 1): piezas con su huella y sus conexiones, para empezar una placa. */
function guardarNetlistCircuito() {
  const lienzo = simulador.lienzo;
  if (!lienzo || typeof lienzo.exportarNetlist !== 'function') { mostrarToast('Esta versión del simulador no exporta a KiCad.'); return; }
  const base = nombreArchivoBase();
  modalExportar('Llevar el circuito a KiCad', base + '-circuito.net', lienzo.exportarNetlist({ nombre: base }), 'text/plain',
    'Es la lista de piezas y de conexiones (netlist) para hacer un shield. En KiCad, crea el proyecto desde la plantilla «Arduino Uno Shield», ' +
    'abre el editor de placas y usa Archivo → Importar → Netlist. Las piezas aparecen con líneas finas hacia los conectores del Uno: ' +
    'tú las ubicas y trazas las pistas. La protoboard y los cables no van: ya son conexiones.');
}
/** Estado de la pestaña Circuito, del botón de la barra y del monitor mientras se simula. */
function uiSimulador(texto) {
  if (!simulador.disponible) return;
  const corriendo = !!simulador.sim;
  $('btnSimular').disabled = simulador.compilando || !simulador.lienzo;
  $('btnSimular').textContent = corriendo ? 'Simular de nuevo' : 'Simular';
  $('btnDetenerSim').disabled = !corriendo;
  $('btnImagenCircuito').disabled = !simulador.lienzo;
  $('btnKicadCircuito').disabled = !simulador.lienzo;
  $('puntoCircuito').classList.toggle('on', corriendo);
  let t = texto;
  if (!t) {
    if (!simulador.lienzo) t = 'Sin simulador para esta placa';
    else if (!corriendo) t = 'Arma el circuito y pulsa Simular';
    else {
      const s = simulador.sim, m = s.medidas ? s.medidas() : s._medidas ? s._medidas() : null; // medidas(): contrato 1
      t = 'Simulando' + (m ? ` · ${(m.msSimulados / 1000).toFixed(1).replace('.', ',')} s · velocidad ${Math.round(m.velocidad * 100)} %` : '');
      if (codigoActual() !== simulador.codigo) t += ' · cambiaste el programa: pulsa «Simular de nuevo»';
    }
  }
  $('estadoSim').textContent = t;
  if (corriendo) uiSerial();
  clearInterval(simulador.reloj);
  if (corriendo) simulador.reloj = setInterval(() => { if (simulador.sim) uiSimulador(); }, 500);
}

/* ---------- Arranque ---------- */
function iniciar() {
  const sel = $('placa');
  Object.entries(PLACAS).forEach(([k, v]) => sel.append(el('option', { value: k }, v.nombre)));
  sel.value = placaActual;

  espacio = Blockly.inject('blockly', {
    toolbox: toolboxNivel(nivelActual = nivelGuardado()), renderer: 'zelos', theme: esOscuro() ? TEMA_OSCURO : TEMA_CLARO, media: PREFIJO_MEDIA, sounds: false,
    trashcan: true, zoom: { controls: true, wheel: true, startScale: 0.72, maxScale: 2, minScale: 0.35, scaleSpeed: 1.15 },
    move: { scrollbars: true, drag: true, wheel: false }, grid: { spacing: 24, length: 2, colour: '#dde4de', snap: true }
  });
  reemplazarMedia(document.body);
  espacio.registerToolboxCategoryCallback('VARIABLES_TB', flyoutVariables);
  espacio.registerToolboxCategoryCallback('FUNCIONES_TB', flyoutFunciones);
  espacio.registerToolboxCategoryCallback('MIS_BLOQUES_TB', flyoutMisBloques);
  espacio.registerButtonCallback('CREAR_VAR', dialogoCrearVariable);
  espacio.registerButtonCallback('AYUDA_MIS', ayudaMisBloques);
  espacio.registerButtonCallback('IMPORTAR_LIB', importarLibreria);
  espacio.registerButtonCallback('EXPORTAR_LIB', exportarLibreria);
  espacio.registerButtonCallback('ADMIN_LIB', administrarLibreria);
  espacio.addChangeListener(Blockly.Events.disableOrphans);
  espacio.addChangeListener((e) => {
    if (e.isUiEvent) return;
    if (e.type === Blockly.Events.BLOCK_CHANGE && e.element === 'field' && e.name === 'NAME') {
      const b = espacio.getBlockById(e.blockId);
      if (b && b.type === 'fn_def' && e.oldValue) {
        espacio.getAllBlocks(false).forEach(c => {
          if ((c.type === 'fn_call' || c.type === 'fn_call_val') && c.firma_.nombre === e.oldValue && !buscarDefinicion(e.oldValue)) {
            c.firma_.nombre = e.newValue; c.actualizarForma_();
          }
        });
      }
    }
    // Renombrar un pin: los bloques que usaban el nombre viejo pasan al nuevo (al deshacer, Blockly ya revierte todo)
    if (e.type === Blockly.Events.BLOCK_CHANGE && e.element === 'field' && e.name === 'NOMBRE' && e.recordUndo && e.oldValue) {
      const b = espacio.getBlockById(e.blockId);
      if (b && b.type === 'pin_nombre' && !nombresDePines().some(n => n.nombre === e.oldValue)) {
        const grupo = Blockly.Events.getGroup();
        Blockly.Events.setGroup(e.group || true);
        espacio.getAllBlocks(false).forEach(c => c.inputList.forEach(inp => inp.fieldRow.forEach(f => {
          if (f instanceof CampoPin && f.getValue() === e.oldValue) f.setValue(e.newValue);
        })));
        Blockly.Events.setGroup(grupo);
      }
    }
    programarActualizacion();
  });

  window.matchMedia && matchMedia('(prefers-color-scheme: dark)').addEventListener('change', aplicarTema);
  new MutationObserver(aplicarTema).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // Estado inicial: el autoguardado o, la primera vez, un proyecto vacío en el nivel del aprendiz (1 por defecto)
  const auto = leerLocal(CLAVE_AUTO);
  let ok = false;
  if (auto) ok = cargarProyecto(auto, true) === true;
  if (!ok) nuevoProyecto();
  const pref = leerLocal(CLAVE_PREF);
  iniciarDivisor(pref && pref.anchoPanel);
  cambiarVista(pref && pref.vista ? pref.vista : (window.innerWidth < 760 || nivelActual === 1 ? 'bloques' : 'dividido'));
  ponerNivel(nivelActual);
  refrescarPines();
  actualizar();

  // ---- Simulador (solo si hay paquete TecnoCircuito, contrato compatible y app de escritorio) ----
  if (simulador.disponible) {
    $('tCircuito').hidden = false;
    $('vCircuito').hidden = false;
    $('btnAmpliarCircuito').addEventListener('click', () => cambiarVista(estado.vista === 'circuito' ? 'dividido' : 'circuito'));
    $('btnSimularBarra').hidden = false;
    $('tCircuito').addEventListener('click', () => seleccionarPestana('circuito'));
    $('btnSimular').addEventListener('click', simular);
    $('btnSimularBarra').addEventListener('click', simular);
    $('btnDetenerSim').addEventListener('click', detenerSimulacion);
    $('btnImagenCircuito').addEventListener('click', guardarImagenCircuito);
    $('btnKicadCircuito').addEventListener('click', guardarNetlistCircuito);
    $('formSim').addEventListener('submit', (e) => {
      e.preventDefault();
      const t = $('txtSim').value;
      if (t === '' && $('finLinea').value === '') return;
      enviarSim(t);
      $('txtSim').value = '';
    });
    if (!simulador.lienzo) abrirLienzo();
  } else if (window.TecnoCircuito && TecnoCircuito.CONTRATO !== CONTRATO_TC) {
    console.warn(`TecnoCircuito trae el contrato ${TecnoCircuito.CONTRATO} y TecnoBloques espera el ${CONTRATO_TC}: el simulador queda apagado.`);
  }

  // ---- Controles ----
  sel.addEventListener('change', () => { placaActual = sel.value; refrescarPines(); abrirLienzo(); programarActualizacion(); mostrarToast('Placa: ' + placa().nombre); });
  $('nombreProyecto').addEventListener('input', programarActualizacion);
  document.querySelectorAll('#vistas button').forEach(b => b.addEventListener('click', () => cambiarVista(b.dataset.vista)));
  document.querySelectorAll('#niveles button').forEach(b => b.addEventListener('click', () => ponerNivel(b.dataset.nivel, { vista: true, aviso: true })));
  $('tCodigo').addEventListener('click', () => seleccionarPestana('codigo'));
  $('tSerial').addEventListener('click', () => seleccionarPestana('serial'));
  $('btnCopiar').addEventListener('click', async () => { if (!(await copiarTexto(codigoActual()))) modalExportar('Copiar código', nombreArchivoBase() + '.ino', codigoActual(), 'text/plain'); });
  $('btnEditar').addEventListener('click', () => (estado.texto ? salirModoTexto() : entrarModoTexto()));
  $('btnVolverBloques').addEventListener('click', () => salirModoTexto());
  $('btnIno').addEventListener('click', () => modalExportar('Descargar programa', nombreArchivoBase() + '.ino', codigoActual(), 'text/plain',
    `Arduino IDE pide que el archivo esté en una carpeta con su mismo nombre (${nombreArchivoBase()}/${nombreArchivoBase()}.ino); el IDE te ofrece crearla al abrirlo.`));
  $('btnSubir').addEventListener('click', () => modalSubir());
  $('btnMonitor').addEventListener('click', abrirMonitor);
  if (escritorio && escritorio.alActualizacion) {
    // Aviso discreto mientras se baja una versión nueva (la ventana de "Reiniciar" la muestra la app al terminar)
    let version = '';
    escritorio.alActualizacion((d) => {
      const aviso = $('avisoActualizacion');
      if (d.version) version = d.version;
      if (d.estado === 'bajando') {
        aviso.hidden = false;
        aviso.textContent = `Bajando una versión nueva de TecnoBloques${version ? ' (' + version + ')' : ''}… ${d.porcentaje || 0} %. Puedes seguir trabajando.`;
      } else aviso.hidden = true;
    });
  }
  if (escritorio) {
    // La versión en el título de la ventana: así se sabe qué versión tiene cada PC del aula
    escritorio.info().then((i) => { document.title = `TecnoBloques ${i.version}`; }).catch(() => {});
    $('campoPuerto').hidden = false;
    $('puerto').addEventListener('change', () => { guardarLocal(CLAVE_PUERTO, $('puerto').value); escritorio.preferirPuerto($('puerto').value); });
    $('puerto').addEventListener('focus', refrescarPuertos);
    refrescarPuertos();
    setInterval(refrescarPuertos, 3000);
  }
  $('btnGuardar').addEventListener('click', () => modalExportar('Guardar proyecto', nombreArchivoBase() + '.tbq.json', JSON.stringify(proyectoActual(), null, 1), 'application/json',
    'El proyecto lleva los bloques, la placa y una copia de tus bloques propios que usa.'));
  $('btnAbrir').addEventListener('click', () => modalAbrirTexto({
    titulo: 'Abrir proyecto', explicacion: 'Elige un archivo .tbq.json guardado con TecnoBloques. El programa actual se reemplaza.',
    alLeer: (d) => cargarProyecto(d)
  }));
  $('btnNuevo').addEventListener('click', () => modal({
    titulo: '¿Empezar un programa nuevo?', cuerpo: 'Se borra el programa actual. Tus bloques de Mis bloques se conservan.',
    botones: [{ texto: 'Cancelar' }, { texto: 'Empezar de cero', primario: true, accion: nuevoProyecto }]
  }));
  const lista = $('listaEjemplos');
  EJEMPLOS.forEach(ej => lista.append(el('button', {
    type: 'button', onclick: () => {
      lista.hidden = true; $('btnEjemplos').setAttribute('aria-expanded', 'false');
      modal({ titulo: `Abrir "${ej.nombre}"`, cuerpo: 'Se reemplaza el programa actual.', botones: [{ texto: 'Cancelar' }, { texto: 'Abrir ejemplo', primario: true, accion: () => cargarEjemplo(ej) }] });
    }
  }, el('b', null, ej.nombre), el('small', null, `${PLACAS[ej.placa].nombre} · ${ej.desc}`))));
  $('btnEjemplos').addEventListener('click', (e) => {
    e.stopPropagation();
    lista.hidden = !lista.hidden; $('btnEjemplos').setAttribute('aria-expanded', String(!lista.hidden));
  });
  document.addEventListener('click', (e) => { if (!lista.hidden && !lista.contains(e.target)) { lista.hidden = true; $('btnEjemplos').setAttribute('aria-expanded', 'false'); } });

  // Monitor serial
  $('btnConectar').addEventListener('click', () => (serial.conectado ? desconectarSerial() : conectarSerial()));
  $('baudios').addEventListener('change', () => { estado.baudiosManual = true; });
  $('btnLimpiar').addEventListener('click', () => { $('salidaSerial').innerHTML = ''; serial.inicioLinea = true; });
  $('formEnvio').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = $('txtEnviar').value;
    if (t === '' && $('finLinea').value === '') return;
    enviarSerial(t);
    if (t) { serial.historial.push(t); serial.posHist = serial.historial.length; }
    $('txtEnviar').value = '';
  });
  $('txtEnviar').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' && serial.historial.length) { serial.posHist = Math.max(0, serial.posHist - 1); e.target.value = serial.historial[serial.posHist]; e.preventDefault(); }
    if (e.key === 'ArrowDown' && serial.historial.length) { serial.posHist = Math.min(serial.historial.length, serial.posHist + 1); e.target.value = serial.historial[serial.posHist] || ''; e.preventDefault(); }
  });
  if (!('serial' in navigator)) notaSerial('<b>El monitor serial necesita Chrome o Edge de computador</b> y abrir el editor como archivo local (<code>TecnoBloques.html</code>). Aquí puedes armar y revisar el código.');
  else lineaEspecial('Elige la velocidad y pulsa Conectar para ver lo que envía la placa.', 'sistema');

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); $('btnGuardar').click(); }
  });
  window.addEventListener('resize', () => Blockly.svgResize(espacio));
}
iniciar();
