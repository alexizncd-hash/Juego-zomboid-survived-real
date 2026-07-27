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

  // Saqueo REAL: teletransporta al jugador junto a muebles y pulsa E
  const r = await page.evaluate(async () => {
    const sleep = ms => new Promise(r=>setTimeout(r,ms));
    let looted = 0, gainsSeen = 0;
    const snap = () => JSON.stringify([player.wood,player.scrap,player.cloth,player.alcohol,
      player.gas,player.ammo,player.rawFood,player.armor,player.hp,player.wTier,
      player.inv.food,player.inv.water,player.inv.med,player.inv.anti,
      player.books.length,Object.values(player.tools).filter(Boolean).length,radioFound]);
    for (let n=0; n<60 && n<furns.length; n++) {
      const f = furns[n];
      if (f.gone || f.looted) continue;
      player.gx = f.gx + .5; player.gy = f.gy + 1.2;   // pegado al mueble
      const before = snap();
      tryLoot();
      looted++;
      if (snap() !== before) gainsSeen++;
      await sleep(0);
    }
    // saqueo de contenedor de calle y de auto
    let dumpOk = false, carOk = false;
    const d = props.find(p=>p.type==='dumpster');
    if (d) { player.gx=d.gx+.5; player.gy=d.gy+1.1; const b=snap(); tryLoot(); dumpOk = d.looted; }
    const c = cars[0];
    if (c) { player.gx=c.gx; player.gy=c.gy+1.2; tryLoot(); carOk = c.looted; }
    return { looted, gainsSeen, dumpOk, carOk };
  });

  // guardado/carga tras saquear
  const rt = await page.evaluate(() => {
    const ok1 = saveGame();
    const nF = furns.length, nP = props.length;
    const ok2 = loadGame();
    return { saved: ok1, loaded: ok2, furnSame: furns.length===nF, propSame: props.length===nP };
  });

  await page.screenshot({ path: 'tests/_out/loot-integration.png' });
  console.log(JSON.stringify({ errors, ...r, rt }, null, 1));
  await browser.close();
})();
