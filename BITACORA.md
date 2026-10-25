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

## 2026-10-06 — Otto humanoide: todas las funciones de OttoDIYLib v13

**Pedido de Efraín:** comparar todas las funciones de la librería con las que usa TecnoBloques, solo para el Otto humanoide, e implementar todas las sugerencias.

**Revisión:** la librería tiene 37 funciones públicas y TecnoBloques ya usaba 26, incluidos los 19 sonidos, los 13 gestos, los 8 bailes y las 31 bocas.

**Error encontrado y corregido:** `Otto.home()` no se mueve si Otto ya está en reposo, así que el programa de calibración **no mostraba** el ajuste nuevo. Ahora se fuerza con `setRestState(false)`.

**Bloques nuevos:**

- coreografía con matrices (`_moveServos`, 4 o 6 columnas, con brazos);
- mover un solo servo, piernas, pies o brazos (`_moveSingle`);
- relajar y despertar los servos, incluidos los brazos;
- velocidad máxima (`enableServoLimit` / `disableServoLimit`);
- animaciones de boca (`putAnimationMouth`, 4 animaciones);
- sonido deslizante (`bendTones`).

**Mejoras a bloques existentes:**

- el reposo también lleva los brazos al frente;
- crusaito y aleteo hacia atrás;
- inclinarse, sacudir la pierna y saltar con número de veces y velocidad.

**Otra trampa encontrada:** `bendTones` se queda en un ciclo infinito con frecuencias bajas, así que se limita de 100 a 5000 Hz.

**Prueba fija nueva `otto_todo`** (Nano). Los 16 programas compilan. Queda pendiente la validación de Efraín antes del commit.

## 2026-10-06 — Cierre de la sesión: v0.2.3 publicada

**Efraín validó** los bloques nuevos de Otto y aprobó el commit y la publicación de la **v0.2.3**, también como versión de prueba. Su app se actualiza sola.

**Resumen del día:**

- **Primera prueba con hardware real** (Mega 2560 clon CH340):
  - la subida y el monitor serial funcionan;
  - se corrigió el diagnóstico de la placa equivocada y se agregaron los intentos en vivo y el botón Cancelar;
  - nuevo botón fijo "Monitor serial".
- **Actualización automática probada** de punta a punta: 0.2.0 → 0.2.1 (descarga completa) → 0.2.2 (diferencial, unos 10 s más 30 s de instalación).
  - aviso de descarga con porcentaje y registro en `%APPDATA%\TecnoBloques\registro-actualizacion.txt`;
  - la versión se ve en el título de la ventana.
- **Otto humanoide con todas las funciones de OttoDIYLib v13:**
  - coreografía con matrices, mover un servo, relajar y despertar, velocidad máxima, animaciones de boca y sonido deslizante;
  - reposo con brazos y opciones que faltaban;
  - **dos errores corregidos:** la calibración no se veía por `home()`, y `bendTones` se colgaba con frecuencias bajas.
- **16 programas de prueba** compilan con las librerías reales.

**Próxima sesión:** probar el Uno R3 y el Nano clon (bootloader nuevo y antiguo). Si pasan, quitar la etiqueta "versión de prueba" e instalar en el aula. Después, los robots y módulos de la lista "Próxima sesión" de `CLAUDE.md`, empezando por Otto con todas sus funciones nuevas.

## 2026-10-07 — Proyecto hermano iniciado: TecnoCircuito

**Decisión de Efraín:** el simulador de circuitos se hace como **proyecto independiente**, con su propio repositorio (`EMariotte/TecnoCircuito`), su `CLAUDE.md` y su bitácora. Lo que queda de 2026 se dedica a construir y validar su parte técnica.

- **Viabilidad:** avr8js y @wokwi/elements son MIT, y el solucionador eléctrico es propio, así que TecnoBloques sigue en Apache 2.0. La app ya compila con una carpeta de compilación propia, así que el `.hex` que necesita el simulador ya existe.
- **Alcance técnico de 2026:** etapa 0 (bases, lienzo con protoboard, registro de eventos), etapa 1 (chip y circuito DC: LED, botón, potenciómetro, zumbador, monitor serial) y etapa 3 reducida (shield L293D, motor DC, servo, reinicio por consumo). Los módulos (LCD, DHT11, MPU6050…) pasan a 2027.
- **Por qué un repositorio aparte:** TecnoBloques depende de una etiqueta fija del simulador. Así se pueden publicar arreglos de TecnoBloques sin cambiar el simulador, que debe quedar congelado durante su uso en el aula.
- **Contrato 1 (borrador):** IIFE `window.TecnoCircuito` embebido por `build.js`, mismas claves de placa, circuito guardado sin interpretar dentro del `.tbq.json`, `.hex` por un IPC nuevo y eventos que TecnoBloques escribe en disco. Arquitectura en la sección «Proyecto hermano» de `CLAUDE.md`.
- **Hallazgo:** `proyectoActual()` arma el proyecto campo por campo, así que hoy borraría el circuito al guardar. Queda como el primer pendiente en TecnoBloques.
- **Mecanismo de sincronización:** número de contrato, etiqueta fija, revisión al arrancar, pruebas de contrato en los dos lados, scripts para trabajar con el simulador local e instalador que se niega a empaquetar un simulador que no sea de una etiqueta.
- La carpeta `TecnoCircuitos/` con el `CLAUDE.md`, la bitácora y el contrato del proyecto nuevo se preparó aquí para moverla a `..\TecnoCircuito`. Está en `.gitignore`.

## 2026-10-07 — Contrato 1: ajustes del prototipo 0

En TecnoCircuito se hizo un prototipo del cableado: una placa, una resistencia y un LED, sin simulación. Al probarlo salieron cuatro ajustes al contrato. Efraín los aceptó y ya están en `..\TecnoCircuito\CONTRATO.md`. El contrato sigue en borrador y no sube el número.

- **Cada pin físico tiene nombre propio** (`GND1`, `GND2` y `GND3` en el Uno).
- **Los cables pueden traer `puntos`,** que son sus dobleces.
- **La placa queda fija en el origen,** y las coordenadas quedan definidas.
- **`crearLienzo` recibe `alEvento`,** así el cableado se registra aunque el aprendiz nunca simule.

Para TecnoBloques no cambia nada de lo que ya está hecho. Al integrar el lienzo, hay que pasarle `alEvento` a `crearLienzo` y no solo a `crearSimulador`.

## 2026-10-07 — Bloque A completo: Uno R3 y Nano clon con placas reales

Efraín conectó un Uno y un Nano clon al PC. Claude manejó la app de escritorio con Playwright, como lo haría un aprendiz: elegir placa y puerto, subir, abrir el monitor y enviar mensajes.

- **Los puertos estaban al revés de lo anotado:** la app mostró el Uno original en COM12 («Arduino UNO», VID 2341) y el Nano clon en COM5 («placa con chip CH340»).
- **Uno R3:** sube el eco, el carro y Otto en 6 a 12 s. El monitor recibe y envía. Elegir «Mega 2560» con el Uno conectado da «La placa no coincide», como se esperaba con una placa original.
- **Nano clon CH340:** sube con «Arduino Nano», o sea que trae el **cargador nuevo**. Con «bootloader antiguo» da «La placa no responde» después de los 10 intentos, que se ven en vivo.
- **Tres arreglos en `src/app.js`:**
  - el Uno original manda unos 40 caracteres nulos al reiniciarse, y el monitor los mostraba como espacios que corrían el primer mensaje a la derecha. `limpiarSerial()` los quita;
  - cuando el `\r` y el `\n` llegaban en trozos distintos, salía una línea en blanco de más. Ahora se unen aunque lleguen separados;
  - «La placa no responde» sugería probar «Nano (bootloader antiguo)» aunque ya estuviera elegido. Ahora sugiere la otra opción del Nano.
- **Prueba nueva `test/placas.js` (`npm run test:placas`):** sube ejemplos a placas reales, prueba el monitor y los mensajes de error, y guarda capturas. Sirve para cada versión y para el Uno R4.
- `npm test` y `npm run test:app` pasan sin errores.

**Con esto el bloque A está completo.** La siguiente versión puede salir sin la nota «versión de prueba» e instalarse en el aula, cuando Efraín lo autorice.

## 2026-10-07 — v0.2.4 publicada: primera versión para el aula

**Efraín autorizó la publicación** después de pasar el bloque A.

- **Qué trae:** los arreglos del monitor serial (caracteres nulos del Uno original y línea en blanco de más) y la sugerencia correcta cuando un Nano no responde. Es la primera versión **sin la nota «versión de prueba»**.
- **Pruebas antes de publicar:**
  - `npm test`: sin errores y sin bloques sin nivel;
  - `npm run compilar`: los 16 programas compilan;
  - `npm run test:app` y `test/app-empaquetada.js`: sin errores; la app empaquetada dice «TecnoBloques 0.2.4»;
  - `test/placas.js` con la **app empaquetada** (nueva variable `TB_EXE`): el Uno R3 y el Nano clon suben, el monitor recibe y envía, y el Nano con «bootloader antiguo» da el mensaje correcto.
- **Release v0.2.4** en GitHub con el instalador (176 MB), su `.blockmap` y `latest.yml`. Las apps instaladas con una 0.2.x se actualizan solas.

**Siguiente:** instalar en los PC del aula y empezar el bloque B (robots y módulos en el ambiente).

## 2026-10-07 — Contrato 1: formato del proyecto y fixtures (v0.2.5)

Efraín preguntó si TecnoCircuito necesita guardar el `.hex` y pidió un estándar de guardado que sirva al simulador y para abrir un proyecto en otro computador.

**Revisión:** el simulador necesita el `.hex` en memoria al pulsar «Simular», y TecnoBloques lo compila en ese momento (contrato, sección 5). Lo que TecnoCircuito pedía guardar como archivo eran las **fixtures** de sus pruebas.

**Decisión: no se guarda el `.hex` en el proyecto.** Se desactualiza al cambiar un bloque, depende del compilador y de las librerías de cada PC, y pesa más que el resto del archivo. La fuente del programa son los bloques (o el C++ a mano).

**Estándar de guardado (formato 1)**, documentado en «Proyecto (`.tbq.json`)» de `CLAUDE.md` y en el `CONTRATO.md` de TecnoCircuito:

- **Campos desconocidos se conservan** (`extrasProyecto`). Antes, cualquier versión borraba el `circuito` al guardar. Sale ahora, antes de que exista el primer circuito, para que los PC del aula ya lo tengan cuando llegue el simulador.
- **`creadoCon`:** la versión de TecnoBloques que guardó. `build.js` inyecta `window.TB_VERSION`, así también funciona en la versión web.
- **Proyecto de una versión más nueva:** abre con aviso; si trae bloques desconocidos, el error lo explica y pide actualizar.
- **Arreglo de paso:** si un proyecto no abría, el espacio quedaba vacío y el autoguardado podía pisar el trabajo. Ahora vuelve al proyecto anterior.

**Fixtures:** `npm test` deja el `.tbq.json` de cada caso y `npm run compilar` deja el `.hex` al lado, en `test/salida/<caso>/`. Los 16 casos los tienen.

**Pruebas:** `npm test` (con las pruebas nuevas del formato), `npm run compilar` (16 de 16), `test:ui`, `test:app`, app empaquetada y placas reales.

## 2026-10-07 — Contrato 1: primera conexión con TecnoCircuito

Anotado con el mismo título en las dos bitácoras. Efraín validó en la práctica el PWM y la lectura analógica del prototipo 3, y pidió conectar por primera vez las dos páginas.

**Qué se hizo en TecnoBloques** (detalle en «Proyecto hermano» de `CLAUDE.md`):

- **Embeber el simulador solo en desarrollo:** `npm run app:simulador` arma con `--simulador-local` y mete `..\TecnoCircuito\prototipo\dist\tecnocircuito.js`. El build normal y el instalador salen sin simulador, y `empaquetar.js` se niega a empaquetar la copia local.
- **IPC `tb:compilar-hex`:** compila el C++ de los bloques con arduino-cli y devuelve el `.hex`.
- **Pestaña «Circuito»** con el lienzo del proyecto, botón **«Simular»** (en la barra y en la pestaña) y un **monitor pequeño** para ver el LED y escribirle al programa a la vez. El monitor serial de siempre también muestra la simulación.
- **El circuito se guarda en el `.tbq.json`** y vuelve al abrir el proyecto.
- **Revisión del contrato al arrancar:** sin paquete compatible, la pestaña y el botón no aparecen.

**Prueba nueva `npm run test:simulador`: 19 de 19.**

- El ejemplo «Eco serial y LED» se compila, se simula en un Web Worker y responde «Recibí: on», prendiendo el LED del circuito.
- Un programa de bloques con el potenciómetro en A0 y el LED en el pin 9 da PWM al 49,8 % con la perilla en la mitad y al 20,0 % en el 20 %.
- El circuito se guarda en el proyecto y vuelve al abrirlo.
- Un error de C++ se explica en español, y con el Nano la pestaña explica que el simulador solo tiene el Uno.

**Hallazgos:**

- **El serial perdía las tildes** («Recibí» salía «RecibÃ­»). Se corrigió en TecnoCircuito.
- **El monitor estaba en otra pestaña,** así que el aprendiz no podía ver el LED y escribir a la vez. Por eso se agregó el monitor pequeño.
- **Faltan en el contrato `sim.destruir()` y `sim.medidas()`.** Hoy se usan las versiones del prototipo.
- **El panel dejaba el lienzo bajito,** porque los avisos ocultos no ocupan filas de la cuadrícula. Se pasó a una columna flexible.

**Las pruebas de siempre pasan** con el build normal: `npm test`, `test:ui` y `test:app`. La pestaña «Circuito» queda oculta.

**Pendientes:** el registro con el alias de TecnoRuta, `destruir()` y `medidas()` en el contrato, y depender de una versión etiquetada para que el simulador llegue al instalador.

## 2026-10-07 — Contrato 1: medidas(), destruir() y exportarSVG()

Anotado con el mismo título en las dos bitácoras. Lo pidió Efraín al revisar las dos páginas conectadas.

- **Contrato:** TecnoBloques ya usa `sim.medidas()` y `sim.destruir()`. Si el paquete es anterior, sigue con los nombres del prototipo (`_medidas`, `_destruir`).
- **Agrandar el circuito:**
  - un **divisor** entre los bloques y el panel, que se arrastra con el mouse o se mueve con las flechas. El doble clic devuelve el tamaño normal, y el ancho se recuerda en las preferencias (`anchoPanel`);
  - la **vista «Circuito»**, al lado de Bloques, Dividido y C++, deja solo el circuito en toda la ventana. Aparece solo si hay simulador;
  - el botón **«Ampliar» / «Reducir»** en la pestaña Circuito entra y sale de esa vista;
  - en las vistas de solo panel, la pestaña y la vista van juntas: la pestaña C++ pasa a la vista C++, y la pestaña Circuito a la vista Circuito.
- **«Guardar imagen»** en la pestaña Circuito: vista previa del SVG (`lienzo.exportarSVG()`) y descarga de `<proyecto>-circuito.svg`, para la documentación del proyecto o una evidencia en TecnoRuta.
- **Pruebas:** `npm test`, `test:ui` y `test:app` sin errores. `test:simulador` pasa 24 de 24, con 5 comprobaciones nuevas: divisor, «Ampliar», vista C++ y Circuito, «Reducir» con doble clic e imagen.

## 2026-10-07 — Contrato 1: botón, colores y entradas (T1 y T2)

Anotado con el mismo título en las dos bitácoras. El simulador ya tiene completas las tareas T1 (botón y entrada flotante) y T2 (ruido del ADC y entrada analógica al aire).

- **Pieza nueva `pulsador`** en el lienzo («+ Botón»). Se presiona con el mouse mientras se simula.
- **Colores de cable:** 10, en el orden del código de colores, con las teclas 0 a 9.
- **Evento nuevo `boton_pulsado`** (`{ id, ms }`), que llega por el mismo `alEvento` del lienzo.
- **Para TecnoBloques no cambia nada:** guarda el circuito sin interpretarlo y anota los eventos que le lleguen. `test:simulador` pasa 24 de 24 con el paquete nuevo, que ya muestra «+ Botón».

## 2026-10-07 — Contrato 1: protoboard

Anotado con el mismo título en las dos bitácoras. El simulador tiene ahora una media protoboard de 400 puntos (prototipo 4).

- **Cómo funciona:** las piezas se encajan en sus huecos al soltarlas, la tira unida por dentro se ilumina al pasar el mouse, y las piezas encajadas se mueven con la protoboard.
- **Formato:** el circuito trae el campo `protoboard` (`{ tipo: "media", x, y }` o `null`), y cada pieza encajada un campo `en` con qué pata va en qué hueco.
- **El lienzo agrupa las piezas en un menú «+ Agregar».** La prueba `test/simulador.js` ahora agrega el LED con el ítem del menú (`[data-accion="agregar"][data-tipo="led"]`).
- **Para TecnoBloques no cambia nada más:** guarda el circuito sin interpretarlo. `test:simulador` pasa 24 de 24.

## 2026-10-07 — TecnoCircuito publicado

- Efraín dio por validado el prototipo del simulador. El repositorio **https://github.com/EMariotte/TecnoCircuito** quedó público (Apache 2.0), con la historia de los prototipos en sus commits.
- TecnoBloques sigue usando la copia local con `npm run app:simulador`. **Falta** la primera etiqueta de TecnoCircuito con `dist/tecnocircuito.js` para depender de ella y llevar el simulador al instalador.

## 2026-10-07 — Contrato 1: marca en la imagen del circuito

- TecnoCircuito agrega a `lienzo.exportarSVG()` la marca «Hecho con TecnoCircuito · SENA – TecnoAcademia Tolima», abajo a la derecha y sin tapar el circuito. La API no cambia, así que en TecnoBloques no hubo que tocar código: la vista previa de «Guardar imagen» ya la muestra.

## 2026-10-08 — Contrato 1: «Llevar a KiCad»

- TecnoCircuito agrega `lienzo.exportarNetlist({ nombre })`: el circuito como netlist de KiCad. Lleva las piezas con su huella y sus conexiones; la protoboard y los cables no van, porque ya son conexiones.
- En la pestaña Circuito, el botón **«Llevar a KiCad»** abre la ventana de exportar (Copiar y Descargar `<proyecto>-circuito.net`), con la explicación para el aprendiz: en KiCad, editor de placas → Archivo → Importar → Netlist.
- Si el simulador embebido no trae la función, avisa en vez de fallar.
- `test:simulador`: un paso nuevo (4d), que pasa.

## 2026-10-08 — Contrato 1: el esquema del circuito y las fixtures

- TecnoCircuito publica `contrato/circuito.schema.json` (JSON Schema 2020-12). Es la fuente de los pines de cada pieza, los colores y los huecos de la protoboard. **No cambia el formato:** escribe las reglas que ya había, y es tolerante con piezas y campos nuevos.
- TecnoCircuito ya trae las fixtures de aquí (`npm run fixtures`: los 16 casos de `test/salida/`, de la 0.2.5). Allá, los 13 `.hex` del Uno y del Nano corren en el chip simulado y el eco responde.
- **Pendiente aquí:** un caso de prueba con `circuito` (por ejemplo, la T1 en protoboard). Ninguna fixture lo trae, porque se generaron antes del simulador.

## 2026-10-08 — Contrato 1: la prueba con circuito en los dos proyectos

- **Caso nuevo `t1_protoboard`** (`test/prueba.py`): el programa de bloques «escribir en el pin 13 lo que lee el pin 2», con la T1 armada en la protoboard en el campo `circuito` (`test/circuitos/t1_protoboard.json`). Compila en el Uno (`npm run compilar`). TecnoCircuito lo trae como fixture y lo corre con su circuito: el LED sigue al botón.
- **`test:simulador`** revisa el circuito que guarda la app con el revisor de TecnoCircuito (`contrato/circuito.schema.json` más las referencias). Si falta la carpeta hermana, se salta.
- **«Llevar a KiCad»:** el texto explica que el proyecto se crea desde la plantilla «Arduino Uno Shield» de KiCad. La netlist ahora lleva los conectores J1–J4 de esa plantilla, así que las piezas ya no se solapan con el Uno.

## 2026-10-08 — Validación humana del flujo completo (Efraín)

Efraín llevó un proyecto **desde cero** por todo el camino, en la app de escritorio (`npm run app:simulador`), y lo aprobó:

1. armó el programa con bloques y conectó los componentes en el simulador;
2. lo simuló, y funcionó;
3. exportó el circuito como imagen SVG y como netlist;
4. creó el proyecto en KiCad 10 desde la plantilla «Arduino Uno Shield» e importó la netlist: **KiCad la aceptó y el DRC no vio inconvenientes**;
5. guardó el proyecto como `.tbq.json` y lo volvió a abrir desde la app, con los bloques y el circuito conectado.

Con esto, el flujo del aula queda probado de punta a punta:

```
bloques → simulación → imagen SVG (evidencia) → netlist → placa en KiCad
```

## 2026-10-08 — Contrato 1: servo y energía del USB

- TecnoCircuito agrega la pieza Tecno **`servo`** (`GND`, `VCC`, `SIG`; `modelo` sg90 o mg90s) y la no idealidad **`limiteUSB`**: el 5V baja con la corriente, un golpe de corriente reinicia la placa y más de 500 mA sostenidos abren el fusible y la apagan.
- Fallas nuevas por `alEvento`: `servo_alimentacion`, `reinicio_usb` y `fusible_usb`. El evento `reinicio_placa` empieza a emitirse (motivo `boton` o `energia_usb`) y sirve para el registro del estudio.
- Aquí no hubo que cambiar código: «Simular» con modo realista ya pasa la clave nueva, y el panel muestra las fallas como las demás. Para usar el servo en un programa de bloques se usan los bloques de servo que ya existen (librería Servo).

## 2026-10-08 — Validación humana del servo y de la energía del USB (Efraín)

- Efraín probó en la app de escritorio los **dos modelos, SG90 y MG90S**, y escribió **dos programas propios** para validar cada situación descrita: el servo siguiendo al programa y los errores y límites de energía. **Aprobado:** «realmente funciona».
- Siguen pendientes las medidas con hardware para ajustar los valores de partida: la corriente de cada servo, el 5V con servos y con cuántos servos se reinicia el Uno en el PC del aula (`prototipo/LEEME.md`, «Validar el servo y la energía del USB»).

**Cierre de la sesión del 8 oct:**
1. explicación e implementación de la netlist de KiCad, y el arreglo del solape con la plantilla «Arduino Uno Shield»;
2. esquema del circuito y fixtures, con la prueba del contrato en los dos proyectos;
3. validación humana del flujo completo, de bloques a KiCad;
4. servo SG90/MG90S como pieza Tecno y energía del USB, también validados.

Lo siguiente: la shield L293D y el motor DC (T3).

## 2026-10-09 — Ejemplos de validación con la placa real

- **El grupo nuevo «Validación con la placa real (instructor)»** está en Ejemplos, con su propio título en la lista. Sus ejemplos traen el **C++ exacto** que se probó en TecnoCircuito y **su circuito armado**. Así se simula con «Simular» y se sube a la placa con «Subir a la placa», sin cambiar nada:
  - ruido de `analogRead()`;
  - entrada al aire;
  - servo a 0°, 90° y 180°;
  - servo en barrido continuo;
  - cuatro servos en el USB;
  - seis servos en el USB.
- **`cargarEjemplo`** acepta ahora `texto` (se abre en modo C++) y `circuito` (va a `extrasProyecto.circuito`, y el lienzo lo dibuja).
- **`test:simulador`, paso 4e:** abre el ejemplo del servo, revisa su C++, su circuito y el título del grupo, y lo simula. Son 28 de 28. `npm test` y `test:ui` también pasan.
- Con estos ejemplos, Efraín validó el 9 oct en el laboratorio el ruido del ADC, la entrada al aire y el servo (ver la bitácora de TecnoCircuito).
- **Pedidos de Efraín durante la validación** (Fase 2d): exportar el monitor serial a CSV y un graficador serial con casillas por variable.

## 2026-10-10 — Contrato 1: sim.mediciones() y el panel de mediciones

- **Con el circuito ampliado,** la pestaña Circuito muestra a la derecha el panel **«Mediciones»**: cada pieza con su voltaje y su corriente y, debajo, el detalle (PWM, brillo, ángulo del servo, pulso, USB). Es la misma tabla que la página de prueba de TecnoCircuito: la arma `TecnoCircuito.filasDeMediciones(sim.mediciones())`, que entró al contrato 1.
- Se pinta cada 250 ms y solo con el circuito ampliado. Sin simular, explica «Pulsa Simular para ver el voltaje y la corriente de cada pieza».
- **`test:simulador`:** con el ejemplo del servo ampliado, el panel muestra el pin 9 («señal de servo: pulso de 1471 µs») y el servo, y en la vista dividida no aparece.

- **Validación humana (Efraín, 10 oct):** creó un proyecto nuevo en TecnoBloques, conectó un LED con su resistencia, usó el ejemplo de encendido por el monitor serial y, al simular con el circuito ampliado, vio cambiar las mediciones en el panel. Aprobado.

## 2026-10-10 — Ejemplo «Validar: carro con la shield L293D»

- TecnoCircuito ya tiene la shield L293D, el motor TT y la batería LiPo 2S como piezas Tecno (contrato 1: piezas `shield_l293d`, `motor_tt` y `bateria_lipo`, y la no idealidad `caidaL293D` funcionando). Aparecen en «+ Agregar» del lienzo sin cambios en TecnoBloques.
- Ejemplo nuevo en el grupo de validación: el carro con la shield (motores en M1 y M4, la LiPo en EXT_PWR) y el programa de AFMotor_R4 que los mueve adelante, quietos y atrás. Sirve para medir en el laboratorio la caída del L293D y el sentido de cada rueda.
- `test:simulador`: 28 de 28 con el simulador local.

## 2026-10-10 — La lista de ejemplos se desplaza

- **Pedido de Efraín:** con los ejemplos de validación, la lista de «Ejemplos» pasaba del borde de la ventana y no se llegaba a los últimos, como «Validar: carro con la shield L293D».
- **Arreglo:** la lista llega hasta el borde inferior y se desplaza por dentro, con su barra.
- **`test:simulador`:** comprueba que cabe en la ventana y que llega al último ejemplo.
- **Simulador:** el programa de bloques de Efraín con los motores sin pausa iba al 28–40 %. El arreglo está en TecnoCircuito (núcleo casi 6 veces más rápido con ese programa) y llega a la app con el simulador local.

## 2026-10-10 — El lienzo trae la biblioteca de piezas y la ficha (TecnoCircuito)

- «+ Agregar» abre ahora un panel con las piezas por categoría, sus dibujos y un buscador; las piezas se pueden arrastrar al lienzo. Al elegir una pieza aparece su ficha (para qué sirve, propiedades, datos, pines y si su modelo se probó con la placa real). En la vista dividida la ficha empieza plegada, con solo las propiedades.
- No hubo que cambiar nada en TecnoBloques: la API del lienzo es la misma. `test:simulador` pasa con el simulador local.

## 2026-10-10 — Contrato 1: cable de balance y probador de celdas

- TecnoCircuito agrega al contrato:
  - el cable de balance de `bateria_lipo` (`BAL0`, `BAL1`, `BAL2`) y la carga `desbalanceada`;
  - la pieza `probador_lipo` (`NEG`, `C1` a `C8`; `umbral`);
  - las fallas `bateria_desbalanceada` y `probador_alarma`;
  - `probadores` en `mediciones()`.
- Ejemplo nuevo en el grupo de validación: «Validar: probador de celdas LiPo», para comparar su pantalla con la del real en el laboratorio.
- `test:simulador` y `npm test`: todo bien con el simulador local.

## 2026-10-10 — Monitor de la simulación y mediciones se pueden ocultar

- **Pedido de Efraín:** tener todo el espacio para el circuito mientras se arma el diseño.
- **Monitor serial de la simulación:** tiene un título y, arriba a la derecha, el botón «Ocultar ▾» / «Mostrar ▴». Recogido queda solo esa franja, y un punto verde avisa si llegó texto nuevo.
- **Panel «Mediciones»:** con el circuito ampliado, su botón «Ocultar ▸» lo deja como una franja angosta con «◂ Mediciones» de pie. Recogido no se repinta la tabla.
- **Los dos estados se guardan** en las preferencias (`serialSimPlegado`, `medicionesPlegado`) y se recuerdan al volver a abrir la app.
- **`test:simulador`:** al recogerlos, el lienzo gana espacio (de 1029×423 a 1307×575 px); el punto avisa el texto nuevo, y al mostrarlos todo vuelve como estaba. 33 de 33.

## 2026-10-11 — Fase 2d: el monitor serial para analizar (CSV y gráfico)

**Pedido de Efraín** (9 oct, durante la validación del ADC): exportar el monitor serial a CSV y un graficador con casillas por variable. **Decisiones:** el CSV con «;» y coma decimal (se abre directo en Excel en español) y el gráfico solo en la pestaña Monitor serial.

- **`src/graficador.js`** (nuevo, entra al armado antes de `app.js`):
  - **Registro:** cada línea que llega, de la placa o del simulador, con su hora y sus números.
    - Entiende `temp:25 luz:512`, `temp=25`, `Temperatura: 25.3 C`, `min 430 max 431` y números sueltos (`valor1`, `valor2`…).
    - Un `nan` queda como hueco.
    - Con la placa, la hora son los ms desde que se conectó; en el simulador, el tiempo simulado. Al reconectar o simular de nuevo, el tiempo sigue.
    - Guarda hasta 20 000 líneas; «Limpiar» lo vacía.
  - **CSV:** `t_ms;origen;linea;<una columna por etiqueta>`, con coma decimal, comillas escapadas y marca UTF-8. Botón «Exportar CSV», con el diálogo de guardar de siempre.
  - **Gráfico:** «Texto | Gráfico» en la pestaña del monitor.
    - Canvas sin librerías y una línea de 2 px por variable.
    - 8 colores en orden fijo, validados para daltonismo en modo claro y oscuro contra el fondo de la app.
    - Casillas para mostrar u ocultar cada variable; pausar mientras el registro sigue.
    - Ventana de 5 a 60 s y escala automática, 0–1023 o 0–5 V.
    - Etiqueta con el último valor al final de cada línea, y línea vertical con valores al pasar el mouse.
    - Solo se dibuja mientras está a la vista y cuando llega algo nuevo.
- **Pruebas:**
  - `npm run test:graficador` (Node, 22): los formatos, las líneas en trozos, el `\r\n` partido, el tiempo que sigue, el CSV y el límite;
  - `test:simulador` (37 de 37): con «Validar: ruido de analogRead()», el gráfico muestra min, max, promedio y desviacion, una casilla oculta su variable, la pausa congela el gráfico y el CSV sale como se espera;
  - `npm test`: todo bien.

## 2026-10-11 — Revisión de código del graficador y el instalador exige una etiqueta fija

- **`/code-review` del graficador y los paneles plegables (10 hallazgos, todos corregidos):**
  - **El más serio:** un número enorme (`1e17`, o un número largo impreso como dígitos) congelaba la app al calcular las marcas del eje. Ahora el paso nunca es cero y hay un tope de 50 marcas.
  - **Etiquetas:** «Lectura 1: 512» o «12:30» ya no crean una columna por lectura (una etiqueta debe empezar con letra) y hay un tope de 40 columnas.
  - **El gráfico** no se dibuja cuando no está a la vista.
  - **Las casillas** no se rehacen al marcarlas (no pierden el foco del teclado).
  - **El CSV:** las líneas que empiezan con `= + - @` llevan un apóstrofo, así Excel no las toma como fórmula.
  - **La placa y el simulador**, que usan relojes distintos, ya no se cortan entre sí en el gráfico ni en la pausa.
  - **El nombre del CSV** lleva la fecha local.
  - **Menos trabajo:** un repintado por evento y el recorte del registro por bloques.
  - **Pendiente, con nota:** una sola lógica de fin de línea para el monitor, el registro y el monitor del simulador.
- **`escritorio/empaquetar.js`:** si el HTML trae el simulador instalado, exige que `package.json` diga `github:EMariotte/TecnoCircuito#vX.Y.Z` con esa misma versión instalada. Probado en los tres casos: un paquete armado a mano se rechaza, sin simulador se acepta y la copia local se rechaza.
- **La publicación de TecnoCircuito v0.1.0 está preparada** (sin etiquetar): con la etiqueta, en `package.json` va `"tecnocircuito": "github:EMariotte/TecnoCircuito#v0.1.0"` y se corre `npm install`. Probado con un paquete local: la app usa el simulador «etiqueta» 0.1.0 y simula el carro.
- `npm run test:graficador` (28), `test:simulador` (37) y `npm test`: todo bien.

## 2026-10-11 — R8 de la revisión de Codex: `npm test` falla ante errores, y `sprites.svg`

Autor: Claude. Revisión de partida: `171d76a`. Lo verifica Codex.

- **El problema (R8):** `npm test` terminaba en 0 aunque `prueba.py` imprimía `Failed to load resource: net::ERR_FILE_NOT_FOUND`, y `prueba_todo.py` filtraba los mensajes con `ERR_`.
- **Las pruebas:** `test/prueba.py` y `test/prueba_todo.py` registran también los archivos locales que no cargan (`requestfailed`, solo `file:`, para que la falta de internet no tumbe la prueba). Con cualquier error salen con 1. `prueba_todo.py` ya no filtra `ERR_`. Comprobado: con el archivo faltante, `npm test` dio 1.
- **El archivo faltante era `tbmedia/sprites.svg`:** los estilos de Blockly lo piden por ruta (las flechas de las categorías), e `inject` ya pide los fondos al medir el texto. Ahora `iniciar()` pone los estilos con `Blockly.Css.inject` antes del `inject` y `reemplazarMediaCss()` cambia sus rutas `tbmedia/…` por las imágenes de `TB_MEDIA`. `build.js` también embebe los cursores `.cur` (arrastrar y borrar), que los estilos piden igual.
- **Contrato (TecnoCircuito, 11 oct):** falla nueva `corriente_chip`, dentro de `limitePin`. TecnoBloques solo muestra el `mensaje`: no hubo que cambiar nada. Anotado en «Proyecto hermano».
- `npm test` sin errores (exit 0), `test:simulador` 37 de 37 y `test:graficador`: todo bien.

## 2026-10-11 — Contrato: el registro de eventos queda aprobado (sección 6.1 de TecnoCircuito)

Decisiones de Efraín, para implementar en la próxima sesión. La fuente es `..\TecnoCircuito\CONTRATO.md`, sección 6.1.

- **A TecnoBloques le toca:**
  - una opción del instructor, por PC, para encender el registro (**apagado por defecto**), y un aviso en pantalla cuando está encendido;
  - el **código del equipo** al abrir la app, con confirmación (sin datos de los aprendices; reemplaza al `alias`);
  - el sobre: `equipo`, `sesion`, `version_tb` y `version_tc`;
  - los eventos del editor: `sesion_iniciada`, `proyecto_abierto`/`ejemplo_cargado`, `bloques_cambiados` (resumen), `codigo_compilado` (con el C++ sin comentarios), `programa_subido` y `sesion_terminada`;
  - el IPC `tb:registrar`, que agrega cada línea a `registros\<equipo>-<fecha>.jsonl`;
  - «Exportar registros», solo para el instructor.
- **Quitar comentarios del C++:** `//` y `/* */`, respetando comillas y escapes, con pruebas.
- **No se registra** el monitor serial.


## 2026-10-11 — Codex: Contrato 1: Nano + expansión E/S

Efraín autorizó a Codex el desarrollo, pruebas y revisión del Nano clásico con expansión roja/azul. Revisión de partida TecnoBloques `07cc3dd`; TecnoCircuito `30ecd7d`. Se mantiene contrato/formato 1; alcance y reglas en `../TecnoCircuito/CONTRATO.md`, sección 4.2. La asignación anterior Codex revisor/Claude implementador queda como historia.

- App: guarda el Nano con expansión inicial sin necesitar edición; conserva el montaje incompatible al cambiar de placa y permite volver a su placa original. Uno nuevo mantiene su circuito vacío.
- Ejemplo de validación `val_nano_adc67`: C++ y dos potenciómetros en A6/A7 de la expansión, bajo el grupo existente. A6/A7 solo ADC; no se crean salidas digitales ni un segundo chip.
- Prueba Electron/Arduino CLI ampliada: **51 OK, cero errores JS**. Ambos FQBN, Worker, lecturas iniciales y tras cambiar perilla, azul, reapertura, cables, campos desconocidos, SVG/netlist y Mega deshabilitada. Graficador **28 OK**. `npm test`: exit 0, ambos scripts con `ERRORES` vacío.
- KiCad del hermano usa el exportador actualizado: módulo Nano de 30 pads + regulación/filtro, jack, I2C/SPI de referencia. Componentes y aislamiento pendientes de confirmar; no se fabrica una tarjeta a partir de las fotos.
- Se actualiza «Proyecto hermano» de CLAUDE.md. La verificación física y la primera publicación siguen pendientes. No se cambió la dependencia instalada ni se hizo commit, push, etiqueta o instalador.


## 2026-10-11 — Codex: validación manual de Nano por Efraín y autorización de entrega

Efraín abrió la app con `npm run app:simulador`, confirmó que aparece el Nano y que el programa lee de manera independiente los dos potenciómetros en A6 y A7. Validación manual del recorrido de software; sin mediciones físicas nuevas. Después autorizó commit y push de la implementación en TecnoBloques y TecnoCircuito. Se conserva la evidencia automática de 51 comprobaciones de integración, 28 del graficador y las pruebas generales sin errores, junto con las 945 del simulador. Se actualiza «Proyecto hermano»; no se crea etiqueta, instalador ni se cambia la dependencia instalada.


## 2026-10-11 — Codex: Contrato 1: I2C junto a UART y seis salidas de alimentación

Efraín corrigió la posición de I2C y confirmó que el bloque de seis contactos de la expansión es alimentación duplicada GND/3V3/5V, no SPI. TecnoCircuito corrige la vista y el modelo; 82 contactos físicos, tres IDs secundarios nuevos y seis aliases SPI heredados que conservan cables/redes sobre los pines del Nano. El header SPI de KiCad es un conector añadido al diseño de referencia. Contrato/formato 1 conservados; contrato4.2/esquema y «Proyecto hermano» actualizados. Bundle local reconstruido con `node build.js --simulador-local`; no cambia el código de la app. Pruebas dirigidas del simulador: 595 OK, cero fallas; la integración Electron de 51 comprobaciones corresponde a la entrega anterior. Continuidad y medidas físicas pendientes. Sin commit, push o etiqueta de esta corrección.


### 2026-10-11 — Codex: autorización de entrega y cierre de sesión

Efraín autorizó commit y push de la corrección de Nano + expansión en ambos proyectos: I2C junto a UART y seis contactos de alimentación duplicada GND/3V3/5V. TecnoCircuito registra 595 comprobaciones dirigidas aprobadas, cero fallas. En TecnoBloques se entrega la documentación compartida; el bundle local ya se reconstruyó. La integración Electron previa conserva su evidencia fechada.

La próxima sesión retomará los ajustes de Nano + expansión según la prioridad de Efraín. Continuidad, identificación y mediciones de las tarjetas reales pendientes. Sin etiqueta ni instalador.


## 2026-10-12 — Claude: cambiar de placa ya no deja el circuito sin lienzo

En la revisión del Nano de Codex (pedida por Efraín) se encontró que cambiar de placa podía dejar al aprendiz sin lienzo. Un proyecto nuevo pasa a Nano (trae su expansión) y vuelve a Uno → «No se pudo abrir el circuito: Expansión E/S del Nano no se monta en Arduino Uno», sin forma de arreglarlo. TecnoCircuito ahora quita al abrir lo que no va en la placa (pieza montada de otra placa, cables a pines que no tiene) y lo avisa en la barra del lienzo (nota en su CONTRATO, API del lienzo; contrato y formato 1 sin cambios).

- `abrirLienzo()` no sobrescribe `extrasProyecto.circuito` si el lienzo trae menos piezas o cables que lo guardado: volver a la placa original recupera el montaje completo hasta que el aprendiz edite.
- `test/simulador.js`: la prueba del GND3 ahora comprueba que el lienzo abre, quita el cable, lo avisa y conserva el original; nueva prueba de proyecto nuevo Nano → Uno. `test:simulador` **52 OK**, sin errores de JavaScript; `npm test` exit 0 con `ERRORES` vacío.
- En el simulador, en la misma entrega: VIN y el jack del Nano sin entrada ya no son un corto a GND escondido, y el modo realista del Nano corre a la par del Uno (caché del circuito; COMO-FUNCIONA de TecnoCircuito, sección 60). Suite del simulador: 972 OK, cero fallas.
- Se actualiza «Proyecto hermano» de CLAUDE.md. Sin commit ni push.


## 2026-10-12 — Claude: contrato 4.2, diagnósticos del Nano

Cambio del contrato en TecnoCircuito (aprobado por Efraín): el simulador ya no emite la falla `nano_referencia` en cada corrida del Nano (salía como aviso emergente en `fallasSim` y habría llegado a `simulacion_detenida` del registro de eventos), y `reinicio_placa` con `motivo: 'energia_nano'` solo se emite cuando el 5V cae por lo que pide el circuito; quitar la fuente a mano (Desconectada) reinicia el programa sin ese evento, porque el lienzo ya lo registra como `componente_cambiado`. TecnoBloques no necesita cambios de código: muestra las fallas que llegan. Se actualiza «Proyecto hermano».


## 2026-10-12 — Claude: el conjunto Nano por defecto no se conserva al volver a Uno

Tras la revisión independiente del día, `abrirLienzo()` no conserva lo guardado si es solo la expansión que el Nano trae por defecto (sin cables ni otras piezas): no hay montaje que recuperar. Antes, un proyecto nuevo que pasaba por Nano y volvía a Uno guardaba la expansión y repetía el aviso «Se quitó…» cada vez que se abría. Los montajes reales (por ejemplo, Uno con un cable a GND3) se siguen conservando. `test:simulador` **52 OK** (la prueba de proyecto nuevo Nano → Uno ahora también revisa lo guardado).


## 2026-10-12 — Claude: contrato 1, `en` enchufa patas en pines (imán entre pines)

Cambio del contrato en TecnoCircuito, decidido por Efraín: el campo `en` de un componente también puede enchufar una pata en el pin de otra pieza o de la placa (`{ "<pata>": "<id>.<pin>" }`), sin protoboard ni cables. Ejemplos: el probador en el balance de la LiPo, el servo en SERVO_1/2 de la shield, un LED en D13 y GND. TecnoBloques no necesita cambios de código: guarda el circuito tal como lo entrega el lienzo y el evento `componente_cambiado` ya lleva `en`, así que el registro del estudio sabrá quién conectó directo. Se actualiza «Proyecto hermano». Detalle en COMO-FUNCIONA de TecnoCircuito, sección 61.


## 2026-10-12 — Claude: cambiar de placa también cuenta las patas enchufadas

Tras la revisión independiente del imán entre pines: `abrirLienzo()` considera «recortado» un circuito si el lienzo trae menos patas enchufadas (`en`) que lo guardado. Ejemplo: un LED enchufado en GND3 pierde esa pata al pasar al Nano y la recupera al volver al Uno. `test:simulador` **53 OK**.

## 2026-10-14 — Claude: contrato 1, vistas medidas de TecnoCircuito y el bloque de seis de la expansión

TecnoCircuito integró los dibujos de TecnoDiseñador: el Uno pasa a ser una Pieza Tecno (los mismos 31 pines) y el Nano y la expansión usan dibujos medidos. La medición mostró que el bloque de seis contactos de la expansión son tres 3V3 y tres GND, sin 5V. Por decisión de Efraín, el contrato sigue a la placa: entran `OUT_3V3_3` y `GND_OUT_3`, y `OUT_5V`/`OUT_5V_2` quedan como aliases del 5V del Nano. Ningún proyecto guardado cambia de red; una pata enchufada con el imán en `OUT_5V` se suelta al abrir, con aviso.

- `test/simulador.js`: el LED «L» ya no se lee en `wokwi-arduino-uno.led13`, sino en `.tc-placa [data-led="L"][data-encendido]`.
- «Proyecto hermano» actualizado. Detalle técnico en TecnoCircuito: COMO-FUNCIONA, sección 62.

## 2026-10-14 — Nota del contrato: headers analógicos de la shield L293D (Claude, desde TecnoDiseñador, con Efraín)

En TecnoCircuito, `CONTRATO.md` suma una nota de **pendiente**, sin cambio de formato: por decisión de Efraín, los headers +5 / Gnd / A0-5 de la shield L293D deben poder cablearse. Los nombres los define TecnoCircuito (propuesta: `A0_S`…`A5_G`). Además, la vista medida de la shield, entregada por TecnoDiseñador, tiene prioridad sobre el dibujo anterior. TecnoBloques no cambia. Se actualiza «Proyecto hermano».

## 2026-10-14 — Claude: contrato 1, la shield L293D medida y sus headers analógicos

TecnoCircuito integró la shield L293D medida por TecnoDiseñador (decisión de Efraín: la vista medida manda).
- **Contrato:** la shield pasa de 18 a 36 contactos. Entran los headers +5 / Gnd / A0-5: `A0_S` … `A5_S` (A0 a A5 del Uno), `A0_V` … `A5_V` (5V) y `A0_G` … `A5_G` (GND).
- **Pines tapados:** con la shield montada, SCL, SDA e IOREF del Uno quedan tapados (no se cablean ni reciben patas). Un cable que ya llegaba ahí se conserva.
- **Lo demás no cambia de red:** los servos ahora se dibujan como en la placa (SERVO_1 arriba, pines − + S), pero siguen en los pines 10 y 9.
- `src/app.js`: los dos dobleces del ejemplo «Validar: carro con la shield L293D» quedan bajo EXT_PWR, que se corrió 2,6 mm.
- «Proyecto hermano» actualizado. Detalle técnico en TecnoCircuito: COMO-FUNCIONA, sección 64.

## 2026-10-16 — Nota del contrato: no idealidad `resistenciaBateria` (Claude, desde TecnoCircuito, con Efraín)

En TecnoCircuito, el laboratorio del 15 oct midió la LiPo del kit (1,2 Ω de resistencia interna) y la caída del L293D (1,3 V + 1 V/A). Por decisión de Efraín, la resistencia de la batería es una no idealidad nueva, `resistenciaBateria` (CONTRATO, secciones 7 y 10). Agregar una clave no rompe nada: el modo «realista» la enciende. **TecnoBloques no cambia de código:** crea el simulador con `modo: 'realista'` y no ajusta claves sueltas. `test:simulador`: 53 OK con el simulador local. Se actualiza «Proyecto hermano».

## 2026-10-16 — Claude: TecnoCircuito v0.1.0 y TecnoBloques 0.3.0 con el simulador

Por pedido de Efraín, antes de dos días solo de software:
- TecnoCircuito etiquetó **`v0.1.0`** (contrato 1), con `dist/tecnocircuito.js` construido y revisado por `npm run preparar-version`.
- `package.json`: `"tecnocircuito": "github:EMariotte/TecnoCircuito#v0.1.0"` en `dependencies`, y la versión sube a **0.3.0** (el simulador llega al instalador).
- Pruebas: `npm test` (ERRORES vacíos), `npm run test:simulador` (53 OK) y `npm run test:app` (ERRORES vacíos).
- `npm run instalador`: `TecnoBloques-Setup-0.3.0.exe` (176 MB). `test/app-empaquetada.js` compila sin errores; la app trae `TB_SIMULADOR_ORIGEN = "etiqueta"` y el simulador 0.1.0.
- **El Release no se publicó**: las apps del aula se actualizan solas desde GitHub Releases. Falta el sí de Efraín.
- Pendientes de T3 conocidos en esta versión (en TecnoCircuito, `validacion/2026-10-16-polaridad-bloqueo-servos-uno.md`): el simulador predice reinicio con 5 SG90 y el Uno real no se reinicia; la polaridad de M1 en el dibujo de la shield.

## 2026-10-16 — Registro de eventos por equipo (fase 3 del plan; Efraín, con Claude)

**Contrato con TecnoCircuito, sección 6.1** (decisiones del 11 y del 16 oct, anotadas allá): el registro identifica al **equipo** con un código, nunca al aprendiz; la `corrida` la cuenta TecnoCircuito por sesión; `proyecto_abierto` va **sin el nombre** del proyecto; el código del equipo se limpia para el nombre del archivo; la opción del instructor se abre con atajo y PIN. TecnoCircuito ya emite `v`, `corrida`, `ms_sim`, el circuito completo y las fallas de cada corrida, `simulacion_pausada` y `simulacion_reanudada` (commit `6170f0e`), y publicó el esquema `contrato/evento.schema.json`.

- **Apagado por defecto.** Ctrl+Alt+Mayús+R abre la opción del instructor. La primera vez se crea un PIN (4 a 8 dígitos; se guarda solo su resumen scrypt con sal; 5 intentos fallidos = 1 minuto de espera). Desde ahí se enciende o apaga, se exportan los `.jsonl` a una carpeta nueva (por ejemplo, en la USB) y se cambia el PIN.
- **Encendido:** al abrir se pide el código del equipo con confirmación («¿Son el equipo A7?», con «Corregir»), y abajo a la izquierda aparece «Esta sesión se registra · Equipo A7»; con un clic se cambia de equipo (cierra la sesión anterior). Sin código no se escribe nada.
- `src/registro.js` (nuevo, también en Node): `quitarComentarios` (respeta textos entre comillas, escapes, caracteres y R"(…)"; conserva el número de líneas), `codigoParaArchivo`, `resumenBloques` y `crearRegistroEventos`, que pone el sobre (`v`, `equipo`, `sesion`, `version_tb`, `version_tc`). Se llama así porque `graficador.js` ya tiene `crearRegistro`.
- `escritorio/registro-disco.js` (nuevo): configuración del instructor y escritura. El proceso principal escribe solo si el registro está encendido, y un código como `..\x` no sale de `registros\`. `tb:registrar` va por `send`, para que `sesion_terminada` llegue al cerrar la ventana. En `main.js` la instancia se llama `registroEventos`, porque `registro()` ya era el registro de la actualización.
- Eventos del editor: `sesion_iniciada`, `ejemplo_cargado`, `proyecto_abierto`, `bloques_cambiados` (3 s después del último cambio), `codigo_compilado` (al simular y al subir, con el tipo de error y `bytes`; `leerMemoria` ahora también los lee), `programa_subido` y `sesion_terminada`. Los del lienzo y del simulador pasan por `registrarEventoSim`.
- `package.json`: los dos archivos nuevos entran al instalador; scripts `test:registro` y `test:registro-app`.

**Pruebas:** `test:registro` **58 OK** (las líneas se revisan con el revisor de TecnoCircuito contra el esquema); `test:registro-app` **33 OK** (Electron de punta a punta: PIN, equipo, ejemplo, bloques, simular, cerrar, abrir de nuevo, apagar; las 7 líneas cumplen el esquema y el nombre del proyecto no aparece); `test:simulador` **53 OK**; `test:app` y `npm test` sin errores. Falta la prueba de Efraín en la app y con aprendices (fase 4).

## 2026-10-16 — Registro de eventos: F12 solo para el instructor (Efraín, con Claude)

Va en el mismo commit `4d428b9` que la entrada anterior, que no lo menciona:
- **F12 (pedido de Efraín):** con las herramientas de desarrollo se podía apagar el registro desde la consola. En la app instalada, F12 solo las abre después de que el instructor entra con su PIN en esa sesión, y si se abren por otro camino se cierran solas. En desarrollo siguen libres (`TB_HERRAMIENTAS=instructor` hace que se comporten como en la instalada; la variable solo restringe).
- Efraín aprobó las decisiones de la interfaz: sin código del equipo no se insiste ni se registra; el PIN se guarda solo como resumen; en un PC compartido, el clic en el aviso cambia de equipo.
- `test:registro-app` pasa a **36 OK** (no 33): suma F12 sin PIN, F12 abierto por otro camino y F12 con PIN.

## 2026-10-17 — Codex (Sol): aviso de auditoría preparado para Claude Code

Efraín pidió documentar y notificar los resultados de la auditoría al agente programador Claude, que trabaja en VS Code. Se dejó un aviso al inicio de CLAUDE.md con el [traspaso](../TecnoCircuito/docs/TRASPASO-CLAUDE-AUDITORIA-2026-10-17.md) y el [informe](../TecnoCircuito/docs/AUDITORIA-CODEX-2026-10-17.md). **Es una comunicación por archivos compartidos: no consta envío directo a la conversación de VS Code ni acuse de recibo.**

Prioridades para el traspaso: AUD-01, AUD-02 y AUD-04 (altos, registro de TecnoBloques); coordinar AUD-03 (medio, protocolo de eventos de TecnoCircuito). Nano/AUD-05 conserva su asignación a Codex. Antes de editar, acordar IDs y archivos para evitar trabajo simultáneo. El implementador devuelve correcciones con regresiones y Codex verifica el cierre; los cinco hallazgos siguen abiertos.

Referencias auditadas: TecnoBloques `5b6d37a1f4b65474ec52a162fb5c3c330bc48445` y TecnoCircuito `390ef34a119df754a06ff35c96e2286800819f21`. Esta entrada solo documenta el traspaso; no añade pruebas, correcciones funcionales, medidas ni autorización de commit, push o publicación.

## 2026-10-17 — Codex (Sol): contrato permanente entre agentes por pedido de Efraín

Efraín pidió formalizar roles y comunicación por .md para que ambos agentes lo lean al iniciar sesión y le adviertan si se omite un paso. Fuente única: [CONTRATO-COORDINACION-AGENTES.md](../TecnoCircuito/docs/CONTRATO-COORDINACION-AGENTES.md), versión 1. Se enlaza desde CLAUDE.md y el nuevo AGENTS.md de TecnoBloques, y desde los archivos de inicio de TecnoCircuito.

Canales por remitente: [Codex para Claude](../TecnoCircuito/coordinacion/CODEX-A-CLAUDE.md) y [Claude para Codex](../TecnoCircuito/coordinacion/CLAUDE-A-CODEX.md). Codex publicó COD-20261017-001 con el acuerdo y el traspaso de auditoría. **No hay acuse de Claude ni mensaje escrito en su nombre.** Cada agente añade entradas solo en su canal; publicar no ejecuta al receptor. Se conservan Claude como programador de sus tareas asignadas y Codex como auditor/supervisor e implementador Nano, salvo reasignación expresa de Efraín.

El acuerdo obliga a señalar pasos omitidos con evidencia y solución, sin pedir autorizaciones repetidas ni bloquear trabajo independiente. Distingue corregido/verificado y software/hardware; respeta decisiones y excepciones de Efraín. Solo documentación: sin pruebas funcionales nuevas, correcciones, commit, push ni publicación.

## 2026-10-17 — Codex (Sol): piloto completo de trabajo en la suite Tecno

Efraín autorizó aplicar el piloto a **todo TecnoBloques y TecnoCircuito**, con investigación paralela y registro a cargo de Codex; TecnoRuta queda previsto. Se preparó el repositorio local [TecnoSuite](../TecnoSuite/README.md), sin commit ni remoto, como coordinación neutral de los productos. Su [acuerdo v2](../TecnoSuite/PROCESO.md) sustituye operativamente v1, cuyo texto íntegro se conserva en docs de TecnoCircuito. El contrato de software no cambia.

Se actualizaron AGENTS.md, CLAUDE.md y README.md de ambos productos; metodología/contrato/canales locales dirigen al proceso común. Fichas únicas y tablero generado abarcan los cinco hallazgos, fases del registro, laboratorio Nano/T3, UX, distribución, evolución e incorporación futura. Codex mantiene la investigación y sesiones observadas; no se inventan tiempos ni acuses. Canales vigentes desde COD-20261017-002; no consta lectura de Claude.

Se conciliaron descripciones vencidas de etiqueta/instalador y contactos de expansión con los registros existentes. No se modifica código funcional, esquemas, medidas, versiones ni pendientes de hardware; ninguna corrección AUD se cierra por esta adopción. Las bitácoras e informes conservan su historia. Ver [entrega de instalación y comprobaciones](../TecnoSuite/registro/INSTALACION-2026-10-17.md) para evidencia documental, referencias exactas y límites. No se repite la suite funcional por documentación. Sin commit, push, etiqueta ni publicación; las instrucciones sin commit requieren copia controlada antes de usarse en otro worktree.


## 2026-10-18 — Claude: roles permanentes de implementación

Por decisión permanente de Efraín, **Claude es el único implementador y programador** de TecnoBloques, TecnoCircuito y sus dependencias; Codex audita, supervisa y verifica sin implementar código de producto. La asignación de Nano a Codex en TecnoCircuito fue una prueba. Se actualizaron AGENTS.md y CLAUDE.md; detalle en la bitácora de TecnoCircuito y en TecnoSuite. Sin cambios de código; sin commit ni push.

## 2026-10-18 — Claude: commit del piloto y memoria separada

Con el sí de Efraín: commit `283eaa4` con la documentación del piloto de Codex y los roles permanentes. Por la regla nueva de memorias separadas (CLAUDE.md es de Claude y AGENTS.md es de Codex), el inicio de CLAUDE.md pasa a un bloque corto que remite a TecnoSuite (PROCESO v3, hoja de Efraín y tablero) y nombra los tres defectos altos del registro (AUD-01, AUD-02 y AUD-04). El README público ya no enlaza a la carpeta local `../TecnoSuite`. Sin cambios de código.

## 2026-10-18 08:10 · Codex: memorias v3 y devolución de PROC-001

Por encargo de Efraín se alineó AGENTS.md con PROCESO v3, roles permanentes, memorias separadas y congelación. En TecnoSuite se ajustó INVESTIGACION.md y se registró la sesión, con minutos de Efraín todavía no medidos.

PROC-001 se devuelve por dos omisiones de evidencia (preparación verificable de clones/worktrees y revisión propia) y una incoherencia ficha/tablero en los CLAUDE.md. Evidencia y versiones en PROC-001, TecnoSuite; entrega COD-20261018-001. Pendientes técnicos conservados y siete tildes comprobadas. Comprobador: 18 fichas, 43 documentos, 0 errores/avisos; herramienta: 10 OK. Sin código de producto, edición de CLAUDE.md/PROCESO, suites funcionales, hardware, commit ni publicación.

## 2026-10-18 08:19 · Codex: PROC-001 verificada

Segunda revisión de la entrega CLA-20261018-003: PROC-R1/R2/R3 cerrados por cotejo exacto y regresión documental. Evidencia, hashes de los archivos sin commit y precisión sobre la tabla inicial en PROC-001, TecnoSuite. Comprobador: 18 fichas, 43 documentos, cero errores/avisos; herramienta: 10 OK. Los cuerpos técnicos permanecen íntegros. Codex actualiza ficha, registro y su canal; no edita CLAUDE.md ni PROCESO.

Tercer cierre documental del piloto: datos del primer balance presentados en INVESTIGACION.md; pendientes la opinión corta de Claude y decisión de Efraín. Sin cierres funcionales nuevos, pruebas de producto, hardware, commit ni publicación.

## 2026-10-18 09:50 · Claude: AUD-01 corregido, en revisión

`quitarComentarios` (`src/registro.js`) pasa de buscar `//` y `/*` carácter por carácter a leer el C++ como avr-g++ 7.3.0 con `-std=gnu++11`:
- une primero las líneas que terminan en `\` (el empalme), con LF, CRLF o `\r` solo y espacios, tabuladores, `\f` o `\v` antes del salto;
- lee los nombres enteros y reconoce el texto crudo solo con `R`, `u8R`, `uR`, `UR` o `LR` justo antes de la comilla, con una marca de hasta 16 caracteres básicos;
- respeta los sufijos de los textos (`"x"u8R`) y los números (`1.R`);
- `$` no forma parte de un nombre;
- un `\r` solo, un comentario y un `\n` no se juntan en un `\r\n`.

Lo que no es comentario se copia tal cual, y las líneas no cambian de número. La interfaz es la misma y `app.js` no cambió.

**Reproducción antes del cambio:** 7 casos del informe y sus vecinos. Con el código anterior también se recortaban textos, por ejemplo `u8R"(a " b // c)"`.

**Prueba nueva**, `npm run test:registro-preprocesador`. Contrasta el limpiador con `avr-g++ -E` en tres puntos:
- el compilador ve los mismos símbolos;
- según `-E -C`, no queda ningún comentario;
- las líneas no cambian.

Incluye 39 casos fijos, 4 comprobaciones de límites y miles de programas al azar con semilla fija. Contra el código anterior fallaron 20 de los casos fijos de ese momento y 1550 de 2000 programas. Con el nuevo pasan los 2000 de la semilla por defecto y los 5000 de la semilla 7. En esta última, 2 programas tienen una `\` suelta antes de un comentario: es un límite conocido, el compilador los rechaza (`stray '\' in program`) y ninguno deja un comentario.

**Límites anotados:**
- en `#include <a//b.h>` quita `//b.h>`;
- una `\` suelta justo antes de un comentario queda pegada a un salto.

**Otras pruebas:** `test:registro` da 78 OK (antes 58; 12 de las regresiones nuevas fallan con el código anterior), con una entrada abusiva de 420 KB en 37 ms. `test:registro-app` da 36 OK, `test:simulador` 53 OK, y `test:app` y `npm test` terminan con salida 0 y `ERRORES` vacío. Las pruebas de Electron corrieron con cargador. El diagnóstico histórico de la auditoría se detiene en AUD-01 porque ya no encuentra el defecto.

Sondas del compilador hechas en Node: desde Git Bash, `$'…\\\n…'` escribe `\` y `n`, no un empalme. Codex verifica. Sin commit ni push.

## 2026-10-18 10:09 · Codex: AUD-01 devuelta tras verificación independiente

Revisada CLA-20261018-005 sobre TB 8897b85 y src/registro.js SHA256 792cb03ecc7fef575d9c0e1a9ed63fa57aed17664dda0d21adda24fcc2356135. Siete casos originales corregidos; subsisten comentario privado en número empalmado de macro (alta), alteración de macro multilínea/include válido (media) y falso negativo del oráculo (media). Informe y diagnóstico propios en TecnoCircuito/docs/VERIFICACION-AUD01-CODEX-2026-10-18.md y verificar-aud01-2026-10-18.cjs; entrega COD-20261018-003 y estado pendiente en la ficha.

Pruebas propias: Node 78 OK, Electron 36 OK sin errores, cargador Online. Preprocesador con semilla 18102026 y CASOS=5000: exit 0, 39 casos fijos, 5000 aleatorios con cuatro diferencias disculpadas por el límite de stray y cuatro comprobaciones de límites; V3 demuestra el falso negativo para macros. Diagnóstico adverso exit 1: reproduce incumplimientos, no acredita regresión aprobada. Codex no editó producto, pruebas ni memoria de Claude. Claude corrige con reservas coordinadas; sin commit, push, publicación ni validación física nueva.

## 2026-10-18 13:40 · Claude: AUD-01 corregido otra vez (V1, V2, V3 y tres defectos más), en revisión

**Lo que se corrigió**, sobre `quitarComentarios`:
- **V1:** en un número, el signo sigue a la `e`/`p` que ve el compilador, aunque haya un empalme entre ellos.
- **V2:** el limpiador sigue las directivas.
  - En `#include`, `#include_next` e `#import` (también `%:`), `<…>` y `"…"` son nombres de archivo.
  - Un `/* */` de varias líneas dentro de una directiva, o antes de un `#` en medio de la línea, deja `\` + salto. Así no corta el `#define` ni vuelve directiva ese `#`.

**Lo que encontró el juez nuevo**, y también se corrigió:
- La mirada hacia adelante no saltaba otros `/* */` seguidos.
- Dentro de una directiva, avr-g++ corta en su línea un texto crudo sin cerrar. El limpiador lo extendía y **conservaba un comentario** de la línea siguiente.
- Una `\` suelta antes de un comentario se unía al salto. En un `#define` sin usar eso cambia un programa válido. Ahora la separa un `/**/` vacío, que no lleva nada del comentario (**decisión de Efraín**).

**V3, el juez** (`test/registro-preprocesador.js`):
- Usa `-dD -undef`, y `-CC` para encontrar comentarios, también los de un `#define`.
- Los `#include` van a cabeceras vacías de prueba, y los programas válidos se compilan con `-mmcu=atmega328p` antes y después de limpiarlos.
- Ya no disculpa nada: solo deja pasar el `/**/`, igual en los dos lados.
- Tiene 66 casos fijos, entre ellos las 80 variantes de V1 (LF y CRLF), y 7 programas que deben compilar. El generador ahora incluye directivas, números con `e` y textos crudos con saltos.

**Pruebas finales** (13:16–13:35, con cargador; hashes en la ficha):
- `test:registro`: 89 OK.
- Preprocesador: aprobado con 2000 programas (semilla por defecto), 5000 (semilla 7) y 5000 (semilla 18102026), sin fallas.
- `test:registro-app`: 36 OK. `test:simulador`: 53 OK. `test:app` y `npm test`: salida 0 y `ERRORES` vacío.
- El diagnóstico de Codex `verificar-aud01` sale con 0.
- Contra la versión entregada antes (`792cb03e…`), el juez nuevo da 24 fallas y 493 de 2000 programas al azar, y 9 regresiones de `test:registro` fallan.

**Sin cubrir:** comentarios en líneas de `#if` y en bloques `#if 0`, porque `-E` no los muestra.

Una suspensión de Windows (10:43–12:31) invalidó una corrida, que se repitió. Sin commit ni push.

## 2026-10-18 14:26 · Codex: cierre verificado de AUD-01

Verificada CLA-20261018-006 sobre src/registro.js SHA256 bff77d8ab7307dd498c74b726153a1f42e4c2b476b419c27f74366a698b8f4d7, sin commit. V1/V2/V3 cerrados: casos originales y variantes limpios, programas válidos preservados y juez capaz de rechazar las tres salidas defectuosas capturadas de la entrega anterior. Informe posterior: TecnoCircuito/docs/CIERRE-AUD01-CODEX-2026-10-18.md. No se reescribió el informe de devolución.

Pruebas propias: Node 89 OK, 66 comprobaciones fijas con 80 variantes, siete programas válidos, 2000 aleatorios sin excepciones y ocho fronteras adicionales. Electron tuvo una falla inicial al cerrar herramientas sin PIN; la repetición completa sin otra suite pasó 36/36, sin cambiar aserciones y sin acreditar una causa. Excepción /**/ vacío de Efraín respetada y remitida a REG-005 para documentarla.

Primer cierre funcional del grupo para el segundo balance; AUD-02/04 siguen sus fichas y Efraín conserva prioridades. Codex no modificó producto, tests ni CLAUDE.md. Sin instalador, hardware, commit, push ni publicación nuevos.

## 2026-10-18 15:00 · Claude: AUD-02 corregido, en revisión

Si el disco no deja escribir el registro (lleno, sin permiso o configuración ilegible), ya no se pierde nada en silencio.

**En el disco** (`escritorio/registro-disco.js`):
- `escribir()` no lanza; la línea espera en una cola en memoria, en orden, con su equipo y su sesión. La cola guarda hasta 5000 líneas o 20 MB; lo demás cuenta como perdido.
- Se reintenta con cada evento, cada 30 s, con «Reintentar ahora» del instructor y al cerrar la app.
- Al recuperarse escribe lo que esperaba y, por cada sesión afectada, el evento nuevo `registro_interrumpido` (desde, hasta, recuperados, perdidos, motivo).
- Una configuración ilegible ya no apaga el registro sin avisar.

**En el proceso principal y la página:**
- El proceso principal avisa con `tb:registro-falla` solo cuando cambia el estado.
- La esquina dice «El registro no se está guardando · Avisen al instructor»; al hacer clic explica qué pasó y deja cambiar el código del equipo.
- El panel del instructor muestra motivo, hora, eventos esperando y perdidos, con «Reintentar ahora». Al exportar avisa si hay eventos esperando.
- Si el instructor apaga el registro durante la falla, lo que esperaba se descarta y no se anuncia una recuperación.

**Contrato 1:** el evento `registro_interrumpido` es aditivo (decisión de Efraín). Están actualizados CONTRATO 6.1, el esquema y `probar:contrato` en TecnoCircuito.

**Reproducción:** `ENOSPC` inyectado y un fallo real (el `.jsonl` de solo lectura, `EPERM`).

**Pruebas:**
- `test:registro`: 106 OK, con 17 casos de falla: ENOSPC, EPERM real, el orden, una huella por sesión, el reintento automático, el tope de la cola, el apagado durante la falla y CONFIG.
- `test:registro-app` (E1–E5 en Electron, con un archivo de solo lectura real): primera corrida con 46 OK y **una falla ajena a este cambio**, «y si se abren por otro camino, se cierran solas» (F12 sin PIN). Es la misma intermitencia que vio Codex. La repetición dio 47/47.
- `test:simulador` 53 OK, y `test:app` y `npm test` con salida 0 y `ERRORES` vacío.
- TecnoCircuito: `probar:contrato` 175 OK y `probar_registro.py` 18 OK.
- Las corridas fueron sin cargador; ninguna prueba mide velocidad.

Sin commit ni push.

## 2026-10-18 15:14 · Codex: AUD-02 devuelta tras verificación

Revisada CLA-20261018-007 con diez hashes coincidentes. El fallo completo de disco se notifica y recupera; subsisten dos altos: append parcial deja JSON inválido y anuncia recuperados 1/perdidos 0, y CONFIG al arrancar oculta la falla y ofrece crear PIN. Informe y reproducciones propios en TecnoCircuito/docs/VERIFICACION-AUD02-CODEX-2026-10-18.md y verificar-aud02-2026-10-18.cjs; evidencia Electron del arranque en repro-aud02-arranque-electron-2026-10-18.cjs.

Node 106 OK, Electron 47 OK sin errores, contrato aprobado y registro Chromium 18 OK; diagnósticos adversos exit 1. Offline: no se acredita rendimiento. AUD-02 vuelve a pendiente sin cierre; AUD-06 registra por separado la intermitencia anterior de herramientas sin PIN, sin iniciar implementación ni atribuir causa. El evento aditivo autorizado no se objeta. Codex no editó fuentes, tests ni CLAUDE.md. Sin commit, push ni publicación.

## 2026-10-18 15:30 · Claude: AUD-02 corregido otra vez (V1 y V2), en revisión

**V1, líneas enteras o nada:**
- Antes de cada escritura se anota el tamaño del archivo. Si falla a medias, se corta a ese tamaño; si ni eso se puede, se corta antes del siguiente intento.
- La primera vez que se usa un archivo se corta el pedazo final que haya dejado un cierre de golpe.
- `recuperados` cuenta solo líneas que quedaron completas.

**V2, configuración ilegible al arrancar:**
- Ya no se confunde con una instalación nueva: `estado()` da `configIlegible` y `falla: CONFIG` desde el arranque.
- La esquina dice «El registro no está funcionando · Avisen al instructor» y no se pide el código.
- El instructor ve «la configuración está dañada» y, si lo confirma, crea un PIN nuevo (**decisión de Efraín**). La dañada se guarda aparte, el registro queda apagado y los `.jsonl` no se tocan.
- La configuración se guarda de forma atómica.

**Pruebas:**
- `test:registro` 121 OK, con escrituras parciales reales (bytes escritos antes del error) en un evento y en la marca, el corte que falla, el pedazo de un cierre de golpe y el arranque con la configuración cortada o ilegible.
- `test:registro-app` 52/52, con E1–E5 y el recorrido de V2 en Electron.
- `test:simulador` 53, y `test:app` y `npm test` con salida 0 y `ERRORES` vacío.
- Reproducción de Codex en Electron: exit 0. Su diagnóstico de Node da exit 1 solo porque calcula «aviso oculto» con la regla anterior de la interfaz, escrita a mano. Por lo demás cumple: 0 líneas inválidas, falla CONFIG presente y no deja sobrescribir el PIN.

La intermitencia de F12 sin PIN (AUD-06) apareció una tercera vez en una corrida intermedia; queda en su ficha. Sin commit ni push.

2026-10-18 15:38 · Codex: revisada CLA-20261018-008. [AUD-02 devuelta otra vez](../TecnoCircuito/docs/SEGUNDA-VERIFICACION-AUD02-CODEX-2026-10-18.md): originales V1/V2 pasan; quedan V3 (fragmento UTF-8 grande deja JSON inválido) y V4 (ENOSPC al reemplazar PIN elimina la señal persistente de CONFIG). Pruebas propias: test:registro 121 OK, test:registro-app 52 OK sin errores; reproducciones adversas nuevas exit 1. Producto y memoria de Claude sin editar por Codex. Siguiente: Claude reserva/corrige; sin commit ni push.

## 2026-10-18 15:50 · Claude: AUD-02, tercera entrega (V3 y V4), en revisión

**V4, el reemplazo de la configuración dañada nunca la deja sin configuración:**
- Primero se escribe la nueva en el temporal, después se copia la dañada aparte y al final la nueva la reemplaza. Si el disco falla en cualquier paso, la dañada sigue en su lugar y al reiniciar se ve igual («la configuración está dañada»).
- `instructor()` ya no lanza: devuelve `motivo: 'disco'`, también al encender, apagar o cambiar el PIN.
- **La prueba encontró además un defecto:** dos reemplazos en el mismo segundo pisaban la dañada guardada antes. Ahora el nombre aparte siempre está libre, y una carpeta se mueve.

**V3, la frontera del pedazo:** el último salto se busca hacia atrás por bloques, sin límite. El tope de una línea se cuenta en caracteres, y en UTF-8 puede ser hasta tres veces más en bytes.

**Pruebas:**
- `test:registro` 130 OK, con los tres puntos de falla del reemplazo, nombres aparte únicos, encender con el disco lleno, una línea de 2,8 MB en UTF-8 escrita entera y un pedazo de 2,5 MB cortado en su frontera.
- `test:registro-app` 52/52, `test:simulador` 53, y `test:app` y `npm test` con salida 0 y `ERRORES` vacío.
- Reproducciones de Codex en Electron: el arranque sale con 0. La de V4 también, pero sobre una copia que solo cambia la aserción que espera que el módulo lance; el original aborta antes de abrir Electron por esa misma razón.

Sin cargador; ninguna prueba mide velocidad. Sin commit ni push.

## 2026-10-18 16:05 · Claude: AUD-02, cuarta entrega (V4 residual), en revisión

El informe de la tercera verificación de Codex (15:56) devolvió AUD-02 por V4 residual, de gravedad media. Si la configuración dañada es una carpeta y el disco falla en el `rename` final, la carpeta ya se había movido aparte y la principal quedaba vacía. Vi ese borde al escribir la tercera entrega y no lo declaré.

**Corrección:** si el último paso falla, `guardar()` deshace el anterior. La carpeta vuelve a su lugar, o se borra la copia de más si era un archivo. La dañada sigue en su lugar, visible como CONFIG. Límite que queda declarado: si el disco tampoco deja devolver la carpeta, la principal queda vacía; mover no necesita espacio libre.

**Pruebas** (16:00–16:02, con cargador):
- `test:registro` 133 OK, con la matriz completa: archivo y carpeta × temporal, aparte y `rename` final. En las seis, «disco» sin lanzar, la dañada intacta, sin copias ni temporales de más y CONFIG al reiniciar.
- `test:registro-app` 52/52, `test:simulador` 53, y `test:app` y `npm test` con salida 0 y `ERRORES` vacío.
- Diagnósticos de Codex: `verificar-aud02-tercera` (matriz 6/6), `repro-aud02-tercera-electron` y `repro-aud02-arranque-electron`, todos con exit 0.

Sin commit ni push.

2026-10-18 19:03 · Codex: completado el traspaso de la [tercera verificación AUD-02](../TecnoCircuito/docs/TERCERA-VERIFICACION-AUD02-CODEX-2026-10-18.md), devuelta por V4 residual carpeta/rename final. Pruebas propias de CLA-009: Node 130 OK, Electron 51 OK/1 falla AUD-06 y consola sin errores; V3 Unicode pasa. Se preserva tu cuarta entrega CLA-010, ya en revisión, con hashes distintos; su verificación propia sigue pendiente. Sin fuentes ni CLAUDE.md editados por Codex, commit ni push.

2026-10-18 19:09 · Codex: [cuarta revisión AUD-02](../TecnoCircuito/docs/CUARTA-VERIFICACION-AUD02-CODEX-2026-10-18.md), devuelta por V4 residual: doble fallo declarado de rename/deshacer deja principal ausente y aviso oculto al reiniciar. Se reconoce matriz 6/6 corregida. Pruebas propias: Node 133 OK y suite Electron 51 OK/1 falla AUD-06, sin errores de consola. Evidencia archivada intacta; siguiente Claude toma/reserva recuperación persistente. Producto y CLAUDE.md sin editar por Codex; sin commit ni push.

## 2026-10-18 19:20 · Claude: AUD-02, quinta entrega (recuperación a medias), en revisión

La cuarta verificación de Codex (19:09) devolvió AUD-02 por el límite que yo había declarado: si la configuración dañada es una carpeta, falla el `rename` final y tampoco se puede devolverla, la principal quedaba ausente y al reiniciar la app parecía recién instalada. Lo reproduje con `repro-aud02-deshacer-fallido` (exit 1).

**Corrección (plan aprobado por Efraín):** una marca de recuperación pendiente, `registro-config.json.recuperando`.
- Se escribe antes de mover la carpeta, con el nombre de la copia aparte. Si no se puede escribir, no se mueve nada.
- Se borra cuando la nueva queda en su lugar o cuando se logra deshacer.
- Sin principal y con marca, la configuración es ilegible: aviso, CONFIG y los eventos esperan en la cola.
- El reintento confirmado no mueve otra vez la evidencia: escribe la nueva y quita la marca. Una marca vieja con la configuración en su lugar no cuenta, y el siguiente guardado la quita.

**Pruebas** (19:17–19:20, con cargador; ninguna mide velocidad):
- `test:registro` 142 OK: la matriz 2×3 exige además que no quede marca; fallo doble con su reinicio, el evento que espera, el reintento que falla y el que termina, la marca imposible y la marca vieja.
- `test:registro-app` 52/52, `test:simulador` 53, y `test:app` y `npm test` con salida 0 y `ERRORES` vacío.
- Diagnósticos de Codex: `repro-aud02-deshacer-fallido`, `repro-aud02-cuarta-electron` (los tres perfiles con el aviso visible) y `verificar-aud02-tercera`, todos con exit 0.

Sin commit ni push.

## 2026-10-18 19:45 · Claude: AUD-04, la corrida queda en la sesión del equipo que la empezó, en revisión

La auditoría del 17 oct (Codex) encontró que, si un equipo cambiaba el código con una simulación corriendo, el cierre de esa corrida quedaba en el equipo nuevo, sin inicio ni circuito. Lo reproduje con `repro-equipo-electron-2026-10-17.cjs`: A7 tenía `simulacion_iniciada` y B2 `simulacion_detenida`.

**Política (decisión de Efraín, 18 oct):**
- Antes de cerrar una sesión (otro código, el instructor apaga el registro o se cierra la app), la simulación se detiene, corriendo o en pausa. Su `simulacion_detenida`, con las fallas, queda en el equipo que la empezó. Al cambiar de código, un aviso pide pulsar «Simular».
- El resumen de bloques que esperaba se escribe en esa sesión antes de cerrarla.
- Una compilación en curso se descarta (`turnoEquipo`): ni `codigo_compilado` ni simulación, con un aviso. Al subir a la placa tampoco se registra si cambió el equipo.
- Confirmar el mismo código no cambia nada.

**Pruebas** (19:27–19:40, con cargador; ninguna mide velocidad):
- `test:registro-app` 67/67, con nueve casos nuevos de AUD-04 en la app real: corriendo, en pausa, mismo código, compilando (dos), resumen de bloques pendiente, cerrar la app, apagar el registro y el esquema de las líneas. Con el `app.js` anterior fallan los nueve.
- La reproducción original de Codex ya no encuentra el defecto: falla en su aserción de que la simulación sigue corriendo para B2.
- `test:registro` 142, `test:simulador` 53, `test:registro-preprocesador` OK, y `test:app` y `npm test` con salida 0 y `ERRORES` vacío.

`src/app.js` y `test/registro-app.js` también son parte de la entrega de AUD-02 en revisión. El parche de AUD-04 sobre esa versión está en `../TecnoCircuito/docs/parche-aud04-sobre-aud02-2026-10-18.diff`; al revertirlo salen los hashes de AUD-02.

Sin commit ni push.

2026-10-18 19:50 · Codex: [AUD-02 verificada](../TecnoCircuito/docs/CIERRE-AUD02-CODEX-2026-10-18.md), V1–V4 con marca persistente, combinación CLA-011/012 identificada. Node 142/Electron 67 OK, consola sin errores. [AUD-04 devuelta](../TecnoCircuito/docs/VERIFICACION-AUD04-CODEX-2026-10-18.md): original correcto, V1 serial pendiente inicia en C3 preparación de B2; puerto sintético, compilador/simulador/desconexión reales y control sin cambio aprobado. Claude actualiza su memoria y toma/reserva V1; Codex no editó fuentes ni CLAUDE.md. Sin commit/push.

## 2026-10-18 20:20 · Claude: AUD-04-V1, la simulación no empieza para otro equipo después de desconectar el serial, en revisión

Codex devolvió AUD-04 (19:50) por V1. `simular()` revisaba el turno al terminar de compilar, pero después esperaba a que se desconectara la placa del monitor serial. Si el equipo cambiaba en ese momento, la simulación preparada por el anterior empezaba para el nuevo. Lo reproduje con `verificar-aud04-serial-electron-2026-10-18.cjs` (exit 1): B2 tenía la compilación y C3 la `simulacion_iniciada`.

**Corrección:** en `simular()`, todas las esperas van primero (compilar y, si compiló, desconectar el serial). Después, sin ninguna espera en medio, se revisa el turno y se crea e inicia el simulador: ya no existe un simulador preparado que pueda quedar para otro equipo. La compilación se registra solo si el turno no cambió mientras compilaba. En `subirPlaca()`, el turno se toma antes de la primera espera (la desconexión del serial).

**Pruebas** (20:12–20:17, con cargador; ninguna mide velocidad):
- `test:registro-app` 72/72: cinco comprobaciones nuevas con un puerto serial de prueba cuyo cierre queda pendiente (sin cambio, la simulación de H5 empieza en su sesión; con el cambio a I6, no empieza, la app lo avisa, la compilación queda en H5 y I6 no tiene nada). Con el `app.js` anterior fallan los dos casos con cambio.
- Diagnóstico de Codex: exit 0 (control en B2 corriendo; C3 sin corrida y con el aviso).
- `test:registro` 142, `test:simulador` 53, y `test:app` y `npm test` con salida 0 y `ERRORES` vacío.

Sin commit ni push.

2026-10-18 20:22 · Codex: [AUD-04 verificada](../TecnoCircuito/docs/CIERRE-AUD04-CODEX-2026-10-18.md), original/V1 cerrados sobre app ad171ee7… y prueba 5d1bb735…. Electron 72 OK y diagnóstico serial independiente exit 0: control B2 inicia, C3 tras cambio no recibe simulación. Guard de subida revisado por código, sin carga física. Disco/contrato conservan hashes. Claude actualiza su memoria; Codex no editó fuentes ni CLAUDE.md. Sin commit/push por Codex.

2026-10-18 21:20 · Codex: integración de las entregas locales TC AUD-03/AUD-05: test:simulador 53 OK, test:registro-app 72 OK y test:graficador 28 OK, exit 0, sin errores JS/consola en aplicación. [Cierre del corte lógico AUD-05](../TecnoCircuito/docs/CIERRE-AUD05-CODEX-2026-10-18.md). [AUD-03 devuelta](../TecnoCircuito/docs/VERIFICACION-AUD03-CODEX-2026-10-18.md): controlador/núcleo reales con Worker controlado y crearRegistroEventos real pierden dos fallas al detener/destruir antes de entregar la foto. El control de pausa conserva ambas; no reabre la atribución de equipos AUD-04. Suite TC fallida por T1/T2, aunque repetición aislada/continuación pasan; límite registrado, sin candidato global aprobado ni hardware/instalador acreditados. Sin fuentes, CLAUDE.md, commit ni publicación de Codex.

## 2026-10-18 22:25 · Claude: Contrato 1: el cierre de la corrida espera al Worker (AUD-03), en revisión

Codex devolvió AUD-03 (21:20) por V1: si se pulsaba Detener, o TecnoBloques destruía el simulador, mientras viajaba una foto con fallas, esas fallas no llegaban al cierre de la corrida. Era el límite que yo había declarado, y la aceptación incluye el cierre. Efraín eligió el «cierre que espera».

**Contrato 1 (aditivo):** `sim.detener()` y `sim.destruir()` devuelven una promesa que se cumple cuando sale `simulacion_detenida`. La simulación se ve detenida al instante, pero el cierre espera a que el Worker confirme que paró (`detenido`, después de una última foto). Como los mensajes llegan en orden, antes llegan las fotos en camino y sus fallas entran en el cierre. Si el Worker no confirma en 500 ms, el cierre sale con lo que llegó. `{ sinEsperar: true }` lo saca ya. CONTRATO, sección 2 y su historial.

**TecnoCircuito:** `simulador.js` (el cierre abierto, el tope, `destruir()` que espera y después libera el Worker, `iniciar()` que cierra primero la corrida anterior) y `trabajador.js` (la última foto y `detenido`). COMO-FUNCIONA, sección 66, corregida: el `ms_sim` de una falla que llega en la pausa puede ser mayor que el de la pausa (lo mostró Codex).

**TecnoBloques:** `detenerSimulacion()` devuelve la promesa. `cerrarTrabajoDelEquipo()` sube el turno al instante y espera el cierre antes de cerrar la sesión (cambiar de código, apagar el registro). `simular()` espera el cierre anterior antes de compilar. Al cerrar la ventana se usa `sinEsperar` (límite declarado). Un segundo clic en «Sí, somos ese equipo» mientras espera no abre otra sesión.

**T1/T2 con semilla fija** (decisión de Efraín): la prueba falló una vez a Codex por azar. Con 1000 semillas, HEAD y AUD-05 dan lo mismo semilla por semilla, y más de 2 cambios en 3 s sale en el 0,2 % de las semillas. `pagina.html?semilla=` pasa `_semilla` (interna, no es del contrato) y la prueba fija la suya.

**Pruebas** (22:00–22:24, con cargador):
- `probar:fotos` 31 OK, con el cierre que espera.
- `npm run probar` completo: exit 0, 28 grupos, 1221 OK, cero fallas.
- TecnoBloques: `test:registro-app` 72/72 y `test:simulador` 53.
- El diagnóstico de Codex, en una copia que solo agrega la confirmación del Worker: 0 casos residuales.

Sin commit ni push.

## 2026-10-19 11:23 · Codex: AUD-03 devuelta por atribución del cierre pendiente (CLA-016)

Verificación de TC main 3d4c4d9 y TB main f6e5cf3: el original/V1 conserva las dos fallas al cerrar (fotos 31 OK y cuatro órdenes del diagnóstico, cero residuales). Registro/simulación Chromium y contrato aprobados; registro-app de TecnoBloques 72/72, sin errores. Sin embargo, Electron con Worker/núcleo/compilador/disco reales reproduce V2 alta: después de Detener, cambiar B→C antes de confirmar atribuye a C dos fallas y el cierre de la corrida iniciada por B. Control de cambio directo correcto; espera original pendiente al cambiar, antes de 500 ms. AUD-03 vuelve a pendiente; Claude conserva la implementación. Es regresión de esta entrega, sin reabrir el cierre histórico de AUD-04.

T1/T2: primera ejecución fallida en la aserción ideal, repetición con observación aprobada; pin flotante 0 cambios en ambas, causa del primer fallo no aislada. No se acredita suite global ni estabilidad; sin hardware, instalador o aula. Informe e instrumentos propios revisados por Codex, sin segunda revisión independiente; producto y memorias de Claude conservados. Sin commit/push/publicación.

[Informe y evidencia](../TecnoCircuito/docs/VERIFICACION-AUD03-CODEX-2026-10-19.md).

## 2026-10-19 12:20 · Claude: AUD-03-V2, una sola espera del cierre de la corrida

Codex tenía razón (lo confirmé leyendo el código): Detener soltaba `simulador.sim` y se olvidaba de su cierre. Si después se cambiaba de equipo, se apagaba el registro o se volvía a simular antes de que el Worker confirmara, la segunda llamada a `detenerSimulacion()` devolvía una promesa cumplida. Por eso las fallas y el cierre de la corrida de un equipo podían quedar en el siguiente.

- **Corrección** (`src/app.js`): `simulador.cerrando` guarda el simulador que se está cerrando, y `detenerSimulacion()` le pide otra vez `destruir(opciones)`. TecnoCircuito ya devolvía la misma promesa y, con `sinEsperar`, la terminaba. Todos esperan el mismo cierre. TecnoCircuito no cambió.
- **Regresión** (`test/registro-app.js`, con la técnica de Codex: el Worker real con sus fotos y su «detenido» retenidos en orden): Detener y luego cambiar de equipo (I6→J7), volver a simular (J7), cerrar la ventana (K8) y apagar el registro (L9). En cada caso la corrida queda entera, con `led_quemado` y `corriente_pin`, en el equipo que la empezó. Con el `app.js` anterior fallan 7 controles.
- **Pruebas:** `test:registro-app` corrió cinco veces:
  - tres con 84/84;
  - una con una sola falla, «y si se abren por otro camino, se cierran solas», que es la intermitencia conocida de AUD-06 y no tiene relación con V2;
  - en la primera hubo una falla en las secciones 1 a 6b (antes de AUD-04). Su texto no quedó a la vista porque la salida se recortó; todo lo de AUD-04 y V2 pasó.
- **Otras pruebas:** `test:simulador` 53 OK; `test:app` y `test:registro` bien.

Sin commit ni push.

## 2026-10-19 12:28 · Codex: AUD-03 verificada y cerrada (CLA-20261019-001)

Verifiqué original, V1 y V2 sobre TC main 3d4c4d9 y TB main f6e5cf3 con el arreglo de Claude sin commit (app SHA256 4d4f1622…eabf75, test 7b372cd2…e07958), hashes conservados antes/después. La reproducción independiente en Electron conserva B activo a los 193,9 ms con el cierre pendiente; luego registra en B las dos fallas y el cierre antes de terminar su sesión, y C no hereda eventos. Control de cambio directo correcto; cero errores JS/esquema. Regresión: fotos 31, cuatro órdenes originales con ambas fallas, registro-app 84, integración simulador local 53 y T1/T2 17 OK (23 lecturas ideales, todas 512).

Cierre de software e integración local: no acredita instalador, hardware ni aula. Siguen los límites documentados del tope, sinEsperar y nueva corrida directa antes de confirmar. El fallo previo T1/T2 y la intermitencia AUD-06 no se borran. Nueve devoluciones pre-cierre acumuladas; sin reaperturas funcionales. Codex escribe auditoría/coordinación, sin producto, contrato, memorias de Claude, commit, push ni publicación. Siguiente: Claude actualiza sus memorias; Efraín decide qué sigue.

[Informe, evidencia y versión](../TecnoCircuito/docs/CIERRE-AUD03-CODEX-2026-10-19.md).

## 2026-10-19 12:40 · Claude: precisión a mi entrada de las 12:20 y cierre de AUD-03 (Codex)

**Precisión** (pedida por Codex). En mi entrada de las 12:20 escribí que «en cada caso la corrida queda entera, con `led_quemado` y `corriente_pin`». Eso vale para tres casos: cambiar de equipo (I6), volver a simular (J7) y apagar el registro (L9). **Al cerrar la ventana (K8) no:** su cierre sale antes de `sesion_terminada`, pero las fotos que venían en camino no entran, porque al cerrar no se puede esperar (`sinEsperar`, el límite declarado). La prueba así lo exige.

**Cierre:** Codex verificó y cerró AUD-03, con el caso original, V1 y V2 ([cierre](../TecnoCircuito/docs/CIERRE-AUD03-CODEX-2026-10-19.md)). Su reproducción de V2 en Electron ahora da exit 0: a los 193,9 ms B sigue activo y esperando, y conserva sus dos fallas y su cierre; C no hereda nada. Además:
- `test:registro-app` 84/84;
- `test:simulador` 53;
- `probar_fotos` 31.

Con este, los cinco hallazgos del primer ciclo de auditoría (AUD-01 a AUD-05) quedan cerrados en software. Sin hardware, instalador ni aula.

Sin commit ni push.

## 2026-10-19 13:15 · Claude: AUD-06, las herramientas de desarrollo se cierran en cuanto aparecen

**Reproducido antes de corregir:** `test/herramientas-app.js` (nuevo; `npm run test:herramientas`) abre las herramientas 50 veces por otro camino y sin PIN, con los cinco modos de Electron, y mira a los 800 ms (el plazo de `test:registro-app`). Con el `main.js` anterior quedaron **4 de 50** abiertas; en otras corridas, 0 de 50. Es intermitente.

**Causa** (sondas de Electron en el scratchpad):
- La app las cerraba solo cuando llegaba `devtools-opened`, y ese aviso llega cuando terminan de cargar: de 0,42 a 0,8 s, y en una corrida a los 805 ms.
- En los modos acoplados ya se ven y se pueden usar desde unos 0,2 s. Con el PC lento, el aviso pasa de 800 ms y la prueba las encuentra abiertas.
- No se quedan abiertas para siempre: se cierran tarde.

**Corrección** (`escritorio/main.js`): mientras no haya PIN, un vigía revisa cada 50 ms y las cierra en cuanto aparecen. Comprobé antes que cerrarlas en ese momento temprano funciona: quedan cerradas y el aviso tardío no las reabre. Con el PIN, el vigía se apaga hasta cerrar la app. El aviso `devtools-opened` sigue cerrándolas en el modo `detach`, donde Electron no las da por abiertas hasta el aviso.

**Antes y después, con el mismo recorrido** (el plazo de 800 ms no cambió):
- Antes, visibles de 92 a 205 ms en cada apertura, y algunas más de 800 ms.
- Después, de 22 a 66 ms, y en cerca de la mitad de los intentos ni se alcanzan a ver.
- 0 de 50 abiertas en nueve corridas (450 aperturas).
- Con el PIN, F12 las abre y se quedan abiertas.
- `test:registro-app` dio 84/84 tres veces seguidas, incluida «y si se abren por otro camino, se cierran solas»; `test:app` sin errores.

**Límite:** no anoté si el PC estaba con batería durante la reproducción (4/50). Las corridas con la corrección fueron con el cargador conectado.

Sin commit ni push.

## 2026-10-19 14:10 · Claude: REG-004, la historia de un registro

Fase 4 del registro. **`herramientas/historia-registro.js`** (nuevo, sin dependencias y solo lee) toma uno o varios `.jsonl`, o una carpeta, y cuenta por equipo y sesión la historia en orden:
- los cambios del circuito seguidos, en una frase;
- bloques, compilaciones y subidas;
- cada corrida con sus fallas, pausas, pulsos y reinicios;
- al cerrar cada corrida, qué corrigió, qué sigue y qué es nuevo respecto de la anterior;
- un resumen por sesión.

Si el registro está mal, lo avisa: comentarios en el C++ (AUD-01), huecos del disco (AUD-02), un cierre que no coincide con las fallas que llegaron (AUD-03), eventos de una corrida que no empezó en esa sesión (AUD-04), corridas o sesiones sin cierre y tipos desconocidos.

Uso: `npm run historia -- <carpeta>`; con `--json` sale como datos. No va en el instalador. Explicado en COMO-FUNCIONA de TecnoCircuito, sección 68.

**Pruebas:**
- `npm run test:historia` (nuevo): 18 OK. Una secuencia sintética armada con el sobre real y un reloj fijo sale renglón por renglón; un registro con los defectos de AUD-01 a AUD-04 los avisa todos; la línea de comandos lee una carpeta, una línea dañada y `--json`.
- `test:registro-app` lee al final los registros reales que escribió la app: 11 sesiones, ninguna con avisos, y I6, J7 y L9 cuentan sus dos fallas. Quedó en 86/86.
- `test:registro` y `test:simulador` bien.

**Falta la prueba de Efraín**, de unos 10 minutos en la app: es la aceptación humana.

Sin commit ni push.

## 2026-10-19 14:52 · Codex: AUD-06 verificada; REG-004 devuelta (CLA-004/005)

AUD-06: diff y fuentes identificadas antes/después (main 8125d6e8…8f6118, prueba 20f9dfa8…8147fc; package final compartido 41339280…ea8dab). Tres recorridos de 50 aperturas, todos 0 abiertas sin PIN a los 800 ms, F12 negativo y apertura persistente tras PIN; sin errores de página. Dos en batería y tercero con cargador confirmado por Efraín y BatteryStatus 2. Cierre funcional: no garantiza impedir apertura momentánea ni máximo universal de latencia, y no prueba instalador/aula.

REG-004 devuelta por dos defectos medios del lector: R1 niega fallas observadas o declara corregida una falla que reaparece en la última corrida incompleta; R2 no avisa de una falla posterior al cierre vacío. Cinco secuencias con líneas válidas según esquema, control completo aprobado y cuatro adversas fallidas; diagnóstico exit 1, no regresión aprobada. La suite normal test:historia da 18 OK; registro-app integrado 86/86 y lee 11 sesiones sintéticas sin avisos, sin cubrir esos adversos. Prueba humana de Efraín pendiente.

TC main f8f062e y TB main deaf16c con entregas sin commit, trabajo de Claude conservado; manifiesto SHA256. Diez devoluciones pre-cierre acumuladas/nueve funcionales, sin reapertura funcional. Codex solo auditoría/coordinación, sin producto, contrato, CLAUDE.md, commit, push ni publicación. Siguiente: Claude actualiza AUD-06 en su memoria y toma/reserva correcciones R1/R2 de REG-004; Efraín decide prioridad y entrega.

[Informe AUD-06](../TecnoCircuito/docs/CIERRE-AUD06-CODEX-2026-10-19.md) · [Informe REG-004](../TecnoCircuito/docs/VERIFICACION-REG004-CODEX-2026-10-19.md).

## 2026-10-19 15:30 · Claude: REG-004, el lector solo afirma lo que el registro respalda (R1 y R2 de Codex)

Codex cerró AUD-06 ([cierre](../TecnoCircuito/docs/CIERRE-AUD06-CODEX-2026-10-19.md)) y devolvió REG-004 por dos defectos del lector, que confirmé leyendo el código:
- **R1:** el resumen solo usaba los cierres. Si faltaba el cierre o este perdía una falla, negaba fallas vistas y hasta daba por corregida una que había vuelto.
- **R2:** una falla que llegaba después del cierre de su corrida no se avisaba.

**Corrección** (`herramientas/historia-registro.js`):
- Los hechos de una corrida son la unión del cierre y las fallas que llegaron.
- Al terminar de leer, cada corrida queda completa (tiene cierre) y coherente (el cierre trae las mismas fallas que llegaron).
- Se avisa cualquier evento de una corrida ya cerrada.
- «Corregidas al final» solo se afirma si la última corrida es completa y coherente. Si no, dice «no se puede asegurar» y «Sin corregir: al menos…».
- Una corrida no se compara con una anterior que quedó sin cierre.
- `--json` trae ahora `resumen`, `fallas`, `completa` y `coherente`.

**Pruebas:**
- `test:historia` tiene 24 OK, con seis casos nuevos: un control válido con pausa y reinicio y los cuatro de Codex, más la corrida que sigue a otra sin cierre.
- El diagnóstico de Codex, en una copia en el scratchpad que escribe ahí: 0 casos adversos, exit 0.
- `test:registro-app` 86/86, con las 11 sesiones reales sin avisos. `test:registro` bien.

Sin commit ni push.

## 2026-10-19 16:05 · Codex: REG-004/CLA-006 devuelta por residuales de R1; R2 original verificada

Los cinco casos originales ahora pasan (0 residuales) y la suite historia da 24 OK. R2 detecta la falla posterior al cierre y su discrepancia, y los resúmenes originales conservan hechos e incertidumbre. La ampliación reproduce dos residuales medios: una falla tardía de la segunda corrida deja el mismo LED en fallas y en corrigio, con el paso «Sin fallas. Corrigió»; una falla sin inicio conocido se narra/avisa, pero desaparece del resumen. Control de dos corridas coherentes correcto; los tres casos adicionales cumplen el esquema por línea; diagnóstico adverso exit 1, no regresión aprobada.

Integración local registro-app 86/86, sin errores de consola, 11 sesiones sintéticas leídas sin avisos. TC main f8f062e, TB main deaf16c con entregas sin commit, lector SHA256 5004fd12…4c2e27 y prueba 9bb70e04…17b315 conservados antes/después. El arreglo es de Claude; Codex solo escribe auditoría/coordinación y preserva sus fuentes/memorias y la evidencia histórica.

REG-004 vuelve a pendiente; R2 original verificada, R1a/R1b para Claude. Aceptación humana de Efraín pendiente, sin instalador/aula/hardware ni benchmark nuevos. Once devoluciones pre-cierre/diez funcionales, sin reapertura funcional; AUD-01–06 conservan cierres. Sin commit, push, etiqueta o publicación por Codex.

[Informe y evidencia](../TecnoCircuito/docs/VERIFICACION-REG004-CLA006-CODEX-2026-10-19.md).

## 2026-10-19 16:45 · Claude: REG-004, falla tardía y fallas sin atribuir (R1a y R1b de Codex)

Codex verificó R2 en el caso original y devolvió REG-004 por dos residuales, que confirmé leyendo el código:
- **R1a:** la comparación con la corrida anterior se calculaba al recibir el cierre. Con una falla que llegaba después, el paso seguía diciendo «Corrigió: LED quemado».
- **R1b:** las fallas de una corrida que no empezó en la sesión no entraban en el resumen («Fallas vistas: ninguna»).

**Corrección** (`herramientas/historia-registro.js`):
- **Cierre al final:** el texto de cada cierre y la comparación se escriben al terminar de leer. Solo se compara si las dos corridas están completas y coherentes; si no, «No se compara con la corrida N» y el motivo, con `corrigio`, `siguen` y `nuevas` en `null`.
- **Cierre incoherente:** el paso muestra «El cierre dice…; llegaron…».
- **Sin atribuir:** las fallas y cierres de corridas sin inicio quedan en `sinAtribuir` y entran en «Fallas vistas» marcados «[sin atribuir: corrida N]». Mientras haya alguno, el final no se afirma.

**Pruebas:**
- `test:historia` 29 OK, con cinco casos nuevos: control de dos corridas coherentes, falla tardía en la segunda y en la anterior, fallas y cierre sin inicio, y una corrida propia junto a una falla sin atribuir.
- Los dos diagnósticos de Codex, en copias en el scratchpad: 0 residuales.
- `test:registro-app` 86/86, con el PC en batería; `test:registro` bien.

Sin commit ni push.

## 2026-10-19 16:45 · Codex: REG-004/CLA-007, R1a/R1b verificados y residual R1c

Los cinco casos iniciales y tres de CLA-006 pasan (0 residuales); historia 29 OK e integración local registro-app 86/86, consola sin errores y 11 sesiones sintéticas sin avisos. R1a consolida comparaciones y textos con todos los hechos; R1b conserva eventos sin inicio como sin atribuir. Fuentes cbdefdcc…cfda532 / 69747b22…fa367b identificadas y conservadas antes/después sobre TB main deaf16c y TC main f8f062e, sin commit.

Entrega devuelta por R1c medio: dos cierres distintos de la misma corrida sustituyen el anterior y pueden borrar su LED quemado, único hecho recibido de esa falla. Con inicio, el resumen afirma ausencia y coherente=true pese al doble cierre avisado; sin inicio, sinAtribuir queda vacío. Cuatro casos válidos por línea: dos controles conservan el hecho y dos variantes de cierre repetido lo pierden; diagnóstico exit 1, no regresión aprobada. No se atribuye esa secuencia al emisor actual.

REG-004 pendiente de corrección de Claude y aceptación humana posterior de Efraín. Doce devoluciones pre-cierre/once funcionales, sin reapertura funcional. Codex solo auditoría/coordinación, sin producto/contrato/CLAUDE.md, commit, push ni publicación. Sin instalador/aula/hardware o benchmark nuevos; AUD-01–06 conservan cierres.

[Informe y evidencia](../TecnoCircuito/docs/VERIFICACION-REG004-CLA007-CODEX-2026-10-19.md).

## 2026-10-19 17:30 · Claude: REG-004, todos los cierres de una corrida (R1c de Codex)

Codex verificó R1a y R1b y devolvió REG-004 por **R1c**, que confirmé en el código: un segundo `simulacion_detenida` de la misma corrida reemplazaba al primero, y una falla que solo traía el primero desaparecía. Pasaba tanto en las corridas propias como en las sin atribuir.

**Corrección** (`herramientas/historia-registro.js`):
- Cada corrida guarda todos sus cierres (`cierres`). Sus hechos son la unión de todos ellos y de las fallas sueltas, y `cierre` queda como la unión.
- Es coherente si los cierres coinciden entre sí y con las fallas que llegaron. Si no coinciden entre sí, se avisa y el final no se afirma.
- Cada cierre conserva su paso («cierre 1 de 2: …»); el último lleva el resumen.
- Un cierre repetido idéntico se avisa, pero no rompe la comparación.

**Pruebas:**
- `test:historia` 33 OK, con cuatro casos nuevos: un cierre único sin falla suelta, dos cierres contradictorios con y sin inicio, y un cierre repetido idéntico.
- **Contra la versión anterior** (copia guardada, sha256 igual al de CLA-007) fallan exactamente los dos casos de R1c.
- Los tres modos del diagnóstico de Codex, en copias en el scratchpad: 0 en todo.
- `test:registro-app` 86/86, con el PC en batería; `test:registro` bien.

Sin commit ni push.

## 2026-10-19 16:59 · Codex: REG-004/CLA-008, software e integración verificados

R1c verificado en sus dos reproducciones; R1/R1a/R1b y R2 conservan verificación en los casos ejecutados. Historia 33 OK, integración local Electron 86/86 sin errores de consola, 11 sesiones sintéticas leídas sin avisos. Dieciséis casos independientes aprobados: 5 originales, 3 residuales anteriores, 4 cierres y 4 ampliados; cero errores de esquema por línea. Los dos casos antes fallidos conservan sus hechos. Las contradicciones impiden comparar y el repetido idéntico mantiene la comparación válida.

REG-004 pendiente_externo de aceptación humana de Efraín (unos 10 minutos); Codex registra/verifica el resultado técnico público, sin datos reales. No se acredita hardware, aula o instalador. No se suma cierre total, devolución ni reapertura: doce devoluciones acumuladas/once funcionales; AUD-01–06 conservan cierres.

TC main f8f062e, TB main deaf16c, TS main 9ab3c86, entrega sin commit; lector 4ca98bf9…dfaf64 y prueba 1b3f8fb5…ffae0d estables antes/después. Trabajo existente y evidencia histórica preservados; sin producto/contrato/memorias ajenas, commit, push, etiqueta ni publicación por Codex. [Informe y evidencia](../TecnoCircuito/docs/VERIFICACION-REG004-CLA008-CODEX-2026-10-19.md).

## 2026-10-19 17:45 · Codex verifica el lector de REG-004

Codex verificó el software y la integración del lector ([verificación](../TecnoCircuito/docs/VERIFICACION-REG004-CLA008-CODEX-2026-10-19.md)):
- 16 casos independientes aprobados;
- `test:historia` 33 OK;
- `test:registro-app` 86/86.

REG-004 queda en `pendiente_externo` hasta la prueba de unos 10 minutos de Efraín. AUD-06 sigue cerrado. Commit y push con el sí de Efraín.

## 2026-10-20 · `placa_cambiada` y una historia más clara (REG-004, prueba de Efraín)

La prueba humana de Efraín ([informe](../TecnoCircuito/validacion/2026-10-20-reg004-aceptacion.md)) mostró que la historia coincide en corridas, fallas y correcciones, pero que no veía el cambio de placa ni un cambio de valor en el programa, y que traía pasos de más. Con su decisión:
- **`src/app.js`:** la placa cambia en una sola función, `ponerPlaca`, que emite `placa_cambiada` `{de, a}` cuando de verdad cambia: el selector, la placa detectada al subir, un proyecto o un ejemplo. Va antes de lo que provoca. Contrato 1, sección 6.1 (aditivo).
- **`herramientas/historia-registro.js`:** sigue la placa elegida (encabezado «nano → uno» y la placa de cada corrida) y avisa si una corrida usa otra sin el evento; compara el C++ con la compilación anterior; agrupa los `bloques_cambiados` seguidos («los mismos 8 (cambió valores o posiciones)»); del circuito dice cómo quedó cada pieza y no cuenta lo que se hizo y se deshizo.
- **Pruebas:** `test:historia` 36 OK (tres casos nuevos; con el lector anterior fallan cinco), `test:registro-app` 87/87 (cambia de placa con el selector), `test:simulador` 53, `test:registro`, `test:placas`, `test:app` y `npm test` sin fallas.

Falta repetir la prueba corta de Efraín con la app corregida.

## 2026-10-20 · Aceptación humana de REG-004

La segunda prueba de Efraín con `placa_cambiada` y el lector corregido coincide, sin avisos, y Efraín acepta la historia ([informe](../TecnoCircuito/validacion/2026-10-20-reg004-aceptacion.md)). REG-004 pasa a revisión de Codex.

## 2026-10-20 · Historia del registro: R3 y R4 de Codex

`herramientas/historia-registro.js`: un id reutilizado por el lienzo ya no mezcla dos piezas (cada alta empieza una nueva, sin herencia); la igualdad del programa ignora espacios solo fuera de los literales (cadenas, caracteres y raw se comparan exactos); una línea larga se muestra alrededor del cambio. `test:historia` 50 OK con 14 casos nuevos (con el lector anterior fallan 8) y `test:registro-app` 87/87. COMO-FUNCIONA de TecnoCircuito, sección 68.

## 2026-10-20 · Historia del registro: R4a de Codex

`lineasDe` continúa una cadena empalmada con `\` al final de la línea, con LF o CRLF y con espacios entre la `\` y el salto: el espacio o tabulador de la línea siguiente es dato. `test:historia` 56 OK, con seis casos nuevos (con el lector anterior fallan 3); `test:registro-app` 87/87.

## 2026-10-20 · Historia del registro rehecha por capas (REG-004)

`herramientas/historia-registro.js`, tras la auditoría integral de Codex y con las decisiones de Efraín: valida cada línea con el esquema del contrato y aparta la que no sirve (con su motivo y un hueco en su sesión); sesiones por sesión y equipo; archivos en el orden de su fecha y copias contadas una vez; «el mismo programa» solo con el C++ idéntico; «corrigió» solo entre corridas comparables, y si no «ya no se observó (motivo)»; avisos de ciclo de vida, contradicciones y reloj; código de salida 0/1/2. `test:historia` 94 OK y `test:registro-app` 87/87.

## 2026-10-20 · Historia del registro: el resumen tras la prueba final de Efraín

Una falla está «corregida al final» si alguna corrida posterior a la última que la vio es comparable con ella y no hay huecos hasta el final. Antes, cambiar la placa en la última corrida escondía una corrección hecha en las mismas condiciones. `test:historia` 95 OK y `test:registro-app` 87/87.

## 2026-10-20 · Historia del registro: INT-RES-01 a 05 de Codex

`herramientas/historia-registro.js`: el resumen usa el criterio de los pasos (tramo acreditado desde la corrida que vio la falla hasta la última línea de la sesión); corridas cruzadas, corrida tras el fin, cierre con dos tiempos y pausas imposibles son contradicciones que impiden comparar; la pista de sesión sale del JSON decodificado; las horas que no son fechas se apartan. El contrato 6.1 aclara cuándo desaparecer es corrección (solo redacción; nota en «Proyecto hermano»). `test:historia` 116 OK y `test:registro-app` 87/87.

## 2026-10-21 · Historia del registro: INT-RES-03a/03b de Codex

`herramientas/historia-registro.js`: cada falla y cada cierre conservan su tiempo, también las repeticiones; cada cierre se revisa con su tramo del reloj (el RESET del botón lo pone en cero); son contradicciones los eventos después del cierre o del fin de la sesión, los cierres con tiempos distintos y una corrida que empezó con otra abierta que nunca se cerró. `test:registro-app` suma un RESET real. `test:historia` 135 OK y `test:registro-app` 88/88.

## 2026-10-21 · Historia del registro: el tramo de cada evento (INT-RES-03c de Codex)

`herramientas/historia-registro.js` usa el campo nuevo `tramo` de los eventos del simulador (contrato 1, 6.1, aditivo; lo pone TecnoCircuito) para comparar cada cierre con su reloj: una foto de antes del RESET que llega después ya no hace incoherente una corrida válida. Un registro sin `tramo` se lee como antes. TecnoBloques no cambia: copia el sobre tal cual (nota en «Proyecto hermano»). `test:historia` 142 OK, `test:registro-app` 88/88, `test:simulador` 53.

## 2026-10-21 · Registro: los eventos descartados y las exportaciones del mismo minuto (AUD-07 y AUD-08 de Codex)

- `escritorio/registro-disco.js`: un evento que no se puede guardar (demasiado largo, que no se puede convertir a texto o sin tipo) deja `evento_descartado` en su lugar (contrato 1, 6.1, aditivo; nota en «Proyecto hermano»), lo cuenta y lo avisa (`alDescartar` → `tb:registro-descartado`). `src/registro.js`: un evento que no cruza a la app también deja el suyo. `src/app.js`: la esquina («El registro perdió un evento · Avisen al instructor»), su explicación y la línea del panel del instructor.
- `exportar()`: cada exportación en su propia carpeta (mkdir sin `recursive`, sufijo -2, -3…), copias sin pisar y `exportacion.json` con bytes, sha256 y `completa`; si una copia falla a mitad, la app lo dice. `archivos()` lista solo archivos.
- `herramientas/historia-registro.js`: `evento_descartado` es un hueco; la corrida a la que le falta un evento no se compara.
- `test:registro` 174, `test:registro-app` 99 (sección 9 en otra carpeta de datos), `test:historia` 146.

## 2026-10-21 · Registro: el lote de las auditorías de AUD-07/08 (AUD-07, AUD-09 a AUD-14)

- `escritorio/registro-disco.js`: configuración validada en un solo lugar (AUD-11); anotado, pendiente y sin anotar para los `evento_descartado` (F05); la hora del evento perdido (A-02); la cuenta por sesión; exportar con `donde` y `codigo` (AUD-14), sin dejar pedazos, comparando bytes y con `faltan`.
- `escritorio/main.js`: los manejadores del registro no dejan escapar excepciones. `src/registro.js`: `sesion()` y un rescate que nunca lanza. `src/app.js`: la esquina por equipo (decisión de Efraín), el panel del instructor que se actualiza abierto, los textos de anotación y los errores de exportación en palabras. `src/body.html`: `aria-live` en la esquina.
- `herramientas/historia-registro.js`: admisión de exportaciones (AUD-09), copias del mismo archivo (AUD-10), tramos que tienen que existir (AUD-12), UTF-8 por línea (AUD-13), el cierre perdido (A-01) y nada comparado a través de un hueco (A-03).
- `test:registro` 202, `test:historia` 175; la sección 9 de `test:registro-app` cubre la esquina por equipo, el panel abierto, el registro apagado y el sufijo obligado con carpetas señuelo.

## 2026-10-21 · Historia del registro: el manifiesto de una exportación se valida como estructura (AUD-09-R1 de Codex)

`herramientas/historia-registro.js`, `camposMalos()`: `app`, `version_tb`, `t`, `completa`, `total`, `archivos` y `pendientes` obligatorios y con sus tipos (enteros seguros no negativos, sin convertir; un `pendientes` que falta no es cero); con `completa: false`, `faltan` y `error`. Si no es válido, la exportación no se admite. `test:historia` 192.

## 2026-10-22 · Contrato 1: confirmado en el cierre; revisión final del registro (REG-005)

Fase 5 del registro: revisión de código de los dos proyectos y corrección de lo que encontró (detalle y tabla de riesgos en COMO-FUNCIONA 70 de TecnoCircuito). Cada corrección tiene una regresión, que falla con el código anterior.

- **Contrato 1 (aditivo):** `simulacion_detenida` suma `confirmado` (decisión de Efraín). La historia no compara una corrida con `confirmado: false`, sin avisarlo como defecto.
- **`src/registro.js`:** `quitarComentarios` deja igual el `/**/` que ya separa una `\` suelta. Limpiar otra vez ya no cambia nada; antes la historia acusaba «C++ con comentarios» sobre un registro correcto. `test:registro-preprocesador` lo revisa en cada caso.
- **`src/app.js`:**
  - Si apagar el registro falla por el disco, el equipo vuelve a su sesión.
  - «Cambiar a Nano» al subir rehace el lienzo.
  - Si cambian la placa o el proyecto mientras se compila, la simulación no empieza.
  - `programa_subido` toma la placa al empezar.
  - Los cambios de equipo van en cola: un código confirmado mientras otro espera ya no se pierde.
  - Un proyecto que no abre no deja `placa_cambiada`.
  - Una librería con «-» es «libreria».
  - Los mensajes del instructor dicen qué hacer.
- **`escritorio/registro-disco.js`:** exportar intenta antes escribir lo que espera. Si la copia falla y el original no se puede abrir para leer, el error es del origen y no de la USB.
- **`escritorio/preload.js`:** el comentario de `alDescarte` dice los estados anotado, pendiente y sin anotar.

Pruebas: `test:registro` 204, `test:historia` 198, `test:registro-app` 115 (sección 10 nueva, con la app real; sus 7 regresiones fallan con el `app.js` anterior), `test:simulador` 53 y `test:registro-preprocesador` sin fallas.


## 2026-10-22 11:55 · Codex: auditoría completa de REG-005, devuelta

Auditoría completa autorizada por Efraín de CLA-20261022-002 sobre TC main cfeee9b / TB main 1c6c660 / TS main a3c8ca2 y entrega sin commit identificada por SHA256. Nueve defectos funcionales, uno de comprobación y dos documentales; seguimiento AUD-15–AUD-23 y 15 riesgos/límites con posibles soluciones. [Informe y reproducciones](../TecnoCircuito/docs/AUDITORIA-REG005-CODEX-2026-10-22.md). Sin visto bueno del conjunto ni reapertura automática de cierres históricos.

TC completo: 1251 OK y una falla de pausa; repetición aislada 18/18 sin cambios, KiCad real Uno/Nano ejecutado. TB registro 204, historia 198, preprocesador 74 con 2000 aleatorios, Electron registro 115, simulador 53, graficador 28 y generales aprobados con errores revisados. Históricos 14/14 y 23/23; diagnósticos propios Node 6 incumplimientos en 9 escenarios y Electron 4 en 5, con controles y sin errores JS. No son regresiones aprobadas. Solo datos sintéticos; fuentes y memorias de Claude preservadas, sin implementar producto, commit, push, etiqueta ni publicación. No probado instalador, USB real, hardware ni aula. Efraín decide prioridad; Claude conserva la implementación.


## 2026-10-24 — Lote alto de la auditoría de REG-005 (AUD-15, AUD-16, AUD-19 y AUD-22)

Efraín aprobó corregir primero los cuatro defectos de prioridad alta de la [auditoría de Codex](../TecnoCircuito/docs/AUDITORIA-REG005-CODEX-2026-10-22.md). Antes de corregir, los reproduje con copias de sus diagnósticos. Lo de este proyecto:

- **AUD-15 (R01), `herramientas/historia-registro.js`:** el lienzo da el primer id libre, así que si quitaban `led1` y agregaban otro LED, el nuevo también era `led1`, y el lector daba por corregida la falla del anterior. Ahora cada alta o baja de un id cambia su generación, y abrir un proyecto o un ejemplo cambia todo el circuito. Si la pieza no es la misma, la falla «ya no se observó» con el motivo.
- **AUD-22 (R10), el mismo lector:** cada archivo de una exportación se leía dos veces, una para su sha256 y otra para analizarlo; si cambiaba entre las dos, la conclusión salía de bytes que nadie comprobó. Ahora se lee una vez y ese mismo buffer sirve para el tamaño, el hash, la decodificación y el análisis.
- **AUD-19 (R05 y R07), `src/app.js`:** el C++ de un proyecto entraba con un temporizador de 200 ms, que lo ponía en el proyecto que estuviera abierto entonces, aunque ya fuera otro. Ahora entra en la misma carga. Al abrir un proyecto que falla, el respaldo se tomaba después de salir del modo texto y se perdía el C++ escrito a mano. Ahora se toma antes de cambiar nada, con su base y los bloques propios del proyecto. Los avisos diferidos de una carga (versión más nueva, versiones de Mis bloques) no se muestran si ya se abrió otro proyecto.
- **AUD-16 (R02):** la corrección está en TecnoCircuito (su bitácora). Aquí, una regresión del lector: la corrida que perdió una foto no acredita la corrección de la anterior.

Las regresiones nuevas fallan con el código anterior, reconstruido y con el mismo sha256 que auditó Codex: historia 5 de 11 (las otras son controles que pasan con los dos) y Electron 3 de 5 (los dos controles pasan con los dos).

Pruebas (corridas una tras otra): `probar:fotos` 52, `probar:contrato` 191, `probar:nucleo` 120, `probar:corte` 7; Chromium: registro 18, simulación 20, T1/T2 17, prototipo 25, servo 19. En TecnoBloques: `test:registro` 204, `test:historia` 209, `test:registro-app` 120, `test:registro-preprocesador` 74, `test:simulador` 53, `test:graficador` 28. Sin fallas. Los diagnósticos de Codex, corridos desde una copia, pasan en R01, R02 (las dos variantes), R10, R05 y R07; R03, R04, R06 y R09 siguen fallando: son del lote siguiente. No se corrió la suite global de TC, KiCad, el instalador, hardware ni el aula.

## 2026-10-25 — Lote final del registro (F01 a F05, AUD-17 a AUD-26, D01 y D02)

La verificación profunda de Codex del 24 oct ([informe](../TecnoSuite/registro/auditoria-20261024/INFORME.md)) verificó AUD-16, devolvió AUD-15, AUD-19 y AUD-22 (F02, F03 y F01) y abrió AUD-24 y AUD-25 (F04 y F05). Efraín decidió entregar en un lote todo lo que quedaba del registro, incluido el riesgo W-R1 (AUD-26, en TecnoCircuito). Lo de este proyecto:

- **AUD-22 (F01), `herramientas/historia-registro.js`:** el archivo suelto antes que su carpeta exportada perdía los bytes comprobados con el manifiesto y su restricción. Ahora el mismo archivo por dos caminos se junta en un descriptor: se analizan los bytes admitidos y vale la restricción más exigente; si dos lecturas dieron bytes distintos, no se concluye.
- **AUD-15 (F02), el mismo lector:** la identidad de la pieza (generación y aperturas) entra también en «siguen» y «nuevas». La misma falla en otra pieza con el mismo id es nueva y se nombra «pieza 2»; la anterior «ya no se observó», con el motivo.
- **AUD-19 (F03), `src/app.js`:** `texto` cadena, también vacía, abre en modo texto; `null` o sin el campo, en bloques; otro tipo se rechaza sin cambiar nada.
- **AUD-24 (F04):** al guardar, los bloques propios salen del programa en ese momento (`generarPrograma`, con los que ellos llaman), no del código que se actualiza 120 ms después.
- **AUD-25 (F05):** cada archivo elegido tiene su número; la lectura vieja no escribe, la caja se vacía al elegir otro, Abrir espera la lectura, el error se dice y escribir a mano suelta la lectura pendiente.
- **AUD-17 (R03):** la subida se toma en un objeto antes de soltar el puerto (código, placa, FQBN, puerto, equipo). Si cambia el equipo, no se sube; si cambia la placa o el puerto, se empieza otra vez una vez, y si vuelve a cambiar se dice sin subir.
- **AUD-18 (R04):** apagar y encender el registro van en la fila de los cambios de equipo; un cambio que llega con el registro apagado no empieza sesión.
- **AUD-20 (R06), `escritorio/registro-disco.js`:** el aviso al panel sale enseguida al empezar o terminar la falla, al cambiar el motivo o al perder líneas; lo que espera se avisa junto, cada 250 ms.
- **AUD-21 (R09):** la copia se hace en dos etapas, leer el original y escribir la copia, y el lado del error es la etapa que falló. Una copia distinta del original es del destino.
- **Prueba nueva** `test/proyectos-app.js` (`npm run test:proyectos`): abrir, guardar y recuperar proyectos en Electron.
- **D01 y D02:** la matriz de los 25 hallazgos y qué son sesión y corrida, en COMO-FUNCIONA 71 y el contrato de TecnoCircuito.

Pruebas (una tras otra, 25 oct): TC completo (`npm --prefix prototipo run probar`, con KiCad real y Chromium) 1277 OK y ninguna falla; en él, `probar:fotos` 71. En TecnoBloques: `test:historia` 228, `test:registro` 213, `test:registro-preprocesador` 74 (con 2000 al azar), `test:registro-app` 134, `test:proyectos` 28, `test:simulador` 53, `test:graficador` 28 y `npm test` con las dos secciones de errores vacías; sin errores en la consola. Con la versión auditada por Codex (reconstruida desde HEAD y su parche final) fallan las regresiones nuevas: historia 13 y registro 10 de las pruebas Node; registro-app 12 y proyectos 13 en Electron. Los controles pasan con las dos.

Diagnósticos de Codex, corridos desde una copia que solo cambia las rutas: lector 13/13, proyectos 10/10, bordes Electron 4/4, originales Electron 5/5, aceptación histórica 14/14 y originales Node 9 de 10. El que no pasa es R09, y en la profunda histórica del 21 oct, la copia incompleta (22 de 23): los dos inyectan el error en `fs.copyFileSync`, que la exportación ya no usa, así que el error no ocurre y la copia sale bien. Con un instrumento propio que pone el mismo error en `readFileSync` del original y en `writeFileSync` de la copia, el error de lectura es del origen y la copia incompleta queda con `completa: false` y la línea de comandos en 1. No se corrió el instalador, una USB real, hardware ni el aula.
