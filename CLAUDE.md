# CLAUDE.md — TecnoBloques

> Memoria técnica del proyecto para Claude Code / Claude en Cowork.
> Actualizado: 5 de octubre de 2026 · Estado: **v0.1 — prototipo del editor funcionando (Fase 1 completa). Fase 2 (app de escritorio que compila y sube) pendiente.**

---

## Qué es este proyecto

Editor web de **programación por bloques en español para Arduino**, al estilo de
MakeCode, Ottoblockly o Visualino, hecho para la **TecnoAcademia Tolima (SENA,
Ibagué)**. Los aprendices arman el programa con bloques, ven el C++ que se
genera y, en la fase 2, lo suben a la placa eligiendo el puerto COM desde el
navegador.

- **Sin simulador** (nada tipo Tinkercad o Wokwi). Solo el editor de bloques como motor para crear programas y subirlos.
- Lo construye Efraín (instructor) junto con Claude. Los **usuarios finales son aprendices**, así que los textos de la interfaz son en español, cortos y sin jerga.
- Autor: ver [`ABOUTME.md`](ABOUTME.md).

> Este archivo es una **fotografía del estado actual** y se sobrescribe cuando
> algo cambia. El **historial cronológico** está en [`BITACORA.md`](BITACORA.md) (append-only).

Prototipo publicado (privado, de Efraín): https://claude.ai/artifact/4hwGvqf9mAaxqLRsmVLSk7
En esa vista no funcionan el puerto serie ni las descargas. Para usar el editor completo, abre `dist/TecnoBloques.html` en Chrome o Edge.

---

## Alcance acordado (decisiones de Efraín — no cambiar sin consultarle)

```
Placas            → Solo AVR por ahora: Arduino Uno R3, Nano (bootloader nuevo y antiguo)
                    y Mega 2560. La TecnoAcademia tiene Uno R3 y espera comprar Uno R4
                    (Minima/WiFi) en próximas compras → dejar la arquitectura lista
                    para el R4 (perfiles de placa + cargadores intercambiables).

Librerías (las más usadas en la TecnoAcademia)
                  → AFMotor_R4 (shield L293D, Adafruit Motor Shield V1; se usa la
                    variante R4 porque es la que usa Efraín y compila también en AVR)
                  → DHT11 con la librería DHT de Adafruit (+ Adafruit Unified Sensor)
                  → LCD 16x2 por I2C (LiquidCrystal_I2C). OLED llega el próximo año.
                  → Monitor serial
                  → Bluetooth HC-05/HC-06
                  → Otto DIY: hay muchos Otto, sobre todo el Otto humanoide.

Funciones         → El aprendiz crea sus propios bloques con parámetros tipados
                    (entero, decimal, texto…) y valor de retorno.

Mis bloques       → Nivel 1 acordado: los aprendices crean sus bloques y los reusan
                    en otros programas solo con el nombre del bloque. Todo LOCAL
                    (navegador + exportar/importar archivo). Sin servidor.
                    Nivel 2 (diseñador de bloques para instructor) y nivel 3
                    (catálogo compartido) quedan para después.

Licencia          → (decidido 5 oct 2026) Apache 2.0, igual que Blockly. Titular SENA –
                    TecnoAcademia Tolima; autor Efraín (NOTICE). Repositorio público
                    en GitHub: EMariotte/TecnoBloques. Lo que se empaque en el instalador
                    (arduino-cli GPL, librerías, driver CH340) lleva su propia licencia.

C++ libre         → Bloques para escribir C++ tal cual (instrucción, expresión y global).

Vista del código  → Ver el C++ en vivo mientras se agregan bloques (vista dividida)
                    y poder editar el C++ a mano. Volver del C++ a los bloques NO es
                    posible en general: se ofrece copiar el texto y descartarlo.

Monitor serial    → Debe poder ENVIAR mensajes a la placa (el de Ottoblockly no
                    envía). Hecho con Web Serial, con selector de fin de línea.

Distribución      → (decidido 5 oct 2026) DOS entregas desde el mismo src/:
  (2 formas)          · AULA: app de escritorio (Electron) con arduino-cli, núcleo
                        AVR y librerías embebidos → compila y sube sin internet.
                        Instalador para Windows con drivers CH340 incluidos (hay
                        permisos de admin en los PC). Actualización automática desde
                        GitHub Releases del repositorio.
                      · CASA: página web SIN compilador ni servidor. Sirve para seguir
                        programando: guardar el proyecto (.tbq.json) y abrirlo en el
                        aula, o descargar el .ino. Más adelante se enlazan los retos.
                    Se descarta el servidor de compilación en la red local.

Niveles           → (decidido) Selector 1 · 2 · 3 en la barra superior. Cada usuario elige
                    su nivel; en clase el instructor indica el nivel de cada reto.
                    El nivel 1 muestra la paleta más simple. Principiante = bloques del robot ("carro: avanzar"),
                    sin pines PWM, baudios ni tipos C++. Avanzado = paleta actual.

Nombres de pines  → (decidido) Bloque para nombrar pines físicos: "el pin 13 se llama
                    LedRojo" → #define LedRojo 13. Los nombres aparecen en todos los
                    menús de pines y la revisión de choques sigue usando el número real.

Más librerías     → (decidido) MPU6050, Wire.h (I2C genérico) y Adafruit_PWMServoDriver
                    (PCA9685, 16 servos). El LCD I2C (16x2 y 20x4) y Wire ya existen;
                    falta aclarar qué se quiere agregar en LCD. Bus I2C compartido:
                    LCD 0x27/0x3F, PCA9685 0x40, MPU6050 0x68.
```

---

## Estructura del repositorio

```
TecnoBloques/
├── CLAUDE.md                 ← este archivo (estado actual, se sobrescribe)
├── BITACORA.md               ← historial cronológico (append-only)
├── ABOUTME.md                ← autor (remite a Tecnohonguera)
├── README.md                 ← presentación para GitHub
├── LICENSE / NOTICE          ← Apache 2.0 · © SENA – TecnoAcademia Tolima, autor Efraín
├── package.json              ← blockly 13.3.0 (versión fija) + scripts
├── build.js                  ← arma dist/TecnoBloques.html y dist/artefacto.html
├── src/
│   ├── nucleo.js             ← perfiles de placa, campos, generador C++, revisión de pines
│   ├── bloques.js            ← definición de TODOS los bloques + su traducción a C++
│   ├── app.js                ← interfaz: caja de herramientas, Mis bloques, proyectos,
│   │                            ejemplos, modo texto, monitor serial, arranque
│   ├── style.css             ← diseño (tokens claro/oscuro)
│   └── body.html             ← marcado de la página
├── test/
│   ├── prueba.py             ← carga los 3 ejemplos y guarda el .ino de cada uno
│   ├── prueba_todo.py        ← todos los bloques en un programa + flujo de Mis bloques
│   ├── ui.py                 ← clics reales en la interfaz + capturas (claro, oscuro, celular)
│   ├── compilar.js           ← compila con arduino-cli los .ino generados
│   ├── instalar-librerias.ps1← núcleo AVR + librerías para arduino-cli (Windows)
│   └── requirements.txt      ← playwright
├── docs/capturas/            ← imágenes para el README
└── dist/                     ← SALIDA (ignorada por git): TecnoBloques.html listo para usar
```

Los tres `.js` de `src/` se concatenan en un solo `<script>` (sin módulos ni
bundler). El orden importa: `nucleo.js` → `bloques.js` → `app.js`. Las variables
de nivel superior (`espacio`, `embebidos`, `ultimo`…) son globales compartidas.

---

## Cómo trabajar (Windows + VSCode)

```powershell
npm install                      # descarga blockly 13.3.0
npm run build                    # genera dist/TecnoBloques.html (≈0,9 MB, todo embebido)
start dist\TecnoBloques.html     # abrir en Chrome o Edge

# Pruebas (una vez): pip install -r test/requirements.txt ; python -m playwright install chromium
npm test                         # genera test/salida/<caso>/<caso>.ino
npm run test:ui                  # capturas en test/salida/*.png

# Compilación real (opcional, necesita arduino-cli en el PATH)
.\test\instalar-librerias.ps1
npm run compilar
```

- **Después de cada cambio en `src/` hay que correr `npm run build`.** El HTML de `dist/` no se actualiza solo.
- `dist/TecnoBloques.html` embebe Blockly e imágenes y funciona sin internet. Las fuentes de Google caen a las del sistema si no hay red.
- `dist/artefacto.html` es un fragmento sin `<html>/<head>` que carga Blockly desde jsDelivr. Sirve para publicarlo como artefacto de Claude.
- Web Serial necesita **Chrome o Edge de escritorio** y un contexto seguro: `file://`, `localhost` o HTTPS. **GitHub Pages sirve por HTTPS**, así que publicar `dist/` ahí permitiría usar el monitor (y en la fase 2 la carga) sin repartir el archivo.

---

## Arquitectura

### Flujo

```
cambio en el espacio de bloques ─► programarActualizacion() (debounce 120 ms)
  ─► actualizar(): refresca la firma de las llamadas a bloques propios
  ─► generarPrograma(espacio)  [nucleo.js]
        1. Ard.init() limpia las secciones
        2. genera cada "definir bloque" (fn_def) y cada "C++ al comienzo" (cpp_global)
        3. genera SETUP y LOOP del bloque "programa"
        4. finalizarModulos(): valores por defecto si falta un bloque "iniciar …",
           detenerMotores(), aviso Servo↔PWM
        5. revisarPines(): choques de pines y pines inexistentes en la placa
        6. ensambla: comentario → #include (orden fijo) → globales → variables →
           C++ global → prototipos → setup() → loop() → ayudas → funciones
  ─► pinta el código resaltado, la lista de avisos y los avisos sobre los bloques
  ─► autoguarda en localStorage
```

### Generador (`Ard`, en `nucleo.js`)

- `Ard = new Blockly.CodeGenerator('Arduino')` y cada bloque se registra en `Ard.forBlock[tipo]`. Los bloques de valor devuelven `[código, orden]` con `O.*` (precedencia de C++); los de instrucción devuelven texto con `\n`.
- Helpers `G` que usan los bloques. Todos son idempotentes por clave, así que dos bloques iguales no duplican nada:
  - `G.incluir(clave, '#include <X.h>')`: el orden final lo fija `ORDEN_INCLUDES`.
  - `G.global(clave, código)`: objetos globales.
  - `G.setup(clave, código)`: va al inicio de `setup()`, antes del código del aprendiz.
  - `G.ayuda(clave, función)`: la primera línea debe ser la firma terminada en `{`, porque de ahí se saca el prototipo.
  - `G.pin(pin, uso, bloque)`: registra el uso para detectar choques. Un mismo `uso` en varios bloques no cuenta como choque.
  - `G.aviso(msg, bloque, 'info'|'aviso')`: aparece en el panel y como triángulo sobre el bloque.
  - `G.val(bloque, input, orden, defecto)` y `G.sentencias(bloque, input)`.
- `Ard.banderas_`: estado compartido entre bloques de un módulo (por ejemplo `serialUsado`, `btConfig`, `lcdUsado` u `ottoConfig`).
- Nombres C++: `nombreC()` quita tildes y ñ, reemplaza símbolos por `_` y evita palabras reservadas (lista `RESERVADAS`). Por ejemplo, `señal_lista` pasa a `senal_lista`.

### Placas (`PLACAS` en `nucleo.js`)

Cada perfil define `fqbn`, pines digitales y analógicos, `soloAnalog` (A6 y A7 del Nano), `pwm`, `i2c`, `serialesHW` (Serial1–3 del Mega), `swRx` (pines válidos para SoftwareSerial RX en el Mega), `servoSinPWM` y `carga` (protocolo, pensado para la fase 2).
- Los menús de pines usan `CampoPin`, un FieldDropdown que **acepta cualquier valor**. Así, al cambiar de placa no se borra la elección: si el pin no existe en la nueva placa, se marca con `?` y aparece un aviso.
- **Para agregar una placa (por ejemplo el Uno R4):** agrega el perfil en `PLACAS` y revisa los generadores que dependen de la placa (Bluetooth, I2C, Servo/PWM). El cargador corresponde a la fase 3.

### Variables tipadas

Los bloques propios son `var_set`, `var_get`, `var_cambiar` y `bucle_para`; no se usan los de variables de Blockly. Cada variable tiene un tipo de Blockly que es directamente el tipo C++: `int`, `long`, `float`, `bool`, `char` o `String`. Se crean con el botón "Crear variable…" (modal propio) y se declaran como globales con su valor inicial.

### Funciones / bloques propios

- `fn_def` ("definir bloque"): tiene los campos `NAME` y `TIPO` (retorno) y `NPARAM` (0–4). Para cada parámetro hay `P{i}N` y `P{i}T`. La entrada `RETURN` solo se ve si el tipo no es `void`. La forma se reconstruye desde el validador de `NPARAM`. El nombre es único en el espacio de trabajo: si se repite, se le agrega `_2`.
- `fn_param`: menú (`CampoParam`) con los parámetros del `fn_def` que lo contiene.
- `fn_call` (instrucción) y `fn_call_val` (valor): guardan su **firma** en `firma_ = {nombre, tipo, params}` como extraState, o como mutation `firma` en XML. `refrescar_()` vuelve a leer la definición y dispara un `BlockChange` de tipo mutation, para que deshacer funcione.
- Orden de búsqueda de una definición (`buscarDefinicion`): **1) programa actual → 2) copia embebida en el proyecto (`embebidos`) → 3) Mis bloques (localStorage)**.
- Las definiciones externas se generan cargándolas en un `Blockly.Workspace` sin interfaz (`generarExterna`). Sus variables internas se vuelven **locales** de la función, mientras que en el programa las variables son globales. Hay detección de ciclos.

### Mis bloques

- Se guardan en localStorage, en la clave `tecnobloques.misBloques.v1` → `{app, version, bloques: {nombre: def}}`.
- Formato de `def`: `{nombre, tipo, params:[{nombre,tipo}], cuerpo: <serialización JSON del fn_def>, descripcion, actualizado}`.
- Guardar: clic derecho en "definir bloque" → **Guardar en Mis bloques**. También se guardan los bloques propios que ese bloque usa. Si ya existe una versión distinta, pide confirmar el reemplazo. Las versiones se comparan con `mismaDef()`, que ignora ids y coordenadas.
- Exportar e importar: archivo `.tblib.json` (`{app:'TecnoBloques-libreria', bloques}`).
- En una llamada, el clic derecho ofrece **Traer la definición para editarla**, que la copia al programa.

### Proyecto (`.tbq.json`)

`{app:'TecnoBloques', version:1, nombre, placa, bloques:<workspace JSON>, embebidos:{…}, texto:<C++ a mano|null>, guardado}`.
`embebidos` lleva una copia de los bloques propios que usa el programa, así el proyecto abre en otro PC sin la librería. Al abrir, si Mis bloques tiene una versión distinta, pregunta cuál usar.

### Interfaz

- **Vistas** Bloques / Dividido / C++ (`cambiarVista`) y **pestañas** Código C++ / Monitor serial.
- **Modo texto** (`entrarModoTexto` / `salirModoTexto`): convierte el panel en un `<textarea>` y pone un velo sobre los bloques. Al volver, si hubo cambios, ofrece "Seguir editando", "Copiar mi código y volver" o "Descartar y volver".
- **Monitor serial** (`conectarSerial`, `leerBucle`, `enviarSerial`): usa Web Serial. Tiene baudios, hora, autodesplazamiento, fin de línea (ninguno, `\n`, `\r`, `\r\n`), historial con ↑/↓ y eco de lo enviado. Toma sola la velocidad de `Serial.begin(N)` del programa hasta que la persona la cambie a mano. Da mensajes claros cuando no hay Web Serial, cuando el visor lo bloquea o cuando el puerto está ocupado (Arduino IDE abierto).
- **Diálogos:** `Blockly.dialog.setAlert/setConfirm/setPrompt` se reemplazan por un modal propio, porque `prompt()` y `confirm()` no funcionan dentro de artefactos ni en algunos visores.
- **Imágenes de Blockly** (papelera, zoom, comillas): se usa `media: 'tbmedia/'` y un MutationObserver que cambia esas rutas por data URIs (`window.TB_MEDIA`, que genera `build.js`). No depende de servidores externos ni de rutas `file://`.
- **Tema:** tokens CSS claro/oscuro, que respetan `prefers-color-scheme` y `data-theme`, y dos temas de Blockly (`TEMA_CLARO` y `TEMA_OSCURO`) que se cambian solos.
- **Descargas:** siempre pasan por un modal con "Copiar" y "Descargar", porque en el visor de Claude las descargas no funcionan.

### Receta: agregar un bloque

1. En `src/bloques.js`: `bloque('mi_tipo', COL.categoria, function () { …campos… }, (b) => { …G.incluir/G.global/G.setup/G.pin…; return código; });`
2. Agrégalo a `TOOLBOX` en `src/app.js`, con sombras `num()` o `txt()` si tiene entradas.
3. `npm run build` → `npm test` → `npm run compilar`, para confirmar que compila con la librería real.

---

## Decisiones técnicas fijas y trampas conocidas (no revertir sin justificación)

```
Blockly            → v13.3.0 fija. Renderer 'zelos'. Mensajes en español (msg/es.js).
                     FieldMultilineInput ya no está en el núcleo de Blockly 13 → el
                     C++ libre usa un campo oculto CODE + etiquetas por línea + un
                     lápiz que abre un editor modal (MezclaCodigo en bloques.js).

BACKWARD           → Otto.h define BACKWARD = -1 y AFMotor_R4.h BACKWARD = 2. Si se
                     incluyen los dos, los motores giran mal SIN error. Solución
                     implementada: Otto.h se incluye antes, se emite
                     "#undef BACKWARD" antes de AFMotor_R4.h y el bloque de Otto usa
                     el literal -1 para "atrás". (Encontrado al compilar todo junto.)

Shield L293D       → Pines ocupados: 4, 7, 8, 12 (74HC595) + PWM por motor:
                     M1=11, M2=3, M3=6, M4=5. Servos de la shield: SERVO_1=10,
                     SERVO_2=9. Lo registra usarShield()/declararMotor().

Servo y PWM        → La librería Servo inutiliza analogWrite en 9 y 10 (Uno/Nano) y
                     en 11 y 12 (Mega). Se avisa si hay servos (u Otto) y PWM en esos pines.

Bluetooth          → Uno/Nano: SoftwareSerial en los pines elegidos (por defecto A1/A2).
                     Mega: si RX/TX coinciden con 19/18, 17/16 o 15/14 se usa
                     Serial1/2/3 por hardware ("#define BT SerialN"). Con SoftwareSerial
                     en el Mega, el RX solo sirve en 10–15, 50–53, A8–A15 (se avisa).
                     El TX del módulo va al RX del Arduino.

DHT                → La librería de Adafruit ya guarda la última lectura durante 2 s, así
                     que no hace falta limitar las lecturas en el generador. Si la
                     lectura falla da NaN → bloque "¿es un número válido?" (isnan).

LCD I2C            → LiquidCrystal_I2C (Frank de Brabander / marcoschwartz): usa
                     lcd.init() + lcd.backlight(). Direcciones 0x27 o 0x3F.
                     I2C: A4/A5 en Uno/Nano, 20/21 en el Mega.

Otto humanoide     → OttoDIYLib v13 (Otto.h) solo maneja 4 servos (piernas y pies) +
                     zumbador. No trae brazos. Los brazos se manejan con dos Servo
                     aparte (ottoBrazoIzq/Der) y helpers propios (ottoBrazos, ottoSaludar,
                     ottoAletear). Pines por defecto: piernas 2/3, pies 4/5,
                     zumbador 13, brazos 6/7, ultrasonido Trig 8 / Echo 9.
                     ⚠ Pines y ángulos de los brazos (arriba 160/20, abajo 20/160,
                     reposo 90/90) salen de Ottoblockly → VALIDAR en los robots.
                     Ottoblockly tiene errores en sus brazos (attach cruzado, índices
                     fuera del arreglo); no copiar ese código.

Ultrasonido        → Helper leerDistanciaCM(): pulseIn con timeout de 30 ms; sin eco
                     devuelve 999 ("nada al frente"), así "distancia < 15" funciona solo.

Texto en C++       → "a" + "b" no se puede en C++ (suma de punteros): el bloque "unir"
                     genera String(a) + String(b). Comparar un char con "A" tampoco:
                     por eso existe el bloque "carácter" ('A') para Bluetooth/serial.

Serial             → Si se usa algún bloque serial sin "iniciar monitor serial", se
                     agrega Serial.begin(9600) y un aviso. Los pines 0/1 quedan
                     registrados como ocupados.

Bloques sueltos    → Blockly.Events.disableOrphans los desactiva (grises) y se avisa.

Prototipos         → Siempre se emiten prototipos de funciones y helpers (no se depende
                     de que arduino-cli los genere con ctags).

Licencias          → Blockly es Apache 2.0. Ottoblockly/Visualino son otros proyectos
                     (algunos GPL): se usan como REFERENCIA de diseño, sin copiar su código.
```

### Mapa de pines por defecto del kit (Uno R3 + shield L293D)

Motores M1/M2 → 11, 3 (+ 4, 7, 8, 12 del shield) · DHT11 → A0 · Bluetooth RX/TX → A1/A2 ·
LCD I2C → A4/A5 · Serial → 0/1. Libres: 2, 13, A3 (y 9/10 si no hay servos).
Ojo: el ultrasonido trae 8/9 por defecto (pensado para Otto); **con la shield el pin 8 está ocupado**.

---

## Estado de verificación (26 sep 2026)

| Qué | Resultado |
|---|---|
| 3 ejemplos (Carro Bluetooth, Otto humanoide esquiva, Eco serial y LED) | ✅ compilan: uno, nano, nano (old), mega2560 |
| Programa con TODOS los bloques del toolbox | ✅ compila en uno y mega2560 (sin warnings tras el fix de BACKWARD) |
| Mis bloques: 2 bloques anidados (uno devuelve float y llama al otro con 2 parámetros), guardar → proyecto nuevo → borrar librería → reabrir proyecto | ✅ mismo código generado y compila |
| Interfaz: categorías, crear variable, Mis bloques, modo texto, monitor, tema oscuro, 400 px | ✅ sin errores de JavaScript (Playwright + Chromium) |
| Monitor serial con una placa real | ⬜ **no probado** (en la nube no hay USB) |
| `test/compilar.js` y `instalar-librerias.ps1` en Windows | ⬜ **no probados** (se escribieron para arduino-cli; la verificación se hizo en Linux con arduino-builder + avr-gcc 7.3) |

Versiones con las que se compiló: núcleo AVR 1.8.6, AFMotor-Shield-R4-Compatible 1.0.1,
DHT sensor library 1.4.7, Adafruit Unified Sensor 1.1.15, LiquidCrystal_I2C 1.1.4,
OttoDIYLib 13.0.0, Servo 1.3.0.

Uso de memoria: carro en Uno usa 36 % de flash y 29 % de RAM. El programa con todos los bloques usa 68 % de flash y 53 % de RAM en el Uno. **Ojo con la OLED en Uno/Nano:** el buffer de SSD1306 ocupa 1 KB de los 2 KB de RAM.

### Pendiente de validar con hardware (Efraín)

1. Monitor serial: conectar, recibir y **enviar** con el ejemplo "Eco serial y LED" (Chrome/Edge + `dist/TecnoBloques.html`).
2. Otto humanoide: pines y ángulos de los brazos, dirección de giro y velocidades.
3. Carro: sentido de los motores M1/M2 y comandos 'A'/'S' desde una app Bluetooth.
4. LCD: dirección 0x27 vs 0x3F de los módulos del aula.
5. Clones con CH340: que el puerto aparezca y el monitor funcione.

---

## Hoja de ruta

```
Fase 1 ✅ Editor (esta versión v0.1): bloques, generador, avisos de pines, funciones,
          Mis bloques local, C++ libre, modo texto, monitor serial, proyectos, ejemplos.

Fase 2 ⬜ App de escritorio para el aula (reemplaza al servidor de compilación, 5 oct 2026):
          - Envolver el mismo HTML en Electron (electron-updater + GitHub Releases). Botón "Subir" → arduino-cli
            compile + upload (avrdude) con el puerto elegido. Sin cargador STK500 en JS.
          - Instalador Windows: arduino-cli + núcleo arduino:avr + librerías + drivers CH340.
          - Actualización automática desde GitHub Releases.
          - El monitor serial debe cerrar el puerto antes de cargar.
          - Mostrar errores del compilador en español y ligarlos al bloque si se puede.
          - build.js genera también la versión web para casa (sin "Subir").

Fase 2b ⬜ Base del sistema de bloques, ANTES de sumar librerías nuevas:
          nombres de pines (#define) y niveles desbloqueables.

Fase 3 ⬜ Uno R4 (cuando lleguen): perfil de placa + núcleo arduino:renesas_uno en el
          instalador. arduino-cli ya sabe cargar el R4 (DFU / toque a 1200 baudios).

Fase 4 ⬜ Pantallas OLED (próximo año): categoría "Pantalla" ya separada. En Uno/Nano
          usar U8g2 en modo página o SSD1306Ascii (solo texto); Adafruit_SSD1306 solo en Mega.

Fase 5 ⬜ Nivel 2 de librerías: diseñador de bloques para instructores (forma, campos,
          plantilla de código con {{PIN}}, #include, setup) + instalación de la
          librería Arduino en el servidor (solo instructores).

Fase 6 ⬜ Nivel 3: catálogo compartido de bloques (posiblemente Supabase, como Tecnohonguera).

Ideas sueltas: guardar la calibración de Otto, más ejemplos por práctica,
exportar a PDF una ficha del programa para la evidencia del aprendiz.
```

---

## Decisiones abiertas

- **Titularidad:** confirmar con la coordinación SENNOVA que el titular es «SENA – TecnoAcademia Tolima» (así está en `NOTICE`) y Efraín figura como autor.
- **Web para casa:** dónde se publica (GitHub Pages es lo natural). La actualización automática desde GitHub Releases necesita un repositorio público o un token.
- **Librería del MPU6050:** cuál usar (propuesta: MPU6050_light, porque da ángulos directos y es liviana para el Uno).

---

## Reglas de desarrollo — siempre seguir

1. **Interfaz en español** para aprendices: frases cortas, verbos claros y errores que dicen cómo arreglarlo.
2. **Todo nuevo bloque debe compilar con la librería real** antes de commitear (`npm test` + `npm run compilar`).
3. **Un solo HTML autocontenido** como entregable (`dist/TecnoBloques.html`), sin servidores externos obligatorios.
4. **No copiar código de Ottoblockly/Visualino** (licencias y errores conocidos). Solo sirven como referencia.
5. **Convención de commits:** `feat:` `fix:` `docs:` `refactor:` `test:` `chore:`.
6. **Registrar hitos en `BITACORA.md`.** Nunca editar ni borrar entradas pasadas. Actualizar este `CLAUDE.md` cuando cambie el estado.
7. `dist/` y `test/salida/` no se suben al repositorio; se regeneran.

---

## Referencias

- Blockly: https://developers.google.com/blockly · npm `blockly@13.3.0`
- AFMotor R4 Compatible: https://github.com/PhoenixSmaug/AFMotor-Shield-R4-Compatible
- OttoDIYLib: https://github.com/OttoDIY/OttoDIYLib · Ottoblockly (referencia): https://github.com/OttoDIY/blockly
- DHT sensor library: https://github.com/adafruit/DHT-sensor-library
- LiquidCrystal_I2C: https://github.com/marcoschwartz/LiquidCrystal_I2C
- Web Serial API: https://developer.mozilla.org/docs/Web/API/Web_Serial_API

---

*TecnoBloques · SENA TecnoAcademia Tolima · Septiembre 2026*
