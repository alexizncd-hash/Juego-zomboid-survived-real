const { chromium } = require('playwright');
// Usa el Chromium de Playwright salvo que se indique otro con CHROMIUM=
const LAUNCH = process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {};
(async () => {
  const b = await chromium.launch(LAUNCH);
  const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8123/index.html');
  await p.click('#btnStart'); await p.waitForTimeout(200);
  const r = await p.evaluate(() => {
    saveGame();
    const bueno = localStorage.getItem('zonaCero.save');
    const probar = (nombre, mutar) => {
      const s = JSON.parse(bueno); mutar(s);
      localStorage.setItem('zonaCero.save', JSON.stringify(s));
      let cargo=false, reventó=null, jugable=null;
      try { cargo = loadGame(); } catch(e){ reventó = e.message; }
      if (cargo) { try { for(let i=0;i<20;i++) update(1/60); draw(); jugable=true; }
                   catch(e){ jugable='ROMPE AL JUGAR: '+e.message; } }
      return { nombre, cargo, reventó, jugable };
    };
    const out=[];
    out.push(probar('mapa truncado',      s => s.floor = s.floor.slice(0, 100)));
    out.push(probar('mapa gigante',       s => s.solid = s.solid + s.solid));
    out.push(probar('mapa no-base64',     s => s.whue = '!!!no es base64!!!'));
    out.push(probar('buildings no es array', s => s.buildings = {malo:1}));
    out.push(probar('player nulo',        s => s.player = null));
    out.push(probar('gates basura',       s => s.gates = 'texto'));
    out.push(probar('cars con basura',    s => s.cars = [{gx:'x',gy:null}]));
    localStorage.setItem('zonaCero.save', bueno);
    return out;
  });
  console.log(JSON.stringify({errs, casos:r}, null, 1));
  await b.close();
})();
