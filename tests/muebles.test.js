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
    const types = Object.keys(FURN);
    // 1) integridad de tablas para CADA tipo de mueble
    out.sinLoot = types.filter(t => !FURN_LOOT[t]);
    out.sinDismantle = types.filter(t => !DISMANTLE[t]);
    // 2) todo rol referencia muebles existentes
    const badRole = [];
    for (const r in ROLE_FURN) for (const t of ROLE_FURN[r]) if (!FURN[t]) badRole.push(r+':'+t);
    for (const r in ROLE_KEY) if (!FURN[ROLE_KEY[r]]) badRole.push('KEY '+r);
    out.rolesRotos = badRole;
    // 3) cada mueble se DIBUJA sin lanzar y sin caer al respaldo genérico
    //    (se comprueba contando llamadas a boxIso por tipo)
    const realBox = window.boxIso; let calls = 0;
    window.boxIso = (...a) => { calls++; return realBox(...a); };
    const piezas = {};
    for (const t of types) {
      calls = 0;
      const fake = { o:{type:t,looted:false}, gx: Math.floor(player.gx), gy: Math.floor(player.gy) };
      try { drawFurn(fake); } catch(e) { piezas[t] = 'ERROR: '+e.message; continue; }
      piezas[t] = calls;
    }
    window.boxIso = realBox;
    out.piezasPorMueble = piezas;
    out.conUnaSolaPieza = Object.entries(piezas).filter(([,v]) => typeof v==='number' && v<=1).map(([k])=>k);
    return out;
  });

  // 4) rendimiento: tiempo medio de frame con muchos muebles a la vista
  const perf = await page.evaluate(async () => {
    const sleep = ms => new Promise(r=>setTimeout(r,ms));
    // colócate dentro del edificio con más muebles
    let best=null, bestN=0;
    for (const b of buildings) {
      let n=0; for (const f of furns) if (f.gx>=b.x&&f.gx<=b.x+b.w&&f.gy>=b.y&&f.gy<=b.y+b.h) n++;
      if (n>bestN) { bestN=n; best=b; }
    }
    player.gx = best.x+best.w/2; player.gy = best.y+best.h/2;
    await sleep(500);
    const ts=[];
    for (let i=0;i<40;i++){ const t0=performance.now(); draw(); ts.push(performance.now()-t0); await sleep(16); }
    ts.sort((a,b)=>a-b);
    return { mueblesEnEdificio: bestN, medianaMs: +ts[20].toFixed(2), peorMs: +ts[39].toFixed(2) };
  });

  // capturas: interior de casa (cocina/recámara/baño) y de un especial
  await page.evaluate(() => {
    const casa = buildings.find(b=>b.type==='casa');
    player.gx = casa.x+casa.w/2; player.gy = casa.y+casa.h/2;
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'tests/_out/furn-casa.png' });

  console.log(JSON.stringify({ errors, ...res, perf }, null, 1));
  await browser.close();
})();
