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
    const run = (n,dt,night,close)=>{ for(let i=0;i<n;i++) bodyTick(dt,night,close); };

    // 1) TEMPERATURA: la noche enfría, el fuego calienta
    fires.length=0; inCar=null;
    player.gx=2.5; player.gy=2.5;                 // fuera de edificios
    player.temp=50; weather={type:'clear',t:99,inten:0,target:0};
    run(200,.5,true,0);
    const trasNoche = player.temp;
    fires.push({gx:player.gx+1,gy:player.gy});    // fogata al lado
    run(200,.5,true,0);
    const trasFogata = player.temp;
    out.temperatura = { trasNocheFria:+trasNoche.toFixed(1), enfrio: trasNoche<25,
      trasFogata:+trasFogata.toFixed(1), calienta: trasFogata>trasNoche+15 };
    // bajo techo la misma noche NO debe helarte
    fires.length=0;
    const casa=buildings[0];
    player.gx=casa.x+casa.w/2; player.gy=casa.y+casa.h/2; player.temp=50;
    run(200,.5,true,0);
    out.temperatura.bajoTecho=+player.temp.toFixed(1);
    out.temperatura.techoProtege=player.temp>=25;

    // 2) el frío hace daño y frena
    player.temp=5; player.hp=100;
    const hp0=player.hp; run(20,.5,true,0);
    out.hipotermia = { pierdeVida: player.hp<hp0, cold: cold() };

    // 3) PÁNICO: sube con zombis encima y baja a salvo; desvía el tiro
    fires.length=0; player.panic=0; player.hp=100;
    run(60,.5,true,4);
    const panicAlto = player.panic;
    run(120,.5,false,0);
    const panicBajo = player.panic;
    out.panico = { conZombis:+panicAlto.toFixed(1), aSalvo:+panicBajo.toFixed(1),
      sube: panicAlto>55, baja: panicBajo<panicAlto };

    // 4) ABURRIMIENTO: sube en calma, y leer lo baja
    player.bored=0; run(400,.5,false,0);
    const aburrido = player.bored;
    player.books=[{skill:'carp',name:'X',cap:3}];
    zombies.length=0; readBook(0);
    out.aburrimiento = { trasCalma:+aburrido.toFixed(1), sube: aburrido>0,
      leerBaja: player.bored < aburrido };

    // 5) el aburrimiento frena el aprendizaje
    player.skills.str=0; player.bored=95; player.xp.str=0; gainXP('str',20);
    const xpAburrido = player.xp.str;
    player.skills.str=0; player.bored=0; player.xp.str=0; gainXP('str',20);
    const xpFresco = player.xp.str;
    out.xp = { aburrido: xpAburrido, fresco: xpFresco, penaliza: xpAburrido < xpFresco };

    // 6) PESO: la mochila sube el tope; sobrecargado se detecta
    player.inv={food:12,water:12,med:6,anti:6};
    player.wood=20;player.scrap=20;player.gas=6;player.cloth=10;
    player.alcohol=5;player.rawFood=5;player.ammo=40;player.batt=6;
    player.wTier=3;player.armor=100;
    player.pack=false;
    const sinPack = { peso:+carryWeight().toFixed(1), max:+carryMax().toFixed(1), over:overloaded() };
    player.pack=true;
    const conPack = { max:+carryMax().toFixed(1), over:overloaded() };
    out.peso = { sinPack, conPack, mochilaAyuda: sinPack.max < conPack.max };

    // 7) los moodles nuevos existen en el DOM
    out.moodlesFaltantes = ['mFri','mCal','mAbu','mPes'].filter(id=>!DOM.moodle[id]);

    // 8) el panel de inventario muestra la carga sin romperse
    try { toggleInv(); out.invConPeso = DOM.invList.innerHTML.includes('CARGA'); toggleInv(); }
    catch(e){ out.invConPeso = 'ERROR: '+e.message; }
    return out;
  });

  // 9) guardado y retrocompatibilidad
  const save = await page.evaluate(() => {
    player.temp=18; player.panic=70; player.bored=44;
    saveGame(); player.temp=50; player.panic=0; player.bored=0;
    const ok = loadGame();
    const nuevo = { ok, temp:player.temp, panic:player.panic, bored:player.bored };
    const s = JSON.parse(localStorage.getItem('zonaCero.save'));
    delete s.player.temp; delete s.player.panic; delete s.player.bored;
    localStorage.setItem('zonaCero.save', JSON.stringify(s));
    const ok2 = loadGame();
    return { nuevo, viejo: { ok:ok2, temp:player.temp, panic:player.panic, bored:player.bored } };
  });

  console.log(JSON.stringify({ errors, ...res, save }, null, 1));
  await browser.close();
})();
