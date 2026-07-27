const { chromium } = require('playwright');
// Usa el Chromium de Playwright salvo que se indique otro con CHROMIUM=
const LAUNCH = process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {};
(async () => {
  const browser = await chromium.launch(LAUNCH);
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8123/index.html');
  await page.click('#btnStart');
  await page.waitForTimeout(80);

  const res = await page.evaluate(() => {
    const out = {};

    // 1) integridad: cada id citado en las tablas existe en LOOT_DEF
    const missing = new Set();
    for (const f in FURN_LOOT) for (const k in FURN_LOOT[f]) if (!LOOT_DEF[k]) missing.add(f+'.'+k);
    for (const b in BLD_LOOT)  for (const k in BLD_LOOT[b])  if (!LOOT_DEF[k]) missing.add(b+'.'+k);
    out.missingIds = [...missing];

    // 2) cada tipo de edificio del catálogo tiene tabla (salvo casa, a propósito)
    const catalog = Object.keys(BUILD_ROLES);
    out.bldWithoutTable = catalog.filter(t => t!=='casa' && !BLD_LOOT[t]);

    // 3) cada mueble usable tiene tabla base
    out.furnWithoutTable = Object.keys(FURN).filter(t => !FURN_LOOT[t]);

    // 4) distribución real: intercepta msg() y tira N veces por combinación
    const realMsg = window.msg;
    let captured = [];
    window.msg = (t) => captured.push(t);

    function sample(kind, bt, N) {
      const tally = {};
      for (let i=0;i<N;i++){
        // estado fresco por tirada para que los condicionales no se peguen
        radioFound=false; player.armor=0; player.wTier=0; player.hp=50;
        player.inv={food:0,water:0,med:0,anti:0};
        player.books=[]; player.tools={hammer:false,saw:false,screw:false,wrench:false};
        captured=[];
        rollLoot(kind, bt);
        const t = captured.join(' | ');
        tally[t] = (tally[t]||0)+1;
      }
      return tally;
    }

    const N = 4000;
    // el cruce que da sentido a todo: la MISMA alacena en 3 edificios distintos
    const alaBodega = sample('alacena','bodega',N);
    const alaTaller = sample('alacena','taller_mec',N);
    const alaCasa   = sample('alacena','casa',N);
    const cnt=(t,re)=>Object.entries(t).filter(([k])=>re.test(k)).reduce((a,[,v])=>a+v,0);
    out.cross = {
      alacena_bodega_comida:  +(cnt(alaBodega,/Comida|Agua/)/N).toFixed(3),
      alacena_taller_comida:  +(cnt(alaTaller,/Comida|Agua/)/N).toFixed(3),
      alacena_taller_gasChat: +(cnt(alaTaller,/gasolina|Chatarra|Llave/)/N).toFixed(3),
      alacena_casa_comida:    +(cnt(alaCasa,/Comida|Agua/)/N).toFixed(3),
    };

    // 5) RAREZAS: deben ser raras y estar SOLO en su sitio
    const botFarm = sample('botiquin','farmacia',N);
    const botCasa = sample('botiquin','casa',N);
    const casCom  = sample('casillero','comisaria',N);
    const casCarc = sample('casillero','casa',N);
    out.rare = {
      morfina_en_farmacia: +(cnt(botFarm,/Morfina/)/N).toFixed(4),
      morfina_en_casa:     +(cnt(botCasa,/Morfina/)/N).toFixed(4),   // debe ser 0
      chaleco_en_comisaria:+(cnt(casCom,/Chaleco/)/N).toFixed(4),
      chaleco_en_casa:     +(cnt(casCarc,/Chaleco/)/N).toFixed(4),   // debe ser 0
    };

    // 6) la radio sigue siendo encontrable en muebles de casa
    const mesaCasa = sample('mesa','casa',N);
    out.radio_en_mesa_casa = +(cnt(mesaCasa,/RADIO/)/N).toFixed(3);

    // 7) ninguna tirada queda en silencio (siempre da feedback)
    let silent = 0;
    for (const [kind] of Object.entries(FURN_LOOT)) {
      const t = sample(kind, null, 400);
      silent += (t[''] || 0);
    }
    out.silentRolls = silent;

    // 8) libros salen en la escuela
    const mesaEsc = sample('mesa','escuela',N);
    out.libro_en_escuela = +(cnt(mesaEsc,/Encontraste/)/N).toFixed(3);

    window.msg = realMsg;
    return out;
  });

  console.log(JSON.stringify({ errors, ...res }, null, 1));
  await browser.close();
})();
