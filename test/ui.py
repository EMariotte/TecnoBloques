import pathlib
from playwright.sync_api import sync_playwright
RAIZ = pathlib.Path(__file__).resolve().parent.parent
S = RAIZ / 'test' / 'salida'
URL = (RAIZ / 'dist' / 'TecnoBloques.html').as_uri()

with sync_playwright() as p:
    nav = p.chromium.launch()
    errores = []
    pag = nav.new_page(viewport={'width': 1366, 'height': 800})
    pag.on('pageerror', lambda e: errores.append(str(e)))
    pag.goto(URL); pag.wait_for_timeout(1200)
    pag.screenshot(path=str(S / 'ui_1_inicio.png'))
    # Categoría Otto
    pag.locator('.blocklyToolboxCategory', has_text='Otto humanoide').first.click(); pag.wait_for_timeout(400)
    pag.screenshot(path=str(S / 'ui_2_otto.png'))
    # Variables -> crear
    pag.locator('.blocklyToolboxCategory', has_text='Variables').first.click(); pag.wait_for_timeout(400)
    pag.screenshot(path=str(S / 'ui_3_variables.png'))
    pag.locator('.blocklyFlyoutButton').first.click(); pag.wait_for_timeout(300)
    pag.fill('#nuevaVarNombre', 'distancia'); pag.select_option('#nuevaVarTipo', 'float')
    pag.screenshot(path=str(S / 'ui_4_modal_var.png'))
    pag.get_by_role('button', name='Crear').click(); pag.wait_for_timeout(400)
    # Guardar "avanzar" en Mis bloques via menú contextual
    pag.evaluate("() => guardarEnMisBloques(espacio.getBlocksByType('fn_def')[0])")
    pag.locator('.blocklyToolboxCategory', has_text='Mis bloques').first.click(); pag.wait_for_timeout(400)
    pag.screenshot(path=str(S / 'ui_5_misbloques.png'))
    pag.keyboard.press('Escape')
    # Modo texto
    pag.click('#btnEditar'); pag.wait_for_timeout(200)
    pag.locator('#editor').press('End'); pag.keyboard.type('\n// cambio a mano')
    pag.click('#btnVolverBloques'); pag.wait_for_timeout(300)
    pag.screenshot(path=str(S / 'ui_6_texto.png'))
    pag.get_by_role('button', name='Seguir editando').click()
    pag.get_by_role('button', name='Volver a bloques').first.click(); pag.wait_for_timeout(200)
    pag.get_by_role('button', name='Descartar y volver').click(); pag.wait_for_timeout(300)
    # Monitor serial
    pag.click('#tSerial'); pag.wait_for_timeout(200)
    pag.screenshot(path=str(S / 'ui_7_serial.png'))
    tiene = pag.evaluate("() => 'serial' in navigator")
    # Oscuro
    pag.emulate_media(color_scheme='dark'); pag.wait_for_timeout(400)
    pag.click('#tCodigo')
    pag.screenshot(path=str(S / 'ui_8_oscuro.png'))
    # Celular
    mov = nav.new_page(viewport={'width': 400, 'height': 860})
    mov.on('pageerror', lambda e: errores.append('movil: ' + str(e)))
    mov.goto(URL); mov.wait_for_timeout(1200)
    mov.screenshot(path=str(S / 'ui_9_movil.png'), full_page=True)
    print('serial en navigator:', tiene)
    print('ERRORES:', errores)
    nav.close()
