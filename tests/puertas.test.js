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
    const gs = Object.values(gates);
    out.totalGates = gs.length;
    out.puertas = gs.filter(g=>g.kind==='door').length;
    out.escaparates = gs.filter(g=>g.kind==='glass').length;
    out.cerradas = gs.filter(g=>g.kind==='door'&&g.locked).length;
    // toda puerta creada debe tener SOLID=7 y todo escaparate SOLID=6
    out.solidMal = gs.filter(g=>SOLID[idx(g.i,g.j)]!==(g.kind==='glass'?6:7)).length;
    // cada edificio tiene puerta registrada
    out.edifSinPuerta = buildings.filter(b=>!b.doors.some(d=>gates[d.i+','+d.j])).length;

    // 1) una puerta CERRADA bloquea; abrirla deja pasar
    const g = gs.find(g=>g.kind==='door'&&g.locked);
    out.bloqueaCerrada = solidAt(g.i,g.j)===true;
    player.gx=g.i+.5; player.gy=g.j+1.4; player.tools.crow=false;
    tryGate();                                   // sin palanca: no debe abrir
    out.sinPalancaSigueCerrada = !g.open;
    player.tools.crow=true;
    tryGate();                                   // con palanca: abre en silencio
    out.conPalancaAbre = g.open && !g.locked;
    out.abiertaDejaPasar = solidAt(g.i,g.j)===false;
    tryGate();                                   // vuelve a cerrar
    out.puedeCerrar = !g.open && solidAt(g.i,g.j)===true;

    // 2) a golpes también se abre, y hace RUIDO (zombis forzados)
    const g2 = gs.find(x=>x.kind==='door'&&x!==g) || g;
    g2.open=false; g2.locked=true; g2.hp=g2.mhp;
    player.gx=g2.i+.5-1.0; player.gy=g2.j+.5; player.dir=0; player.tools.crow=false;
    // pon un zombi cerca para medir el ruido
    zombies.length=0; zombies.push(newZombie(g2.i+6, g2.j+0.5));
    let golpes=0;
    while(!g2.open && golpes<60){ bashGate({dmg:20}); golpes++; }
    out.golpesParaTirar = golpes;
    out.tiradaAGolpes = g2.open;
    out.ruidoAlerto = zombies[0].forced > 0;

    // 3) escaparate: no se cruza entero, sí roto
    const gl = gs.find(x=>x.kind==='glass');
    out.escaparate = null;
    if (gl) {
      gl.open=false; gl.hp=gl.mhp;
      const bloq = solidAt(gl.i,gl.j)===true;
      player.gx=gl.i+.5-1.0; player.gy=gl.j+.5; player.dir=0;
      let n=0; while(!gl.open && n<60){ bashGate({dmg:20}); n++; }
      out.escaparate = { bloqueaEntero: bloq, golpes: n, cruzaRoto: solidAt(gl.i,gl.j)===false };
    }

    // 4) barricada sobre una puerta: convive, y al quitarla la puerta sigue
    const g3 = gs.find(x=>x.kind==='door');
    g3.open=true;
    player.gx=g3.i+.5; player.gy=g3.j+.5; player.wood=5;
    tryBuild();                                  // tapiar
    const k=g3.i+','+g3.j;
    const trasTapiar = { hayBarr: !!barrs[k], solid: SOLID[idx(g3.i,g3.j)],
      puertaCerrada: !g3.open, bloquea: solidAt(g3.i,g3.j)===true };
    tryBuild();                                  // destapiar
    const trasQuitar = { hayBarr: !!barrs[k], solid: SOLID[idx(g3.i,g3.j)],
      puertaSigue: !!gates[k] };
    out.barricada = { trasTapiar, trasQuitar };

    // 5) los zombis derriban puertas
    const g4 = gs.find(x=>x.kind==='door');
    g4.open=false; g4.locked=true; g4.hp=30;
    const z = newZombie(g4.i+.5, g4.j+1.2); z.dir=-Math.PI/2;
    let it=0; while(!g4.open && it<40){ hitGate(g4,z); it++; }
    out.zombiDerriba = g4.open;
    return out;
  });

  // 6) guardado/carga conserva puertas y su estado
  const rt = await page.evaluate(() => {
    const g = Object.values(gates).find(x=>x.kind==='door');
    g.open=true; g.locked=false; g.hp=55;
    const n = Object.keys(gates).length;
    saveGame(); gates={};
    const ok = loadGame();
    const g2 = gates[g.i+','+g.j];
    return { ok, mismas: Object.keys(gates).length===n,
      estadoOk: !!g2 && g2.open===true && g2.hp===55 };
  });

  // 7) retrocompatible: guardado sin `gates`
  const compat = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('zonaCero.save'));
    delete s.gates;
    localStorage.setItem('zonaCero.save', JSON.stringify(s));
    const ok = loadGame();
    return { cargaVieja: ok, gates: Object.keys(gates).length };
  });

  // 8) captura: fachada con escaparate y puerta (partida nueva tras el test viejo)
  await page.evaluate(() => { init(); started=true; });
  await page.waitForTimeout(120);
  await page.evaluate(() => {
    const g = Object.values(gates).find(x=>x.kind==='glass') ||
              Object.values(gates).find(x=>x.kind==='door');
    player.gx=g.i+.5; player.gy=g.j+2.5; gameTime=20;
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'tests/_out/puertas.png' });

  console.log(JSON.stringify({ errors, ...res, rt, compat }, null, 1));
  await browser.close();
})();
