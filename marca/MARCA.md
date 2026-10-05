# Marca TecnoBloques

![Logo horizontal](png/logo-horizontal.png)

## La idea

**Dos bloques encajados forman un robot.** Programar es encajar bloques, y los bloques se vuelven un robot.

| Elemento | Qué dice |
|---|---|
| Dos bloques que encajan (pestaña y muesca) | **Programación por bloques**: cada instrucción encaja con la siguiente |
| Ojo engranaje | **Robótica** |
| Ojo cursor y `</>` en el cuerpo | **Código**: detrás de los bloques hay C++ real |
| Antena en forma de T | **TecnoAcademia** |

El robot es también la **mascota** de la herramienta.

## Colores

| Color | Código | Uso |
|---|---|---|
| Verde SENA | `#39A900` | Cabeza del robot, palabra "Bloques" |
| Azul SENA | `#00304D` | Fondo del ícono, cara, palabra "Tecno" |
| Blanco | `#FFFFFF` | Cuerpo del robot sobre fondos oscuros |

Los valores siguen la paleta institucional del SENA. Antes de imprimir material oficial, confírmalos con el manual de identidad del SENA.

En la interfaz del editor, el verde de los botones es un poco más oscuro (`#2c8a1c` en tema claro) para que el texto blanco se lea bien (contraste AA). El de la marca se usa en el logo y en los íconos.

## Tipografía

**Atkinson Hyperlegible**, en negrita para el nombre. Es la misma de la interfaz: fue diseñada para lectores con baja visión y es muy legible para niños y niñas. Es libre (Google Fonts).

El nombre se escribe junto: **Tecno** (azul o blanco) + **Bloques** (verde). Debajo, la línea de respaldo **TecnoAcademia Tolima · SENA**.

## Archivos

| Archivo | Para qué |
|---|---|
| `svg/simbolo-app.svg` | Ícono principal (robot sobre fondo azul). App, web, materiales |
| `svg/simbolo-cabeza.svg` | Solo la cabeza, para 16–24 px (pestaña del navegador, barra de tareas) |
| `svg/simbolo-sobre-claro.svg` / `simbolo-sobre-oscuro.svg` | Robot sin fondo, según el fondo donde va |
| `svg/una-tinta-azul.svg` / `una-tinta-blanca.svg` | Una sola tinta: stickers, grabado láser sobre los robots, impresión económica |
| `png/icono-<tamaño>.png` | 16 a 1024 px (16 y 24 usan solo la cabeza) |
| `png/logo-horizontal.png` / `logo-horizontal-oscuro.png` | Símbolo + nombre, para fondos claros / oscuros |
| `png/compartir.png` | 1200 × 630, para compartir enlaces (WhatsApp, redes) y la vista previa de GitHub |
| `../escritorio/icono.ico` | Ícono de Windows (7 tamaños) para la app y el instalador |

**Todo sale de `generar.py`.** Para cambiar la marca se edita ese archivo y se corre `python marca/generar.py`; luego `npm run build` (web) y `npm run instalador` (app).

## Reglas de uso

- Deja alrededor del símbolo un espacio libre de al menos la altura de la antena.
- Tamaño mínimo: el robot completo desde 32 px; por debajo, usa la cabeza sola.
- No cambies los colores, no estires el dibujo, no le agregues sombras ni contornos, y no pongas el símbolo verde-azul sobre fondos verdes (usa la versión de una tinta).
- El logo del SENA no se mezcla dentro del símbolo. Si una pieza lleva ambos, van separados según el manual del SENA.
