const { chromium } = require('playwright');
// Usa el Chromium de Playwright salvo que se indique otro con CHROMIUM=
const LAUNCH = process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {};
(async () => {
  const browser = await chromium.launch(LAUNCH);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const MOCK='http://127.0.0.1:8199';
  const useMock = pg => pg.addInitScript(u => {
    window.__MOCK__ = u;
  }, MOCK);
  await useMock(page);
  await page.goto('http://localhost:8123/index.html');
  await page.evaluate(() => { CLOUD.url = window.__MOCK__; });

  const out = {};

  // 1) arranca una partida y la respalda
  await page.click('#btnStart');
  await page.waitForTimeout(200);
  const subida = await page.evaluate(async () => {
    gameTime = 2*180 + 30; kills = 77;          // dia 3, 77 bajas
    player.wood = 42; player.pack = true;
    saveGame();
    const ok = await cloudPush(false);
    return { ok, code: cloudToken(false) };
  });
  out.respaldo = { ok: subida.ok, codigoLargo: (subida.code||'').length };
  const code = subida.code;

  // 2) OTRO dispositivo (contexto nuevo, localStorage vacio) recupera con el codigo
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page2 = await ctx2.newPage();
  page2.on('pageerror', e => errors.push('disp2: '+e.message));
  await page2.goto('http://localhost:8123/index.html');
  await page2.evaluate(u => { CLOUD.url = u; }, MOCK);
  const recu = await page2.evaluate(async (code) => {
    const antes = hasSave();
    const ok = await cloudPull(code);
    const despues = hasSave();
    let datos = null;
    if (despues && loadGame()) datos = { wood: player.wood, pack: player.pack, kills, dia: dayNum() };
    return { habiaAntes: antes, ok, hayDespues: despues, datos,
      adoptoCodigo: cloudToken(false) === code };
  }, code);
  out.otroDispositivo = recu;

  // 3) un codigo AJENO no devuelve nada
  const ajeno = await page2.evaluate(async () => {
    const falso = 'ffffffffffffffffffffffffffffffff';
    return await cloudPull(falso);
  });
  out.codigoAjenoNoDevuelveNada = ajeno === false;

  // 4) el marcador global recibe la marca y se lee
  const marc = await page.evaluate(async () => {
    await cloudRecord(false);
    const rows = await cloudTop();
    return { hayFilas: !!(rows && rows.length),
      primera: rows && rows[0] ? { name: rows[0].name, days: rows[0].days, kills: rows[0].kills } : null,
      exponeToken: !!(rows && rows[0] && ('token_hash' in rows[0])) };
  });
  out.marcador = marc;

  // 5) SIN CONEXION el juego sigue funcionando y guarda en local
  const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 900 }, offline: true });
  const page3 = await ctx3.newPage();
  const errOff = [];
  page3.on('pageerror', e => errOff.push(e.message));
  await page3.goto('http://localhost:8123/index.html').catch(()=>{});
  // el servidor local sigue accesible aunque "offline" bloquee la red externa;
  // forzamos el fallo de Supabase apuntando a un host inexistente
  const off = await ctx.newPage();
  await off.goto('http://localhost:8123/index.html');
  const sinRed = await off.evaluate(async () => {
    CLOUD.url = 'https://no-existe-este-host-zonacero.invalid';
    await off_start();
    async function off_start(){}
    document.getElementById('btnStart').click();
    await new Promise(r=>setTimeout(r,150));
    const guardo = saveGame();                 // local debe seguir funcionando
    const subio  = await cloudPush(false);     // nube debe fallar SIN romper
    // y el juego debe seguir corriendo
    let vivo = true;
    try { for(let i=0;i<30;i++) update(1/60); } catch(e){ vivo = false; }
    return { guardoLocal: guardo, subioNube: subio, sigueVivo: vivo, hayLocal: hasSave() };
  });
  out.sinConexion = sinRed;

  // 6) captura de la pantalla de inicio con la caja de la nube
  await page.goto('http://localhost:8123/index.html');
  await page.evaluate(u => { CLOUD.url = u; }, MOCK);
  await page.waitForTimeout(200);
  await page.click('#btnCloudTop');
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'tests/_out/nube.png' });

  console.log(JSON.stringify({ errors, errOff, ...out }, null, 1));
  await browser.close();
})();
