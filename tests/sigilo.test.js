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
    player.gx=3.5; player.gy=3.5; inCar=null; player.vx=0; player.vy=0;

    // 1) el sigilo cambia de verdad el alcance de deteccion
    const m = (f) => { f(); return +stealthMul(true).toFixed(3); };
    const base    = m(()=>{ player.sneak=false; player.vx=0;player.vy=0;
                            player.helmet=false; player.helmOn=false; inCar=null; });
    const agach   = m(()=>{ player.sneak=true; });
    const corr    = m(()=>{ player.sneak=false; player.vx=CFG.runSpeed; player.vy=0; });
    const lampara = m(()=>{ player.vx=0;player.vy=0; player.helmet=true;
                            player.helmOn=true; player.batt=5; });
    const auto    = m(()=>{ player.helmet=false;player.helmOn=false; inCar=cars[0]; });
    inCar=null;
    out.sigilo = { base, agachado:agach, corriendo:corr, conLampara:lampara, enAuto:auto,
      agacharseEsconde: agach < base,
      correrDelata: corr > base,
      lamparaDelata: lampara > base,
      autoEsLoPeor: auto > corr };

    // 2) agachado no puedes correr y vas mas lento
    player.sneak=true; keys['w']=true; keys['shift']=true;
    player.gx=3.5; player.gy=3.5;
    for(let i=0;i<120;i++) update(1/60);
    const vSneak = hyp(player.vx,player.vy);
    player.sneak=false;
    for(let i=0;i<120;i++) update(1/60);
    const vRun = hyp(player.vx,player.vy);
    keys['w']=false; keys['shift']=false;
    out.velocidad = { agachado:+vSneak.toFixed(2), corriendo:+vRun.toFixed(2),
      agachadoEsLento: vSneak < vRun };

    // 3) MIGRACION: un estruendo arrastra zombis del doble de lejos
    zombies.length=0;
    const zCerca = newZombie(20.5,20.5), zLejos = newZombie(38.5,20.5);
    zombies.push(zCerca, zLejos);
    noise(20.5,20.5,16);            // estruendo grande (puerta derribada)
    out.migracion = { cercaAlertado: zCerca.forced>0, lejosAlertado: zLejos.forced>0,
      vanAlRuido: zLejos.tx===20.5 && zLejos.ty===20.5 };
    // un ruido pequeño NO debe arrastrar al lejano
    zombies.forEach(z=>{z.forced=0;z.tx=undefined;});
    noise(20.5,20.5,2.5);
    out.migracion.ruidoChicoNoArrastra = zLejos.forced===0;

    // 4) sin verte, el zombi camina hacia el RUIDO, no hacia ti
    zombies.length=0;
    player.gx=60.5; player.gy=60.5;
    const z = newZombie(20.5,20.5); zombies.push(z);
    noise(26.5,20.5,16);
    const d0 = hyp(z.gx-26.5, z.gy-20.5);
    for(let i=0;i<60;i++) update(1/60);
    const d1 = hyp(z.gx-26.5, z.gy-20.5);
    out.vaAlRuido = d1 < d0;

    // 5) VESTIMENTA: los zombis dentro de edificios llevan su uniforme
    zombies.length=0;
    let conUni=0, total=0;
    for(let k=0;k<300;k++){ spawnZombie(); }
    for(const z of zombies){ total++; if(z.uni) conUni++; }
    out.uniformes = { total, conUniforme:conUni, hayUniformados: conUni>0,
      tipos:[...new Set(zombies.filter(z=>z.uni).map(z=>z.uni))].length };

    // 6) el uniforme coincide con el edificio donde esta
    let coinciden=0, revisados=0;
    for(const z of zombies){ if(!z.uni) continue;
      const b = buildingAt(z.gx, z.gy); revisados++;
      if(b && b.type===z.uni) coinciden++; }
    out.uniformeCoincide = { revisados, coinciden, todosOk: revisados>0 && coinciden===revisados };

    // 7) morder sigue exigiendo estar encima del JUGADOR (no del ruido)
    zombies.length=0;
    player.gx=60.5; player.gy=60.5; player.hp=100; inCar=null;
    const zz = newZombie(20.5,20.5); zombies.push(zz);
    noise(20.5,20.5,16);            // le decimos que vaya a SU sitio
    for(let i=0;i<30;i++) update(1/60);
    out.noMuerdeDeLejos = player.hp===100;
    return out;
  });

  const save = await page.evaluate(() => {
    player.sneak=true; saveGame(); player.sneak=false;
    const ok=loadGame(); const nuevo={ok, sneak:player.sneak};
    const s=JSON.parse(localStorage.getItem('zonaCero.save'));
    delete s.player.sneak;
    localStorage.setItem('zonaCero.save', JSON.stringify(s));
    const ok2=loadGame();
    return { nuevo, viejo:{ok:ok2, sneak:player.sneak} };
  });

  await page.evaluate(() => { init(); started=true;
    const b=buildings.find(x=>x.type==='hospital')||buildings[0];
    zombies.length=0;
    for(let k=0;k<40;k++) spawnZombie();
    player.gx=b.x+b.w/2; player.gy=b.y+b.h/2; gameTime=20; });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'tests/_out/sigilo.png' });

  console.log(JSON.stringify({ errors, ...res, save }, null, 1));
  await browser.close();
})();
