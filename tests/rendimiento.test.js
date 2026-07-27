const { chromium } = require('playwright');
// Usa el Chromium de Playwright salvo que se indique otro con CHROMIUM=
const LAUNCH = process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {};
(async () => {
  const b = await chromium.launch(LAUNCH);
  const p = await b.newPage({ viewport:{width:1280,height:720} });
  await p.goto('http://localhost:8123/index.html');
  await p.click('#btnStart'); await p.waitForTimeout(600);
  const r = await p.evaluate(async () => {
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    for(let i=0;i<CFG.spawnCap;i++) spawnZombie();
    await sleep(300);
    for(let i=0;i<40;i++){draw();}          // calentar
    const ts=[];
    for(let i=0;i<200;i++){const t=performance.now();draw();ts.push(performance.now()-t);await sleep(4);}
    const s=[...ts].sort((a,b)=>a-b);
    const picos=ts.map((v,i)=>[i,v]).filter(([,v])=>v>16).slice(0,6);
    // ¿de dónde viene? mide update por separado
    const us=[];
    for(let i=0;i<200;i++){const t=performance.now();update(1/60);us.push(performance.now()-t);await sleep(2);}
    us.sort((a,b)=>a-b);
    return { drawMediana:+s[100].toFixed(2), drawP95:+s[190].toFixed(2), drawMax:+s[199].toFixed(2),
      framesSobre16ms: ts.filter(v=>v>16).length, primerosPicos:picos,
      updateMediana:+us[100].toFixed(3), updateP95:+us[190].toFixed(3),
      zombis:zombies.length, statics:statics.length };
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
