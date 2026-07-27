# ZONA CERO

Juego de supervivencia zombi isométrico, en un canvas 2D, **sin dependencias ni
motor**: HTML, CSS y un archivo de JavaScript. Corre en el navegador del móvil y
del ordenador.

▶ **[Jugar](https://alexizncd-hash.github.io/Juego-zomboid-survived-real/)**

> Inspirado en el género de los *survival-sim* isométricos, pero con **contenido,
> arte y textos 100% originales**. No copia assets, mapas ni bases de datos de
> ningún juego comercial.

## De qué va

El pueblo cayó. Saqueas casas y comercios, fabricas lo que necesitas, aguantas el
frío y el hambre, y sobrevives hasta que el helicóptero llega el **día 7**.

La gracia está en que el mundo **se degrada solo**:

| Día | Qué pasa |
|-----|----------|
| 3 | **Se va la luz.** Se apaga todo el alumbrado público. |
| 4 | **El botín deja de reaparecer.** Lo que saqueaste es lo que hay. |
| 5 | **Se corta el agua.** Los grifos se secan; toca lluvia hervida. |
| 7 | Llega la extracción… si aguantas. |

## Sistemas

- **Ciudad por manzanas** con retícula de calles, mobiliario urbano y farolas que
  alumbran de noche (hasta el apagón).
- **15 tipos de edificio** con interiores multi-cuarto, donde cada cuarto tiene un
  *rol* (cocina, recámara, baño, taller, celda, aula…) que decide sus muebles.
- **Botín por tabla de pesos** mueble × edificio: la misma alacena da comida en una
  bodega y refacciones en un taller. Objetos raros solo en su sitio.
- **Muebles como objetos reales**, compuestos por piezas: camas con cabecera, mesas
  servidas, estufas con quemadores, lavabos, inodoros, estanterías abiertas.
- **Puertas con cerradura** y escaparates de cristal. Tres formas de entrar: abrir,
  hacer palanca (silencioso) o a golpes (mucho ruido).
- **Estado del cuerpo**: temperatura, pánico, aburrimiento y peso cargado, cada uno
  con efectos reales sobre velocidad, puntería y aprendizaje.
- **Heridas concretas** con cura propia: sangrado (vendas), fractura (férula),
  quemadura.
- **Ropa por partes** que abriga y protege, y **equipo**: mochila, casco de minero
  con pilas, palanca, llaves de auto.
- **Vehículos por partes** (llantas, motor), sifón de gasolina, cajuela, y
  camiones/vans/autobuses como **casa rodante** donde dormir.
- **Sigilo y sentidos**: agacharse te esconde; correr, la lámpara y sobre todo el
  motor del coche te delatan. Los estruendos arrastran hordas.
- **Zombis vestidos según el edificio** donde aparecen: bata en el hospital,
  overol naranja en la cárcel, uniforme escolar…
- **Guardado local y en la nube** con un código secreto, sin cuentas ni contraseñas.

## Controles

**Teclado** · `WASD` mover · `clic` atacar · `E` interactuar · `I` inventario ·
`C` fabricar · `H` habilidades · `X` cocinar/hervir · `F` auto · `B` tapiar ·
`Z` dormir · `L` lámpara · `V` sifonar · `T` cajuela · `Q` cambiar arma ·
`R` agacharse · `1-4` objetos · `G` guardar · `SHIFT` correr · `P`/`ESC` pausa ·
`F9` "El Catador" (vigilante interno que detecta fallos en vivo).

**Móvil** · joystick a la izquierda y botones de acción a la derecha.

## Ejecutar en local

No hace falta compilar nada; solo un servidor estático porque el juego carga
`css/` y `js/` por separado:

```bash
python3 -m http.server 8123
# abre http://localhost:8123
```

Para obtener un único archivo autocontenido:

```bash
node tools/build.js      # → dist/zona-cero.html
```

## Pruebas

La suite arranca un navegador sin ventana, juega de verdad y comprueba mecánicas
(no solo que no lance errores):

```bash
./tests/run.sh              # toda la suite
./tests/run.sh puertas      # solo un grupo
```

Necesita `node` con [Playwright](https://playwright.dev/) y un Chromium. Si no
están en las rutas por defecto:

```bash
NODE_PATH=/ruta/node_modules CHROMIUM=/ruta/chromium ./tests/run.sh
```

Las pruebas levantan solas el servidor estático y un **imitador de Supabase**
(`tests/mock_supabase.py`), así que no tocan la base de datos real.

## Guardado en la nube

Sin registro. El navegador genera un **código secreto** de 128 bits; el servidor
solo guarda su `sha256`. Apuntas el código, lo escribes en otro aparato y ahí
tienes tu partida.

Las tablas tienen RLS activo y **cero políticas**: nadie puede leerlas ni
escribirlas directamente. Todo pasa por funciones `SECURITY DEFINER` que solo
tocan la fila cuyo hash coincide con el código recibido. La clave del cliente es
*publishable* y no da acceso a nada por sí sola.

Si no hay red, el juego guarda en local y **sigue funcionando igual**.

## Estructura

```
index.html          markup y pantallas
css/style.css       HUD, paneles, controles táctiles, áreas seguras
js/game.js          todo el juego
tools/build.js      empaqueta a un solo archivo
tests/              suite de pruebas + imitador de Supabase
docs/               visión de diseño y hoja de ruta
```

## Licencia

MIT — ver [LICENSE](LICENSE).
