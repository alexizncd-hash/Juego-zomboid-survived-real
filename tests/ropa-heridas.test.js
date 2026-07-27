const { chromium } = require('playwright');
// Usa el Chromium de Playwright salvo que se indique otro con CHROMIUM=
const LAUNCH = process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {};
(async () => {
  const browser = await chromium.launch(LAUNCH);
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8123/index.html');
  await page.click('#btnStart'); await page.waitForTimeout(80);

  const res = await page.evaluate(() => {
    const out = {};
    // 0) integridad: todo id nuevo existe y es obtenible
    out.idsFaltan = ['machete','escopeta','cartuchos','chamarra','abrigo','botas','guantes','gorro']
      .filter(k=>!LOOT_DEF[k]);
    let citado={}; for(const f in FURN_LOOT)for(const k in FURN_LOOT[f])citado[k]=1;
    for(const b in BLD_LOOT)for(const k in BLD_LOOT[b])citado[k]=1;
    out.nuncaObtenibles = Object.keys(LOOT_DEF).filter(k=>!citado[k]);

    // 1) ROPA: abriga y protege, y ocupa su parte
    player.wear={torso:null,pies:null,manos:null,cabeza:null};
    const w0=clothWarm(), p0=clothProt();
    wearItem('chamarra'); wearItem('botas'); wearItem('guantes'); wearItem('gorro');
    out.ropa = { antesAbrigo:w0, antesProt:p0, abrigo:clothWarm(), prot:clothProt(),
      slots:{...player.wear} };
    // una prenda peor NO sustituye a la mejor
    wearItem('abrigo');                       // abrigo(28+3=31) > chamarra(16+5=21) => cambia
    const trasAbrigo = player.wear.torso;
    wearItem('chamarra');                     // peor: no debe sustituir
    out.ropa.mejorGana = trasAbrigo==='abrigo' && player.wear.torso==='abrigo';

    // 2) la ropa calienta de verdad en el tick de temperatura
    fires.length=0; inCar=null; player.gx=2.5; player.gy=2.5;
    weather={type:'clear',t:99,inten:0,target:0};
    player.wear={torso:null,pies:null,manos:null,cabeza:null}; player.temp=50;
    for(let i=0;i<200;i++) bodyTick(.5,true,0);
    const sinRopa=player.temp;
    player.wear={torso:'abrigo',pies:'botas',manos:'guantes',cabeza:'gorro'};
    player.temp=50;
    for(let i=0;i<200;i++) bodyTick(.5,true,0);
    out.temperatura = { sinRopa:+sinRopa.toFixed(1), conRopa:+player.temp.toFixed(1),
      abrigaDeVerdad: player.temp > sinRopa+20, salvaDelFrio: sinRopa<25 && player.temp>=25 };

    // 3) HERIDAS: sangrado desangra y las vendas lo cortan
    player.wounds={bleed:0,fracture:0,burn:0}; player.hp=100;
    hurt('bleed',40);
    for(let i=0;i<40;i++) woundTick(.5);
    const trasSangrar=player.hp;
    player.inv.med=1; useItem('med');
    out.sangrado = { perdioVida: trasSangrar<100, hp:+trasSangrar.toFixed(1),
      vendasCortan: player.wounds.bleed===0 };

    // 4) FRACTURA: frena y solo la férula la cura
    player.wounds={bleed:0,fracture:0,burn:0};
    hurt('fracture',100);
    const rec=RECIPES.find(r=>r.id==='ferula');
    const seCuraSola=(()=>{for(let i=0;i<200;i++) woundTick(.5); return player.wounds.fracture===0;})();
    player.wood=5;player.cloth=5;player.skills.med=2;
    rec.make();
    out.fractura = { frena: CFG.fractureSlow<1, seCuraSola, ferulaCura: player.wounds.fracture===0 };

    // 5) QUEMADURA al pisar la fogata y CORTE con el cristal roto
    player.wounds={bleed:0,fracture:0,burn:0}; player.hp=100; player._burnCd=0;
    fires.length=0; fires.push({gx:player.gx,gy:player.gy});
    for(let i=0;i<10;i++) hazardTick(.3);
    out.quemadura = { seQuemo: player.wounds.burn>0, perdioVida: player.hp<100 };
    fires.length=0;
    const gl=Object.values(gates).find(g=>g.kind==='glass');
    out.corteCristal=null;
    if(gl){ gl.open=true; player.gx=gl.i+.5; player.gy=gl.j+.5;
      player.wounds={bleed:0,fracture:0,burn:0}; player._cutCd=0;
      player.wear={torso:null,pies:null,manos:null,cabeza:null};
      for(let i=0;i<20;i++) hazardTick(.3);
      out.corteCristal = { corta: player.wounds.bleed>0 }; }

    // 6) ARMAS: machete es el tier 4, la escopeta dispara en cono
    out.armas = { machete: MELEE[4] && MELEE[4].n, tiers: MELEE.length };
    player.gx=20.5; player.gy=20.5; player.dir=0; inCar=null; player.sleeping=false;
    zombies.length=0;
    for(let k=0;k<5;k++) zombies.push(newZombie(22.5+k*.15, 20.2+k*.2));
    const hp0=zombies.map(z=>z.hp);
    player.hasShotgun=true; player.shells=3; player.gunMode=2; player.cd=0; player.panic=0;
    shootShell();
    const tocados=zombies.filter((z,i)=>z.hp<hp0[i]).length;
    out.escopeta = { gastoCartucho: player.shells===2, tocoVarios: tocados>1, tocados };
    // ruido: alerta a un zombi lejano
    const lejano=newZombie(20.5+SHOT.noise-4, 20.5); zombies.push(lejano);
    player.shells=3; player.cd=0; shootShell();
    out.escopeta.hacePlenoRuido = lejano.forced>0;

    // 7) el ciclo Q solo recorre lo que llevas
    player.hasGun=true; player.hasShotgun=true; player.gunMode=0;
    cycleWeapon(); const m1=player.gunMode;
    cycleWeapon(); const m2=player.gunMode;
    cycleWeapon(); const m3=player.gunMode;
    player.hasShotgun=false; player.gunMode=0; cycleWeapon(); const soloPistola=player.gunMode;
    cycleWeapon(); const vuelve=player.gunMode;
    out.ciclo = { conAmbas:[m1,m2,m3], sinEscopeta:[soloPistola,vuelve],
      ok: m1===1&&m2===2&&m3===0 && soloPistola===1 && vuelve===0 };

    // 8) el inventario dibuja ropa y heridas
    try{ player.wounds={bleed:20,fracture:1,burn:5}; toggleInv();
      const h=DOM.invList.innerHTML;
      out.inv={ropa:h.includes('ROPA'),heridas:h.includes('HERIDAS'),escopeta:h.includes('Escopeta')};
      toggleInv(); }catch(e){ out.inv='ERROR: '+e.message; }
    return out;
  });

  const save = await page.evaluate(() => {
    player.wear={torso:'abrigo',pies:'botas',manos:null,cabeza:'gorro'};
    player.wounds={bleed:12,fracture:1,burn:3};
    player.hasShotgun=true; player.shells=7; player.gunMode=2;
    saveGame();
    player.wear={torso:null,pies:null,manos:null,cabeza:null};
    player.wounds={bleed:0,fracture:0,burn:0}; player.hasShotgun=false; player.shells=0;
    const ok=loadGame();
    const nuevo={ok, torso:player.wear.torso, bleed:player.wounds.bleed,
      shells:player.shells, escopeta:player.hasShotgun};
    const s=JSON.parse(localStorage.getItem('zonaCero.save'));
    delete s.player.wear; delete s.player.wounds; delete s.player.hasShotgun;
    delete s.player.shells; delete s.player.gunMode;
    localStorage.setItem('zonaCero.save', JSON.stringify(s));
    const ok2=loadGame();
    return { nuevo, viejo:{ok:ok2, tieneWear:!!player.wear, tieneWounds:!!player.wounds,
      escopeta:player.hasShotgun} };
  });

  console.log(JSON.stringify({ errors, ...res, save }, null, 1));
  await browser.close();
})();
