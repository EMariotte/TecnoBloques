# CLAUDE.md — TecnoBloques

> Memoria técnica del proyecto para Claude Code / Claude en Cowork.
> Actualizado: 5 de octubre de 2026 · Estado: **v0.2 — app de escritorio que compila y sube (Fase 2), instalador armado. Falta probar la carga con una placa real y publicar la primera versión en GitHub Releases.**

---

## Qué es este proyecto

Editor de **programación por bloques en español para Arduino**, al estilo de
MakeCode, Ottoblockly o Visualino, hecho para la **TecnoAcademia Tolima (SENA,
Ibagué)**. Los aprendices arman el programa con bloques, ven el C++ que se
genera y lo suben a la placa con un botón.

Se entrega de **dos formas desde el mismo código** (`src/` → `dist/TecnoBloques.html`):
- **App de escritorio (aula):** Electron + arduino-cli embebido. Compila y sube sin internet. Instalador para Windows con actualización automática desde GitHub Releases.
- **Página web (casa):** el mismo HTML sin compilador. Sirve para programar, guardar el proyecto y descargar el `.ino`.

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

Niveles           → ✅ HECHO (5 oct). Selector 1 · 2 · 3 en la barra superior:
                    1 Explorador · 2 Constructor · 3 Inventor. Cada usuario elige su
                    nivel; el proyecto guarda el suyo y al abrirlo se cambia solo
                    (así el instructor fija el nivel de cada reto). Nivel 1: sin
                    variables; del monitor serial solo "imprimir". Ver "Niveles"
                    en Arquitectura. Principiante = bloques del robot ("carro: avanzar"),
                    sin pines PWM, baudios ni tipos C++. Avanzado = paleta actual.

Nombres de pines  → ✅ HECHO (5 oct). "el pin 13 se llama LedRojo" → #define LedRojo 13.
                    Los nombres aparecen en todos los menús de pines y la revisión de
                    choques sigue usando el número real. Ver "Nombres de pines" en Arquitectura.

Más librerías     → (decidido) MPU6050, Wire.h (I2C genérico) y Adafruit_PWMServoDriver
                    (PCA9685, 16 servos). LCD ampliada el 5 oct (símbolos propios,
                    cursor, desplazar, borrar fila…). Bus I2C compartido:
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
├── package.json              ← blockly 13.3.0 (versión fija), Electron, scripts y config de electron-builder
├── build.js                  ← arma dist/TecnoBloques.html y dist/artefacto.html
├── escritorio/               ← APP DE ESCRITORIO (Electron)
│   ├── main.js               ← ventana, IPC, Web Serial (elige el puerto), actualización automática
│   ├── preload.js            ← puente seguro: window.tbEscritorio (info, puertos, subir, alProgreso…)
│   ├── arduino.js            ← arduino-cli: board list, compile, upload (módulo Node sin Electron)
│   ├── preparar-arduino.js   ← arma recursos/arduino (cli + núcleo AVR + librerías) para el instalador
│   ├── empaquetar.js         ← corre electron-builder (salida en %LOCALAPPDATA%\TecnoBloques-build)
│   ├── instalador.nsh        ← paso NSIS: ofrece el driver CH340 en la primera instalación
│   ├── icono.png             ← ícono de la app (512 px)
│   └── recursos/             ← arduino/ (≈310 MB, ignorado por git) · drivers/ (CH341SER.EXE, ignorado)
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
│   ├── app.js                ← abre la app Electron: puertos, compilar, errores en español (capturas)
│   ├── app-empaquetada.js    ← lo mismo con la app ya empaquetada (win-unpacked)
│   ├── instalar-librerias.ps1← núcleo AVR + librerías para arduino-cli (Windows)
│   └── requirements.txt      ← playwright
├── marca/                    ← MARCA: generar.py (fuente única del dibujo), MARCA.md (guía),
│                                svg/ (símbolo y variantes), png/ (íconos 16–1024, logos, compartir.png)
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

# Compilación real (usa ARDUINO_CLI, el arduino-cli del Arduino IDE 2 o el del PATH)
npm run compilar

# App de escritorio
npm run preparar-arduino         # una vez (con internet): baja arduino-cli + núcleo AVR + librerías (≈310 MB)
npm run app                      # abre la app en modo desarrollo
npm run test:app                 # prueba la app con Playwright (puertos, compilar, errores)
npm run instalador               # arma %LOCALAPPDATA%\TecnoBloques-build\TecnoBloques-Setup-<versión>.exe
npm run publicar                 # arma y sube el Release a GitHub (necesita GH_TOKEN; ver "Publicar una versión")
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

### Niveles (1 Explorador · 2 Constructor · 3 Inventor)

- `NIVEL_BLOQUE` (app.js) asigna cada tipo de bloque a un nivel, y los niveles se suman. `NIVEL_CATEGORIA` cubre las categorías dinámicas: Variables y Funciones desde el 2, Mis bloques desde el 1 (solo para usar los bloques que entregue el instructor). **Todo bloque nuevo debe agregarse a `NIVEL_BLOQUE`**: `npm test` imprime "Bloques sin nivel asignado" y la lista debe salir vacía. Un tipo sin nivel cae en el 3.
- `toolboxNivel(n)` filtra `TOOLBOX` y quita las categorías vacías y los separadores sobrantes. `ponerNivel(n, {vista, aviso})` actualiza la caja con `updateToolbox` y guarda el nivel en `tecnobloques.nivel.v1`. Con `vista`, el nivel 1 abre en Bloques y los niveles 2 y 3 en Dividido.
- El botón **Editar C++** solo se ve en el nivel 3, o mientras ya se está en modo texto.
- **Un nivel solo filtra lo que se ofrece; nunca borra ni desactiva bloques ni cambia el C++.** Si el programa usa bloques de un nivel más alto (`nivelNecesario()`), aparece una nota informativa.
- Dentro de los bloques, `MenuNivel` (nucleo.js) es un menú cuyas opciones dependen de `nivelActual`, pero que acepta cualquier valor de la lista completa para abrir proyectos de otro nivel. En el nivel 2, "definir bloque" solo ofrece 0 parámetros y retorno "nada", y `fn_param` no aparece. Las variables del nivel 2 usan `TIPOS_VAR_N2`: número entero, número decimal, texto, letra (char, para comandos de Bluetooth) y sí/no. `long` y los nombres C++ llegan en el nivel 3.
- El proyecto guarda `nivel`. `cargarProyecto` lo aplica y los ejemplos abren en el nivel que necesitan. La primera vez (sin autoguardado) se abre un proyecto vacío en el nivel guardado, que por defecto es el 1.
- Bloques "iniciar" que se ocultan en el nivel 1 (Otto, brazos, Bluetooth, serial): el generador ya pone solos los valores por defecto del kit.

### Nombres de pines (`#define`)

- `pin_nombre`: "el pin [PIN] se llama [NOMBRE]". Es un bloque suelto sin conexiones, como `cpp_global`, porque un `#define` es global. No se desactiva por estar suelto. Su `CampoPin('fisico')` lista solo pines reales, sin nombres.
- `pin_valor`: un bloque de valor "pin [LedRojo]" que sirve para pasar un pin a un bloque propio.
- El validador `validarNombrePin` convierte lo que se escribe en un identificador C++ válido. Usa `nombreC`. Si el nombre parece un pin real, como `A0` o `D5`, le agrega `_`.
- `nombresDePines(ws)` lee los bloques activos. Al empezar `generarPrograma` se llena `Ard.nombresPin_` (nombre → `{pin, bloque}`), **antes** de generar cualquier bloque.
- `opcionesPin()` pone primero los nombres que sirven para ese uso, como "LedRojo (13)". Los **campos guardan el nombre**, no el número: si se cambia 13 por 12 en `pin_nombre`, cambia en todo el programa.
- Los generadores **emiten el valor tal cual** (`digitalWrite(LedRojo, HIGH)`). Para cualquier **lógica** con el número del pin deben usar `pinReal(v)`: PWM válido, Serial por hardware del Mega, `swRx`, Servo↔PWM, claves de `G.setup` como `pinMode_`. `G.pin` ya resuelve el número solo.
- Para objetos que van uno por pin físico se usa `sufijoPin(v)` (`servo_Pinza`, `dht_Clima`). En los avisos se usa `pinTexto(v)`, que da "LedAzul (9)".
- Los `#define` salen después de los `#include` y antes de los objetos globales, porque estos pueden usar los nombres. Por ejemplo, `DHT dht_Clima(Clima, DHT11)`.
- Avisos: nombre repetido, pin inexistente en la placa, nombre no definido ("No hay un pin llamado…") y nombre igual a una variable o a un bloque propio.
- Al renombrar un `pin_nombre`, un listener de `app.js` cambia los `CampoPin` que usaban el nombre viejo, en el mismo grupo de eventos (deshacer revierte todo, y se ignora si `!e.recordUndo`). `actualizar()` llama a `refrescarPines()` cuando cambia algún nombre o número, para que los menús muestren el texto nuevo.

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

### App de escritorio (`escritorio/`)

- **Mismo editor:** la ventana carga `dist/TecnoBloques.html`. El editor detecta la app con `window.tbEscritorio` (lo expone `preload.js` con `contextIsolation`, sin Node en la página). Si no está, es la versión web.
- **Puerto:** en la app aparece el selector **Puerto** (`#campoPuerto`). `refrescarPuertos()` llama a `arduino-cli board list` cada 3 s y al enfocar el selector, y se detiene mientras se sube. Ordena primero los USB y nombra los clones por VID (1a86 = CH340).
- **Subir** (`subirPlaca`): avisa si la placa detectada no coincide con la elegida (y ofrece cambiarla), cierra el monitor serial si estaba conectado, compila (`compile --build-path` por placa, con caché en userData) y sube (`upload --input-dir`). Al terminar reconecta el monitor. Muestra el % de memoria y avisa si la RAM pasa del 75 %.
- **Errores en español** (`explicarError` y `traducirErrorCpp` en app.js): librería faltante, programa muy grande o sin RAM, errores de C++ con número de línea y el texto de esa línea, puerto ocupado o inexistente, y placa que no responde (sugiere "Nano bootloader antiguo", otro cable y desconectar los pines 0 y 1). Siempre se puede abrir "Ver el mensaje completo". arduino-cli corre con `ARDUINO_LOCALE=en` para que los mensajes sean predecibles.
- **Monitor serial en la app:** sigue siendo Web Serial. `main.js` atiende `select-serial-port` y elige el puerto del selector (`preferirPuerto`), sin ventana del sistema.
- **arduino-cli:** `ubicarArduino()` busca primero `resources/arduino` (empaquetada) o `escritorio/recursos/arduino` (desarrollo), luego `ARDUINO_CLI` y luego el del Arduino IDE 2. Los datos se apuntan con `ARDUINO_DIRECTORIES_DATA` y `ARDUINO_DIRECTORIES_USER`. La instalación es por usuario (`%LOCALAPPDATA%\Programs\TecnoBloques`), así que esas carpetas se pueden escribir.
- **Actualización automática:** `electron-updater` revisa GitHub Releases (EMariotte/TecnoBloques) 5 s después de abrir, descarga sola y pregunta "Reiniciar ahora / Más tarde". Sin internet o sin versiones publicadas no muestra nada. El `.blockmap` permite bajar solo lo que cambió.
- **Instalador:** NSIS de un clic, por usuario, con acceso directo en el escritorio y en español. Ofrece el driver CH340 solo en la primera instalación y solo si `escritorio/recursos/drivers/CH341SER.EXE` existe (ver el LEEME de esa carpeta). Pesa unos 175 MB, casi todo avr-gcc.
- **Versión web (casa):** el botón "Subir a la placa" explica cómo seguir: guardar el proyecto para abrirlo en el aula o usar Arduino IDE.

### Publicar una versión

1. Sube `version` en `package.json` (por ejemplo 0.2.0 → 0.2.1). Las apps instaladas solo se actualizan si la versión es mayor.
2. `npm test`, `npm run compilar` y `npm run test:app`.
3. `npm run instalador` y prueba el `.exe`.
4. Crea el Release `v<versión>` en GitHub con estos 3 archivos: `TecnoBloques-Setup-<versión>.exe`, `TecnoBloques-Setup-<versión>.exe.blockmap` y `latest.yml`. Se puede hacer con `gh release create v<versión> <archivos> --title … --notes …`, o con `npm run publicar` y `GH_TOKEN`.

### Marca (`marca/`)

- **El símbolo:** dos bloques encajados (la pestaña de la cabeza entra en la muesca del cuerpo) forman un robot. La cabeza es verde, con un ojo engranaje y un ojo cursor y una antena en T. El cuerpo es blanco, con `</>`. Colores SENA: verde `#39A900` y azul `#00304D`. Lo aprobó Efraín el 5 oct 2026 (versión "A", con el engranaje a la izquierda).
- **`marca/generar.py` es la única fuente.** Dibuja el SVG en una cuadrícula de 64 y genera los SVG, los PNG de 16 a 1024 (16 y 24 px usan solo la cabeza), `escritorio/icono.ico` (7 tamaños, PNG dentro de ICO), `escritorio/icono.png`, los logos horizontales y `compartir.png`. Usa Playwright y Chromium.
- **Dónde se usa:**
  - `build.js` inserta `marca/svg/simbolo-app.svg` en la barra superior, en lugar de `<!--SIMBOLO-->` de body.html.
  - El favicon es `simbolo-cabeza.svg`, más el apple-touch-icon de 180 px y `theme-color` `#00304D`.
  - electron-builder usa `icono.ico` para la app, el instalador y el desinstalador.
  - La ventana de Electron usa `icono.ico` en Windows.
- **En la interfaz**, "Tecno" usa `--ink` y "Bloques" usa `--accent`. Los botones siguen con `#2c8a1c` en tema claro, porque el verde SENA con texto blanco no alcanza el contraste AA.

### Receta: agregar un bloque

1. En `src/bloques.js`: `bloque('mi_tipo', COL.categoria, function () { …campos… }, (b) => { …G.incluir/G.global/G.setup/G.pin…; return código; });`
2. Agrégalo a `TOOLBOX` en `src/app.js`, con sombras `num()` o `txt()` si tiene entradas, **y a `NIVEL_BLOQUE` con su nivel (1, 2 o 3)**.
3. Si el bloque hace lógica con el número de un pin, usa `pinReal(v)`. El código que emite usa el valor tal cual (puede ser un nombre de pin).
4. `npm run build` → `npm test` → `npm run compilar`, para confirmar que compila con la librería real.

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
                     El BRILLO no se regula por programa: la luz de fondo solo se
                     enciende/apaga (setBacklight también). Contraste = potenciómetro.
                     Símbolos propios: CampoDibujo (5x8, valor = 40 caracteres '0'/'1')
                     con editor emergente y 8 dibujos listos. "crear símbolo" genera un
                     byte[8] global + lcd.createChar(n, …) + lcd.setCursor(0, 0), porque
                     createChar deja la LCD escribiendo en la memoria de símbolos.
                     El número 0–7 se asigna por nombre (indiceSimbolo); repetir un nombre
                     con otro dibujo lo redefine (sirve para animar). Avisos: más de 8
                     símbolos, símbolo inexistente, columna/fila fuera de la pantalla
                     (solo con números fijos). "borrar fila" usa el helper lcdBorrarFila.
                     Trampa de Blockly: el CSS pinta de blanco los <rect> hijos directos
                     de un campo editable → los puntos van dentro de un <g> propio.

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

ELECTRON_RUN_AS_NODE → La extensión de VS Code deja esta variable puesta en algunas terminales.
                     Con ella, Electron arranca como Node sin ventana. test/app.js y
                     escritorio/empaquetar.js la quitan.

EPERM al empaquetar → Dentro de la carpeta del proyecto, Windows (VS Code o el antivirus)
                     bloquea el renombrado de release/win-unpacked.tmp. Por eso el
                     instalador se arma en %LOCALAPPDATA%\TecnoBloques-build.

Sin firma digital  → El instalador no está firmado: Windows SmartScreen muestra "Windows
                     protegió su PC" → "Más información" → "Ejecutar de todas formas".
                     Firmarlo requiere un certificado de firma de código (decisión abierta).

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

## Estado de verificación (5 oct 2026)

| Qué | Resultado |
|---|---|
| 3 ejemplos (Carro Bluetooth, Otto humanoide esquiva, Eco serial y LED) | ✅ compilan: uno, nano, nano (old), mega2560 |
| Programa con TODOS los bloques del toolbox | ✅ compila en uno y mega2560 (sin warnings tras el fix de BACKWARD) |
| Mis bloques: 2 bloques anidados (uno devuelve float y llama al otro con 2 parámetros), guardar → proyecto nuevo → borrar librería → reabrir proyecto | ✅ mismo código generado y compila |
| Interfaz: categorías, crear variable, Mis bloques, modo texto, monitor, tema oscuro, 400 px | ✅ sin errores de JavaScript (Playwright + Chromium) |
| Monitor serial con una placa real | ⬜ **no probado** (en la nube no hay USB) |
| `npm test` + `npm run compilar` en Windows 11 | ✅ los 8 programas compilan. `compilar.js` usa `ARDUINO_CLI`, o el arduino-cli que trae el Arduino IDE 2, o el del PATH |
| Bloques nuevos de la LCD (20x4, 2 símbolos, cursor, borrar fila, desplazar) | ✅ compilan en uno y mega2560 sin warnings propios; guardar/abrir conserva los dibujos; editor probado con clics reales (claro y oscuro) |
| Nombres de pines: 5 nombres usados en LED, botón, servo, PWM, DHT y un bloque propio, mezclando `13` y `LedRojo` | ✅ compila en uno; renombrar actualiza los bloques y deshacer lo revierte; avisos probados |
| Niveles: 31 / 65 / 85 bloques (contando repetidos en dos categorías), clic real en el selector, tipos de variable y "definir bloque" en el nivel 2, proyecto de nivel 3 abierto en nivel 1 (no pierde nada y avisa), ejemplos, 400 px | ✅ sin errores de JavaScript |
| App de escritorio (Electron 44.5.1, arduino-cli 1.5.1, núcleo AVR 1.8.8): abre, lista puertos, compila el carro (≈7 s; ≈3 s con caché) y Otto, error de puerto inexistente y error de C++ con línea, todo en español | ✅ en desarrollo y empaquetada (`win-unpacked`), sin errores de JavaScript |
| Instalador `TecnoBloques-Setup-0.2.0.exe` (175 MB) | ✅ se arma; ⬜ falta ejecutarlo en un PC del aula |
| **Subir a una placa real** desde la app | ⬜ **no probado** (en este PC solo hay puertos COM3/COM4 sin USB) |
| `instalar-librerias.ps1` | ⬜ no probado (en este PC las librerías se instalaron una por una con el arduino-cli del IDE) |

Versiones con las que se compiló (Linux, 26 sep): núcleo AVR 1.8.6, AFMotor-Shield-R4-Compatible 1.0.1,
DHT sensor library 1.4.7, Adafruit Unified Sensor 1.1.15, LiquidCrystal_I2C 1.1.4,
OttoDIYLib 13.0.0, Servo 1.3.0.
Windows (5 oct): arduino-cli 1.5.1, núcleo AVR 1.8.7, Adafruit Motor Shield R4 Compatible 1.0.0,
LiquidCrystal I2C 1.1.2, el resto igual.

Uso de memoria: carro en Uno usa 36 % de flash y 29 % de RAM. El programa con todos los bloques usa 68 % de flash y 53 % de RAM en el Uno. **Ojo con la OLED en Uno/Nano:** el buffer de SSD1306 ocupa 1 KB de los 2 KB de RAM.

### Pendiente de validar con hardware (Efraín)

0. **App de escritorio:** instalar `TecnoBloques-Setup-0.2.0.exe`, conectar un Uno y un Nano clon, y pulsar "Subir a la placa". Revisar los mensajes si el Nano necesita "bootloader antiguo".
1. Monitor serial: conectar, recibir y **enviar** con el ejemplo "Eco serial y LED" (en la app o en Chrome/Edge con `dist/TecnoBloques.html`).
2. Otto humanoide: pines y ángulos de los brazos, dirección de giro y velocidades.
3. Carro: sentido de los motores M1/M2 y comandos 'A'/'S' desde una app Bluetooth.
4. LCD: dirección 0x27 vs 0x3F de los módulos del aula.
5. Clones con CH340: que el puerto aparezca y el monitor funcione.

---

## Hoja de ruta

```
Fase 1 ✅ Editor (esta versión v0.1): bloques, generador, avisos de pines, funciones,
          Mis bloques local, C++ libre, modo texto, monitor serial, proyectos, ejemplos.

Fase 2 ◐ App de escritorio para el aula (5 oct 2026):
          ✅ Electron + arduino-cli embebido, selector de puerto, Subir con avance,
             errores en español, monitor serial con el puerto elegido, instalador NSIS,
             actualización automática (electron-updater), versión web con explicación.
          ⬜ Probar la carga con placas reales (Uno, Nano clon CH340, Mega).
          ⬜ Poner CH341SER.EXE en escritorio/recursos/drivers y publicar el Release v0.2.0.
          ⬜ Ligar los errores del compilador al bloque que los causa.
          ⬜ Publicar la versión web (GitHub Pages).

Fase 2b ✅ Base del sistema de bloques: nombres de pines (#define) y niveles 1·2·3.

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
- **Web para casa:** publicarla en GitHub Pages (lo natural, HTTPS) u otro sitio.
- **Firma del instalador:** sin certificado, SmartScreen avisa en la primera instalación. Un certificado de firma de código cuesta dinero cada año; también se puede pedir a SENA si tiene uno.
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
