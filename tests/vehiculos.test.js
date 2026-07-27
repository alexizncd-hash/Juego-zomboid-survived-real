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
    // 0) todos los autos nacen con partes
    out.sinPartes = cars.filter(c=>c.tires===undefined||c.engine===undefined||!c.trunk).length;

    const c = cars[0];
    const junto = () => { player.gx=c.gx; player.gy=c.gy; };

    // 1) motor fundido: no arranca. Reparado: sí
    inCar=null; c.drivable=true; c.fuel=40; c.engine=0; junto();
    enterExitCar();
    const noArranca = !inCar;
    c.engine=100; junto(); enterExitCar();
    const arranca = !!inCar;
    if(inCar) enterExitCar();
    out.motor = { fundidoNoArranca:noArranca, reparadoArranca:arranca };

    // 2) las partes cambian la velocidad real
    // Explanada despejada en el centro y ráfaga CORTA: si se simula mucho rato
    // el coche recorre decenas de tiles, se sale y choca, y la medida se vuelve ruido.
    const CI=Math.floor(MW/2), CJ=Math.floor(MH/2);
    for(let j=CJ-14;j<=CJ+14;j++) for(let i=CI-14;i<=CI+14;i++){
      if(i<1||j<1||i>=MW-1||j>=MH-1) continue;
      SOLID[idx(i,j)]=0; FLOOR[idx(i,j)]=5;          // carretera libre
    }
    zombies.length=0;
    const vel = (tires,engine) => {
      if(inCar) enterExitCar();
      c.tires=tires; c.engine=engine; c.hp=100; c.fuel=99; c.drivable=true;
      c.gx=CI+.5; c.gy=CJ+.5; c.vx=0; c.vy=0;
      player.gx=c.gx; player.gy=c.gy;
      enterExitCar();
      c.gx=CI+.5; c.gy=CJ+.5; c.vx=0; c.vy=0;
      keys['w']=true;
      for(let i=0;i<40;i++) driveCar(1/60);           // ráfaga corta: ~3 tiles
      const v=hyp(c.vx,c.vy); keys['w']=false;
      if(inCar) enterExitCar();
      return v;
    };
    const buena = vel(100,100), mala = vel(25,30);
    out.velocidad = { partesBuenas:+buena.toFixed(2), partesMalas:+mala.toFixed(2),
      lasPartesImportan: mala < buena*.75 };

    // 3) sifonar pasa gasolina del depósito a tus bidones
    inCar=null; c.fuel=40; player.gas=0; junto();
    const sif = trySiphon();
    out.sifon = { funciono:sif, ganoGas:player.gas>0, bajoDeposito:c.fuel<40 };
    const gasAntes=player.gas;
    c.fuel=1; const seco = trySiphon() && player.gas===gasAntes;
    out.sifon.depositoSecoAvisa = seco;

    // 4) cajuela: guarda y saca
    player.inv={food:4,water:3,med:0,anti:0}; c.trunk={food:0,water:0,med:0,anti:0};
    junto(); tryTrunk();
    const guardado = { trunk:{...c.trunk}, inv:{...player.inv} };
    tryTrunk();
    const sacado = { trunk:{...c.trunk}, inv:{...player.inv} };
    out.cajuela = { guardado, sacado,
      guardaBien: guardado.trunk.food===4 && guardado.inv.food===0,
      sacaBien: sacado.inv.food===4 && sacado.trunk.food===0 };

    // 5) dormir: solo en vehículos grandes
    const grande = cars.find(x=>['truck','bus','van'].includes(x.type));
    const chico  = cars.find(x=>x.type==='sedan');
    out.dormir = { hayGrande: !!grande };
    if (grande) {
      zombies.length=0; player.slp=30; player.sleeping=false;
      inCar=grande; trySleep();
      out.dormir.enGrande = player.sleeping;
      player.sleeping=false;
    }
    if (chico) {
      zombies.length=0; player.slp=30; player.sleeping=false;
      inCar=chico; trySleep();
      out.dormir.enChico = player.sleeping;   // debe ser false
      player.sleeping=false;
    }
    inCar=null;

    // 6) recetas nuevas
    out.recetas = ['llantas','motor'].filter(id=>!RECIPES.find(r=>r.id===id));
    return out;
  });

  const save = await page.evaluate(() => {
    cars[0].tires=42; cars[0].engine=13; cars[0].trunk={food:5,water:1,med:0,anti:0};
    saveGame();
    const ok = loadGame();
    const c=cars[0];
    const nuevo = { ok, tires:c.tires, engine:c.engine, trunkFood:c.trunk.food };
    const s = JSON.parse(localStorage.getItem('zonaCero.save'));
    for(const c2 of s.cars){ delete c2.tires; delete c2.engine; delete c2.trunk; }
    localStorage.setItem('zonaCero.save', JSON.stringify(s));
    const ok2 = loadGame();
    return { nuevo, viejo:{ ok:ok2, tienePartes: cars.every(c=>c.tires!==undefined&&c.trunk) } };
  });

  console.log(JSON.stringify({ errors, ...res, save }, null, 1));
  await browser.close();
})();
