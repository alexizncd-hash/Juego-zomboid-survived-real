const { chromium, devices } = require('playwright');
const LAUNCH = process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {};
(async () => {
  const browser = await chromium.launch(LAUNCH);
  // iPhone 16 Pro Max: 440x956 css px, DPR 3
  const ctx = await browser.newContext({ viewport:{width:440,height:956}, deviceScaleFactor:3,
    isMobile:true, hasTouch:true });
  const page = await ctx.newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:8123/index.html');
  await page.waitForTimeout(300);
  const out={};
  // ¿se puede llegar a TODOS los controles de la pantalla de inicio?
  for(const id of ['btnStart','btnCloudUp','btnCloudDown','btnCloudTop','cloudIn']){
    try{ await page.locator('#'+id).scrollIntoViewIfNeeded({timeout:2500});
         out[id]=await page.locator('#'+id).isVisible(); }
    catch(e){ out[id]='INALCANZABLE'; }
  }
  // el panel no debe desbordar horizontalmente
  out.scrollHorizontal = await page.evaluate(()=>
    document.documentElement.scrollWidth > document.documentElement.clientWidth);
  await page.screenshot({ path:'tests/_out/iphone-inicio.png' });
  // y jugar
  await page.locator('#btnStart').scrollIntoViewIfNeeded();
  await page.locator('#btnStart').click();
  await page.waitForTimeout(500);
  out.juegaEnMovil = await page.evaluate(()=>started && !!player);
  await page.screenshot({ path:'tests/_out/iphone-juego.png' });
  console.log(JSON.stringify({errors,...out},null,1));
  await browser.close();
})();
