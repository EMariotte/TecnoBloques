// Registro de eventos por equipo (contrato con TecnoCircuito, sección 6.1). Aquí va lo que no depende de la página:
// quitar los comentarios del C++, limpiar el código del equipo para el nombre del archivo, resumir los bloques y
// completar cada evento con el sobre. app.js lo conecta con la interfaz y la app de escritorio lo escribe en disco.
// Se prueba con Node: test/registro.js.

/**
 * El C++ sin comentarios: quita // y /* *\/ y respeta los textos entre comillas ("http://…" no se corta), los
 * caracteres ('/'), los escapes (\" dentro de un texto) y los textos crudos R"(…)". Un comentario de bloque deja sus
 * saltos de línea (o un espacio, si no tenía), así las líneas del código no cambian de número y a/**\/b no se pega.
 */
function quitarComentarios(codigo) {
  const c = String(codigo);
  let fuera = '';
  let i = 0;
  while (i < c.length) {
    const x = c[i];
    const y = c[i + 1];
    if (x === '/' && y === '/') {
      // Hasta el fin de la línea, que se conserva. Una barra al final de la línea la continúa (como hace el
      // compilador): ese salto también se conserva, para que las líneas no cambien de número.
      let fin = fuera.length;
      while (fin > 0 && (fuera[fin - 1] === ' ' || fuera[fin - 1] === '\t')) fin--;
      fuera = fuera.slice(0, fin);
      i += 2;
      while (i < c.length) {
        const salto = c[i + 1] === '\n' ? '\n' : c[i + 1] === '\r' && c[i + 2] === '\n' ? '\r\n' : '';
        if (c[i] === '\\' && salto) { fuera += salto; i += 1 + salto.length; continue; }
        if (c[i] === '\n' || (c[i] === '\r' && c[i + 1] === '\n')) break;
        i++;
      }
      continue;
    }
    if (x === '/' && y === '*') {
      const fin = c.indexOf('*/', i + 2);
      const dentro = c.slice(i + 2, fin < 0 ? c.length : fin);
      const saltos = dentro.match(/\r?\n/g);
      fuera += saltos ? saltos.join('') : ' ';
      i = fin < 0 ? c.length : fin + 2;
      continue;
    }
    if (x === 'R' && y === '"' && !/[A-Za-z0-9_]/.test(c[i - 1] || '')) {
      // Texto crudo: R"marca( … )marca", sin escapes adentro.
      const abre = c.indexOf('(', i + 2);
      const marca = abre > 0 ? c.slice(i + 2, abre) : null;
      if (marca !== null && /^[^\s()\\]{0,16}$/.test(marca)) {
        const cierre = c.indexOf(')' + marca + '"', abre + 1);
        const hasta = cierre < 0 ? c.length : cierre + marca.length + 2;
        fuera += c.slice(i, hasta);
        i = hasta;
        continue;
      }
    }
    if (x === '"' || x === "'") {
      let j = i + 1;
      while (j < c.length && c[j] !== x && c[j] !== '\n') j += c[j] === '\\' ? 2 : 1;
      fuera += c.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    fuera += x;
    i++;
  }
  return fuera;
}

/** El código del equipo para el nombre del archivo: solo letras sin tilde, dígitos, - y _ (lo demás pasa a _). */
function codigoParaArchivo(equipo) {
  const limpio = String(equipo || '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40);
  return /[A-Za-z0-9]/.test(limpio) ? limpio : 'equipo';
}

/** El código del equipo como se escribió, sin los espacios de los extremos ni saltos de línea. */
function limpiarEquipo(equipo) {
  return String(equipo || '').replace(/\s+/g, ' ').trim().slice(0, 40);
}

/** Resumen de los bloques (no el XML): cuántos hay y cuántos de cada tipo. `tipos` es la lista de tipos de cada bloque. */
function resumenBloques(tipos) {
  const cuenta = {};
  for (const t of tipos) cuenta[t] = (cuenta[t] || 0) + 1;
  return { bloques: tipos.length, tipos: cuenta };
}

/** La fecha local AAAA-MM-DD, para el nombre del archivo. */
function fechaArchivo(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * El registro de una sesión. `escribir(linea)` lo hace la app de escritorio. Mientras no haya equipo, no escribe
 * nada. Cada evento sale con el sobre completo: v, equipo, sesion y las dos versiones.
 */
function crearRegistroEventos({ escribir, versionTB, versionTC, ahora = () => Date.now(), nuevaSesion }) {
  let equipo = null;
  let sesion = null;
  let inicio = 0;
  const completar = (ev) => ({
    v: 1, ...ev, equipo, sesion, version_tb: versionTB || 'desconocida', version_tc: versionTC || 'ninguno',
  });
  return {
    activo: () => equipo !== null,
    equipo: () => equipo,
    /** Empieza la sesión de un equipo (y termina la del anterior, si había). */
    empezar(codigo, datos) {
      if (equipo !== null) this.terminar();
      equipo = limpiarEquipo(codigo);
      if (!equipo) { equipo = null; return false; }
      sesion = nuevaSesion();
      inicio = ahora();
      this.editor('sesion_iniciada', datos);
      return true;
    },
    terminar() {
      if (equipo === null) return;
      this.editor('sesion_terminada', { ms: Math.max(0, Math.round(ahora() - inicio)) });
      equipo = null;
      sesion = null;
    },
    /** Un evento del editor (origen «editor»). */
    editor(tipo, datos) {
      this.registrar({ t: Math.round(ahora()), origen: 'editor', tipo, datos: datos || {} });
    },
    /** Un evento ya armado (del lienzo, del simulador o del editor). */
    registrar(ev) {
      if (equipo === null || !ev || typeof ev !== 'object') return;
      try { escribir(completar(ev)); } catch (e) { /* el registro nunca interrumpe el trabajo */ }
    },
  };
}

if (typeof module !== 'undefined') module.exports = { quitarComentarios, codigoParaArchivo, limpiarEquipo, resumenBloques, fechaArchivo, crearRegistroEventos };
