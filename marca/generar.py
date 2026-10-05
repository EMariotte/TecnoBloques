"""Genera todos los archivos de la marca TecnoBloques a partir de un solo dibujo.

El símbolo: dos bloques encajados forman un robot. La cabeza (verde) tiene un ojo engranaje
(robótica) y un ojo cursor (código), y una antena en T (TecnoAcademia). El cuerpo lleva </>.
Colores institucionales SENA: verde #39A900 y azul #00304D, más blanco.

Uso:  python marca/generar.py      (necesita playwright + chromium, los mismos de las pruebas)
"""
import base64, io, math, pathlib, struct
from playwright.sync_api import sync_playwright

RAIZ = pathlib.Path(__file__).resolve().parent.parent
M = RAIZ / 'marca'
VERDE, AZUL, BLANCO = '#39A900', '#00304D', '#FFFFFF'

# ---------------------------------------------------------------- geometría (cuadrícula de 64)
GAP = 1.8                       # separación entre los bloques encajados
TAB_W, TAB_D, TAB_S = 8, 3, 3   # pestaña: ancho abajo, profundidad, inclinación de los lados


def f(n):
    return f'{n:.2f}'.rstrip('0').rstrip('.')


def _bloque(x, y, w, h, r, color, muesca=False, pestana=False, cx=32):
    m = TAB_W / 2 + TAB_S
    d = f'M{f(x + r)} {f(y)}'
    if muesca:
        d += f'H{f(cx - m)}l{TAB_S} {TAB_D}h{TAB_W}l{TAB_S}-{TAB_D}'
    d += f'H{f(x + w - r)}a{f(r)} {f(r)} 0 0 1 {f(r)} {f(r)}V{f(y + h - r)}a{f(r)} {f(r)} 0 0 1-{f(r)} {f(r)}'
    if pestana:
        d += f'H{f(cx + m)}l-{TAB_S} {TAB_D}h-{TAB_W}l-{TAB_S}-{TAB_D}'
    d += f'H{f(x + r)}a{f(r)} {f(r)} 0 0 1-{f(r)}-{f(r)}V{f(y + r)}a{f(r)} {f(r)} 0 0 1 {f(r)}-{f(r)}z'
    return f'<path d="{d}" fill="{color}"/>'


def _engranaje(cx, cy, ro, ri, dientes, color, hueco, color_hueco):
    pts, paso = [], 2 * math.pi / dientes
    for i in range(dientes):
        a = i * paso - math.pi / 2
        for da, r in ((-0.30, ri), (-0.16, ro), (0.16, ro), (0.30, ri)):
            pts.append((cx + r * math.cos(a + da * paso * 1.6), cy + r * math.sin(a + da * paso * 1.6)))
    d = 'M' + 'L'.join(f'{f(px)} {f(py)}' for px, py in pts) + 'Z'
    return f'<path d="{d}" fill="{color}"/><circle cx="{f(cx)}" cy="{f(cy)}" r="{f(hueco)}" fill="{color_hueco}"/>'


def robot(cabeza, cara, cuerpo, codigo, solo_cabeza=False):
    """Dibujo del robot (sin fondo). cabeza/cuerpo: color de cada bloque; cara: ojos; codigo: </>."""
    hx, hy, hw, hh = (9, 19, 46, 30) if solo_cabeza else (16, 12.5, 32, 20)
    k, cx = hw / 32, hx + hw / 2
    s = (f'<path d="M{f(cx - 5.5 * k)} {f(hy - 6.5 * k)}h{f(11 * k)}M{f(cx)} {f(hy - 6.5 * k)}v{f(6.5 * k)}" '
         f'stroke="{cabeza}" stroke-width="{f(3.6 * k)}" stroke-linecap="round"/>')
    s += _bloque(hx, hy, hw, hh, 5 * k, cabeza, pestana=not solo_cabeza, cx=cx)
    ey = hy + hh / 2
    s += _engranaje(hx + hw * 0.31, ey, 6.1 * k, 4.5 * k, 8, cara, 2.0 * k, cabeza)
    s += (f'<rect x="{f(hx + hw * 0.69 - 2.4 * k)}" y="{f(ey - 6 * k)}" width="{f(4.8 * k)}" height="{f(12 * k)}" '
          f'rx="{f(2.4 * k)}" fill="{cara}"/>')
    if not solo_cabeza:
        by = hy + hh + GAP
        s += _bloque(10, by, 44, 18, 6, cuerpo, muesca=True, pestana=True, cx=cx)
        my = by + 10
        s += (f'<path d="M25.5 {f(my - 4)}l-4 4 4 4M38.5 {f(my - 4)}l4 4-4 4M33.6 {f(my - 5)}l-3.2 10" stroke="{codigo}" '
              f'stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>')
    return s


def svg(dibujo, fondo=None):
    t = f'<rect width="64" height="64" rx="14" fill="{fondo}"/>' if fondo else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">{t}{dibujo}</svg>\n'


# ---------------------------------------------------------------- variantes
SVGS = {
    'simbolo-app.svg': svg(robot(VERDE, AZUL, BLANCO, AZUL), AZUL),               # ícono principal (fondo azul)
    'simbolo-cabeza.svg': svg(robot(VERDE, AZUL, BLANCO, AZUL, True), AZUL),      # 16-24 px y favicon
    'simbolo-sobre-claro.svg': svg(robot(VERDE, AZUL, AZUL, BLANCO)),             # sin fondo, para fondos claros
    'simbolo-sobre-oscuro.svg': svg(robot(VERDE, AZUL, BLANCO, AZUL)),            # sin fondo, para fondos oscuros
    'una-tinta-azul.svg': svg(robot(AZUL, BLANCO, AZUL, BLANCO)),                 # impresión / grabado (sobre blanco)
    'una-tinta-blanca.svg': svg(robot(BLANCO, '#202020', BLANCO, '#202020')),     # sobre fondos oscuros
}


def ico(pngs):
    """Arma un .ico de Windows con imágenes PNG (válido desde Windows Vista)."""
    cab = struct.pack('<HHH', 0, 1, len(pngs))
    dirs, datos, off = b'', b'', 6 + 16 * len(pngs)
    for t, b in pngs:
        dirs += struct.pack('<BBBBHHII', t % 256, t % 256, 0, 0, 1, 32, len(b), off)
        datos += b
        off += len(b)
    return cab + dirs + datos


def logo_html(texto_tecno, texto_bloques, linea, fondo, simbolo):
    return f'''<html><head><link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap" rel="stylesheet">
<style>body{{margin:0;background:{fondo}}} .l{{display:inline-flex;align-items:center;gap:22px;padding:24px 30px}}
.l img{{width:112px;height:112px}} .t{{display:flex;flex-direction:column;font-family:"Atkinson Hyperlegible",sans-serif;line-height:1}}
b{{font-size:72px;letter-spacing:-1px}} small{{font-size:24px;color:{linea};margin-top:8px;letter-spacing:.3px}}</style></head>
<body><div class="l"><img src="data:image/svg+xml;base64,{base64.b64encode(simbolo.encode()).decode()}">
<div class="t"><b><span style="color:{texto_tecno}">Tecno</span><span style="color:{texto_bloques}">Bloques</span></b>
<small>TecnoAcademia Tolima · SENA</small></div></div></body></html>'''


def main():
    (M / 'svg').mkdir(parents=True, exist_ok=True)
    (M / 'png').mkdir(parents=True, exist_ok=True)
    for nombre, contenido in SVGS.items():
        (M / 'svg' / nombre).write_text(contenido, encoding='utf-8', newline='\n')

    b64 = lambda s: 'data:image/svg+xml;base64,' + base64.b64encode(s.encode()).decode()
    with sync_playwright() as p:
        nav = p.chromium.launch()
        pag = nav.new_page()

        def png(s, t):
            pag.set_viewport_size({'width': t, 'height': t})
            pag.set_content(f'<html><body style="margin:0;background:transparent"><img src="{b64(s)}" width="{t}" height="{t}" style="display:block"></body></html>')
            return pag.screenshot(omit_background=True, clip={'x': 0, 'y': 0, 'width': t, 'height': t})

        app, cabeza = SVGS['simbolo-app.svg'], SVGS['simbolo-cabeza.svg']
        # Íconos en PNG: hasta 24 px se usa solo la cabeza (el robot completo se vuelve una mancha)
        pngs = {}
        for t in (16, 24, 32, 48, 64, 128, 180, 256, 512, 1024):
            pngs[t] = png(cabeza if t <= 24 else app, t)
            (M / 'png' / f'icono-{t}.png').write_bytes(pngs[t])
        # Windows: .ico para la app y el instalador, y PNG de 512 para la ventana
        (RAIZ / 'escritorio' / 'icono.ico').write_bytes(ico([(t, pngs[t]) for t in (16, 24, 32, 48, 64, 128, 256)]))
        (RAIZ / 'escritorio' / 'icono.png').write_bytes(pngs[512])

        # Logos horizontales (2 fondos)
        for nombre, args in {
            'logo-horizontal.png': (AZUL, VERDE, '#5b6770', 'transparent', app),
            'logo-horizontal-oscuro.png': (BLANCO, '#5fd12a', '#b9c4cc', 'transparent', app),
        }.items():
            pag.set_viewport_size({'width': 900, 'height': 200})
            pag.set_content(logo_html(*args))
            pag.wait_for_timeout(1200)
            pag.locator('.l').screenshot(path=str(M / 'png' / nombre), omit_background=True)

        # Imagen para compartir (redes, WhatsApp, GitHub): 1200 x 630
        pag.set_viewport_size({'width': 1200, 'height': 630})
        pag.set_content(f'''<html><head><link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap" rel="stylesheet"></head>
<body style="margin:0;width:1200px;height:630px;background:{AZUL};font-family:'Atkinson Hyperlegible',sans-serif;display:flex;align-items:center;gap:56px;padding:0 90px;box-sizing:border-box;color:#fff">
<img src="{b64(SVGS['simbolo-sobre-oscuro.svg'])}" width="330" height="330">
<div><div style="font-size:92px;font-weight:700;letter-spacing:-1.5px;line-height:1"><span>Tecno</span><span style="color:#5fd12a">Bloques</span></div>
<div style="font-size:30px;margin-top:22px;line-height:1.35;color:#e3edf3;white-space:nowrap">Programación por bloques para Arduino.<br>Aprende a programar construyendo robots.</div>
<div style="font-size:24px;margin-top:34px;color:#9fb6c6;letter-spacing:.3px">TecnoAcademia Tolima · SENA</div></div></body></html>''')
        pag.wait_for_timeout(1200)
        pag.screenshot(path=str(M / 'png' / 'compartir.png'))
        nav.close()
    print('Marca generada en', M)


if __name__ == '__main__':
    main()
