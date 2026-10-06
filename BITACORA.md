# BITACORA — TecnoBloques

> Historial cronológico del proyecto. Append-only: nunca editar ni borrar
> entradas pasadas. El estado *actual* vive en `CLAUDE.md`.

---

## 2026-09-26 — Sesión de arranque: viabilidad, alcance y prototipo v0.1

**Contexto:** Efraín preguntó qué tan viable era construir para la TecnoAcademia
un editor web de bloques tipo MakeCode para Arduino. La idea era generar el código
desde los bloques y subirlo eligiendo el puerto, sin simulador, tomando como
referencia Ottoblockly y Visualino, y con bloques para las librerías más usadas
de la TecnoAcademia.

**Viabilidad (conclusión):** Es viable. Los bloques son la parte fácil con Blockly
(Apache 2.0). Lo delicado es compilar, porque el navegador no puede correr avr-gcc.
Se eligió como ruta un servidor de compilación en la red local (arduino-cli en
Docker) más la carga desde el navegador por Web Serial (STK500). Los planes B son
un agente local o una app Electron. Web Serial solo funciona en Chrome/Edge de
escritorio y requiere HTTPS o localhost.

**Decisiones tomadas con Efraín:**

- Placas: solo Arduino Uno, Nano y Mega. Hoy hay **Uno R3**; se esperan **Uno R4** en
  próximas compras. Primero AVR, con la arquitectura preparada para R4 (perfiles
  de placa y cargadores intercambiables).
- Librerías: **AFMotor_R4** (shield L293D), **DHT11** (Adafruit), **LCD 16x2 I2C**
  (OLED el próximo año), **monitor serial** y **Bluetooth**. Se sumó la librería
  **Otto**, porque hay muchos robots Otto, sobre todo el **Otto humanoide**.
- **Funciones** con parámetros tipados y **bloques propios** que los aprendices
  crean y reutilizan en otros programas llamándolos por su nombre, **de forma local**
  (nivel 1). Diseñador de bloques para instructores y catálogo compartido quedan
  para después.
- **Bloque de C++ libre**, **monitor serial que sí envía** (falla de Ottoblockly),
  **vista del C++ en vivo** y botón para pasar a C++ y volver a los bloques.

**Entregables de esta sesión:**

- Prototipo v0.1 funcionando: `src/` (núcleo, bloques, interfaz), `build.js`,
  `dist/TecnoBloques.html` y un artefacto publicado en Claude para verlo.
- 3 ejemplos: Carro Bluetooth (Uno), Otto humanoide esquiva (Nano), Eco serial y LED (Uno).
- Pruebas con Playwright y compilación real con las librerías: todo compila en
  uno, nano, nano (old) y mega2560.
- Hallazgo y corrección: `BACKWARD` vale -1 en Otto.h y 2 en AFMotor_R4.h. Con
  ambas librerías los motores habrían girado al revés sin avisar. Se resolvió con
  `#undef` y un literal en los bloques de Otto.
- Hallazgo: OttoDIYLib v13 no trae brazos para el humanoide. Se manejan con dos
  Servo aparte.
- Repositorio organizado para GitHub con `CLAUDE.md`, `BITACORA.md`, `ABOUTME.md` y `README.md`.

**Pendiente (antes de la fase 2):**

- Probar el monitor serial (recibir y enviar) con una placa real y clones CH340.
- Validar pines y ángulos de los brazos del Otto humanoide y el sentido de los motores del carro.
- Elegir la licencia del repositorio y si se publica en GitHub Pages.
- Definir en qué equipo corre el servidor de compilación.

---

## 2026-10-05 — Decisiones: app de escritorio + web para casa, niveles y nombres de pines

**Contexto:** Se revisó el proyecto desde lo pedagógico. La conclusión fue que lo
que más motiva es el ciclo corto "armo → subo → el robot se mueve", y hoy el
aprendiz no puede subir su programa sin el Arduino IDE.

**Decisiones:**

- **Dos entregas desde el mismo código.** En el aula, una app de escritorio con
  arduino-cli, el núcleo AVR y las librerías embebidos. Trae instalador para
  Windows con drivers CH340 (hay permisos de administrador) y se actualiza sola
  desde GitHub Releases. En casa, una página web sin compilador ni servidor para
  seguir programando: guardar el proyecto o descargar el .ino. Los retos se
  enlazan más adelante.
- **Se descarta el servidor de compilación en la red local** y el cargador
  STK500 en JavaScript. El R4 también se cargará con arduino-cli.
- **Niveles de bloques** que se desbloquean según el nivel del aprendiz.
- **Bloque para nombrar pines** (`#define LedRojo 13`), con los nombres visibles
  en los menús de pines.
- **Bloques de más librerías.** La lista está pendiente.

**Orden propuesto:** app con botón "Subir" → nombres de pines y niveles → librerías nuevas → web para casa y retos.

## 2026-10-05 — Niveles, librerías, Electron, licencia y repositorio en GitHub

**Decisiones:**

- **Niveles:** selector 1 · 2 · 3 en la barra superior. Cada usuario elige su
  nivel y en clase el instructor indica el nivel de cada reto.
- **Librerías nuevas:** MPU6050, Wire.h (I2C genérico) y Adafruit_PWMServoDriver
  (PCA9685). La LCD I2C 16x2/20x4 ya existía; falta aclarar qué se agrega ahí.
- **App de escritorio:** Electron.
- **Licencia:** Apache 2.0, igual que Blockly. Titular: SENA – TecnoAcademia Tolima.
  Autor: Efraín Guillermo Mariotte Parra. Se creó `NOTICE`. Hay que confirmar la
  titularidad con la coordinación SENNOVA.
- **Repositorio público** en GitHub (`EMariotte/TecnoBloques`), necesario para
  la actualización automática sin tokens.

## 2026-10-05 — Pantalla LCD ampliada y primera compilación en Windows

**Hecho:**

- **Bloques nuevos de la LCD:**
  - escribir donde está el cursor
  - mover el cursor
  - borrar una fila
  - **crear símbolo**, con un editor de 5x8 puntos que se pinta tocando o arrastrando, botones Borrar e Invertir y 8 dibujos listos (corazón, carita, grado, flecha, nota, batería, campana, persona)
  - mostrar un símbolo
  - correr el texto a la izquierda o a la derecha
  - ocultar o mostrar el texto
  - tipo de cursor
- **Avisos nuevos:** más de 8 símbolos, un símbolo que no existe y una columna o fila que no cabe en 16x2 o 20x4.
- **Hallazgo:** la librería no permite regular el brillo, solo encender o apagar la luz. El contraste se ajusta con el potenciómetro del módulo. Se explica en la ayuda del bloque.
- **Primera compilación real en Windows**, con el arduino-cli que trae el Arduino IDE 2: los 8 programas de prueba compilan. `test/compilar.js` ahora encuentra ese arduino-cli solo. Las pruebas guardan los .ino en UTF-8.

## 2026-10-05 — Nombres de pines (#define)

**Hecho:**

- **Bloque "el pin [13] se llama [LedRojo]"** que genera `#define LedRojo 13`. Los nombres aparecen primero en todos los menús de pines como "LedRojo (13)", y el C++ usa el nombre. Si se cambia el número en ese bloque, cambia en todo el programa. Si se renombra, los bloques que lo usan se actualizan solos y deshacer lo revierte.
- **Bloque de valor "pin [LedRojo]"** para pasar pines a los bloques propios, por ejemplo `parpadear(LedRojo)`.
- **Revisión de choques:** sigue usando el número real y los avisos muestran el nombre y el número, como "LedAzul (9)". Los objetos se nombran por el pin: `servo_Pinza` y `dht_Clima`.
- **Avisos:** nombre repetido, pin inexistente, nombre no definido y nombre igual a una variable.
- **Prueba fija nueva `pines`** en `test/prueba_todo.py` y `test/compilar.js`. Los 9 programas compilan.
- **Falla vieja corregida:** si un bloque de C++ libre se borraba justo después de cambiar su texto (por ejemplo, con "Nuevo"), el redibujo diferido fallaba con `FIELD_TEXT_BASELINE_CENTER`.

## 2026-10-05 — Niveles 1 Explorador · 2 Constructor · 3 Inventor

**Decisiones con Efraín:** se aceptan los nombres de los niveles. En el nivel 1 no hay variables y del monitor serial solo está "imprimir"; el resto del monitor llega en el nivel 2.

**Hecho:**

- **Selector 1 · 2 · 3** en la barra superior. El botón activo muestra el nombre del nivel.
- **Cuántos bloques ve cada nivel:**
  - 1 Explorador: 31 bloques en 13 categorías.
  - 2 Constructor: 65 bloques en 16 categorías.
  - 3 Inventor: 85 bloques en 17 categorías.
  - Los conteos incluyen los bloques que aparecen en dos categorías.
- **Dentro de los bloques:** en el nivel 2, "definir bloque" no tiene parámetros ni retorno, y las variables usan nombres de aprendiz.
- **El proyecto guarda su nivel** y al abrirlo se cambia solo. Un nivel nunca borra bloques: si el programa usa bloques de un nivel más alto, aparece una nota.
- **Vista inicial:** el nivel 1 abre en "Bloques" y el botón "Editar C++" solo está en el nivel 3. La primera vez se abre un proyecto vacío en el nivel 1, en vez del ejemplo del carro.
- **Hallazgo:** el carro Bluetooth (proyecto estrella del nivel 2) necesita una variable de tipo carácter para los comandos. Se agregó "letra (para comandos)" a los tipos del nivel 2. El ejemplo "Carro Bluetooth" queda en nivel 3 porque usa un bloque propio con parámetros.
- **Pruebas:** `npm test` revisa que todo bloque de la caja tenga nivel. `test/ui.py` captura los niveles 1 y 2.

## 2026-10-05 — Fase 2: app de escritorio (Electron + arduino-cli)

**Hecho:**

- **Carpeta `escritorio/`:** Electron 44.5.1 abre el mismo `dist/TecnoBloques.html`. Un puente seguro (`window.tbEscritorio`) da acceso a arduino-cli, sin abrir Node a la página.
- **Selector de puerto:** detecta las placas con `arduino-cli board list` cada 3 s, pone primero las USB y reconoce los clones CH340 por su VID.
- **"Subir a la placa":**
  1. avisa si la placa conectada no es la elegida;
  2. cierra el monitor serial si estaba conectado;
  3. compila con caché (≈7 s la primera vez, ≈3 s después) y sube;
  4. muestra el % de memoria y vuelve a abrir el monitor.
- **Errores explicados en español:** librería faltante, programa muy grande, error de C++ (con número de línea y el texto de esa línea), puerto ocupado o inexistente, y placa que no responde.
- **Monitor serial en la app:** sigue usando Web Serial. La app elige sola el puerto del selector.
- **Paquete de Arduino (`npm run preparar-arduino`):** arduino-cli 1.5.1, núcleo AVR 1.8.8 y las 6 librerías del aula, unos 310 MB. Se quitó el índice de librerías (57 MB), que no hace falta para compilar ni subir.
- **Instalador NSIS** de un clic, por usuario y en español: `TecnoBloques-Setup-0.2.0.exe`, de 175 MB. Ofrece el driver CH340 en la primera instalación si se pone `CH341SER.EXE` en `escritorio/recursos/drivers`. Trae actualización automática con electron-updater desde GitHub Releases. La versión subió a 0.2.0.
- **Versión web (casa):** "Subir a la placa" explica cómo seguir: guardar el proyecto para el aula o usar Arduino IDE.
- **Pruebas:** `test/app.js` y `test/app-empaquetada.js` abren la app con Playwright, compilan y revisan los mensajes de error. Todo pasa.

**Hallazgos:**

- La extensión de VS Code deja puesta `ELECTRON_RUN_AS_NODE=1`, y con ella Electron arranca como Node sin ventana.
- Dentro del proyecto, Windows bloquea el empaquetado (EPERM), así que el instalador se arma en `%LOCALAPPDATA%\TecnoBloques-build`.
- El instalador no está firmado y SmartScreen avisa la primera vez.

**Pendiente:** subir a placas reales, conseguir CH341SER.EXE, publicar el Release v0.2.0 y ligar los errores al bloque que los causa.

**Nota (Efraín, mismo día):** ya está `CH341SER.EXE` en `escritorio/recursos/drivers/`. La prueba con placas reales pasa a la próxima sesión, en el ambiente donde están todas las placas. **No se publica el Release v0.2.0** hasta probarla.

## 2026-10-05 — Marca de TecnoBloques

**Proceso:**

1. Primera ronda de 4 íconos. Efraín pidió más opciones y un ícono que reúna **bloques, código, TecnoAcademia y robótica**, con los colores institucionales.
2. Seis conceptos, evaluados a 48, 32 y 16 px sobre fondo claro y oscuro.
3. Cuatro finalistas que combinan lo mejor de cada uno. Se quitó la muesca superior, que hacía ver "orejas de gato". Se probaron en una sola tinta y con el nombre al lado.
4. Efraín eligió **F4 (Pila T)** y pidió dos ajustes: que cabeza y cuerpo **encajen como bloques**, y una cara más mecánica con **un ojo engranaje y otro cursor**. Se aprobó la versión **A**, con el engranaje a la izquierda.

**Hecho:**

- **`marca/generar.py`** genera todo desde un solo dibujo: SVG (app, cabeza, sobre claro y oscuro, una tinta azul y blanca), PNG de 16 a 1024 px (a 16 y 24 px va solo la cabeza), `escritorio/icono.ico` de 7 tamaños, logos horizontales e imagen para compartir de 1200×630.
- **Guía de uso:** `marca/MARCA.md`.
- **Dónde quedó la marca:**
  - el logo de la barra superior del editor;
  - el favicon de la página web, que antes no tenía;
  - el ícono para celulares;
  - la app y el instalador, comprobado sacando el ícono del `.exe`;
  - el README.
- **Pendiente:**
  - confirmar los colores con el manual de identidad del SENA;
  - subir `compartir.png` como vista previa del repositorio en GitHub (Settings → Social preview; no se puede hacer por API).

## 2026-10-05 — Listas y matrices (nivel 3)

**Decisiones con Efraín:** las posiciones empiezan en 0, como en C++. El orden es: marca → listas y matrices → librerías MPU6050, PCA9685 e I2C.

**Hecho:**

- **Categoría nueva "Listas y matrices"**, en nivel 3:
  - para crear: lista con valores, lista vacía de N espacios, y matriz de F×C;
  - para usar: elemento, poner, largo, "para cada", elemento y poner de la matriz, y número de filas o columnas.
- **La matriz se ve fila por fila sobre el bloque** y se edita en una tabla. Sirve, por ejemplo, para coreografías de Otto: cada fila es una pose y cada columna un servo.
- **Avisos:** posición fija fuera de rango, lista inexistente, valor que no es del tipo, nombre repetido con una variable, un pin o un bloque propio, y uso alto de memoria.
- **El C++ queda legible:** `int melodia[5] = { … };` y `const int melodia_largo = 5;`, este último solo si se usa.
- **Prueba fija nueva `listas`.** Los 10 programas de prueba compilan.

## 2026-10-05 — Librerías I2C: MPU6050, PCA9685 y Wire

**Decisión:** el bloque se sigue llamando "lista" (como en Python y JavaScript, que es lo que más programarán los aprendices). La ayuda aclara que en C++ se llama arreglo (array).

**Hecho:**

- **Bus I2C compartido (`usarI2C`):** todos los módulos registran A4/A5 como "Bus I2C". Así no hay avisos falsos entre la LCD, el MPU y el PCA, pero sí se avisa si alguien usa A4 como pin digital. También se avisa si dos módulos usan la misma dirección.
- **MPU6050 (MPU6050_light 1.2.1):** iniciar (dirección 0x68/0x69, calibrar 1 s) y ángulo X/Y/Z en el nivel 2; aceleración, velocidad de giro y temperatura en el nivel 3.
- **PCA9685 (Adafruit PWM Servo Driver 3.0.3):**
  - nivel 2: iniciar (0x40–0x47), mover el servo de un canal a N grados, soltar el servo;
  - nivel 3: PWM por canal (0–4095) y calibrar el pulso de 0° y 180°.
- **Categoría I2C:** "buscar dispositivos I2C" (nivel 2) escribe en el monitor serial cada dirección y el módulo probable. Enviar, pedir y leer bytes van en el nivel 3.
- **Paquete de la app:** se agregaron MPU6050_light, la librería del PCA9685 y Adafruit BusIO (`preparar-arduino.js` e `instalar-librerias.ps1`).
- **Corrección:** en el nivel 1 aparecían títulos de la caja de bloques sin bloques debajo. Ahora se quitan.
- **Prueba fija nueva `i2c`** (Uno y Mega). Los 12 programas de prueba compilan.

**Pendiente:** rearmar el instalador antes de publicar, porque el paquete de Arduino cambió.

## 2026-10-05 — Calibración por canal del PCA9685 (idea de Efraín)

**Idea:** en lugar de un solo par de pulsos para todos los servos, un bloque parecido al de las matrices: se elige cuántos servos calibrar y el bloque muestra una fila por servo, con su canal y sus pulsos para 0° y 180°. Retoma las matrices, porque la calibración es una tabla.

**Aportes al diseño:**

- **Un nombre por servo**, igual que con los pines con nombre. El menú de canales muestra "hombro (1)" y el C++ lo pone como comentario.
- **Sin columnas extra:** los dos pulsos ya permiten ajustar el recorrido, enderezar el servo e invertir el giro (intercambiándolos).
- **Se quitó el bloque de calibración general** (no estaba publicado), para que haya una sola forma de calibrar.

**Hecho:**

- **Bloque suelto `pca_calibracion`** (nivel 3), de 1 a 16 servos (4 por defecto: base, hombro, codo, pinza). Una fila nueva toma el siguiente canal libre.
- **C++ generado:** la matriz `int pcaCalibracion[16][2]`, con una fila por canal y su nombre como comentario. `pcaServo()` lee la fila de su canal. Sin calibración, el C++ queda sin tabla.
- **Avisos:** canal repetido, pulsos iguales, dos bloques de calibración, y calibración que no se usa.
- **Prueba:** el caso `i2c` incluye la calibración, con un servo invertido. Los 12 programas compilan.

**Idea para después:** un ejemplo "calibrar servos en vivo" que use el envío del monitor serial para ajustar el pulso sin volver a subir el programa.

## 2026-10-05 — Calibración de Otto e investigación de matrices LED

**Pedido de Efraín:** un bloque de calibración para Otto como el del PCA9685, pero fijo, porque los servos de Otto ya tienen nombre. También pidió las funciones de la matriz LED y sugerencias para Otto (solo servos) y para la matriz.

**Hecho:**

- **Bloque "calibración de Otto (ajuste en grados)"** (nivel 2), suelto y fijo: piernas, pies y brazos (estos con la casilla "con brazos").
  - Usa los "trims" de OttoDIYLib: `setTrims` y `saveTrimsOnEEPROM`.
  - Con "guardar en la memoria del robot", la calibración queda en la EEPROM y **cualquier programa la carga sola**. Los brazos van en las direcciones 4 y 5, con una marca en la 6.
  - El bloque solo ya es el programa para calibrar: se sube una vez por robot.
- **Brazos:** todo movimiento pasa por `ottoBrazo()`, que aplica la calibración. Saludar se saltaba la calibración y quedó corregido.
- **Hallazgo:** OttoDIYLib define como macros `otto`, `wave`, `one`…`nine`, `smile`, `heart`, `sad`, `angry`… Una variable con esos nombres no compilaba. Se agregaron a las palabras reservadas.
- **Investigación de matrices LED:** se revisó la API real de las tres opciones:
  - la matriz de OttoDIYLib, es decir la boca MAX7219 del humanoide;
  - LedControl 1.0.6, para módulos MAX7219 de 8×8;
  - Arduino_LED_Matrix, la matriz integrada del Uno R4 WiFi.
  Las sugerencias quedaron en la conversación, pendientes de decisión.
- **Pruebas fijas nuevas:** `otto_calibrar` y `otto_calibrado` (Nano). Los 14 programas compilan.

## 2026-10-05 — Matriz LED: boca de Otto (OttoDIYLib) y categoría "Matriz LED" (LedControl)

**Decisiones de Efraín:** la matriz es la misma MAX7219 8x8 de la boca de Otto. En la categoría Otto se usa la opción A (funciones de OttoDIYLib) y en una categoría nueva la opción B (LedControl), con su librería. Pidió además resolver la orientación: con Ottoblockly, los dibujos hechos LED por LED salen siempre en una orientación y en el robot hay que dibujarlos al revés.

**Causa encontrada:** OttoDIYLib aplica la orientación de `initMATRIX` solo a sus bocas y al texto (`writeFull` y `sendChar`), pero `Otto.setLed` escribe sin girar.

**Hecho:**

- **`ottoBocaPunto()`** aplica a los dibujos propios la misma transformación que la librería aplica a sus bocas. Se verificó con las 31 bocas en las 4 orientaciones, sin diferencias. Ahora el aprendiz dibuja como se ve en el robot y elige la orientación en "iniciar boca" con la convención de Otto (arriba 1, abajo 2, izquierda 3, derecha 4).
- **Bloques de la boca de Otto:** iniciar (pines de los ejemplos de Otto y brillo, que la librería dejaba al máximo), las 31 bocas con nombre en español, dibujo propio, borrar, texto (máximo 9 caracteres, se avisa), punto y brillo.
- **Categoría "Matriz LED" con LedControl:** iniciar (orientación, espejo y brillo), dibujo, borrar, animación de 2 a 8 cuadros (el bloque se amolda), texto con fuente propia de 5×7, punto y brillo.
- **Editor de dibujo generalizado:** 5×8 azul para la LCD y 8×8 rojo para la matriz, con botones Espejo y Girar.
- **Librería LedControl 1.0.6** agregada al paquete de la app. Prueba fija nueva `matriz`. Los 15 programas compilan.

## 2026-10-05 — Cierre de la sesión

**Resumen del día** (sesión larga, todo el 5 de octubre):

- **Fase 1 terminada y ampliada:**
  - LCD con símbolos;
  - nombres de pines (`#define`);
  - niveles 1 · 2 · 3;
  - listas y matrices;
  - I2C (MPU6050, PCA9685, Wire);
  - calibración del PCA9685 por canal y de Otto con memoria del robot;
  - matriz LED (LedControl) y boca de Otto con la orientación corregida.
- **Fase 2, app de escritorio:** Electron + arduino-cli + instalador con driver CH340 y actualización automática, armado pero **sin publicar**.
- **Marca:** el robot de dos bloques encajados, con los colores SENA.
- **Repositorio público:** EMariotte/TecnoBloques, licencia Apache 2.0.
- **15 programas de prueba** que compilan con las librerías reales. Pruebas de interfaz y de la app con Playwright.

**Próxima sesión (Efraín, en el ambiente con todas las placas):** probar con hardware según la lista "Próxima sesión" de `CLAUDE.md`, y solo después publicar el Release v0.2.0.

## 2026-10-06 — Primera prueba con hardware: Arduino Mega 2560 (clon CH340)

**Contexto:** Efraín conectó una Mega 2560 clon CH340 en COM7 (ya probada con el Arduino IDE), instaló `TecnoBloques-Setup-0.2.0.exe` y probó la app.

**Funcionó:**

- El selector muestra "COM7 · placa con chip CH340 (clon)", primero en la lista.
- La subida tarda unos 4–6 s y termina en "¡Listo!".
- El monitor serial recibe y **envía** con el ejemplo "Eco serial y LED".

**Problemas encontrados y corregidos:**

1. **Diagnóstico equivocado con la placa equivocada** (Uno elegida, Mega conectada). La app decía "No se pudo abrir COM7".
   - **Causa:** avrdude reintenta 10 veces ("not in sync") y termina con "unable to open port", y la app revisaba primero el caso de puerto.
   - **Ahora:** dice "La placa no responde" y muestra la placa elegida.
2. **Casi un minuto de espera sin explicación.**
   - **Ahora:** se ven los intentos en vivo ("La placa no contesta (intento 3 de 10)… ¿Elegiste la placa correcta?").
   - **Botón Cancelar:** cierra el árbol de procesos con `taskkill /T`, porque si no, avrdude seguía ocupando el puerto. Probado: se cancela al intento 2 y enseguida se sube con la placa correcta en 3,9 s.
3. **Volver a abrir el monitor serial.** Si un niño pulsaba "Cerrar" en "¡Listo!", no tenía cómo reabrirlo (en el nivel 1 el panel está escondido).
   - **Ahora:** hay un botón fijo "Monitor serial" en la barra, que abre y conecta, con un punto verde.
   - "¡Listo!" ofrece el monitor solo si el programa lo usa.

Efraín aprobó los cambios en la versión de desarrollo. Se rearma el instalador (la misma 0.2.0, sin publicar).

**Falta del bloque A:** Uno R3 y Nano clon (bootloader nuevo y antiguo).

## 2026-10-06 — Primeras versiones publicadas (de prueba) y prueba de actualización

**Decisión de Efraín:** publicar ya en GitHub, como versión de prueba, para no reinstalar a mano y para **probar la actualización automática antes de llevar la app al aula**. Regla nueva: no instalar en los PC del aula hasta probar el Uno R3 y el Nano.

**Hecho:**

- Release **v0.2.0**, con el mismo código que la versión instalada.
- Release **v0.2.1**, con un cambio visible para comprobar la actualización: la versión aparece en el título de la ventana ("TecnoBloques 0.2.1"), lo que además sirve para el soporte en el aula.
- **Prueba pendiente:** que la app instalada de Efraín (0.2.0) muestre "Hay una versión nueva (0.2.1)" y se actualice.

## 2026-10-06 — La actualización automática funciona (0.2.0 → 0.2.1) y versión 0.2.2

**Prueba:**

- Pasados 5 minutos, la app instalada no había mostrado nada. Al relanzarla con registro se vio esto:
  1. encontró la 0.2.1 e intentó la **descarga diferencial** (1 MB de 176);
  2. falló por `sha512 mismatch`, porque la 0.2.0 instalada venía del instalador del 5 oct y no del Release del 6;
  3. **pasó sola a la descarga completa**.
- Al terminar mostró "Hay una versión nueva…". Efraín eligió "Reiniciar ahora" y la app quedó en **0.2.1**: el título lo muestra.
- **Lección:** la app trabajaba en silencio y se callaba los errores.

**Hecho en 0.2.2:**

- **Aviso discreto mientras descarga**, con el porcentaje: "Bajando una versión nueva… Puedes seguir trabajando".
- **Registro de la actualización** en `%APPDATA%\TecnoBloques\registro-actualizacion.txt`.
- **`disableWebInstaller`**, para quitar una advertencia del registro.
- **`test/app.js` con su propia carpeta de datos:** la app solo permite una instancia, y antes la prueba se cerraba sola si la app instalada estaba abierta.

Se publica la v0.2.2 para la segunda prueba de actualización, ahora diferencial.

## 2026-10-06 — Segunda prueba de actualización: 0.2.1 → 0.2.2 (diferencial)

Efraín reabrió la app 0.2.1:

- apareció el aviso "Bajando una versión nueva…";
- la **descarga tardó unos 10 segundos** (diferencial: solo lo que cambió, porque la 0.2.1 venía de un Release) y la **instalación unos 30 segundos**;
- el título quedó en "TecnoBloques 0.2.2".

**La cadena de actualización automática quedó probada de punta a punta.** Para el aula significa que cada versión nueva llega sola a los PC en menos de un minuto, sin reinstalar.

**Falta del bloque A** para quitar la etiqueta "versión de prueba" e instalar en el aula: probar el Uno R3 y el Nano clon (bootloader nuevo y antiguo).
