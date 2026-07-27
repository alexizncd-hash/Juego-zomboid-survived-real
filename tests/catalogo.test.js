const { chromium } = require('playwright');
// Usa el Chromium de Playwright salvo que se indique otro con CHROMIUM=
const LAUNCH = process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {};
(async () => {
  const browser = await chromium.launch(LAUNCH);
  const errors = [];
  let minSpecials = 1e9, minReach = 1e9, totalB = 0, maps = 0, casaWithoutBed = 0, roleSamples = {};
  const SPEC_TYPES = ['tienda','gasolinera','hospital','comisaria','ferreteria','farmacia','barberia','carcel','taller_mec','bar','bodega','escuela','restaurante','oficina','iglesia'];
  for (let s = 0; s < 40; s++) {
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push('map'+s+': '+e.message));
    await page.goto('http://localhost:8123/index.html');
    await page.click('#btnStart');
    await page.waitForTimeout(50);
    const r = await page.evaluate((SPEC_TYPES) => {
      const specTypes = new Set(buildings.filter(b=>b.name).map(b=>b.type));
      // reachability: flood-fill each building interior from its door, count reachable floor tiles
      let worstReach = 1;
      let casaNoBed = 0;
      for (const b of buildings) {
        const inb=(i,j)=>i>=b.x+1&&i<=b.x+b.w-2&&j>=b.y+1&&j<=b.y+b.h-2;
        const seen=new Set(),st=[[b.doors[0].i,b.doors[0].j-1]];
        while(st.length){const[i,j]=st.pop(),k=i+','+j;
          if(seen.has(k)||!inb(i,j)||SOLID[idx(i,j)]!==0)continue;
          seen.add(k);st.push([i+1,j],[i-1,j],[i,j+1],[i,j-1]);}
        let free=0;
        for(let j=b.y+1;j<=b.y+b.h-2;j++)for(let i=b.x+1;i<=b.x+b.w-2;i++)
          if(SOLID[idx(i,j)]===0)free++;
        // reachable free tiles
        let reach=0; for(const key of seen){const [i,j]=key.split(',').map(Number); if(SOLID[idx(i,j)]===0)reach++;}
        if(free>0)worstReach=Math.min(worstReach, reach/free);
        // casa: ¿tiene cama?
        if(b.type==='casa'){
          let bed=false;
          for(const f of furns)if(f.bt==='casa'&&f.type==='cama'&&f.gx>=b.x&&f.gx<=b.x+b.w&&f.gy>=b.y&&f.gy<=b.y+b.h){bed=true;break;}
          if(!bed)casaNoBed++;
        }
      }
      // muestra de furniture-por-tipo para 'bar' y 'hospital'
      const furnByType={};
      for(const f of furns){furnByType[f.bt]=furnByType[f.bt]||{}; furnByType[f.bt][f.type]=(furnByType[f.bt][f.type]||0)+1;}
      return {nSpecTypes:specTypes.size, worstReach, nB:buildings.length, casaNoBed,
        hasBarFurn: !!furnByType['bar'], hasCasaFurn: !!furnByType['casa'], nProps: props.length,
        specTypesList:[...specTypes]};
    }, SPEC_TYPES);
    maps++;
    minSpecials = Math.min(minSpecials, r.nSpecTypes);
    minReach = Math.min(minReach, r.worstReach);
    totalB += r.nB;
    casaWithoutBed += r.casaNoBed;
    await page.close();
  }
  console.log(JSON.stringify({
    errors: errors.slice(0,10),
    errCount: errors.length,
    maps,
    minDistinctSpecials: minSpecials,       // de 15 posibles
    minReachFrac: +minReach.toFixed(3),     // debe ser 1.0
    avgBuildings: +(totalB/maps).toFixed(1),
    casaWithoutBed
  }, null, 1));
  await browser.close();
})();
