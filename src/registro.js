// Registro de eventos por equipo (contrato con TecnoCircuito, sección 6.1). Aquí va lo que no depende de la página:
// quitar los comentarios del C++, limpiar el código del equipo para el nombre del archivo, resumir los bloques y
// completar cada evento con el sobre. app.js lo conecta con la interfaz y la app de escritorio lo escribe en disco.
// Se prueba con Node: test/registro.js.

/** El largo del salto de línea en p: \n, \r\n o un \r solo (el compilador acepta los tres); 0 si no hay. */
function largoSalto(c, p) {
  return c[p] === '\n' ? 1 : c[p] === '\r' ? (c[p + 1] === '\n' ? 2 : 1) : 0;
}

/** El largo del empalme en p: \, espacios en blanco (avr-g++ los admite con un aviso) y un salto; 0 si no hay. */
function largoEmpalme(c, p) {
  if (c[p] !== '\\') return 0;
  let q = p + 1;
  while (c[q] === ' ' || c[q] === '\t' || c[q] === '\f' || c[q] === '\v') q++;
  const s = largoSalto(c, q);
  return s ? q + s - p : 0;
}

/** La posición del siguiente carácter que ve el compilador desde p, después de los empalmes. */
function saltarEmpalmes(c, p) {
  for (let e = largoEmpalme(c, p); e; e = largoEmpalme(c, p)) p += e;
  return p;
}

// Sin $: en avr-g++ 7.3, a$b son tres partes y a$R"(…)" es un texto crudo.
const esDeNombre = (ch) => ch !== undefined && /[A-Za-z0-9_]/.test(ch);
const esDigito = (ch) => ch !== undefined && ch >= '0' && ch <= '9';
const PREFIJOS_CRUDOS = new Set(['R', 'u8R', 'uR', 'UR', 'LR']);
const EMPALMES = /\\[ \t\f\v]*(?:\r\n|\r|\n)/g;
const DIRECTIVAS_CON_ARCHIVO = new Set(['include', 'include_next', 'import']);
const esEspacio = (ch) => ch === ' ' || ch === '\t' || ch === '\f' || ch === '\v';

/**
 * El C++ sin comentarios, como los ve avr-g++ (-std=gnu++11). Quita // y /* *\/ y respeta los textos entre comillas
 * ("http://…" no se corta), los caracteres ('/'), los escapes (\" dentro de un texto) y los textos crudos R"(…)",
 * u8R, uR, UR y LR. Como el compilador, primero une las líneas que terminan en \ (el empalme): /\ y otra línea con /
 * también es un comentario. Lo que no es comentario se copia tal cual, con sus empalmes. Un comentario deja sus saltos
 * de línea (o un espacio, si es de bloque y no tenía), así las líneas no cambian de número y a/**\/b no se pega.
 * Dentro de una directiva (#define…) los saltos de un comentario de bloque van con \, para no cortarla, y en #include
 * <…> o "…" son el nombre de un archivo (<avr//io.h> no tiene un comentario).
 * Lo contrasta con el compilador test/registro-preprocesador.js, que también anota los límites conocidos.
 */
function quitarComentarios(codigo) {
  const c = String(codigo);
  const fuera = [];
  let copia = 0; // desde aquí se copia tal cual hasta el próximo comentario
  let i = 0;
  // Una directiva (#define, #include…) termina en el salto de línea; por eso se sigue la línea.
  let inicioDeLinea = true; // en esta línea solo hubo espacios y comentarios
  let enDirectiva = false;
  let nombreDeDirectiva = false; // lo próximo es el nombre: define, include…
  let nombreDeArchivo = false; // después de #include, <…> y "…" son el nombre de un archivo
  const almohadilla = { desde: -1, hasta: -1, sigue: false }; // lo último que miró sigueAlmohadilla
  while (i < c.length) {
    const e = largoEmpalme(c, i);
    if (e) { i += e; continue; }
    const x = c[i];
    if (x === '/') {
      const j = saltarEmpalmes(c, i + 1);
      if (c[j] === '/' || c[j] === '*') {
        const bloque = c[j] === '*';
        const fin = bloque ? finDeBloque(c, j + 1) : finDeLinea(c, j + 1);
        pegar(fuera, c.slice(copia, i));
        if (!bloque) quitarEspaciosAlFinal(fuera);
        // Una \ suelta justo antes del comentario, pegada al salto, sería un empalme y uniría dos líneas: el comentario
        // vacío /**/ la separa (no lleva nada del comentario). Si ya está ese separador, queda igual: limpiar otra vez
        // un código limpio no lo cambia, y la historia lo revisa así (REG-005, TB-1).
        if (terminaEnBarra(fuera)) {
          pegar(fuera, '/**/');
          if (c.slice(i, fin) === '/**/') { i = copia = fin; continue; }
        }
        const saltos = c.slice(i, fin).match(/\r\n|\r|\n/g);
        if (!saltos) pegar(fuera, bloque ? ' ' : '');
        else if (bloque && (enDirectiva || (!inicioDeLinea && sigueAlmohadilla(c, fin, almohadilla)))) {
          // Un salto cortaría la directiva (o volvería directiva un # que estaba en medio de la línea): con \ antes
          // de cada salto la línea sigue, como con el comentario, y no cambia el número de líneas.
          pegar(fuera, ' ');
          for (const s of saltos) pegar(fuera, '\\' + s);
        } else for (const s of saltos) pegar(fuera, s);
        i = copia = fin;
        continue;
      }
    }
    const salto = largoSalto(c, i);
    if (salto) {
      inicioDeLinea = true;
      enDirectiva = nombreDeDirectiva = nombreDeArchivo = false;
      i += salto;
      continue;
    }
    if (esEspacio(x)) { i++; continue; }
    const alInicio = inicioDeLinea;
    const esNombreDeDirectiva = nombreDeDirectiva;
    const esNombreDeArchivo = nombreDeArchivo;
    inicioDeLinea = nombreDeDirectiva = nombreDeArchivo = false;
    if (alInicio && (x === '#' || (x === '%' && c[saltarEmpalmes(c, i + 1)] === ':'))) {
      enDirectiva = nombreDeDirectiva = true;
      i = x === '#' ? i + 1 : saltarEmpalmes(c, i + 1) + 1;
      continue;
    }
    if (esNombreDeArchivo && (x === '<' || x === '"')) {
      // #include <avr//io.h>: el // es parte del nombre. Sin cerrar en la línea, se lee como siempre.
      const fin = finDeNombreDeArchivo(c, i + 1, x === '<' ? '>' : '"');
      if (fin > 0) { i = fin; continue; }
    }
    if (x === '"' || x === "'") { i = finDeTexto(c, i + 1, x); continue; }
    if (esDigito(x) || (x === '.' && esDigito(c[saltarEmpalmes(c, i + 1)]))) {
      // Un número (pp-number): en 1.R"(…)" no hay texto crudo, como 0x1F o 1e+5 tampoco son tres partes. El signo
      // sigue a la e que ve el compilador, aunque haya un empalme entre ellos (1e\ y otra línea con +R"(…" es un número).
      let p = i + 1;
      let anterior = x;
      for (;;) {
        p = saltarEmpalmes(c, p);
        const ch = c[p];
        if (esDeNombre(ch) || ch === '.' || ((ch === '+' || ch === '-') && /[eEpP]/.test(anterior))) { anterior = ch; p++; }
        else break;
      }
      i = p;
      continue;
    }
    if (esDeNombre(x)) {
      // Un nombre entero, aunque lo corte un empalme (xx\ y otra línea con R"( es el nombre xxR). Abre un texto crudo
      // solo si es R, u8R, uR, UR o LR y le sigue la comilla (sin contar los empalmes: u8\ y otra línea con R" también).
      let p = i + 1;
      while (esDeNombre(c[saltarEmpalmes(c, p)])) p = saltarEmpalmes(c, p) + 1;
      const nombre = c.slice(i, p).replace(EMPALMES, '');
      if (esNombreDeDirectiva && DIRECTIVAS_CON_ARCHIVO.has(nombre)) nombreDeArchivo = true;
      const comilla = saltarEmpalmes(c, p);
      if (c[comilla] === '"' && PREFIJOS_CRUDOS.has(nombre)) {
        const crudo = finDeCrudo(c, comilla + 1, enDirectiva);
        if (crudo > 0) { i = crudo; continue; }
      }
      i = p;
      continue;
    }
    i++;
  }
  pegar(fuera, c.slice(copia));
  return fuera.join('');
}

/**
 * ¿Lo próximo en la línea, después de espacios, empalmes y comentarios de bloque, es un # (o %:)? `memoria` guarda
 * lo último que se miró: en una cadena de comentarios, cada uno llega al mismo #, y así no se recorre la cadena otra vez.
 */
function sigueAlmohadilla(c, p, memoria) {
  if (p >= memoria.desde && p <= memoria.hasta) return memoria.sigue;
  const desde = p;
  for (;;) {
    p = saltarEmpalmes(c, p);
    if (esEspacio(c[p])) { p++; continue; }
    const j = saltarEmpalmes(c, p + 1);
    if (c[p] === '/' && c[j] === '*') { p = finDeBloque(c, j + 1); continue; }
    break;
  }
  Object.assign(memoria, { desde, hasta: p, sigue: c[p] === '#' || (c[p] === '%' && c[saltarEmpalmes(c, p + 1)] === ':') });
  return memoria.sigue;
}

/** ¿La salida termina en una \ suelta, quizás con espacios después? */
function terminaEnBarra(partes) {
  for (let k = partes.length - 1; k >= 0; k--) {
    const s = partes[k];
    let q = s.length;
    while (q > 0 && esEspacio(s[q - 1])) q--;
    if (q > 0) return s[q - 1] === '\\';
  }
  return false;
}

/** El nombre de archivo de un #include termina después de > (o "), en la misma línea; 0 si no se cierra. */
function finDeNombreDeArchivo(c, p, cierre) {
  while (p < c.length) {
    const e = largoEmpalme(c, p);
    if (e) { p += e; continue; }
    if (largoSalto(c, p)) return 0;
    if (c[p] === cierre) return p + 1;
    p++;
  }
  return 0;
}

/** El final del sufijo de un texto cerrado ("x"_k, y "x"u8R"(…)" es el sufijo u8R y otro texto), o p si no tiene. */
function finDeSufijo(c, p) {
  if (!/[A-Za-z_]/.test(c[saltarEmpalmes(c, p)] || '')) return p;
  while (esDeNombre(c[saltarEmpalmes(c, p)])) p = saltarEmpalmes(c, p) + 1;
  return p;
}

/**
 * Añade un trozo a la salida. Si el anterior termina en un \r solo y este empieza con \n, los separa con un espacio:
 * juntos serían un salto \r\n, y el código tendría una línea menos.
 */
function pegar(partes, texto) {
  if (!texto) return;
  if (texto[0] === '\n' && partes.length && partes[partes.length - 1].endsWith('\r')) partes.push(' ');
  partes.push(texto);
}

/** Un comentario de línea termina antes del salto que no es empalme. */
function finDeLinea(c, p) {
  while (p < c.length) {
    const e = largoEmpalme(c, p);
    if (e) p += e;
    else if (largoSalto(c, p)) return p;
    else p++;
  }
  return c.length;
}

/** Un comentario de bloque termina después de * y /, aunque haya empalmes entre ellos; si no se cierra, al final. */
function finDeBloque(c, p) {
  while ((p = saltarEmpalmes(c, p)) < c.length) {
    const q = saltarEmpalmes(c, p + 1);
    if (c[p] === '*' && c[q] === '/') return q + 1;
    p++;
  }
  return c.length;
}

/**
 * Un texto o un carácter termina después de su comilla y su sufijo; sin cerrar, en el salto de línea (como en el
 * compilador, y entonces no tiene sufijo).
 */
function finDeTexto(c, p, comilla) {
  while (p < c.length) {
    const e = largoEmpalme(c, p);
    if (e) { p += e; continue; }
    if (largoSalto(c, p)) return p;
    if (c[p] === comilla) return finDeSufijo(c, p + 1);
    p = c[p] === '\\' ? saltarEmpalmes(c, p + 1) + 1 : p + 1;
  }
  return c.length;
}

/**
 * Un texto crudo desde después de la comilla: marca( … )marca" y su sufijo. Adentro no hay escapes ni empalmes (la \
 * al final de una línea es parte del texto). Devuelve dónde termina (sin cerrar, al final) o 0 si la marca no vale:
 * entonces el compilador lo trata como un texto común. En una directiva no pasa de su línea (sí de un empalme): sin
 * cerrar, termina en el salto, y lo que sigue se lee como siempre (un // de la otra línea es un comentario).
 */
function finDeCrudo(c, p, enDirectiva) {
  const abre = c.slice(p, p + 17).indexOf('('); // la marca tiene hasta 16 caracteres
  const marca = abre < 0 ? '' : c.slice(p, p + abre);
  // La marca solo lleva caracteres básicos de C++ (avr-g++ rechaza $, @, `, los de control y las letras con tilde).
  if (abre < 0 || !/^[A-Za-z0-9_{}[\]#<>%:;.?*+\-/^&|~!=,"']*$/.test(marca)) return 0;
  const limite = enDirectiva ? finDeLinea(c, p + abre + 1) : c.length;
  const cierre = c.indexOf(')' + marca + '"', p + abre + 1);
  return cierre < 0 || cierre + marca.length + 2 > limite ? limite : finDeSufijo(c, cierre + marca.length + 2);
}

/** Quita los espacios y tabuladores que quedaron antes de un comentario de línea. */
function quitarEspaciosAlFinal(partes) {
  while (partes.length) {
    const ultima = partes[partes.length - 1];
    let fin = ultima.length;
    while (fin > 0 && (ultima[fin - 1] === ' ' || ultima[fin - 1] === '\t')) fin--;
    if (fin) { partes[partes.length - 1] = ultima.slice(0, fin); return; }
    partes.pop();
  }
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
    /** La sesión del equipo actual (la esquina avisa solo sus eventos perdidos, AUD-07). */
    sesion: () => sesion,
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
    /**
     * Un evento ya armado (del lienzo, del simulador o del editor). Si no llega a la app (no se puede copiar: una
     * función, un nodo de la página…), no se pierde en silencio: va su evento_descartado (AUD-07, contrato 6.1).
     */
    registrar(ev) {
      if (equipo === null || !ev || typeof ev !== 'object') return;
      try { escribir(completar(ev)); } catch (e) {
        // Nada de aquí puede lanzar: un evento raro (un getter que falla) tampoco interrumpe el trabajo
        try {
          const datos = { motivo: 'no_serializable' };
          if (typeof ev.tipo === 'string' && ev.tipo) datos.tipo = ev.tipo.slice(0, 64);
          if (typeof ev.origen === 'string' && ev.origen) datos.origen = ev.origen.slice(0, 64);
          if (Number.isInteger(ev.corrida) && ev.corrida >= 1) datos.corrida = ev.corrida;
          // La hora del evento perdido, si la traía: así queda en su lugar
          const t = Number.isFinite(ev.t) && ev.t >= 0 && ev.t <= 8.64e15 ? Math.round(ev.t) : Math.round(ahora());
          escribir(completar({ t, origen: 'editor', tipo: 'evento_descartado', datos }));
        } catch (e2) { /* el registro nunca interrumpe el trabajo */ }
      }
    },
  };
}

if (typeof module !== 'undefined') module.exports = { quitarComentarios, codigoParaArchivo, limpiarEquipo, resumenBloques, fechaArchivo, crearRegistroEventos };
