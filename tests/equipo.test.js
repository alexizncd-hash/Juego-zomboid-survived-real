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
    // 1) los ids nuevos existen y las tablas los referencian
    out.idsNuevos = ['pilas','llaves','palanca','mochila','casco'].filter(k=>!LOOT_DEF[k]);
    let citado = {};
    for (const f in FURN_LOOT) for (const k in FURN_LOOT[f]) citado[k]=1;
    for (const b in BLD_LOOT)  for (const k in BLD_LOOT[b])  citado[k]=1;
    out.nuncaObtenibles = Object.keys(LOOT_DEF).filter(k=>!citado[k]);

    // 2) mochila: sube el tope de 6 a 12 y addInv lo respeta
    player.pack=false; player.inv.food=0;
    for(let i=0;i<20;i++) addInv('food','x');
    const sinPack = player.inv.food;
    player.pack=true; player.inv.food=0;
    for(let i=0;i<20;i++) addInv('food','x');
    const conPack = player.inv.food;
    out.capacidad = { sinMochila: sinPack, conMochila: conPack };

    // 3) casco: consume pilas solo de noche, y se apaga al agotarse
    gameTime=90;                                  // noche
    player.helmet=true; player.helmOn=true; player.batt=2; player.battT=0;
    const encendidoNoche = helmetOn();
    for(let i=0;i<CFG.battLife*2+2;i++) helmetTick(1);
    out.casco = { encendidoNoche, battTrasGastar: player.batt, sigueEncendido: player.helmOn };
    // de día no gasta
    gameTime=0;  player.helmet=true; player.helmOn=true; player.batt=3; player.battT=0;
    for(let i=0;i<CFG.battLife*2;i++) helmetTick(1);
    out.casco.battDeDia = player.batt;

    // 4) llaves arrancan un auto no arrancable, sin necesitar mecánica
    const c = cars.find(c=>true); c.drivable=false; c.fuel=40;
    player.carKeys=1; player.skills.mech=0;
    player.gx=c.gx; player.gy=c.gy;               // pegado al auto
    enterExitCar();
    out.llaves = { arrancoConLlave: !!inCar, llavesRestantes: player.carKeys };
    if (inCar) enterExitCar();

    // 5) palanca duplica el desmantelado
    const mk=()=>{const f=furns.find(f=>!f.gone&&DISMANTLE[f.type]);
      f.dhp=undefined; return f;};
    const f1=mk(); player.tools.crow=false;
    player.gx=f1.gx+.5; player.gy=f1.gy+.5; player.dir=0;
    // apunta al mueble
    const aim=(f)=>{player.gx=f.gx+.5-1.0; player.gy=f.gy+.5; player.dir=0;};
    aim(f1); dismantleFurniture({dmg:10}); const sinCrow=DISMANTLE[f1.type].hp-f1.dhp;
    const f2=mk(); player.tools.crow=true; aim(f2);
    dismantleFurniture({dmg:10}); const conCrow=DISMANTLE[f2.type].hp-f2.dhp;
    out.palanca = { sinPalanca: sinCrow, conPalanca: conCrow };

    // 6) el panel de inventario se renderiza sin lanzar
    try { toggleInv(); out.invAbre = invOpen && DOM.invList.innerHTML.length>200; toggleInv(); }
    catch(e){ out.invAbre = 'ERROR: '+e.message; }

    // 7) guardado/carga conserva el equipo nuevo
    player.pack=true; player.helmet=true; player.batt=5; player.carKeys=3; player.tools.crow=true;
    saveGame();
    player.pack=false; player.helmet=false; player.batt=0; player.carKeys=0; player.tools.crow=false;
    const ok = loadGame();
    out.guardado = { ok, pack:player.pack, helmet:player.helmet, batt:player.batt,
      carKeys:player.carKeys, crow:player.tools.crow };
    return out;
  });

  // 8) retrocompatibilidad: una partida guardada SIN los campos nuevos debe cargar
  const compat = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('zonaCero.save'));
    delete s.player.pack; delete s.player.helmet; delete s.player.batt;
    delete s.player.carKeys; delete s.player.battT;
    s.player.tools = {hammer:true,saw:false,screw:false,wrench:false};  // sin 'crow'
    localStorage.setItem('zonaCero.save', JSON.stringify(s));
    const ok = loadGame();
    return { cargaVieja: ok, pack:player.pack, batt:player.batt, crow:player.tools.crow,
      helmetOnSinCasco: helmetOn() };
  });

  // 9) captura de noche con el casco encendido
  await page.evaluate(() => {
    gameTime=90; player.helmet=true; player.helmOn=true; player.batt=5;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'tests/_out/casco-noche.png' });
  // 10) captura del panel de inventario
  await page.evaluate(() => { player.pack=true; player.tools.crow=true; player.carKeys=2;
    player.wTier=2; player.wDur=60; player.wDurMax=75; player.hasGun=true; player.ammo=14;
    player.armor=40; player.inv={food:5,water:3,med:2,anti:1};
    player.wood=6;player.scrap=4;player.cloth=3;player.alcohol=2;player.rawFood=1;player.gas=2;
    toggleInv(); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'tests/_out/panel-inventario.png' });

  console.log(JSON.stringify({ errors, ...res, compat }, null, 1));
  await browser.close();
})();
