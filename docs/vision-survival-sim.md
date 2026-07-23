# ZONA CERO — Visión de survival-sim profundo (inspiración de género)

> Objetivo: replicar la **profundidad y la sensación** de un survival-sim
> isométrico de zombis, con **contenido y arte 100% propios**. No se copia
> ningún asset, mapa, texto ni base de datos de ningún juego comercial —
> solo se implementan mecánicas de género (que no son propiedad de nadie).
> Todo en el mismo motor de un archivo (canvas 2D, sin dependencias).

Esta hoja de ruta amplía `docs/roadmap-fases-4-6.md` y el spec de la ciudad
saqueable. El `/loop` debe ir tomando UN incremento acotado por ciclo, en el
orden sugerido, probando en headless y desplegando.

---

## 1. Necesidades y estado del personaje (moodles)

Además de vida/hambre/sed/energía actuales, añadir de forma gradual:

- **Fatiga/sueño** (ya existe) con penalización a velocidad y daño.
- **Aburrimiento** y **estrés/pánico**: suben con el tiempo, cerca de zombis o
  en oscuridad; se bajan leyendo, con radio/TV, descansando en zona segura.
  El pánico empeora la puntería y la velocidad de ataque.
- **Temperatura corporal**: frío de noche/lluvia/invierno, calor de día/fuego.
  La ropa y las fogatas regulan; hipotermia/insolación dañan.
- **Peso transportado**: la mochila define capacidad; ir sobrecargado agota
  más rápido y frena.
- **Heridas específicas**: mordida (infección, ya existe), rasguño, corte por
  vidrio, fractura, quemadura; cada una con su cura (vendas, alcohol, férula,
  analgésico) y su efecto.
- **Moodles** en HUD (ya hay iconos): ampliar a hambre, sed, cansancio, sueño,
  aburrido, estresado, con frío, con calor, herido, infectado, sobrecargado,
  enfermo, ebrio.

## 2. Habilidades y aprendizaje

Ampliar el sistema actual (carpintería, mecánica, electricidad, medicina,
fuerza) con la lógica de "aprender leyendo + practicando":

- Más habilidades: **cocina, agricultura, pesca, sigilo, puntería, cerrajería,
  costura, fitness/cardio**.
- **Libros por nivel** (vol. 1–5): cada libro multiplica la XP ganada hasta su
  tope; leer toma tiempo de juego.
- **Programas de TV/radio** que enseñan si sintonizas a la hora correcta
  (primeros días antes de que caiga la señal).
- Cada nivel desbloquea recetas y mejora resultados (más rendimiento, menos
  desperdicio, mejor condición del objeto fabricado).

## 3. Fabricación por pasos y estaciones (Fase 4 ampliada)

- Cadenas de varias etapas: **material bruto → componente → objeto**
  (p. ej. chatarra→lingote→hoja + mango→arma).
- **Estaciones**: banco de trabajo, fragua, mesa de costura, cocina/estufa,
  fogata, alambique; ciertas recetas requieren estar junto a la estación y
  tener la herramienta correcta (ya existe el gating por herramienta).
- **Desmontaje** de muebles/objetos para recuperar materiales (ya existe para
  muebles; extender a electrónicos→componentes, ropa→tela, etc.).

## 4. Construcción de base y fortificación

- Construir/quitar: muros, marcos de puerta, puertas, ventanas, vallas,
  escaleras, pisos, contenedores de almacenamiento.
- **Tapiar** puertas/ventanas (ya existe) con niveles de resistencia según
  carpintería.
- **Trampas y cebos** de ruido para desviar hordas.
- Colocar muebles fabricados (cama, estanterías de almacenaje, letrero).

## 5. Comida, cocina y agricultura

- **Estados de la comida**: fresca → cocida → rancia → podrida; congelador la
  conserva (requiere electricidad).
- **Recetas de cocina** que combinan ingredientes para más saciedad y menos
  riesgo (comer crudo/podrido enferma).
- **Huerto**: labrar, sembrar (semillas de loot), regar (agua), cosechar;
  crece con los días. Riesgo de plagas.
- **Agua**: potable de la red (mientras haya), embotellada, o **de lluvia
  recogida** que hay que **hervir** para purificar.

## 6. Utilidades que se agotan (Fase 6, núcleo del survival)

- **Electricidad de la red**: se corta en un día X; después solo dan luz los
  **generadores** (consumen gasolina, hacen ruido). El congelador deja de
  conservar comida.
- **Agua de la red**: se corta en un día Y; después dependes de embotellada,
  lluvia hervida o pozos.
- **Gas** para la estufa: bombonas que se acaban.
- Curva de escasez creciente por día → el saqueo temprano importa; frenar el
  **respawn infinito de loot** (timer `f.rt`) para que la escasez sea real.

## 7. Vehículos (ampliar)

- Tipos ya existen (sedán, van, pickup, camión, autobús). Añadir: llave de
  contacto o **puente** (mecánica), **batería**, **combustible** real,
  **maletero/cajuela** como almacenamiento, **daño por partes** (llantas,
  motor, capó), **sifonar gasolina** de otros autos.
- **Vehículos-hogar** (Fase 5): dormir dentro; modificar camión/autobús para
  vivir (cama, almacenaje, tapiar ventanas, generador).

## 8. Estructuras y ciudad (Fase 2–3, ya en marcha)

- **Trazado urbano por manzanas** con calles, banquetas, cruces, mobiliario
  urbano (postes de luz que alumbran de noche, contenedores, hidrantes,
  semáforos, autos estacionados en batería).
- **Catálogo de edificios** con interiores multi-cuarto (ya implementado) y
  roles de cuarto: casas con cochera, tienda, ferretería, farmacia, barbería,
  hospital, comisaría, cárcel, taller mecánico, escuela, bar, bodega,
  gasolinera, restaurante, iglesia, oficina.
- **Puertas con cerradura**: abrir con palanca (silencioso), a golpes (ruido)
  o rompiendo el **escaparate de cristal** (mucho ruido).
- Edificios pegados a la banqueta formando manzanas; casas con jardín.

## 9. Loot por localización (tabla de pesos edificio × mueble)

- Cada mueble en cada tipo de edificio tiene su propia tabla de pesos con
  **rarezas** (objetos potentes con peso bajo, solo en su sitio):
  - Ferretería → herramientas, clavos, tablones, láminas, cinta, pilas.
  - Farmacia/hospital → antibióticos, analgésicos, vendas, morfina, vitaminas.
  - Comisaría/cárcel → pistola, escopeta, munición, chaleco, palanca, macana.
  - Taller → gasolina, llave inglesa, refacciones, batería.
  - Tienda/bodega → comida, agua, bolsas en volumen.
  - Bar/restaurante → alcohol, comida, bate.
  - Casas → mixto (cocina, recámara, baño, cochera).
- Ya existe `maybeThemed(bt,kind)`; convertirlo en tabla de pesos por
  combinación en vez de cadenas de `if`.

## 10. Ítems y equipo

- **Casco de minero / lámpara de casco**: linterna manos libres (cono sigue la
  mirada, arma libre); consume **pilas**.
- **Mochila**: sube capacidad de 6→12 por ítem; **inventario/mochila** con
  tecla `I` o botón.
- **Palanca** (abre puertas, arma media), **martillo+clavos** (tapiar),
  **serrucho** (talar/desmontar), **llaves de auto**.
- Armas: cuchillo, machete, macana, bate, hacha, llave inglesa, pistola,
  escopeta (munición aparte, cono corto, mucho ruido).
- Ropa con **abrigo** y **protección** (chaleco ya existe): chamarra, botas,
  casco, guantes; reduce mordida/corte y regula temperatura.

## 11. Zombis: población, tipos y sentidos

- **Sentidos**: oído (el ruido de disparos, autos y alarmas atrae), vista
  (línea de visión y luz), olfato leve. El **sigilo** (agacharse, caminar
  lento, ropa oscura) reduce la detección.
- **Población meta creciente por día** y **migración de hordas** hacia el ruido.
- Tipos (ya hay normal/corredor/tanque): mantener y **vestir a los zombis
  según el edificio** donde aparecen (bata en hospital, azul en comisaría,
  overol en taller, naranja en cárcel).
- Meta-eventos: helicóptero/alarma que arrastra una horda a una zona.

## 12. Clima, tiempo y atmósfera (ya iniciado)

- Ciclo día/noche con gradación de color (hecho), clima lluvia/niebla (hecho),
  **estaciones** que afractan temperatura y cultivos, tormentas.
- Sonido ambiental, luz de fogatas/generadores/postes, sangre y cadáveres
  persistentes.

## 13. UI/UX

- **Inventario/mochila** con peso, y ventana de **fabricación** por categorías
  (ya hay menú). Panel de **habilidades** (hecho).
- Minimapa que tiñe edificios por tipo (hecho) y marca descubiertos.
- Contextual: nombre del negocio al entrar (hecho), pista de saqueo con estado
  (cerrado con llave, etc.).

---

### Orden sugerido para el loop

1. Trazado urbano por manzanas + mobiliario urbano.
2. Catálogo ampliado de edificios con roles de cuarto.
3. Tabla de pesos de loot por edificio × mueble + rarezas.
4. Ítems: casco de minero, palanca, mochila, pilas, llaves de auto; inventario.
5. Puertas con cerradura y escaparates rompibles.
6. Utilidades que se agotan (luz/agua/gas) + frenar respawn de loot.
7. Necesidades ampliadas y moodles (temperatura, pánico, aburrimiento, peso).
8. Cocina/comida perecedera + huerto + agua de lluvia hervida.
9. Vehículos-hogar y mecánica de vehículos por partes.
10. Zombis: sentidos, sigilo, migración de hordas, vestimenta por edificio.

Cada punto es varios commits pequeños y verificados. Nunca romper lo que ya
funciona (guardado, techos que se ocultan, muros delgados, habilidades,
fabricación, clima, autos).
