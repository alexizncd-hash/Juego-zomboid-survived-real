const { chromium } = require('playwright');
// Usa el Chromium de Playwright salvo que se indique otro con CHROMIUM=
const LAUNCH = process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {};
(async () => {
  const browser = await chromium.launch(LAUNCH);
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8123/index.html');
  await page.click('#btnStart');
  await page.waitForTimeout(80);

  const res = await page.evaluate(() => {
    const out = {};

    // 1) la carne cruda se pudre con el tiempo
    player.rawFood=3; player.rawAge=0; player.gx=2.5; player.gy=2.5;
    power=false;
    for(let i=0;i<Math.ceil(CFG.spoilTime)+5;i++) foodTick(1);
    out.pudre = { edad:+player.rawAge.toFixed(0), podrida: rotten() };

    // 2) la nevera lo detiene, PERO solo si hay luz
    const nev = furns.find(f=>f.type==='nevera'&&!f.gone);
    out.nevera = null;
    if (nev) {
      player.gx=nev.gx+.5; player.gy=nev.gy+1.2; player.rawFood=3;
      power=true; player.rawAge=0;
      for(let i=0;i<200;i++) foodTick(1);
      const conLuz = player.rawAge;
      power=false; player.rawAge=0;
      for(let i=0;i<200;i++) foodTick(1);
      const sinLuz = player.rawAge;
      out.nevera = { conLuz, sinLuz, conservaConLuz: conLuz===0, noConservaSinLuz: sinLuz>0 };
    }

    // 3) cocinar carne pasada hace daño; fresca no
    const fogata=()=>{ fires.length=0; fires.push({gx:player.gx,gy:player.gy}); };
    fogata();
    player.rawFood=2; player.rawAge=CFG.spoilTime+10; player.hp=100; player.inv.food=0;
    tryCook();
    const hpPasada=player.hp, foodPasada=player.inv.food;
    player.rawFood=2; player.rawAge=0; player.hp=100; player.inv.food=0;
    tryCook();
    out.cocinar = { hpTrasPasada:hpPasada, cocinoIgual:foodPasada>0,
      hpTrasFresca:player.hp, castigaPasada: hpPasada<100 && player.hp===100,
      edadReseteada: player.rawAge===0 };

    // 4) el barril junta agua solo con lluvia
    props.push({gx:Math.floor(player.gx)+2,gy:Math.floor(player.gy),type:'barril',fill:0});
    const bar = props[props.length-1];
    weather={type:'clear',t:99,inten:0,target:0};
    for(let i=0;i<100;i++) rainTick(1);
    const seco = bar.fill;
    weather={type:'rain',t:99,inten:1,target:1};
    for(let i=0;i<100;i++) rainTick(1);
    const lluvia = bar.fill;
    out.barril = { sinLluvia:+seco.toFixed(2), conLluvia:+lluvia.toFixed(2),
      soloConLluvia: seco===0 && lluvia>0, topeRespetado: lluvia<=CFG.barrelMax };

    // 5) recoger y HERVIR: el agua sucia no sirve hasta hervirla
    player.gx=bar.gx+.5; player.gy=bar.gy+.5; player.dirtyWater=0;
    const cogio = tryBarrel() && player.dirtyWater>0;
    player.inv.water=0; fogata();
    tryCook();
    out.hervir = { recogio:cogio, sucia:player.dirtyWater, potable:player.inv.water,
      hirvio: player.inv.water>0 && player.dirtyWater===0 };

    // 6) la receta del barril existe y es fabricable
    out.receta = !!RECIPES.find(r=>r.id==='barril');

    // 7) cocinar respeta la mochila (antes tenía 6 fijo)
    player.pack=true; player.inv.food=0; player.rawFood=20; player.rawAge=0; fogata();
    tryCook();
    out.topeMochila = player.inv.food;
    return out;
  });

  const save = await page.evaluate(() => {
    player.rawAge=99; player.dirtyWater=4;
    const bar = props.find(p=>p.type==='barril'); bar.fill=7;
    saveGame(); player.rawAge=0; player.dirtyWater=0;
    const ok = loadGame();
    const b2 = props.find(p=>p.type==='barril');
    const nuevo = { ok, rawAge:player.rawAge, dirty:player.dirtyWater, fill:b2&&b2.fill };
    const s = JSON.parse(localStorage.getItem('zonaCero.save'));
    delete s.player.rawAge; delete s.player.dirtyWater;
    localStorage.setItem('zonaCero.save', JSON.stringify(s));
    const ok2 = loadGame();
    return { nuevo, viejo:{ ok:ok2, rawAge:player.rawAge, dirty:player.dirtyWater } };
  });

  console.log(JSON.stringify({ errors, ...res, save }, null, 1));
  await browser.close();
})();
