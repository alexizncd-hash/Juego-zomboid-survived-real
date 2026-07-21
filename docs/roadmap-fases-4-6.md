# ZONA CERO — Roadmap técnico: Fases 4, 5 y 6

Documento de trabajo para implementar directamente sobre `js/game.js` (archivo único,
~2200 líneas, todo en el mismo scope global). No se modifica código en este documento;
es la especificación para hacerlo después.

Convenciones que ya usa el juego y que estas fases **deben respetar**:

- Los recursos simples viven como campos planos en `player` (`player.wood`, `player.scrap`…),
  no en un sub-objeto. Los recursos nuevos deben seguir el mismo patrón para no romper
  `canAfford()`, `renderCraft()` (que lee `player[m]`) ni `catadorTaste()` (que sanea
  `player.wood, player.scrap, ...` por nombre).
- Cualquier material nuevo usado en una receta se registra en `MATS` (icono + nombre) —
  `renderCraft()` y `craftItem()` son 100% genéricos sobre `RECIPES`/`MATS`, así que casi
  todo el contenido nuevo de estas fases es **datos**, no lógica nueva.
- Objetos colocables en el mundo (fogata, generador) siguen el patrón `placeX()` +
  `freeTileAhead()` + `fires.push(...)`. Las nuevas estaciones/objetos deben imitarlo.
- Todo lo que deba sobrevivir a un guardado tiene que colgar de un array/objeto que
  `saveGame()` ya serializa (`player`, `cars`, `furns`, `fires`, `barrs`) o de un array
  nuevo que se añada explícitamente a `saveGame()`/`loadGame()`.
- `SAVE_VER` es un entero simple; si `s.v!==SAVE_VER` el guardado entero se descarta
  (no hay migración entre versiones, solo relleno de campos faltantes *dentro* de la
  misma versión, ver los `if(!player.inv)` en `loadGame()`). Cada fase que cambie el
  esquema de guardado debe subir `SAVE_VER` y añadir sus propios rellenos por defecto.

Mapa de teclas ya ocupadas (ver `addEventListener('keydown', ...)`):
`m,f9,p/esc,c,h,e,q,1,2,3,4,f,b,z,x,g` + WASD/flechas para moverse.
Teclas nuevas que reservan estas fases (sin colisión con las anteriores):

| Tecla | Acción | Fase |
|---|---|---|
| `E` (reutilizada) | interacción contextual genérica: registrar mueble/caja/auto, llenar cantimplora en grifo, recoger agua de barril | 6 (extiende `tryLoot`) |
| `V` | cargar / soltar mueble | 4 |
| `T` | abrir/cerrar cajuela del vehículo cercano | 4, 5 |
| `Y` (mantener) | sifonear gasolina de un auto a tu bidón | 4 |
| `R` | entrar/salir del modo "vivienda" de un vehículo-hogar | 5 |
| `N` | rellenar un generador con gasolina | 6 |

---

## FASE 4 — Crafteo por pasos e interacción real

### 1. Objetivo de diseño
Romper el crafteo de un solo paso (`RECIPES` plano, coste → objeto) introduciendo una
cadena chatarra → lingote → hoja → arma ensamblada, que obliga a construir y usar
**estaciones** (banco de trabajo, fragua). Además, dar más textura al mundo: saqueo con
animación, muebles que se pueden mover, y autos con cajuela persistente + sifonado de
gasolina (hoy `bomba`/loot de auto son la única fuente de combustible).

### 2. Estructuras de datos nuevas

**Materiales intermedios** (siguen el patrón de `player.wood`/`player.scrap`):
```js
// en el objeto player (init())
player.ingot = 0;   // lingote de acero
player.blade = 0;   // hoja forjada

// en MATS (junto a wood/scrap/cloth/alcohol)
ingot:{ic:'⚙️',n:'lingote'},
blade:{ic:'🗡️',n:'hoja forjada'}
```

**Estaciones** — nuevo array global `stations` (paralelo a `fires`/`barrs`, no usa SOLID
porque, igual que `fires`, no bloquea el paso — se dibuja directo desde el array en `draw()`):
```js
let stations = [];  // declarar junto a `let fires=[]`
// cada elemento: {gx, gy, type:'workbench'|'forge'}
const STATION_DEF = {
  workbench:{label:'Banco de trabajo', h:22, c:['#6b4f2a','#523c1f','#7d5f38']},
  forge:{label:'Fragua', h:28, c:['#3a3a36','#26261f','#4a4a40'], ember:true}
};
```

**Arma nivel 4** — se añade una entrada a `MELEE` (el índice se vuelve `player.wTier===4`,
todo el resto del combate ya es genérico por índice):
```js
MELEE.push({n:'Espada forjada',dmg:60,range:1.3,arc:2.0,cd:.46,dur:150});
```

**Muebles con animación de saqueo**: campo `animT` en cada `furn` (se inicializa en 0,
no requiere guardarse si se acepta que una animación en curso se corte al recargar):
```js
// en tryLoot(), cuando nl.label es un mueble:
nl.o.animT = 0.4;  // segundos de animación de "abrir cajón/puerta"
// en update(): for(const f of furns) if(f.animT>0) f.animT=Math.max(0,f.animT-dt);
// en drawFurn(): usar f.animT (0..0.4) para desplazar/rotar la puerta dibujada
```

**Mueble cargable**: campo en `player`:
```js
player.carrying = null;  // referencia directa al objeto furn que se está cargando
```

**Cajuela de auto** (persistente, distinta del loot de un solo uso que ya existe):
```js
// al crear cada auto en genWorld(), o de forma perezosa la primera vez que se abre:
c.trunk = {food:0,water:0,med:0,anti:0,wood:0,scrap:0,cloth:0,alcohol:0,gas:0,ingot:0,blade:0};
c.trunkCap = {sedan:4,van:8,pickup:6,truck:10,bus:10}[c.type];
```
Como `cars` ya se serializa completo en `saveGame()`, `c.trunk`/`c.trunkCap` se guardan
gratis; solo hace falta un relleno por defecto en `loadGame()` para autos de partidas viejas:
```js
for(const c of cars) if(!c.trunk) c.trunk={food:0,water:0,med:0,anti:0,wood:0,scrap:0,cloth:0,alcohol:0,gas:0,ingot:0,blade:0};
```

### 3. Funciones nuevas y dónde encajan

En la sección `/* ================= FABRICACIÓN ================= */`:
- `nearStation(type)` — igual forma que `nearFire()`/`nearBed()`, radio ~1.8.
- `placeStation(type)` — clon de `placeFire()`/`placeGen()` usando `freeTileAhead()`.
- `drawStation(st)` — clon de `drawFire()` para renderizar banco/fragua (llamado desde
  el bucle de `items` en `draw()`, nuevo `kind:'station'` empujado igual que `kind:'fire'`).
- Añadir `stations` a `buildStatics()`-style de visibilidad (no necesita entrar en
  `statics` porque, como `fires`, se recorre directo en `draw()` con culling propio —
  seguir exactamente el bloque `for(const f of fires){...items.push({kind:'fire',...})}`).

En la sección `/* ================= v4: BARRICADAS Y TALA ================= */` (o una
nueva subsección "MUEBLES"):
- `tryCarryFurniture()` (tecla `V`): si `!player.carrying`, busca con `nearLoot()`-style
  el mueble más cercano *no fijo* (excluir `bomba`, que está anclada a la gasolinera);
  hace `SOLID[idx(f.gx,f.gy)]=0`, `player.carrying=f`. Si ya está cargando, intenta soltar
  en `freeTileAhead()`: valida tile libre, `SOLID[idx]=4`, `f.gx=ti;f.gy=tj`, y llama
  `buildStatics()` para refrescar la entrada de `statics` que apunta a ese `furn` (barato:
  ocurre solo en la acción explícita de soltar, no por frame).
- En `draw()`: mientras `player.carrying`, no dibujarlo desde `statics` (chequear
  `st.o!==player.carrying` en el filtro existente) y en su lugar empujar un item
  `{kind:'furn', o:player.carrying, gx:Math.floor(freeTileAhead-preview), ...}` como
  "fantasma" delante del jugador (o, más simple: dibujarlo pegado a `player.gx,player.gy`
  con `ctx.globalAlpha=.7`).

En `/* ================= v4: AUTOS ================= */`:
- `openTrunk()`/`closeTrunk()` (tecla `T`, solo si `nearCar()&&!inCar`): abre un panel
  modal nuevo (ver UI) con dos columnas: inventario de `player` (`wood,scrap,cloth,
  alcohol,gas,ingot,blade,inv.food,inv.water,inv.med,inv.anti`) y `c.trunk`.
- `trunkTransfer(car,mat,dir)`: mueve 1 unidad entre `player`/`player.inv` y `c.trunk`,
  respetando `c.trunkCap` como límite de **unidades totales** en el trunk (sumar todas
  las claves de `c.trunk`).
- `trySiphonGas()` (tecla `Y`, mantener 1.2s cerca de un auto con `fuel>0` y `!inCar`):
  progreso por frame en `update()` igual que un `cd`; al completarse,
  `car.fuel=Math.max(0,car.fuel-10); player.gas++;`. Interrumpir si el jugador se mueve
  o un zombi se acerca (mismo chequeo que `trySleep()`).

### 4. Recetas/items nuevos (añadir a `RECIPES`, junto a `reparar`)
| id | Nombre | Costo | Requisito | Efecto |
|---|---|---|---|---|
| `banco` | Banco de trabajo | `wood:6, scrap:2` | `carp:2` | `placeStation('workbench')` |
| `fragua` | Fragua | `scrap:6, wood:2` | `carp:3` | `placeStation('forge')` |
| `fundir` | Fundir lingote | `scrap:3` | `mech:1` | requiere `nearStation('forge')`; `player.ingot++` |
| `hoja` | Forjar hoja | `ingot:1` | `carp:2` | requiere fragua; `player.blade++` |
| `espada` | Espada forjada | `blade:1, wood:2, cloth:1` | `carp:3` | requiere `nearStation('workbench')`; `equipWeapon(4)` |

Todas siguen exactamente el molde de `craftItem()`/`canAfford()`/`meetsReq()` ya
existente — el único código nuevo por receta es el `can:()=>...` que consulta
`nearStation(...)`, igual que `reparauto` ya consulta `nearCar()||inCar`.

### 5. Cambios de UI
- Nuevo modal `#trunk` (mismo patrón que `#craft`/`#skills`: `display:none` por defecto,
  se abre con `.style.display='flex'`), con `DOM.trunk`, `DOM.trunkList` cacheados en `DOM`.
- `renderCraft()` empieza a mostrar recetas "bloqueadas por estación" — ya soportado por
  el mecanismo `can`/`why` existente, solo hay que escribir textos claros
  (`why:'Necesitas estar junto a una Fragua'`).
- Considerar agrupar `RECIPES` por categoría (`cat:'armas'|'construccion'|'auto'|'estacion'`)
  y pintar sub-encabezados en `renderCraft()`, porque la lista plana ya tiene ~11 recetas
  y esta fase añade 5 más.
- `updateHUD()`: extender el `DOM.hint` (hoy solo `nearLoot()`) para mostrar
  "V — CARGAR MUEBLE" / "T — CAJUELA" / "Y — SIFONEAR" cuando aplique, con prioridad
  (loot de caja/mueble > cajuela > sifonar) porque solo hay una línea de hint.

### 6. Integración con guardado
- `saveGame()`: añadir `stations` al objeto serializado (junto a `fires,barrs`).
- `loadGame()`: `stations=s.stations||[];` + relleno de `c.trunk`/`c.trunkCap` descrito
  arriba + `player.ingot=player.ingot||0; player.blade=player.blade||0;`.
- `player.carrying` **no** se serializa tal cual (es una referencia a un objeto `furn`,
  no un índice — igual que se hace con `inCar` guardando `cars.indexOf(inCar)`, aquí
  conviene forzar `player.carrying=null` justo antes de `saveGame()` si el jugador
  estaba cargando algo, soltándolo en el tile actual para no perder el mueble).
- Subir `SAVE_VER` (p. ej. de 3 a 4).

### 7. Orden de implementación sugerido
1. `MATS`/`player.ingot`/`player.blade` + 5 recetas nuevas (sin tocar el motor —
   validación rápida de que `craftItem` genérico soporta la cadena).
2. `MELEE[4]` (espada) — probar que `equipWeapon(4)` funciona por índice.
3. `stations` array + `placeStation`/`nearStation`/`drawStation` + integración en `draw()`.
4. `tryCook`-style: nada nuevo aquí, ya cubierto por craft.
5. Cajuela de auto (`c.trunk`, modal, `trunkTransfer`) — es la pieza de UI más grande.
6. Sifonado de gasolina (`trySiphonGas`, tecla `Y`).
7. Animación de saqueo (`f.animT`) — puramente cosmético, va al final.
8. Cargar/mover muebles (`tryCarryFurniture`) — la más delicada por tocar `SOLID`.
9. Guardado (`SAVE_VER`, rellenos) al cerrar la fase.

### 8. Riesgos técnicos
- **`SOLID` desincronizado**: si `tryCarryFurniture()` no limpia bien `SOLID[idx]` al
  recoger o falla al soltar sobre un tile ya ocupado, un zombi puede quedar atravesando
  una pared invisible o el jugador puede "perder" un mueble sin `SOLID=4` ni entrada
  válida en `statics`. Mitigación: validar `freeTileAhead()` (ya existe) antes de soltar,
  y si no hay tile libre, cancelar sin gastar el "agarre".
- **`RECIPES` plano se vuelve inmanejable**: 16+ recetas en una sola lista sin categorías
  degrada la UX del panel de crafteo; conviene resolver el agrupamiento visual en el
  mismo PR que añade las recetas, no después.
- **Doble llave para "usar arma nivel 4"**: el loot aleatorio (`rollLoot` en `ropero`/
  `casillero`/caja) ya tira tiers `1..3` — verificar que ningún `irand`/`rr<` existente
  se reutilice sin querer para tirar tier 4 por loot (debe ser *solo* craftable).
- **UI nueva sin HTML**: el modal de cajuela requiere marcado en `index.html` y estilos
  en `css/style.css` que este documento no puede tocar; queda pendiente para la
  implementación real.

---

## FASE 5 — Vehículos-hogar

### 1. Objetivo de diseño
Permitir que `van`, `truck` y `bus` (los tipos con `T.cargo`/`T.rows` en `VTYPE`) se
conviertan en base móvil: cama instalada, cajuela ampliada (reutiliza `c.trunk` de la
Fase 4), ventanas tapiadas y generador propio. Importante decisión de diseño: el motor
**no tiene un mapa de interiores real** (es una sola grilla isométrica); en vez de crear
una escena separada, el "interior" se modela como un modo de estado sobre el propio
objeto `car` — el jugador queda anclado a `c.gx,c.gy` (igual que ya hace `driveCar()`
con `player.gx=c.gx`) pero sin control de movimiento, protegido porque `carPush()` ya
impide que los zombis se solapen con el círculo de colisión del auto (`c.r`).

### 2. Estructuras de datos nuevas

```js
const HOMEABLE = ['van','truck','bus'];  // VTYPE elegibles para vivienda

// campo perezoso en cada car, creado la primera vez que se instala algo:
c.home = null;
// tras la primera mejora:
c.home = {
  bed:false,       // cama instalada → duerme aquí
  boarded:false,   // ventanas tapiadas → reduce alcance de detección de zombis cerca
  gen:false,       // generador instalado dentro
  genFuel:0        // combustible del generador del vehículo (litros/unidades, ver Fase 6)
};

// puntero de estado global, paralelo a `inCar` pero NO mutuamente excluyente en el
// dato (sí en la interacción: no se puede conducir y estar "en modo hogar" a la vez):
let inHome = null;  // referencia al car, o null
```

`c.home` cuelga de `cars`, que ya se serializa completo — no hace falta tocar
`saveGame()` para los datos en sí, solo el puntero `inHome` (mismo patrón que `inCar`).

### 3. Funciones nuevas y dónde encajan

En una nueva subsección `/* ================= v5: VEHÍCULOS-HOGAR ================= */`
(después de `/* ================= v4: AUTOS ================= */`):
- `ensureHome(c)`: `if(!c.home) c.home={bed:false,boarded:false,gen:false,genFuel:0};`
- `nearHomeableCar()`: como `nearCar()` pero filtra `HOMEABLE.includes(c.type)` y
  `c!==inCar` (debe estar aparcado, no en marcha).
- `enterExitHome()` (tecla `R`): si `inHome`, sale (coloca al jugador junto al auto con
  la misma lógica de offsets que usa `enterExitCar()` al bajar) y `inHome=null`. Si no,
  busca `nearHomeableCar()`; si `c.home===null` aún no se ha construido nada → mensaje
  "Instala al menos una cama (banco de crafteo)". Si `c.home.bed` existe, `inHome=c`.
- `installBed(c)`, `boardVehicle(c)`, `installVehicleGen(c)`, `expandTrunk(c)`: mutan
  `c.home`/`c.trunkCap`, llaman `ensureHome(c)` primero, dan `gainXP('carp'|'elec'|'mech', …)`.
- Modificar `trySleep()`: además de `nearBed()`, aceptar dormir si `inHome && inHome.home.bed`.
  El resto de la función (chequeo de zombis cerca, `sleepTick`) se reutiliza tal cual;
  si `inHome.home.boarded`, relajar el radio de "demasiado peligro" (hoy `<6`) a `<3`.
- `update()`: cuando `inHome`, tratarlo como una rama adicional junto a
  `if(player.sleeping){...return;}` — mientras `inHome` y no dormido, el jugador puede
  craftear/usar objetos pero no se mueve ni ataca (similar a estar en `inCar` pero sin
  `driveCar()`).

### 4. Recetas/items nuevos (añadir a `RECIPES`)
| id | Nombre | Costo | Requisito | Efecto |
|---|---|---|---|---|
| `camaAuto` | Instalar cama en vehículo | `wood:4, cloth:3` | `carp:2` | requiere `nearHomeableCar()`; `installBed()` |
| `tapiarAuto` | Tapiar ventanas del vehículo | `wood:3` | `carp:1` | `boardVehicle()` |
| `genAuto` | Generador del vehículo | `scrap:5, wood:2` | `elec:2` | `installVehicleGen()` |
| `cajuelaAmpliada` | Ampliar cajuela | `scrap:4, wood:3` | `mech:2` | `c.trunkCap+=6` |

Todas con `can:()=>!!nearHomeableCar()`, `why:'Necesitas estar junto a una van/camión/autobús aparcado'`.

### 5. Cambios de UI
- `DOM.hint` contextual: "R — VIVIR EN ESTE VEHÍCULO" cuando `nearHomeableCar()&&!inCar`.
- `updateHUD()`: cuando `inHome`, `DOM.wName.textContent='🏠 En tu vehículo-hogar'`
  (mismo `if(inCar){...}` extendido con `else if(inHome){...}`).
- Iconos sobre el vehículo en `drawCar()`: si `c.home`, dibujar pequeños íconos
  (🛏️/🔨/💡) encima del techo, igual que hoy se dibuja el punto amarillo de "sin
  saquear" (`if(!c.looted){...arc...}`) — mismo lugar del código, condicionado a `c.home`.
- El panel de cajuela de la Fase 4 debe mostrar `c.trunkCap` actualizado tras
  `cajuelaAmpliada`.

### 6. Integración con guardado
- `cars` ya serializa `c.home` por ser parte del objeto — sin cambios en `saveGame()`.
- `loadGame()`: relleno defensivo `for(const c of cars) if(c.home===undefined) c.home=null;`
- Guardar/restaurar el puntero de estado: `inHome:inHome?cars.indexOf(inHome):-1` en
  `saveGame()` (mismo patrón que `inCar`), y en `loadGame()`:
  `inHome=(s.inHome>=0&&s.inHome<cars.length)?cars[s.inHome]:null;`.
- Al guardar, si `inHome` y el jugador está fuera de una cama (`!player.sleeping`), no
  hace falta forzar nada — a diferencia de `player.carrying` (Fase 4), `inHome` es un
  índice válido y no una referencia ambigua.
- Subir `SAVE_VER` otra vez si esta fase se entrega por separado de la Fase 4.

### 7. Orden de implementación sugerido
1. `HOMEABLE`, `ensureHome`, `nearHomeableCar()` — sin efectos visibles todavía.
2. Las 4 recetas nuevas usando el `RECIPES` genérico (validación rápida end-to-end).
3. `enterExitHome()` + rama en `update()` (bloquear movimiento/ataque mientras `inHome`).
4. Integrar con `trySleep()`/`sleepTick()`.
5. Iconos en `drawCar()` + hint en `updateHUD()`.
6. Guardado (`inHome`, rellenos de `c.home`).

### 8. Riesgos técnicos
- **Ambigüedad de la tecla `F`**: `enterExitCar()` ya usa `F` para subir/bajar del auto.
  Se decidió *no* sobrecargar `F` y usar `R` aparte para evitar que "quería dormir y
  terminé conduciendo" — pero esto obliga a explicar bien las dos teclas en el hint,
  porque conceptualmente son "la misma acción de acercarse al vehículo".
- **Los zombis no atacan autos aparcados**: hoy el único daño que reciben los `cars` es
  por colisión a velocidad (`driveCar()`, `sp>3`); no existe lógica de zombis golpeando
  un auto detenido (a diferencia de `barrs`, que sí tienen `hitBarr()`). Esto significa
  que "tapiar ventanas" es cosmético/de detección, no defensivo — si se quiere que sea
  una mejora real de supervivencia, haría falta añadir zombis-atacan-auto-parqueado como
  extensión futura (fuera de alcance de esta fase, pero se documenta la limitación).
- **Sin escena de interior real**: anclar al jugador a `c.gx,c.gy` es una simplificación
  deliberada coherente con el motor actual; no soporta múltiples entidades dentro del
  "vehículo" a la vez ni vistas internas distintas — aceptable para un survival en
  miniatura, pero debe documentarse como decisión consciente, no como bug.
- **Auto destruido con `home` instalado**: si `c.hp` llega a 0 (no hay lógica de
  destrucción de autos hoy, `c.hp` solo se usa para tintar el sprite con `shade(c.col,-55)`
  cuando `c.hp<45` — no hay `die`/remove de auto), no hay riesgo real de perder el hogar,
  pero conviene confirmarlo explícitamente antes de implementar penalizaciones por daño.

---

## FASE 6 — Economía de recursos que se agota

### 1. Objetivo de diseño
Que el paso de los días vuelva escasos el agua corriente, la electricidad "de red" y la
gasolina, obligando a: recolectar agua de lluvia (`weather.type==='rain'`, ya existe),
hervirla en una fogata (`fires`, no-`gen`) para purificarla, y mantener generadores con
`player.gas`. La curva de escasez se basa en `dayNum()` y en `CFG`, todo ajustable desde
un único lugar como ya es costumbre en el archivo.

**Punto de partida importante**: el sistema de clima (`rollWeather()`) ya hace que la
probabilidad de lluvia/niebla crezca con el día (`bad=Math.min(.6,.22+day*.05)`), así que
la escasez de agua corriente y la mayor disponibilidad de lluvia ya están, sin tocar
nada, narrativamente sincronizadas — esta fase debe apoyarse en eso, no duplicarlo.

**Riesgo de diseño a resolver primero**: hoy el saqueo es infinito — cualquier `furn`/
`crate`/`car` saqueado vuelve a dar loot tras `rt` segundos (`if(f.looted){f.rt-=dt;
if(f.rt<=0)f.looted=false;}` en `update()`). Si esta fase no toca ese timer, la escasez
de agua/gas es cosmética porque el jugador puede seguir "granjeando" botellas de agua
en el mismo estante indefinidamente. Por eso el punto 3 incluye un cambio explícito ahí.

### 2. Estructuras de datos nuevas

**Constantes de balance** (añadir a `CFG`):
```js
CFG.tapWaterFailDay = 3;     // desde este día los grifos ya no dan agua
CFG.gasStationDryBase = .75; // probabilidad de éxito en bomba el día 1
CFG.gasStationDryPerDay = .09;// cuánto baja esa probabilidad por día transcurrido
CFG.gasStationDryMin = .08;  // piso: nunca queda en 0% (siempre hay algo de suerte)
CFG.lootRespawnDayScale = .16;// cuánto se alarga el respawn de loot por día
CFG.genFuelDrain = .55;      // consumo de combustible del generador por segundo
CFG.rainBarrelRate = .09;    // litros/seg que junta un barril con lluvia intensa (inten=1)
CFG.rainBarrelCap = 8;
```

**Nuevo mueble saqueable/interactivo `grifo`** (fuente de agua corriente, se seca con el día):
```js
FURN.grifo = {h:16,c:['#8a8f92','#6c7175'],label:'grifo'};
// añadir 'grifo' a los pools de furniture de casas/hospital/tienda en genWorld()/carveBuilding
```

**Barriles de lluvia** — nuevo array global, mismo nivel que `fires`:
```js
let barrels = [];  // {gx, gy, water:0}  — no solid, igual que fires
```

**Agua cruda** (paralelo a `rawFood`):
```js
player.rawWater = 0;  // en init() y MATS: rawWater:{ic:'🚰',n:'agua sin hervir'}
```

**Generadores con combustible** (extender los `fires` con `.gen`):
```js
// placeGen() actual: fires.push({gx,gy,gen:true})  →  pasa a:
fires.push({gx,gy,gen:true,fuel:40,fuelMax:40});
```

### 3. Funciones nuevas y dónde encajan

En `/* ================= ESTADO / TIEMPO ================= */` o junto a `isNight()`:
```js
function tapWaterActive(){return dayNum()<CFG.tapWaterFailDay;}
```

En `/* ================= LOOT ================= */`:
- Modificar `rollLoot('bomba')`: en vez de `r<.75`, usar
  `const p=Math.max(CFG.gasStationDryMin, CFG.gasStationDryBase-(dayNum()-1)*CFG.gasStationDryPerDay); if(r<p){...}`.
- Modificar `tryLoot()`: al marcar `nl.o.rt=rand(90,150)`, escalarlo:
  `nl.o.rt=rand(90,150)*(1+dayNum()*CFG.lootRespawnDayScale);` — el saqueo se vuelve
  más lento a medida que pasan los días, reforzando la escasez general (no solo agua/gas).

Nueva subsección `/* ================= v6: ESCASEZ (agua, luz, gasolina) ================= */`:
- `nearGrifo()`: como `nearFire()`, radio ~1.6, filtra `furns` con `type==='grifo'&&!f.gone`.
- `nearBarrel()`: mismo patrón sobre `barrels`.
- `tryFillCanteen()`: llamada desde una versión extendida de `tryLoot()` (tecla `E`) —
  antes de usar el `nearLoot()` de siempre, chequear `nearGrifo()`; si existe y
  `tapWaterActive()`, `addInv('water', '🚰 Agua del grifo')`; si existe pero el grifo ya
  no da agua, `msg('El grifo no da agua — la red colapsó. Hierve agua de lluvia.', true)`
  y no consume el turno de loot normal. Esto evita añadir una tecla nueva (ver tabla de
  teclas: `E` queda como interacción contextual genérica).
- `tryCollectBarrel()`: también colgado de la extensión de `E`; si `nearBarrel()` y
  `barrel.water>0`, `player.rawWater += Math.floor(barrel.water); barrel.water=0;`.
- `updateBarrels(dt)`: llamada desde `update()` junto a `updateWeather(dt)`:
  ```js
  for(const b of barrels){
    if(weather.type==='rain') b.water=Math.min(CFG.rainBarrelCap,
      b.water+CFG.rainBarrelRate*weather.inten*dt);
  }
  ```
- `drawBarrel(st,sx,sy)`: clon simplificado de `drawFire()`, con un relleno azul que
  sube según `b.water/CFG.rainBarrelCap` (rectángulo o elipse animada).
- Extender `tryCook()` (o renombrar conceptualmente, sin romper la tecla `X`) para que,
  además de `rawFood→inv.food`, procese `rawWater→inv.water` en el mismo golpe de tecla
  cerca de una fogata (`nearFire()`), reflejando "hervir el agua":
  ```js
  // dentro de tryCook(), junto al while de rawFood:
  let boiled=0;
  while(player.rawWater>0&&player.inv.water<6){player.rawWater--;player.inv.water++;boiled++;}
  if(boiled>0)msg('💧 Herviste '+boiled+' agua de lluvia (ranura 2)');
  ```
- `tryRefuelGen()` (tecla `N`): busca generador cercano —`fires` con `gen:true` a
  distancia <1.7 (mismo radio que `nearFire()`), o `inHome&&inHome.home.gen` — y si
  `player.gas>0`, `f.fuel=Math.min(f.fuelMax,f.fuel+30); player.gas--;`.
- En `update()`: drenar combustible de generadores activos:
  ```js
  for(const f of fires) if(f.gen){
    f.fuel=Math.max(0,f.fuel-CFG.genFuelDrain*dt);
    if(f.fuel<=0) f.out=true;   // deja de dar luz (draw()/oscuridad ya lo consulta)
  }
  ```
  y el generador de un vehículo-hogar (Fase 5) solo drena mientras está en uso:
  `if(inHome&&inHome.home.gen){inHome.home.genFuel=Math.max(0,inHome.home.genFuel-CFG.genFuelDrain*dt);}`
- Avisos narrativos de umbral (una sola vez, sin re-disparar tras recargar):
  ```js
  let tapWarned=false;   // reset en init(); en loadGame() recomputar: tapWarned=dayNum()>=CFG.tapWaterFailDay;
  // en update():
  if(!tapWarned&&dayNum()>=CFG.tapWaterFailDay){tapWarned=true;
    msg('🚰 La red de agua colapsó — hierve agua de lluvia en una fogata',true);}
  ```

### 4. Recetas/items nuevos
| id | Nombre | Costo | Requisito | Efecto |
|---|---|---|---|---|
| `barril` | Barril de lluvia | `wood:3, scrap:1` | `carp:1` | `placeBarrel()` (clon de `placeFire()`) |

El resto de la fase reutiliza recetas y estaciones ya existentes (`generador` de la
Fase 4/base, `genAuto` de la Fase 5) — el cambio real de esta fase es de *balance y
consumo*, no de contenido nuevo de crafteo.

### 5. Cambios de UI
- Fila de recursos (`#wep2` en `index.html`, hoy `🪵🔩🧵🧪🥩⛽`): añadir `🚰<b id="rRawW">0</b>`
  para `player.rawWater`, siguiendo el mismo `DOM.rRaw`/`updateHUD()` que ya existe.
- Indicador de estado de red: reutilizar `DOM.obj` (hoy solo muestra el objetivo de
  extracción) o añadir una línea nueva en `#topR` que muestre `🚰 CORTADA` una vez
  `!tapWaterActive()`, en el mismo lugar donde hoy se pinta `DOM.dIcon` día/noche.
- `updateHUD()`: extender `DOM.hint` con prioridad para "E — LLENAR CANTIMPLORA" /
  "E — RECOGER AGUA DE LLUVIA" / "N — RELLENAR GENERADOR" cuando aplique — mismo
  problema de una sola línea de hint señalado en la Fase 4; para esta fase, con 3 fuentes
  de interacción más, es el momento de resolverlo con una fila pequeña de iconos
  contextuales en vez de una sola línea de texto (cambio de UI, no solo de datos).
- Indicador visual del generador sin combustible: cuando `f.out`, atenuar su luz en el
  bloque de `draw()` que dibuja `fires` (`rr=f.gen?150:...` pasa a `rr=f.out?0:...`).

### 6. Integración con guardado
- `saveGame()`: añadir `barrels` al payload (junto a `fires`).
- `loadGame()`:
  - `barrels=s.barrels||[];`
  - `player.rawWater=player.rawWater||0;`
  - `for(const f of fires) if(f.gen&&f.fuel===undefined){f.fuel=40;f.fuelMax=40;}`
  - `tapWarned=dayNum()>=CFG.tapWaterFailDay;` (recomputado, no serializado — es
    determinista a partir de `gameTime`, que sí se guarda).
- Subir `SAVE_VER` una vez más si esta fase se entrega sola.

### 7. Curva de escasez por día (referencia de balance)
| Día | Agua corriente (`grifo`) | Gasolina en bombas | Loot general |
|---|---|---|---|
| 1–2 | Activa, gratis | ~75% de éxito | Respawn normal (~90-150s) |
| 3 | **Se corta** (`tapWaterFailDay`) | ~57% | Respawn ~1.5× más lento |
| 4 | Cortada — solo lluvia+hervido o botellas sueltas | ~48% | ~1.6× |
| 5 | Cortada | ~39% | ~1.8× |
| 6 | Cortada | ~30% | ~1.96× |
| 7 (extracción) | Cortada | ~21% | ~2.1× |

(Cálculo de la columna gasolina: `max(.08, .75-(day-1)*.09)`; ajustar `CFG.*` según
playtesting — el punto de esta tabla es que todo sale de dos o tres constantes.)

### 8. Riesgos técnicos
- **El respawn infinito de loot es la amenaza real a esta fase**: si se implementa solo
  el agua/gas sin tocar `tryLoot()`/`f.rt`, el jugador puede ignorar toda la escasez
  saqueando estantes en bucle. El cambio de una línea en `tryLoot()` (punto 3) es
  obligatorio, no opcional.
- **Una sola línea de `DOM.hint`** no escala bien a 5+ interacciones contextuales
  (loot, cama, barricada, cocinar, cajuela, sifonar, grifo, barril, generador) —
  esta fase es la que more fuerza el problema y debería resolverlo con una fila de
  botones/iconos priorizados en vez de seguir apilando condicionales de texto.
- **Balance de frustración**: escasez mal calibrada en los días 5-7 (justo antes de la
  extracción) puede volver el final del run injugable. Mitigación: todos los números
  viven en `CFG`, pensados para ajustarse en una sola pasada de playtesting sin tocar
  lógica.
- **Generador de vehículo-hogar vs. generador de estación**: son dos "relojes de
  combustible" independientes (`fires[].fuel` y `car.home.genFuel`); si en el futuro se
  unifican (p. ej. un generador portátil que se saca del auto), habrá que decidir una
  sola fuente de verdad — fuera de alcance de esta fase, pero se deja anotado para no
  duplicar sistemas sin querer.
- **Interacción de `E` sobrecargada**: extender `tryLoot()`/`E` para cubrir grifo y
  barril además de muebles/cajas/autos multiplica los casos de una sola función;
  conviene refactorizar a una lista ordenada de "candidatos interactuables" con
  prioridad de distancia, en vez de una cadena de `if` creciente.

---

## Resumen de cambios acumulados a `SAVE_VER`

Si las tres fases se entregan juntas, basta con **una sola** subida de `SAVE_VER`
(p. ej. 3 → 4) que incluya todos los rellenos por defecto listados en las secciones 6
de cada fase. Si se entregan por separado, cada una sube su propia versión y descarta
los guardados de la anterior — comportamiento ya aceptado por el juego hoy (no hay
migración entre versiones, ver `loadGame()`).
