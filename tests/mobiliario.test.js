const { chromium } = require('playwright');
// Usa el Chromium de Playwright salvo que se indique otro con CHROMIUM=
const LAUNCH = process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {};
(async () => {
  const browser = await chromium.launch(LAUNCH);
  const errors = [];
  // 30 seeds: verify props generate, no runtime errors, save/load roundtrip
  let agg = { maps: 0, lampsMin: 1e9, dumpMin: 1e9, hydMin: 1e9, benchMin: 1e9, lampsTot: 0 };
  for (let s = 0; s < 30; s++) {
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push('map'+s+': '+e.message));
    await page.goto('http://localhost:8123/index.html');
    await page.click('#btnStart');
    await page.waitForTimeout(60);
    const r = await page.evaluate(() => {
      const c = {lamp:0,dumpster:0,hydrant:0,bench:0};
      for (const p of props) c[p.type] = (c[p.type]||0)+1;
      // dumpsters must be SOLID; lamps must NOT be solid
      let solidOk = true;
      for (const p of props) {
        const s = SOLID[idx(p.gx,p.gy)];
        if (p.type==='dumpster' && !s) solidOk=false;
        if (p.type==='lamp' && s) solidOk=false;
      }
      return {c, solidOk, statHasProp: statics.some(x=>x.kind==='prop')};
    });
    agg.maps++;
    agg.lampsMin = Math.min(agg.lampsMin, r.c.lamp);
    agg.dumpMin = Math.min(agg.dumpMin, r.c.dumpster);
    agg.hydMin = Math.min(agg.hydMin, r.c.hydrant);
    agg.benchMin = Math.min(agg.benchMin, r.c.bench);
    agg.lampsTot += r.c.lamp;
    if (!r.solidOk) errors.push('map'+s+': solid mismatch');
    if (!r.statHasProp) errors.push('map'+s+': props not in statics');
    await page.close();
  }
  agg.lampsAvg = (agg.lampsTot/agg.maps).toFixed(1);

  // save/load roundtrip on one map
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push('roundtrip: '+e.message));
  await page.goto('http://localhost:8123/index.html');
  await page.click('#btnStart');
  await page.waitForTimeout(60);
  const rt = await page.evaluate(() => {
    const before = props.length;
    saveGame();
    // wipe and reload
    props = null;
    const ok = loadGame();
    return {ok, before, after: props ? props.length : -1, sample: props && props[0] ? props[0].type : null};
  });

  // night screenshot with lamps
  await page.evaluate(() => { gameTime = 90; });
  await page.waitForTimeout(500);
  const night = await page.evaluate(() => ({ isNight: isNight(), dark: darkness().toFixed(2), lamps: props.filter(p=>p.type==='lamp').length }));
  await page.screenshot({ path: 'tests/_out/props-night.png' });

  console.log(JSON.stringify({ errors, agg, rt, night }, null, 1));
  await browser.close();
})();
