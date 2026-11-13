// Corte y conteo de la red de la app de escritorio para las pruebas sin red (EST-002, I6 r1, F03 de COD-20261112-001).
// Cortar solo la página no basta: el proceso principal tiene sus propios transportes (Electron.net con la partición de
// electron-updater, y los módulos de Node). Este módulo corta, en el proceso principal:
//   1. Nombres: el interruptor de Chromium --host-resolver-rules hace que ningún nombre resuelva desde que arranca el
//      proceso (todas las sesiones y Electron.net), antes de que la prueba pueda instalar nada.
//   2. Pedidos de Chromium: webRequest.onBeforeRequest en la sesión predeterminada (la de la ventana), en la partición
//      «electron-updater» y en cada sesión que se cree después; cancela y anota todo pedido http(s)/ws(s)/ftp.
//   3. Sockets de Node del proceso principal (http, https, net): net.Socket.connect anota y corta toda conexión TCP.
// Y lo comprueba con un control: un servidor local en 127.0.0.1 (una IP, que no pasa por el resolvedor) recibe un pedido
// por Electron.net con la partición del actualizador ANTES del corte (el control es sensible: el transporte llega) y,
// después del corte, ningún pedido de esa partición, de la sesión predeterminada, de la página ni de Node.
// Fuera de alcance: los procesos hijos (arduino-cli) no pasan por aquí; reciben HTTP(S)_PROXY a un puerto cerrado y el
// corte físico de E10 los cubre. Una IP literal pasa el resolvedor, pero no el punto 2 ni el 3.
'use strict';
const http = require('http');

// El resolvedor también rechaza las IP literales; 127.0.0.1 queda fuera (es el equipo mismo, no la red) para que el
// control previo pueda llegar a su servidor local. Después del corte, el punto 2 la cancela igual.
const ARGS_SIN_RED = ['--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost , EXCLUDE 127.0.0.1'];
const ENV_SIN_RED = { HTTP_PROXY: 'http://127.0.0.1:9', HTTPS_PROXY: 'http://127.0.0.1:9' };

// Servidor local que cuenta lo que le llega (pedidos y conexiones TCP)
function servidorControl() {
  return new Promise((listo) => {
    const llegadas = [];
    let conexiones = 0;
    const srv = http.createServer((req, res) => { llegadas.push(req.url); res.end('control'); });
    srv.on('connection', () => { conexiones++; });
    srv.listen(0, '127.0.0.1', () => listo({ puerto: srv.address().port, llegadas, conexiones: () => conexiones, cerrar: () => new Promise((r) => srv.close(r)) }));
  });
}

// Un pedido desde el proceso principal por Electron.net, con la sesión indicada (null: la predeterminada)
const pedirDesdePrincipal = (app, url, particion) => app.evaluate(({ net, session }, [u, p]) => new Promise((fin) => {
  try {
    const s = p ? session.fromPartition(p, { cache: false }) : session.defaultSession;
    const req = net.request({ url: u, session: s });
    const reloj = setTimeout(() => { try { req.abort(); } catch (e) { /* */ } fin({ estado: 'sin-respuesta' }); }, 8000);
    req.on('response', (res) => { clearTimeout(reloj); res.on('data', () => {}); res.on('end', () => fin({ estado: 'respuesta', codigo: res.statusCode })); });
    req.on('error', (e) => { clearTimeout(reloj); fin({ estado: 'error', error: String(e && e.message || e) }); });
    req.end();
  } catch (e) { fin({ estado: 'excepcion', error: String(e && e.message || e) }); }
}), [url, particion]);

// Un socket de Node desde el proceso principal
const socketDesdePrincipal = (app, puerto) => app.evaluate((_e, p) => new Promise((fin) => {
  const req = (process.mainModule || module).require('http').get({ host: '127.0.0.1', port: p, path: '/node' }, (res) => { res.resume(); res.on('end', () => fin({ estado: 'respuesta', codigo: res.statusCode })); });
  req.setTimeout(8000, () => { req.destroy(); fin({ estado: 'sin-respuesta' }); });
  req.on('error', (e) => fin({ estado: 'error', error: String(e && e.message || e) }));
}), puerto);

// Instala el corte en el proceso principal. Devuelve cuándo quedó puesto (segundos desde que arrancó el proceso).
const cortarRed = (app) => app.evaluate(({ app: a, session }) => {
  if (global.__sinRed) return { yaEstaba: true };
  const g = global.__sinRed = { intentos: [], sesiones: [], uptime: process.uptime(), hora: Date.now(), node: false };
  const cortar = (s, nombre) => {
    if (s.__sinRed) return;
    s.__sinRed = true;
    g.sesiones.push(nombre);
    s.webRequest.onBeforeRequest((d, cb) => {
      if (/^(https?|wss?|ftp):/i.test(d.url)) { g.intentos.push({ via: 'chromium', sesion: nombre, url: d.url, tipo: d.resourceType, t: Date.now() }); cb({ cancel: true }); }
      else cb({});
    });
  };
  cortar(session.defaultSession, 'predeterminada');
  cortar(session.fromPartition('electron-updater', { cache: false }), 'electron-updater');
  a.on('session-created', (s) => cortar(s, `creada:${s.storagePath || 'memoria'}`));
  const req = (process.mainModule || module).require;
  const netNode = req('net');
  const conectar = netNode.Socket.prototype.connect;
  netNode.Socket.prototype.connect = function (...args) {
    const o = args[0] && typeof args[0] === 'object' ? (Array.isArray(args[0]) ? args[0][0] : args[0]) : { port: args[0], host: args[1] };
    if (o && o.path) return conectar.apply(this, args); // tuberías locales (no son red)
    g.intentos.push({ via: 'node', url: `tcp://${o && o.host || 'localhost'}:${o && o.port}`, t: Date.now() });
    const err = Object.assign(new Error('sin red (prueba)'), { code: 'ECONNREFUSED' });
    process.nextTick(() => this.destroy(err));
    return this;
  };
  g.node = true;
  return { uptime: g.uptime, sesiones: g.sesiones, node: g.node };
});

const leerIntentos = (app) => app.evaluate(() => (global.__sinRed ? { intentos: global.__sinRed.intentos, sesiones: global.__sinRed.sesiones, hora: global.__sinRed.hora } : null));

// El control completo: antes del corte el transporte llega; después, nada llega por ninguna vía.
// `win` es la ventana (para el pedido de la página). Devuelve las comprobaciones como [condición, texto].
async function controlarCorte(app, win) {
  const srv = await servidorControl();
  const base = `http://127.0.0.1:${srv.puerto}`;
  const r = { puerto: srv.puerto };
  r.previo = await pedirDesdePrincipal(app, `${base}/previo-updater`, 'electron-updater');
  r.llegadasPrevias = srv.llegadas.length;
  // Entre el arranque y el corte, los nombres ya no resuelven (punto 1): un nombre local no llega al servidor
  r.previoNombre = await pedirDesdePrincipal(app, `http://control-red.test:${srv.puerto}/previo-nombre`, 'electron-updater');
  r.llegadasPreviasNombre = srv.llegadas.length - r.llegadasPrevias;
  r.corte = await cortarRed(app);
  const nAntes = srv.llegadas.length, cAntes = srv.conexiones();
  r.updater = await pedirDesdePrincipal(app, `${base}/control-updater`, 'electron-updater');
  r.updaterNombre = await pedirDesdePrincipal(app, `http://control-red.test:${srv.puerto}/control-updater-nombre`, 'electron-updater');
  r.predeterminada = await pedirDesdePrincipal(app, `${base}/control-predeterminada`, null);
  r.node = await socketDesdePrincipal(app, srv.puerto);
  r.pagina = await win.evaluate((u) => fetch(u).then((x) => ({ estado: 'respuesta', codigo: x.status }), (e) => ({ estado: 'error', error: String(e) })), `${base}/control-pagina`);
  await new Promise((t) => setTimeout(t, 300));
  r.llegadasTrasCorte = srv.llegadas.length - nAntes;
  r.conexionesTrasCorte = srv.conexiones() - cAntes;
  const registrados = (await leerIntentos(app)).intentos;
  r.controlesAnotados = registrados.filter((i) => /control-|:\d+$/.test(i.url) && i.url.includes(String(srv.puerto))).map((i) => `${i.via}:${i.sesion || ''}`);
  await srv.cerrar();
  const fallo = (x) => x && x.estado !== 'respuesta';
  return {
    datos: r,
    comprobaciones: [
      [r.previo.estado === 'respuesta' && r.llegadasPrevias === 1, `control previo: antes del corte, Electron.net con la partición del actualizador llega al servidor local (${JSON.stringify(r.previo)}; ${r.llegadasPrevias} llegada): el control es sensible`],
      [r.previoNombre.estado === 'error' && /NAME_NOT_RESOLVED/.test(r.previoNombre.error) && r.llegadasPreviasNombre === 0, `antes del corte, un nombre no resuelve desde que arranca el proceso (${r.previoNombre.error || r.previoNombre.estado}; ${r.llegadasPreviasNombre} llegadas)`],
      [r.corte && r.corte.node && r.corte.sesiones.includes('electron-updater') && r.corte.sesiones.includes('predeterminada'), `corte puesto en el proceso principal a los ${r.corte && r.corte.uptime && r.corte.uptime.toFixed(1)} s (sesiones: ${r.corte && (r.corte.sesiones || []).join(', ')}; sockets de Node: ${r.corte && r.corte.node ? 'sí' : 'no'})`],
      [fallo(r.updater) && fallo(r.updaterNombre) && fallo(r.predeterminada) && fallo(r.node) && fallo(r.pagina), `tras el corte, ninguna vía obtiene respuesta (actualizador ${r.updater.estado}, actualizador por nombre ${r.updaterNombre.estado}, predeterminada ${r.predeterminada.estado}, Node ${r.node.estado}, página ${r.pagina.estado})`],
      [r.llegadasTrasCorte === 0 && r.conexionesTrasCorte === 0, `tras el corte, al servidor local no llega nada (${r.llegadasTrasCorte} pedidos, ${r.conexionesTrasCorte} conexiones)`],
      [['chromium:electron-updater', 'chromium:predeterminada', 'node:'].every((k) => r.controlesAnotados.some((x) => x.startsWith(k))), `cada intento de control quedó contado (${r.controlesAnotados.join(', ')})`],
    ],
  };
}

// Resumen de lo que la app intentó por su cuenta (sin los controles): todo cancelado y contado
async function resumenIntentos(app, puertoControl) {
  const l = await leerIntentos(app);
  const propios = (l ? l.intentos : []).filter((i) => !(puertoControl && i.url.includes(`:${puertoControl}`)));
  const porVia = {};
  for (const i of propios) { const k = `${i.via}:${i.sesion || ''} ${i.url.replace(/^(\w+:\/\/[^/]+).*/, '$1')}`; porVia[k] = (porVia[k] || 0) + 1; }
  return { total: propios.length, porVia, intentos: propios };
}

module.exports = { ARGS_SIN_RED, ENV_SIN_RED, cortarRed, controlarCorte, resumenIntentos, servidorControl };
