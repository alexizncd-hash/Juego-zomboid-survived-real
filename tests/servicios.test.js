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
    const DL = 180;
    const setDay = d => { gameTime = (d-1)*DL + 20; };   // media mañana del día d

    // 1) la luz se corta el día powerDay y apaga el alumbrado
    setDay(1); power=true; water=true;
    for(const p of props) if(p.type==='lamp') p.on=true;
    utilitiesTick(dayNum());
    const d1 = { power, lamparasOn: props.filter(p=>p.type==='lamp'&&p.on).length>0 };
    setDay(CFG.powerDay); utilitiesTick(dayNum());
    const dP = { power, lamparasOn: props.filter(p=>p.type==='lamp'&&p.on).length>0 };
    out.luz = { antes: d1, alCorte: dP };

    // 2) el agua se corta el día waterDay
    setDay(CFG.waterDay-1); utilitiesTick(dayNum());
    const wA = water;
    setDay(CFG.waterDay); utilitiesTick(dayNum());
    out.agua = { antesDelCorte: wA, trasCorte: water };

    // 3) el grifo da agua con red, y nada sin red
    const lav = furns.find(f=>f.type==='lavamanos'&&!f.gone);
    out.grifo = null;
    if (lav) {
      player.gx=lav.gx+.5; player.gy=lav.gy+.5;
      water=true; player.water=20;
      const bebio = tryTap() && player.water>20;
      water=false; player.water=20;
      const seco = tryTap()===false;      // sin red cae al saqueo normal
      out.grifo = { conRed: bebio, sinRed: seco };
    }

    // 4) el botín deja de reaparecer desde respawnDay
    const f = furns.find(x=>!x.gone);
    const probar = (dia) => {
      setDay(dia); f.looted=true; f.rt=1;
      for(let k=0;k<40;k++) update(0.1);   // >4s de juego
      return f.looted;                      // true = NO reapareció
    };
    out.respawn = {
      antes_sigueReapareciendo: probar(CFG.respawnDay-1)===false,
      despues_yaNoReaparece:    probar(CFG.respawnDay)===true
    };

    // 5) guardado/carga conserva el estado de los servicios
    power=false; water=false;
    saveGame(); power=true; water=true;
    const ok = loadGame();
    out.guardado = { ok, power, water };
    return out;
  });

  // 6) retrocompatible: guardado sin power/water se deduce por el día
  const compat = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('zonaCero.save'));
    delete s.power; delete s.water;
    s.gameTime = (CFG.powerDay-1)*180 + 20;    // ya deberia estar sin luz
    localStorage.setItem('zonaCero.save', JSON.stringify(s));
    const ok = loadGame();
    return { cargaVieja: ok, power, water, dia: dayNum() };
  });

  // 7) captura: noche sin luz en el pueblo
  await page.evaluate(() => {
    init(); started=true;
    gameTime = (CFG.powerDay-1)*180 + 90;      // noche del dia del apagon
    utilitiesTick(dayNum());
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'tests/_out/apagon.png' });

  console.log(JSON.stringify({ errors, ...res, compat }, null, 1));
  await browser.close();
})();
