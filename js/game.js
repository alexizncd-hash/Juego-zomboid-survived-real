'use strict';
/* ================= BASE / ISO ================= */
const cv=document.getElementById('cv'),ctx=cv.getContext('2d');
const lightC=document.createElement('canvas'),lctx=lightC.getContext('2d');
const mini=document.getElementById('mini'),mctx=mini.getContext('2d');

/* ================= CACHE DE DOM ================= */
// El script corre al final de <body>, así que todos los nodos ya existen.
// Cachear las referencias evita ~20 consultas al DOM por frame en updateHUD.
const $=id=>document.getElementById(id);
const DOM={
  hpFill:document.querySelector('#fHp .fill'),
  foodFill:document.querySelector('#fFood .fill'),
  waterFill:document.querySelector('#fWater .fill'),
  staFill:document.querySelector('#fSta .fill'),
  wName:$('wName'),ammo:$('ammo'),rWood:$('rWood'),rGas:$('rGas'),
  rScrap:$('rScrap'),rCloth:$('rCloth'),rAlc:$('rAlc'),rRaw:$('rRaw'),rArm:$('rArm'),
  obj:$('obj'),dDay:$('dDay'),dKills:$('dKills'),dHour:$('dHour'),
  dIcon:$('dIcon'),hint:$('hint'),dmg:$('dmg'),
  btnLoot:$('btnLoot'),btnGun:$('btnGun'),btnCar:$('btnCar'),
  btnBed:$('btnBed'),btnBuild:$('btnBuild'),btnCook:$('btnCook'),btnSkills:$('btnSkills'),
  craft:$('craft'),craftMats:$('craftMats'),recList:$('recList'),
  skills:$('skills'),skillList:$('skillList'),
  slots:{food:$('s0'),water:$('s1'),med:$('s2'),anti:$('s3')},
  slotN:{},moodle:{}
};
for(const k of ['food','water','med','anti'])DOM.slotN[k]=DOM.slots[k].querySelector('.n');
for(const id of ['mHun','mThi','mTir','mHer','mInf','mPan','mSue'])DOM.moodle[id]=$(id);

let VW,VH,DPR=1;
// Retina/alta densidad: canvas físico a DPR (tope 2 por rendimiento),
// coordenadas lógicas en px CSS vía setTransform.
function resize(){
  DPR=Math.min(2,window.devicePixelRatio||1);
  VW=innerWidth;VH=innerHeight;
  cv.width=VW*DPR;cv.height=VH*DPR;
  cv.style.width=VW+'px';cv.style.height=VH+'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
  lightC.width=VW*DPR;lightC.height=VH*DPR;
  lctx.setTransform(DPR,0,0,DPR,0,0);
}
addEventListener('resize',resize);resize();
const TOUCH=('ontouchstart' in window||navigator.maxTouchPoints>0);
if(TOUCH)document.body.classList.add('touch');

const HW=32,HH=16,MW=88,MH=88,OX=MH*HW,WALLH=46,DL=180;
const SW=(MW+MH)*HW,SH=(MW+MH)*HH;
const rand=(a,b)=>a+Math.random()*(b-a);
const irand=(a,b)=>Math.floor(rand(a,b));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hyp=Math.hypot;
const lerp=(a,b,t)=>a+(b-a)*t;
const normA=a=>{a=(a+Math.PI)%(2*Math.PI);if(a<0)a+=2*Math.PI;return a-Math.PI;};
const g2sx=(gx,gy)=>(gx-gy)*HW+OX;
const g2sy=(gx,gy)=>(gx+gy)*HH;
const s2gx=(sx,sy)=>(((sx-OX)/HW)+(sy/HH))/2;
const s2gy=(sx,sy)=>((sy/HH)-((sx-OX)/HW))/2;
// vector pantalla -> vector cuadrícula (mover "derecha" en pantalla = derecha visual)
const scr2grid=(sx,sy)=>({x:(sx+2*sy)/2,y:(2*sy-sx)/2});
const grid2scrA=(gvx,gvy)=>Math.atan2((gvx+gvy)*.5,gvx-gvy);

const MELEE=[
  {n:'Puños',dmg:12,range:.95,arc:1.9,cd:.32,dur:0},          // los puños no se rompen
  {n:'Tabla con clavos',dmg:20,range:1.05,arc:1.9,cd:.36,dur:45},
  {n:'Bate de béisbol',dmg:32,range:1.15,arc:2.0,cd:.42,dur:75},
  {n:'Hacha de bombero',dmg:48,range:1.25,arc:2.1,cd:.5,dur:120}
];
const GUN={n:'Pistola 9mm',dmg:34,cd:.27,range:11,noise:14};

/* ================= CONFIG / BALANCE ================= */
// Todas las constantes ajustables del juego en un solo lugar.
const CFG={
  survivalDays:7,          // día en que llega la extracción
  extractRadius:3.2,       // distancia al helipuerto para ser extraído
  extractHold:4,           // segundos que hay que aguantar sobre el punto
  radioAutoDay:5,          // día en que la radio aparece sola si no la hallaste
  // desgaste de estadísticas (por segundo)
  foodDrain:.32, waterDrain:.42,
  starveDmg:2.5, thirstDmg:3, infectDmg:1.05,
  sleepDrain:.23,          // sueño perdido por segundo despierto
  // movimiento del jugador
  walkSpeed:3.7, runSpeed:5.8,
  staRun:13, staRegen:9,   // stamina gastada al correr / recuperada al caminar
  hurtSlow:.85, sleepySlow:.9,
  // zombis
  detectDay:4.6, detectNight:6.2,
  spawnCap:44,             // tope de zombis vivos a la vez
  biteChance:.12,          // probabilidad de infección por golpe recibido
  // sueño
  sleepTimeScale:22, sleepRecover:13, sleepHeal:2.2
};

function vib(ms){try{if(navigator.vibrate)navigator.vibrate(ms);}catch(e){}}
let AC=null,muted=false;
function sfx(f,d,type,g,slide){if(muted)return;try{
  AC=AC||new (window.AudioContext||window.webkitAudioContext)();
  if(AC.state==='suspended')AC.resume();  // iOS Safari lo suspende hasta un gesto
  const o=AC.createOscillator(),ga=AC.createGain();
  o.type=type||'square';o.frequency.value=f;
  if(slide)o.frequency.exponentialRampToValueAtTime(slide,AC.currentTime+d);
  ga.gain.value=g||.05;o.connect(ga);ga.connect(AC.destination);o.start();
  ga.gain.exponentialRampToValueAtTime(.0001,AC.currentTime+d);o.stop(AC.currentTime+d);}catch(e){}}

/* ================= MAPA ================= */
// FLOOR: 0-3 pasto, 4 asfalto, 5 asfalto c/línea, 6 madera, 7 banqueta, 8 tierra
// SOLID: 0 libre, 1 muro, 2 ventana, 3 árbol, 4 objeto (mueble/caja/auto)
let FLOOR,SOLID,WHUE,buildings,furns,crates,cars,treesL,statics;
let player,zombies,corpses,parts,pools,shots,dmgs,cam;
let gameTime,kills,dead=false,started=false,paused=false,crafting=false,skillsOpen=false,flashT=0,spawnT=0,freeze=0,shake=0;
let prevNight=false,groanT=5;
let keys={},atkHold=false,joy=null,aim={x:0,y:0,has:false};
let inCar=null,barrs={},radioFound=false,winT=0,won=false,engineT=0,fires=[];
let weather=null,amb=[],puffs=[];               // clima, partículas ambientales, polvo
const REDUCE_MOTION=(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
const idx=(i,j)=>j*MW+i;

const HUES=[ // paletas de muros por casa: [cara izq, cara der, tapa]
  ['#b3a892','#8f8571','#c9bfa9'],
  ['#9c6a52','#7a5240','#b07d63'],
  ['#8b95a0','#6c757f','#a3aeb9']
];
const FURN={
  nevera:{h:34,c:['#d7dad6','#aab0ab'],label:'nevera'},
  estante:{h:26,c:['#7d6a4a','#5e4f36'],label:'estante'},
  camilla:{h:14,c:['#c9cdc9','#9aa09a'],label:'camilla'},
  botiquin:{h:20,c:['#dfe3df','#b3b9b3'],label:'botiquín de pared'},
  casillero:{h:36,c:['#4a5a6a','#37444f'],label:'casillero'},
  bomba:{h:26,c:['#a33028','#7a201a'],label:'bomba de gasolina'},
  alacena:{h:30,c:['#8a6a3c','#6b4f2a'],label:'alacena'},
  ropero:{h:36,c:['#5c4426','#463317'],label:'ropero'},
  cama:{h:12,c:['#a34a52','#7a333b'],label:'cama'},
  mesa:{h:16,c:['#9a7a4a','#79603a'],label:'mesa'}
};

const EP={x:MW-9,y:9};
const SPECIALS=[
  {type:'tienda',w:12,h:8,hue:1,name:'ABARROTES',furn:['estante','estante','estante','estante','nevera','mesa']},
  {type:'gasolinera',w:7,h:5,hue:2,name:'GASOLINERA',furn:['alacena','mesa'],pumps:true},
  {type:'hospital',w:12,h:9,hue:0,name:'CLINICA',furn:['camilla','camilla','botiquin','botiquin','cama','camilla']},
  {type:'comisaria',w:10,h:8,hue:2,name:'COMISARIA',furn:['casillero','casillero','casillero','mesa','alacena']}
];
function carveBuilding(bx,by,bw,bh,hue,furnTypes,btype,bname){
  const doorI=bx+Math.floor(bw/2),wide=bw>=10;
  const doors=[{i:doorI,j:by+bh-1}];
  if(wide)doors.push({i:doorI+1,j:by+bh-1});
  const b={x:bx,y:by,w:bw,h:bh,hue,type:btype,name:bname,doors};
  buildings.push(b);
  for(let j=by;j<by+bh;j++)for(let i=bx;i<bx+bw;i++){
    const edge=(i===bx||i===bx+bw-1||j===by||j===by+bh-1);
    FLOOR[idx(i,j)]=6;
    if(edge){
      if(j===by+bh-1&&(i===doorI||(wide&&i===doorI+1)))continue;
      let code=1;
      if((j===by&&(i===bx+2||i===bx+bw-3))||(i===bx&&j===by+2)||(i===bx+bw-1&&j===by+2))code=2;
      SOLID[idx(i,j)]=code;WHUE[idx(i,j)]=hue;
    }
  }
  for(const d of doors)FLOOR[idx(d.i,d.j+1)]=8;
  const spots=[];
  for(let i=bx+1;i<bx+bw-1;i++){if(i!==doorI&&!(wide&&i===doorI+1))spots.push([i,by+1]);}
  for(let j=by+1;j<by+bh-1;j++){
    if(!(bx+1===doorI&&j===by+bh-2))spots.push([bx+1,j]);
    if(!(bx+bw-2===doorI||wide&&bx+bw-2===doorI+1)||j!==by+bh-2)spots.push([bx+bw-2,j]);
  }
  for(let k=0;k<furnTypes.length&&spots.length;k++){
    const sp=spots.splice(irand(0,spots.length),1)[0];
    if(SOLID[idx(sp[0],sp[1])])continue;
    SOLID[idx(sp[0],sp[1])]=4;
    furns.push({gx:sp[0],gy:sp[1],type:furnTypes[k],looted:false,rt:0});
  }
  return b;
}
function genWorld(){
  FLOOR=new Uint8Array(MW*MH);SOLID=new Uint8Array(MW*MH);WHUE=new Uint8Array(MW*MH);
  buildings=[];furns=[];crates=[];cars=[];treesL=[];statics=[];
  for(let j=0;j<MH;j++)for(let i=0;i<MW;i++)FLOOR[idx(i,j)]=irand(0,4);
  const ry=Math.floor(MH/2),rx=Math.floor(MW/2);
  for(let i=0;i<MW;i++){FLOOR[idx(i,ry)]=5;FLOOR[idx(i,ry+1)]=4;
    FLOOR[idx(i,ry-1)]=7;FLOOR[idx(i,ry+2)]=7;}
  for(let j=0;j<MH;j++){if(FLOOR[idx(rx,j)]<4)FLOOR[idx(rx,j)]=5;
    if(FLOOR[idx(rx+1,j)]<4)FLOOR[idx(rx+1,j)]=4;
    if(FLOOR[idx(rx-1,j)]<4)FLOOR[idx(rx-1,j)]=7;
    if(FLOOR[idx(rx+2,j)]<4)FLOOR[idx(rx+2,j)]=7;}
  // edificios especiales cerca del cruce
  const spPos=[[rx-18,ry-12],[rx+5,ry-9],[rx+6,ry+5],[rx-15,ry+6]];
  for(let k=0;k<SPECIALS.length;k++){
    const sp=SPECIALS[k];let placed=false;
    const cands=[spPos[k],[spPos[k][0]+3,spPos[k][1]+3],[spPos[k][0]-3,spPos[k][1]-2]];
    for(const[cx0,cy0]of cands){
      const bx=clamp(cx0,4,MW-sp.w-4),by=clamp(cy0,4,MH-sp.h-4);
      let ok=true;
      for(let j=by-2;j<by+sp.h+2&&ok;j++)for(let i=bx-2;i<bx+sp.w+2;i++){
        if(SOLID[idx(i,j)]||FLOOR[idx(i,j)]>=4){ok=false;break;}}
      if(!ok)continue;
      const b=carveBuilding(bx,by,sp.w,sp.h,sp.hue,sp.furn,sp.type,sp.name);
      if(sp.pumps){
        for(const off of[1,4]){
          const pi=bx+off,pj=by+sp.h+1;
          if(!SOLID[idx(pi,pj)]&&FLOOR[idx(pi,pj)]<4){
            SOLID[idx(pi,pj)]=4;
            furns.push({gx:pi,gy:pj,type:'bomba',looted:false,rt:0});}
        }
      }
      placed=true;break;
    }
    if(!placed)console.warn('no cupo',sp.type);
  }
  // casas normales (con cama garantizada)
  for(let n=0;n<7;n++)for(let t=0;t<90;t++){
    const bw=irand(6,10),bh=irand(5,8);
    const bx=irand(4,MW-bw-4),by=irand(4,MH-bh-4);
    if(hyp(bx+bw/2-EP.x,by+bh/2-EP.y)<8)continue;
    let ok=true;
    for(let j=by-2;j<by+bh+2&&ok;j++)for(let i=bx-2;i<bx+bw+2;i++){
      if(SOLID[idx(i,j)]||FLOOR[idx(i,j)]>=4){ok=false;break;}}
    if(!ok)continue;
    const pool=['cama','nevera','alacena','alacena','ropero','mesa'];
    const ft=['cama'];const nf=irand(3,6);
    for(let k=1;k<nf;k++)ft.push(pool[irand(0,pool.length)]);
    carveBuilding(bx,by,bw,bh,irand(0,3),ft,null,null);
    break;
  }
  // árboles (con vida, lejos del punto de extracción)
  for(let n=0;n<90;n++)for(let t=0;t<40;t++){
    const i=irand(2,MW-2),j=irand(2,MH-2);
    if(!SOLID[idx(i,j)]&&FLOOR[idx(i,j)]<4&&hyp(i-EP.x,j-EP.y)>5){
      let near=false;
      for(const b of buildings)if(i>=b.x-1&&i<=b.x+b.w&&j>=b.y-1&&j<=b.y+b.h){near=true;break;}
      if(near)continue;
      SOLID[idx(i,j)]=3;treesL.push({gx:i,gy:j,s:rand(.8,1.2),hp:60});break;}
  }
  // autos DINÁMICOS sobre la carretera (sin SOLID: colisión por círculo)
  // flota variada sobre la carretera
  const vpool=['sedan','sedan','sedan','pickup','van','van','truck','bus'];
  for(let n=0;n<7;n++)for(let t=0;t<40;t++){
    const type=vpool[irand(0,vpool.length)],T=VTYPE[type];
    const i=irand(5,MW-6),j=ry+irand(0,2);
    let clash=false;
    for(const c of cars)if(hyp(c.gx-(i+1),c.gy-(j+.5))<3.2){clash=true;break;}
    if(SOLID[idx(i,j)]||SOLID[idx(i+1,j)]||clash)continue;
    cars.push({gx:i+1,gy:j+.5,vx:0,vy:0,axis:'x',r:T.r,type,
      fuel:rand(8,42),drivable:Math.random()<.72,hp:100,
      col:T.col[irand(0,T.col.length)],looted:false,rt:0});break;
  }
  // cajas exteriores
  for(let n=0;n<10;n++)for(let t=0;t<40;t++){
    const i=irand(3,MW-3),j=irand(3,MH-3);
    if(!SOLID[idx(i,j)]&&FLOOR[idx(i,j)]!==6){
      SOLID[idx(i,j)]=4;crates.push({gx:i,gy:j,looted:false,rt:0});break;}
  }
  buildStatics();
  buildMini();
}
function buildStatics(){
  statics=[];
  for(let j=0;j<MH;j++)for(let i=0;i<MW;i++){
    const s=SOLID[idx(i,j)];
    if(s===1||s===2)statics.push({kind:'wall',gx:i,gy:j,win:s===2,hue:WHUE[idx(i,j)],d:i+j});
  }
  for(const t of treesL)if(!t.dead)statics.push({kind:'tree',gx:t.gx,gy:t.gy,s:t.s,d:t.gx+t.gy});
  for(const f of furns)if(!f.gone)statics.push({kind:'furn',o:f,gx:f.gx,gy:f.gy,d:f.gx+f.gy});
  for(const c of crates)statics.push({kind:'crate',o:c,gx:c.gx,gy:c.gy,d:c.gx+c.gy});
}
let miniBase=null;
function buildMini(){
  miniBase=document.createElement('canvas');miniBase.width=miniBase.height=130;
  const c=miniBase.getContext('2d'),k=130/MW;
  for(let j=0;j<MH;j++)for(let i=0;i<MW;i++){
    const f=FLOOR[idx(i,j)],s=SOLID[idx(i,j)];
    c.fillStyle=s===1||s===2?'#7d8a68':s===3?'#1d2b18':
      f>=4&&f<6?'#3a3a38':f===6?'#5a4630':f===7?'#55554e':'#26301c';
    c.fillRect(i*k,j*k,k+.5,k+.5);
  }
  const tint={tienda:'#c9863a',gasolinera:'#c94a3a',hospital:'#d9d9d9',comisaria:'#5a7ac9'};
  c.globalAlpha=.5;
  for(const b of buildings)if(b.type){c.fillStyle=tint[b.type]||'#fff';
    c.fillRect(b.x*k,b.y*k,b.w*k,b.h*k);}
  c.globalAlpha=1;
}

/* ================= ESTADO / TIEMPO ================= */
function init(){
  genWorld();
  const ry=Math.floor(MH/2);
  player={gx:MW/2-4,gy:ry-3,r:.3,dir:0,vx:0,vy:0,hp:100,food:100,water:100,sta:100,
    wTier:0,wDur:0,wDurMax:1,cd:0,swing:0,walk:0,hasGun:false,useGun:false,ammo:0,gunFlash:0,
    infected:false,slp:100,sleeping:false,wood:2,gas:0,
    scrap:0,cloth:0,alcohol:0,armor:0,rawFood:0,
    skills:{carp:0,mech:0,elec:0,med:0,str:0},
    xp:{carp:0,mech:0,elec:0,med:0,str:0},books:[],mechAcc:0,
    inv:{food:1,water:1,med:0,anti:0}};
  fires=[];crafting=false;skillsOpen=false;
  DOM.craft.style.display='none';DOM.skills.style.display='none';
  weather={type:'clear',t:rand(30,60),inten:0,target:0};amb=[];puffs=[];
  inCar=null;barrs={};radioFound=false;winT=0;won=false;engineT=0;
  zombies=[];corpses=[];parts=[];pools=[];shots=[];dmgs=[];
  gameTime=0;kills=0;dead=false;paused=false;flashT=0;spawnT=1;freeze=0;shake=0;saveT=25;
  prevNight=false;groanT=5;cam={x:0,y:0};
  document.getElementById('over').style.display='none';
  const oh=document.querySelector('#over h1');
  oh.textContent='ASÍ TERMINÓ TU HISTORIA';oh.style.color='#a31621';
}
function tOfDay(){return (gameTime%DL)/DL;}
function darkness(){const b=Math.cos(tOfDay()*2*Math.PI)*.5+.5;return .78*Math.pow(1-b,1.4);}
function isNight(){return darkness()>.35;}
function dayNum(){return Math.floor(gameTime/DL)+1;}

function msg(t,bad){
  const box=document.getElementById('msgs'),d=document.createElement('div');
  d.className='msg'+(bad?' bad':'');d.textContent=t;box.appendChild(d);
  setTimeout(()=>d.remove(),3400);
  while(box.children.length>4)box.firstChild.remove();
}
function dmgText(gx,gy,txt,col){dmgs.push({gx,gy,txt,col:col||'#f2e9dc',life:.8,oy:0});}
function blood(gx,gy,n){
  for(let i=0;i<n;i++)parts.push({gx,gy,vx:rand(-3,3),vy:rand(-3,3),life:rand(.25,.5)});
  pools.push({gx:gx+rand(-.15,.15),gy:gy+rand(-.15,.15),r:rand(.18,.4),life:60});
  if(pools.length>150)pools.shift();
}
function noise(gx,gy,r){for(const z of zombies)if(hyp(z.gx-gx,z.gy-gy)<r)z.forced=7;}

/* ================= COLISIÓN (tiles) ================= */
// Una ventana (código 2) solo bloquea el paso si está tapiada: sin tablones
// es un punto de entrada para los zombis (y una vía de escape para ti).
function solidAt(i,j){
  const s=SOLID[idx(i,j)];
  if(s===0)return false;
  if(s===2)return !!barrs[i+','+j];
  return true;
}
function collideTiles(e){
  const x0=Math.floor(e.gx-e.r),x1=Math.floor(e.gx+e.r),
        y0=Math.floor(e.gy-e.r),y1=Math.floor(e.gy+e.r);
  for(let j=y0;j<=y1;j++)for(let i=x0;i<=x1;i++){
    const solid=(i<1||j<1||i>=MW-1||j>=MH-1)||solidAt(i,j);
    if(!solid)continue;
    const cx=clamp(e.gx,i,i+1),cy=clamp(e.gy,j,j+1);
    let dx=e.gx-cx,dy=e.gy-cy;const d=hyp(dx,dy);
    if(d<e.r){if(d<.0001){dx=1;dy=0;}const dd=d<.0001?1:d;
      e.gx=cx+dx/dd*e.r;e.gy=cy+dy/dd*e.r;}
  }
}

/* ================= ZOMBIS ================= */
const CIV_SHIRTS=['#7a4a4a','#4a5a7a','#5a7a4a','#7a6a3a','#6a4a7a','#4a6a6a','#8a8a86'];
const CIV_PANTS=['#3a4250','#4a3a30','#2e3a2e','#50505a'];
function newZombie(gx,gy,forceType){
  const day=dayNum();let type=forceType;
  if(!type){const r=Math.random();
    type=(day>=3&&r<.1)?'tank':(day>=2&&r<.3)?'runner':'normal';}
  const base={gx,gy,dir:0,wd:rand(0,7),wt:0,cd:0,flash:0,stun:0,forced:0,anim:rand(0,7),type,
    shirt:CIV_SHIRTS[irand(0,CIV_SHIRTS.length)],pants:CIV_PANTS[irand(0,CIV_PANTS.length)]};
  if(type==='runner')return Object.assign(base,{r:.26,hp:22+(day-1)*5,mhp:22+(day-1)*5,sp:rand(2.1,2.5),dmg:6+(day-1),shirt:'#b06a3a'});
  if(type==='tank')return Object.assign(base,{r:.44,hp:120+(day-1)*22,mhp:120+(day-1)*22,sp:rand(.55,.7),dmg:15+(day-1),shirt:'#5e6e54'});
  return Object.assign(base,{r:.32,hp:38+(day-1)*8,mhp:38+(day-1)*8,sp:rand(.9,1.35)+(day-1)*.04,dmg:8+(day-1)});
}
function spawnZombie(forceType,nearEdge){
  for(let t=0;t<60;t++){
    let i,j;
    if(nearEdge){const s=irand(0,4);
      i=s<2?(s===0?irand(2,8):irand(MW-8,MW-2)):irand(2,MW-2);
      j=s<2?irand(2,MH-2):(s===2?irand(2,8):irand(MH-8,MH-2));
    }else{i=irand(2,MW-2);j=irand(2,MH-2);}
    if(!SOLID[idx(i,j)]&&FLOOR[idx(i,j)]!==6&&hyp(i-player.gx,j-player.gy)>15){
      zombies.push(newZombie(i+.5,j+.5,forceType));return;}
  }
}
function horde(){
  const day=dayNum(),n=6+day*2;
  for(let i=0;i<n;i++)spawnZombie(Math.random()<.4?'runner':'normal',true);
  msg('🌙 ¡Una horda entró al pueblo!',true);
  sfx(60,1.2,'sawtooth',.08,40);
}

/* ================= LOOT ================= */
function nearLoot(){
  let best=null,bd=1.25;
  const chk=(o,label)=>{const d=hyp(o.gx+.5-player.gx,o.gy+.5-player.gy);
    if(d<bd&&!o.looted){bd=d;best={o,label};}};
  for(const f of furns)if(!f.gone)chk(f,FURN[f.type].label);
  for(const c of crates)chk(c,'caja');
  for(const c of cars){const d=hyp(c.gx-player.gx,c.gy-player.gy);
    if(d<1.9&&d<bd&&!c.looted){bd=d;best={o:c,label:'auto'};}}
  return best;
}
function addInv(k,label){
  if(player.inv[k]>=6){msg(label+' — inventario lleno, lo usaste');useItem(k,true);return;}
  player.inv[k]++;msg(label+' (guardado)');
}
function giveGunOrAmmo(){
  if(!player.hasGun){player.hasGun=true;player.useGun=true;player.ammo+=8;
    msg('🔫 ¡Una Pistola 9mm! (+8 balas)');sfx(400,.25,'triangle',.06);}
  else{player.ammo+=6;msg('🔸 Balas 9mm (+6)');}
}
// Libros temáticos según el mueble saqueado.
const BOOK_SRC={ropero:['str','carp'],estante:['carp','elec'],mesa:['elec','mech'],
  casillero:['str','mech'],alacena:['carp','med'],botiquin:['med'],camilla:['med'],auto:['mech']};
function maybeBook(kind){
  const opts=BOOK_SRC[kind];
  if(opts&&Math.random()<.12){giveBook(opts[irand(0,opts.length)]);return true;}
  return false;
}
function rollLoot(kind){
  if(maybeBook(kind))return;
  const r=Math.random();
  if(kind==='nevera'){
    if(r<.3)addInv('food','🍖 Comida enlatada');
    else if(r<.62){player.rawFood++;msg('🥩 Carne cruda (+1) — cocínala en una fogata');}
    else if(r<.85)addInv('water','💧 Agua');
    else msg('La nevera apesta… vacía');
  }else if(kind==='alacena'){
    if(maybeRadio(.14))return;
    if(r<.28)addInv('food','🍖 Enlatados');else if(r<.46)addInv('water','💧 Agua');
    else if(r<.58){player.ammo+=6;msg('🔸 Balas 9mm (+6)');}
    else if(r<.66)addInv('anti','💊 Antibióticos');
    else if(r<.76)addInv('med','🩹 Vendas');
    else if(r<.9){player.wood+=2;msg('🪵 Tablones (+2)');}
    else{player.alcohol++;msg('🧪 Botella de alcohol (+1)');}
  }else if(kind==='ropero'){
    if(r<.22)addInv('med','🩹 Botiquín');
    else if(r<.42){const rr=Math.random(),tier=rr<.5?1:(rr<.82?2:3);
      if(tier>player.wTier){equipWeapon(tier);msg('🪓 Equipaste: '+MELEE[tier].n);sfx(300,.2,'triangle');}
      else{player.ammo+=3;msg('Arma repetida → +3 balas');}}
    else if(r<.52)giveGunOrAmmo();
    else if(r<.6)addInv('anti','💊 Antibióticos');
    else{player.cloth+=2;msg('🧵 Tela de ropa vieja (+2)');}
  }else if(kind==='cama'){
    if(r<.3)addInv('med','🩹 Vendas bajo el colchón');
    else if(r<.65){player.cloth++;msg('🧵 Sábanas hechas jirones (+1 tela)');}
    else msg('Nada bajo la cama… por suerte');
  }else if(kind==='mesa'){
    if(maybeRadio(.22))return;
    if(r<.35)addInv('food','🍖 Restos de comida');
    else if(r<.55){player.ammo+=3;msg('🔸 Balas sueltas (+3)');}
    else if(r<.78){player.scrap++;msg('🔩 Chatarra (+1)');}
    else msg('Nada en la mesa…');
  }else if(kind==='estante'){
    if(r<.42)addInv('food','🍖 Provisiones');
    else if(r<.68)addInv('water','💧 Agua embotellada');
    else if(r<.85){player.wood+=2;msg('🪵 Tablones (+2)');}
    else{player.scrap++;msg('🔩 Chatarra del estante (+1)');}
  }else if(kind==='camilla'){
    if(r<.4)addInv('med','🩹 Botiquín');
    else if(r<.6)addInv('anti','💊 Antibióticos');
    else if(r<.8){player.alcohol++;msg('🧪 Frasco de alcohol (+1)');}
    else{player.cloth++;msg('🧵 Sábanas (+1 tela)');}
  }else if(kind==='botiquin'){
    if(r<.4)addInv('anti','💊 Antibióticos');
    else if(r<.7)addInv('med','🩹 Botiquín');
    else{player.alcohol++;msg('🧪 Alcohol medicinal (+1)');}
  }else if(kind==='casillero'){
    if(maybeRadio(.2))return;
    if(r<.3)giveGunOrAmmo();
    else if(r<.55){player.ammo+=8;msg('🔸 Caja de balas (+8)');}
    else if(r<.75){const rr=Math.random(),tier=rr<.4?2:3;
      if(tier>player.wTier){equipWeapon(tier);msg('🪓 Equipaste: '+MELEE[tier].n);}
      else{player.ammo+=4;msg('Arma repetida → +4 balas');}}
    else{player.scrap+=2;msg('🔩 Chatarra del casillero (+2)');}
  }else if(kind==='bomba'){
    if(r<.75){player.gas++;msg('⛽ Bidón de gasolina (+1)');}
    else msg('La bomba está seca…');
  }else if(kind==='auto'){
    if(r<.3){player.ammo+=6;msg('🔸 Balas en la guantera (+6)');}
    else if(r<.5)addInv('water','💧 Agua');
    else if(r<.65)addInv('food','🍖 Comida');
    else if(r<.75)addInv('med','🩹 Botiquín');
    else if(r<.85)giveGunOrAmmo();
    else{player.scrap+=2;msg('🔩 Piezas sueltas del motor (+2)');}
  }else{ // caja
    if(r<.18){player.wood+=2;msg('🪵 Tablones (+2)');}
    else if(r<.35)addInv('food','🍖 Comida');else if(r<.5)addInv('water','💧 Agua');
    else if(r<.62)addInv('med','🩹 Botiquín');
    else if(r<.76){player.ammo+=6;msg('🔸 Balas 9mm (+6)');}
    else if(r<.88){const rr=Math.random(),tier=rr<.5?1:(rr<.82?2:3);
      if(tier>player.wTier){equipWeapon(tier);msg('🪓 Equipaste: '+MELEE[tier].n);}
      else{player.ammo+=3;msg('Arma repetida → +3 balas');}}
    else{player.scrap+=2;msg('🔩 Chatarra (+2)');}
  }
}
function maybeRadio(p){
  if(radioFound)return false;
  if(Math.random()<p){radioFound=true;
    msg('📻 ¡UNA RADIO! "…extracción DÍA 7, claro al NORESTE…"');
    sfx(880,.3,'sine',.06);sfx(440,.4,'sine',.04);return true;}
  return false;
}
function tryLoot(){
  if(inCar)return;
  const nl=nearLoot();if(!nl)return;
  nl.o.looted=true;nl.o.rt=rand(90,150);
  sfx(240,.1,'triangle',.04);
  const kind=nl.o.type?nl.o.type:(nl.label==='auto'?'auto':'caja');
  rollLoot(kind);
}
function useItem(k,silent){
  if(player.inv[k]<=0&&!silent)return;
  if(k==='anti'){
    if(!player.infected){msg('No estás infectado');return;}
    player.inv[k]--;player.infected=false;msg('💊 Infección curada. Estuvo cerca…');
    sfx(700,.2,'sine',.06);return;
  }
  if(!silent)player.inv[k]--;
  if(k==='food'){player.food=clamp(player.food+45,0,100);if(!silent)msg('🍖 Comiste (+45)');}
  if(k==='water'){player.water=clamp(player.water+45,0,100);if(!silent)msg('💧 Bebiste (+45)');}
  if(k==='med'){const heal=Math.round(40*(1+sk('med')*.12));   // 💊 medicina: +12%/nivel
    player.hp=clamp(player.hp+heal,0,100);if(!silent){msg('🩹 Te curaste (+'+heal+')');gainXP('med',18);}}
  sfx(560,.12,'sine',.05);
}

/* ================= COMBATE ================= */
// Equipar un arma cuerpo a cuerpo la deja con la condición al 100%.
function equipWeapon(t){
  player.wTier=t;
  player.wDurMax=MELEE[t].dur||1;
  player.wDur=player.wDurMax;
}
// Desgaste por golpe; si la condición llega a 0, el arma se rompe → puños.
function wearWeapon(extra){
  if(player.wTier<1)return;
  player.wDur-=1+(extra||0);
  if(player.wDur<=0){
    msg('🔧 ¡Se rompió tu '+MELEE[player.wTier].n+'!',true);
    player.wTier=0;player.wDur=0;player.wDurMax=1;
    sfx(160,.25,'square',.06,70);vib(30);
  }
}
function autoAim(maxD){
  let best=null,bd=maxD;
  for(const z of zombies){const d=hyp(z.gx-player.gx,z.gy-player.gy);if(d<bd){bd=d;best=z;}}
  if(best)player.dir=Math.atan2(best.gy-player.gy,best.gx-player.gx);
  return best;
}
function attack(){
  if(player.cd>0||dead||inCar||player.sleeping||crafting||skillsOpen)return;
  if(player.useGun&&player.hasGun){shoot();return;}
  const w=MELEE[player.wTier];
  if(TOUCH)autoAim(w.range+2.2);
  player.cd=w.cd;player.swing=.18;
  const weak=player.sta<6;if(!weak)player.sta-=6;
  let hit=false;
  for(const z of zombies){
    const dx=z.gx-player.gx,dy=z.gy-player.gy,d=hyp(dx,dy);
    if(d<w.range+z.r){
      const da=Math.abs(normA(Math.atan2(dy,dx)-player.dir));
      if(da<w.arc/2+.35){
        let dm=weak?w.dmg*.5:w.dmg;
        if(player.slp<25)dm*=.75;
        dm*=(1+sk('str')*.08);                        // 💪 fuerza: +8% por nivel
        z.hp-=dm;z.flash=.12;z.stun=.22;z.forced=6;
        const kb=z.type==='tank'?.15:.45;
        z.gx+=dx/Math.max(d,.1)*kb;z.gy+=dy/Math.max(d,.1)*kb;
        blood(z.gx,z.gy,7);dmgText(z.gx,z.gy,Math.round(dm));
        hit=true;
      }
    }
  }
  let hitHard=false;
  if(!hit&&player.wTier>=1){hitHard=chopTree(w)||dismantleFurniture(w);hit=hitHard;}
  if(hit){freeze=.045;shake=Math.max(shake,3);vib(18);wearWeapon(hitHard?1:0);}
  noise(player.gx,player.gy,2.5);
  sfx(hit?115:70,.1,'square',hit?.07:.03);
}
function shoot(){
  if(inCar||player.sleeping)return;
  if(player.ammo<=0){msg('Sin balas — Q para arma blanca',true);sfx(900,.06,'square',.03);
    player.cd=.3;return;}
  player.ammo--;player.cd=GUN.cd;player.gunFlash=.07;
  if(TOUCH)autoAim(GUN.range);
  const a=player.dir+rand(-.03,.03),cx=Math.cos(a),sy=Math.sin(a);
  let bestT=GUN.range,hitZ=null;
  for(const z of zombies){
    const rx=z.gx-player.gx,ry=z.gy-player.gy,t=rx*cx+ry*sy;
    if(t>0&&t<bestT){
      const px=player.gx+cx*t,py=player.gy+sy*t;
      if(hyp(z.gx-px,z.gy-py)<z.r+.1){bestT=t;hitZ=z;}
    }
  }
  shots.push({x1:player.gx+cx*.5,y1:player.gy+sy*.5,
    x2:player.gx+cx*bestT,y2:player.gy+sy*bestT,life:.07});
  if(hitZ){hitZ.hp-=GUN.dmg;hitZ.flash=.12;hitZ.stun=.15;hitZ.forced=7;
    blood(hitZ.gx,hitZ.gy,8);dmgText(hitZ.gx,hitZ.gy,GUN.dmg,'#ffd27a');freeze=.03;}
  shake=Math.max(shake,4);vib(22);
  noise(player.gx,player.gy,GUN.noise);
  sfx(160,.14,'square',.1,60);sfx(1200,.05,'sawtooth',.04);
}
/* ================= RÉCORDS (localStorage) ================= */
const REC_KEY='zonaCero.records';
function loadRec(){try{return JSON.parse(localStorage.getItem(REC_KEY))||{};}catch(e){return{};}}
function saveRec(r){try{localStorage.setItem(REC_KEY,JSON.stringify(r));}catch(e){}}
function updateRecords(winFlag){
  const r=loadRec();
  r.bestDay=Math.max(r.bestDay||0,dayNum());
  r.bestKills=Math.max(r.bestKills||0,kills);
  r.wins=(r.wins||0)+(winFlag?1:0);
  r.runs=(r.runs||0)+1;
  saveRec(r);return r;
}
function recLine(r){
  return '🏆 Mejor: día <b>'+r.bestDay+'</b> · <b>'+r.bestKills+'</b> bajas'+
    (r.wins?' · <b>'+r.wins+'</b> extracción(es)':'');
}

/* ================= GUARDADO (localStorage) ================= */
const SAVE_KEY='zonaCero.save',SAVE_VER=3;
let saveT=25;
function u8b64(a){let s='';for(let i=0;i<a.length;i++)s+=String.fromCharCode(a[i]);return btoa(s);}
function b64u8(b){const s=atob(b),a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a;}
function hasSave(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY));return!!(s&&s.v===SAVE_VER);}catch(e){return false;}}
function clearSave(){try{localStorage.removeItem(SAVE_KEY);}catch(e){}}
function saveGame(){
  if(!started||dead||!player)return false;
  try{
    const s={v:SAVE_VER,
      floor:u8b64(FLOOR),solid:u8b64(SOLID),whue:u8b64(WHUE),
      buildings,furns,crates,cars,treesL,fires,barrs,zombies,player,
      inCar:inCar?cars.indexOf(inCar):-1,
      gameTime,kills,radioFound,won,prevNight,groanT,spawnT,winT,engineT,weather};
    localStorage.setItem(SAVE_KEY,JSON.stringify(s));
    return true;
  }catch(e){return false;}
}
function loadGame(){
  let s;try{s=JSON.parse(localStorage.getItem(SAVE_KEY));}catch(e){return false;}
  if(!s||s.v!==SAVE_VER)return false;
  try{
    FLOOR=b64u8(s.floor);SOLID=b64u8(s.solid);WHUE=b64u8(s.whue);
    buildings=s.buildings;furns=s.furns;crates=s.crates;cars=s.cars;
    treesL=s.treesL;fires=s.fires||[];barrs=s.barrs||{};zombies=s.zombies||[];
    player=s.player;
    if(!player.inv)player.inv={food:0,water:0,med:0,anti:0};
    if(!player.skills)player.skills={carp:0,mech:0,elec:0,med:0,str:0};
    if(!player.xp)player.xp={carp:0,mech:0,elec:0,med:0,str:0};
    if(!player.books)player.books=[];
    for(const f of furns)if(f.rt===null||f.rt===undefined)f.rt=1e9;  // Infinity→null al serializar
    player.sleeping=false;
    corpses=[];parts=[];pools=[];shots=[];dmgs=[];amb=[];puffs=[];
    gameTime=s.gameTime;kills=s.kills;radioFound=s.radioFound;won=!!s.won;
    prevNight=s.prevNight;groanT=s.groanT;spawnT=s.spawnT;winT=s.winT||0;engineT=s.engineT||0;
    weather=s.weather||{type:'clear',t:40,inten:0,target:0};
    inCar=(s.inCar>=0&&s.inCar<cars.length)?cars[s.inCar]:null;
    dead=false;paused=false;crafting=false;flashT=0;shake=0;freeze=0;saveT=25;
    DOM.craft.style.display='none';
    buildStatics();buildMini();
    cam={x:0,y:0};started=true;
    return true;
  }catch(e){return false;}
}
function manualSave(){
  if(saveGame())msg('💾 Partida guardada');
  else msg('No se pudo guardar',true);
}
try{addEventListener('beforeunload',()=>{if(started&&!dead)saveGame();});}catch(e){}

function die(cause){
  clearSave();                                     // la partida terminó
  dead=true;
  const mins=Math.floor(gameTime/60),secs=Math.floor(gameTime%60);
  const r=updateRecords(false);
  document.getElementById('stats').innerHTML=
    'Sobreviviste <b>'+dayNum()+'</b> día(s) — '+mins+'m '+String(secs).padStart(2,'0')+'s<br>'+
    'Zombis eliminados: <b>'+kills+'</b><br>Causa: <b>'+cause+'</b><br>'+recLine(r);
  document.getElementById('over').style.display='flex';
  sfx(55,.7,'sawtooth',.09,30);
}

/* ================= UPDATE ================= */
function update(dt){
  if(player.sleeping){sleepTick(dt);updateHUD(dayNum(),isNight());return;}
  gameTime+=dt;
  player.slp=Math.max(0,player.slp-CFG.sleepDrain*dt);
  const day=dayNum(),night=isNight();
  updateWeather(dt);updateAmbient(dt);
  saveT-=dt;if(saveT<=0){saveT=25;saveGame();}      // autoguardado silencioso
  if(night&&!prevNight&&day>=2)horde();
  prevNight=night;
  if(day>=CFG.radioAutoDay&&!radioFound){radioFound=true;
    msg('📻 Una radio militar suena a lo lejos: "…día '+CFG.survivalDays+'… claro NORESTE…"');}
  if(radioFound&&day>=CFG.survivalDays&&!won){
    if(hyp(player.gx-EP.x,player.gy-EP.y)<CFG.extractRadius){winT+=dt;
      if(winT>CFG.extractHold){win();return;}}
    else winT=0;
  }

  player.food=Math.max(0,player.food-CFG.foodDrain*dt);
  player.water=Math.max(0,player.water-CFG.waterDrain*dt);
  if(player.food<=0)player.hp-=CFG.starveDmg*dt;
  if(player.water<=0)player.hp-=CFG.thirstDmg*dt;
  if(player.infected)player.hp-=CFG.infectDmg*dt;
  if(player.hp<=0&&!dead){
    die(player.infected?'La infección':player.water<=0?'La sed':'El hambre');return;}

  if(inCar){driveCar(dt);}
  else{
  /* movimiento (input de pantalla -> cuadrícula) */
  let ix=0,iy=0;
  if(keys['w']||keys['arrowup'])iy-=1;
  if(keys['s']||keys['arrowdown'])iy+=1;
  if(keys['a']||keys['arrowleft'])ix-=1;
  if(keys['d']||keys['arrowright'])ix+=1;
  if(joy){ix=joy.x;iy=joy.y;}
  const il=hyp(ix,iy);
  const wantRun=(keys['shift']||(joy&&joy.m>.84))&&il>0;
  let maxSp=CFG.walkSpeed;
  if(wantRun&&player.sta>0){maxSp=CFG.runSpeed;player.sta=Math.max(0,player.sta-CFG.staRun*dt);}
  else player.sta=clamp(player.sta+CFG.staRegen*dt,0,100);
  if(player.hp<35)maxSp*=CFG.hurtSlow;
  if(player.slp<25)maxSp*=CFG.sleepySlow;
  let gv={x:0,y:0};
  if(il>0){
    const g=scr2grid(ix,iy),gl=hyp(g.x,g.y)||1;
    const mag=joy?Math.min(1,il):1;   // joystick analógico, teclas a tope
    gv={x:g.x/gl*mag,y:g.y/gl*mag};
  }
  const ac=il>0?1-Math.pow(.00003,dt):1-Math.pow(2e-10,dt); // arranque ágil, freno seco
  player.vx=lerp(player.vx,gv.x*maxSp,ac);player.vy=lerp(player.vy,gv.y*maxSp,ac);
  player.gx+=player.vx*dt;player.gy+=player.vy*dt;
  const spd=hyp(player.vx,player.vy);
  player.walk+=spd*dt*3.4;
  if(spd>4.6&&Math.random()<dt*14)footPuff();     // levanta polvo al esprintar
  collideTiles(player);carPush(player);

  if(!TOUCH&&aim.has){
    const wx=s2gx(aim.x+cam.x,aim.y+cam.y),wy=s2gy(aim.x+cam.x,aim.y+cam.y);
    player.dir=Math.atan2(wy-player.gy,wx-player.gx);
  }else if(TOUCH&&il>0&&player.swing<=0){
    player.dir=Math.atan2(gv.y,gv.x);
  }

  player.cd=Math.max(0,player.cd-dt);
  player.swing=Math.max(0,player.swing-dt);
  player.gunFlash=Math.max(0,player.gunFlash-dt);
  if(atkHold)attack();
  }

  /* zombis */
  const target=Math.min(CFG.spawnCap,7+(day-1)*3+(night?6:0));
  spawnT-=dt;
  if(zombies.length<target&&spawnT<=0){spawnZombie();spawnT=rand(.4,1.1);}
  let detect=night?CFG.detectNight:CFG.detectDay;
  if(raining())detect*=.72;                       // la lluvia tapa tus ruidos
  detect*=(1-foggy()*.3);                         // la niebla también te oculta
  for(const z of zombies){
    z.cd=Math.max(0,z.cd-dt);z.flash=Math.max(0,z.flash-dt);
    z.stun=Math.max(0,z.stun-dt);z.forced=Math.max(0,z.forced-dt);
    z.anim+=dt*(z.type==='runner'?10:4.5);
    if(z.stun>0)continue;
    const dx=player.gx-z.gx,dy=player.gy-z.gy,d=hyp(dx,dy);
    if(d<detect||z.forced>0){
      z.dir=Math.atan2(dy,dx);
      const bt=barricadeAhead(z);
      if(bt){if(z.cd<=0){z.cd=1.05;hitBarr(bt,z);}continue;}
      z.gx+=dx/d*z.sp*dt;z.gy+=dy/d*z.sp*dt;
      if(!inCar&&d<player.r+z.r+.15&&z.cd<=0){
        z.cd=.9;
        let zdm=z.dmg;
        if(player.armor>0){
          zdm=Math.max(1,Math.round(zdm*.5));
          player.armor=Math.max(0,player.armor-8);
          if(player.armor<=0)msg('🦺 Tu chaleco quedó destrozado',true);
        }
        player.hp-=zdm;flashT=.35;shake=Math.max(shake,6);vib(45);
        blood(player.gx,player.gy,4);
        dmgText(player.gx,player.gy,'-'+zdm,'#ff6b5e');
        if(!player.infected&&Math.random()<CFG.biteChance){
          player.infected=true;msg('☣️ ¡TE MORDIERON! Busca antibióticos…',true);
          sfx(200,.5,'sawtooth',.08,60);}
        sfx(60,.2,'sawtooth',.07);
        if(player.hp<=0&&!dead){
          die('Un '+(z.type==='tank'?'zombi tanque':z.type==='runner'?'corredor':'zombi'));return;}
      }
    }else{
      z.wt-=dt;
      if(z.wt<=0){z.wd=rand(0,Math.PI*2);z.wt=rand(1,3);}
      z.dir=z.wd;
      z.gx+=Math.cos(z.wd)*z.sp*.35*dt;z.gy+=Math.sin(z.wd)*z.sp*.35*dt;
    }
    collideTiles(z);carPush(z);
    const dd=hyp(player.gx-z.gx,player.gy-z.gy),mm=player.r+z.r-.05;
    if(dd<mm&&dd>0){z.gx-=(player.gx-z.gx)/dd*(mm-dd);z.gy-=(player.gy-z.gy)/dd*(mm-dd);}
  }
  for(let i=0;i<zombies.length;i++)for(let j=i+1;j<zombies.length;j++){
    const a=zombies[i],b=zombies[j],dx=b.gx-a.gx,dy=b.gy-a.gy,d=hyp(dx,dy),m=a.r+b.r;
    if(d<m&&d>0){const push=(m-d)/2;a.gx-=dx/d*push;a.gy-=dy/d*push;b.gx+=dx/d*push;b.gy+=dy/d*push;}
  }
  zombies=zombies.filter(z=>{
    if(z.hp<=0){kills++;blood(z.gx,z.gy,12);
      gainXP('str',z.type==='tank'?14:z.type==='runner'?7:9);   // 💪 aprendes peleando
      corpses.push({gx:z.gx,gy:z.gy,dir:z.dir||0,type:z.type,shirt:z.shirt,pants:z.pants,life:35});
      if(corpses.length>40)corpses.shift();
      sfx(90,.25,'sawtooth',.05,50);return false;}
    return true;});

  for(const f of furns)if(f.looted){f.rt-=dt;if(f.rt<=0)f.looted=false;}
  for(const c of crates)if(c.looted){c.rt-=dt;if(c.rt<=0)c.looted=false;}
  for(const c of cars)if(c.looted){c.rt-=dt;if(c.rt<=0)c.looted=false;}

  for(const p of parts){p.gx+=p.vx*dt;p.gy+=p.vy*dt;p.life-=dt;}
  parts=parts.filter(p=>p.life>0);
  for(const s of pools)s.life-=dt;pools=pools.filter(s=>s.life>0);
  for(const s of shots)s.life-=dt;shots=shots.filter(s=>s.life>0);
  for(const d2 of dmgs){d2.oy-=42*dt;d2.life-=dt;}dmgs=dmgs.filter(d2=>d2.life>0);
  for(const c of corpses)c.life-=dt;corpses=corpses.filter(c=>c.life>0);

  if(night){groanT-=dt;
    if(groanT<=0){groanT=rand(4,9);sfx(rand(65,110),.5,'sawtooth',.02,45);}}

  flashT=Math.max(0,flashT-dt);
  shake=Math.max(0,shake-24*dt);
  updateHUD(day,night);
}
function updateHUD(day,night){
  DOM.hpFill.style.transform='scaleX('+(player.hp/100)+')';
  DOM.foodFill.style.transform='scaleX('+(player.food/100)+')';
  DOM.waterFill.style.transform='scaleX('+(player.water/100)+')';
  DOM.staFill.style.transform='scaleX('+(player.sta/100)+')';
  if(inCar){DOM.wName.textContent='🚗 Manejando';
    DOM.ammo.textContent='⛽'+Math.max(0,Math.round(inCar.fuel));}
  else{const usingGun=player.useGun&&player.hasGun;
    DOM.wName.textContent=usingGun?GUN.n:MELEE[player.wTier].n;
    DOM.ammo.textContent=usingGun?('🔸'+player.ammo)
      :(player.wTier>0?('🔧'+Math.round(player.wDur/player.wDurMax*100)+'%'):'');}
  DOM.rWood.textContent=player.wood;
  DOM.rGas.textContent=player.gas;
  DOM.rScrap.textContent=player.scrap;
  DOM.rCloth.textContent=player.cloth;
  DOM.rAlc.textContent=player.alcohol;
  DOM.rRaw.textContent=player.rawFood;
  DOM.rArm.textContent=player.armor>0?'🦺'+Math.round(player.armor):'';
  if(radioFound){DOM.obj.style.display='block';
    DOM.obj.textContent=day>=CFG.survivalDays?'🚁 ¡EL HELICÓPTERO ESTÁ EN EL CLARO NE!'
      :'🚁 Extracción: DÍA '+CFG.survivalDays+' · claro NE';}
  DOM.dDay.textContent=day;
  DOM.dKills.textContent=kills;
  const hour=(12+tOfDay()*24)%24;
  DOM.dHour.textContent=
    String(Math.floor(hour)).padStart(2,'0')+':'+String(Math.floor(hour%1*60)).padStart(2,'0');
  DOM.dIcon.textContent=night?'🌙':'☀️';
  const nl=inCar?null:nearLoot();
  if(nl){DOM.hint.style.display='block';
    DOM.hint.textContent=(TOUCH?'📦 ':'E — REGISTRAR ')+nl.label.toUpperCase();}
  else DOM.hint.style.display='none';
  DOM.btnLoot.classList.toggle('on',!!nl);
  DOM.btnGun.classList.toggle('have',player.hasGun&&!inCar);
  DOM.btnGun.classList.toggle('sel',player.useGun&&player.hasGun);
  DOM.btnCar.classList.toggle('on',!!inCar||!!nearCar());
  DOM.btnBed.classList.toggle('on',!inCar&&!!nearBed()&&player.slp<85);
  DOM.btnBuild.classList.toggle('on',!inCar&&!!nearBarrSpot());
  DOM.btnCook.classList.toggle('on',!inCar&&!!nearFire()&&player.rawFood>0);
  for(const k in DOM.slots){
    DOM.slotN[k].textContent=player.inv[k];
    DOM.slots[k].classList.toggle('empty',player.inv[k]<=0);}
  // moodles
  let close=0;for(const z of zombies)if(hyp(z.gx-player.gx,z.gy-player.gy)<3)close++;
  setMoodle('mHun',player.food<25,player.food<=0);
  setMoodle('mThi',player.water<25,player.water<=0);
  setMoodle('mTir',player.sta<15,player.sta<=1);
  setMoodle('mHer',player.hp<40,player.hp<20);
  setMoodle('mInf',player.infected,player.infected&&player.hp<50);
  setMoodle('mPan',close>=3,close>=6);
  setMoodle('mSue',player.slp<25,player.slp<8);
  DOM.dmg.style.opacity=flashT>0?Math.min(1,flashT*3):0;
}
function setMoodle(id,on,crit){
  const el=DOM.moodle[id];
  el.classList.toggle('on',!!on);el.classList.toggle('crit',!!crit);
}

/* ================= SPRITES DE PISO ================= */
const TILES={};
function makeTile(key,base,fn){
  const c=document.createElement('canvas');c.width=HW*2+2;c.height=HH*2+2;
  const t=c.getContext('2d');
  t.translate(HW+1,1);
  t.beginPath();t.moveTo(0,0);t.lineTo(HW,HH);t.lineTo(0,HH*2);t.lineTo(-HW,HH);t.closePath();
  t.fillStyle=base;t.fill();t.save();t.clip();
  if(fn)fn(t);
  t.restore();TILES[key]=c;
}
function buildTiles(){
  const R=(a,b)=>a+Math.random()*(b-a);
  const speck=(t,cols,n)=>{for(let i=0;i<n;i++){t.fillStyle=cols[irand(0,cols.length)];
    t.beginPath();t.arc(R(-HW,HW),R(0,HH*2),R(.6,2),0,7);t.fill();}};
  const patch=(t,col,n,sz)=>{for(let i=0;i<n;i++){const x=R(-HW+6,HW-6),y=R(4,HH*2-4);
    t.fillStyle=col;t.beginPath();
    for(let k=0;k<6;k++){const a=k/6*6.283,r=sz*R(.55,1.15);
      const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r*.5;k?t.lineTo(px,py):t.moveTo(px,py);}
    t.closePath();t.fill();}};
  const crack=(t,col,n)=>{t.strokeStyle=col;t.lineWidth=1;
    for(let i=0;i<n;i++){let x=R(-HW+4,HW-4),y=R(3,HH*2-3);t.beginPath();t.moveTo(x,y);
      const seg=irand(2,4);for(let k=0;k<seg;k++){x+=R(-7,7);y+=R(-4,4);t.lineTo(x,y);}t.stroke();}};
  const tuft=(t,cols,n)=>{for(let i=0;i<n;i++){const x=R(-HW,HW),y=R(3,HH*2-3);
    t.strokeStyle=cols[irand(0,cols.length)];t.lineWidth=1;
    for(let b=0;b<3;b++){t.beginPath();t.moveTo(x,y);t.lineTo(x+R(-2.5,2.5),y-R(2,4.5));t.stroke();}}};
  // PASTO: muted, con parches de tierra, matas y piedritas
  const gbase=['#2c3420','#29321e','#313a25','#252d1b'];
  const gspeck=['#222b18','#37422b','#2a331d','#3d4a30'];
  for(let v=0;v<4;v++)makeTile('g'+v,gbase[v],t=>{
    speck(t,gspeck,30);
    if(Math.random()<.6)patch(t,'rgba(74,62,40,.45)',1,9);       // tierra
    tuft(t,['#3f4d2c','#4a5836','#354328'],13);
    speck(t,['#5c5344','#6b6252'],4);                            // piedritas
  });
  // ASFALTO: grietas, manchas de aceite, gravilla
  makeTile('road','#34342f',t=>{
    speck(t,['#2c2c28','#3d3d38','#414139'],20);
    crack(t,'rgba(18,18,16,.55)',3);
    patch(t,'rgba(14,14,13,.4)',2,7);                            // aceite
    speck(t,['#4a4a42','#565650'],6);
  });
  makeTile('roadm','#34342f',t=>{
    speck(t,['#2c2c28','#3d3d38'],16);
    crack(t,'rgba(18,18,16,.5)',2);
    t.fillStyle='#8a8248';t.fillRect(-4,HH-2.5,8,5);             // línea central gastada
    t.fillStyle='rgba(52,52,47,.55)';t.fillRect(-4,HH-2.5,3,5);
  });
  // MADERA interior: tablas con juntas, vetas y nudos
  makeTile('wood','#63502f',t=>{
    t.strokeStyle='rgba(0,0,0,.32)';t.lineWidth=1.4;
    for(let k=-3;k<4;k++){t.beginPath();t.moveTo(-HW+k*9,HH+k*4.5-HH);t.lineTo(k*9+HW,HH+k*4.5);t.stroke();}
    t.strokeStyle='rgba(58,42,24,.55)';t.lineWidth=.8;
    for(let k=-3;k<4;k++){t.beginPath();t.moveTo(-HW+k*9+3,HH+k*4.5-HH+2);t.lineTo(k*9+HW,HH+k*4.5+2);t.stroke();}
    speck(t,['#54401f','#75593a','#4a3820'],10);
    t.fillStyle='rgba(46,32,18,.7)';
    for(let i=0;i<2;i++){t.beginPath();t.ellipse(R(-HW+6,HW-6),R(4,HH*2-4),2.5,1.5,0,0,7);t.fill();}
  });
  // BANQUETA: losas de concreto con junta y grietas
  makeTile('side','#53534b',t=>{
    speck(t,['#494943','#5d5d55','#47473e'],12);
    t.strokeStyle='rgba(0,0,0,.3)';t.lineWidth=1;
    t.beginPath();t.moveTo(0,0);t.lineTo(0,HH*2);t.moveTo(-HW,HH);t.lineTo(HW,HH);t.stroke();
    crack(t,'rgba(28,28,26,.4)',1);
    if(Math.random()<.5)patch(t,'rgba(40,38,30,.3)',1,6);
  });
  // TIERRA: pedregosa
  makeTile('dirt','#57472f',t=>{
    speck(t,['#493c28','#67553b','#40331d'],18);
    patch(t,'rgba(38,30,18,.4)',2,7);
    speck(t,['#786a52','#8a7a62'],5);
  });
}
const FKEY=['g0','g1','g2','g3','road','roadm','wood','side','dirt'];

/* ================= DIBUJO ISO ================= */
function diamond(c,sx,sy,scale){
  c.beginPath();c.moveTo(sx,sy);c.lineTo(sx+HW*scale,sy+HH*scale);
  c.lineTo(sx,sy+HH*2*scale);c.lineTo(sx-HW*scale,sy+HH*scale);c.closePath();
}
function cube(i,j,h,cols,inset){
  const s=inset||1,off=(1-s)/2;
  const ax=g2sx(i+off,j+off),ay=g2sy(i+off,j+off);           // esquina norte
  const bx=g2sx(i+1-off,j+off),by=g2sy(i+1-off,j+off);       // este
  const cx2=g2sx(i+1-off,j+1-off),cy2=g2sy(i+1-off,j+1-off); // sur
  const dx=g2sx(i+off,j+1-off),dy=g2sy(i+off,j+1-off);       // oeste
  ctx.fillStyle=cols[0];                                      // cara izquierda (SO)
  ctx.beginPath();ctx.moveTo(dx,dy-h);ctx.lineTo(cx2,cy2-h);ctx.lineTo(cx2,cy2);ctx.lineTo(dx,dy);ctx.closePath();ctx.fill();
  ctx.fillStyle=cols[1];                                      // cara derecha (SE)
  ctx.beginPath();ctx.moveTo(cx2,cy2-h);ctx.lineTo(bx,by-h);ctx.lineTo(bx,by);ctx.lineTo(cx2,cy2);ctx.closePath();ctx.fill();
  ctx.fillStyle=cols[2];                                      // tapa
  ctx.beginPath();ctx.moveTo(ax,ay-h);ctx.lineTo(bx,by-h);ctx.lineTo(cx2,cy2-h);ctx.lineTo(dx,dy-h);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.28)';ctx.lineWidth=1;ctx.stroke();
  return {ax,ay,bx,by,cx:cx2,cy:cy2,dx,dy};
}
// sombra de contacto que asienta un objeto en el suelo
function groundShadow(gx,gy,rx,ry){
  const sx=g2sx(gx+.5,gy+.5),sy=g2sy(gx+.5,gy+.5);
  ctx.fillStyle='rgba(0,0,0,.24)';
  ctx.beginPath();ctx.ellipse(sx,sy+2,rx,ry,0,0,7);ctx.fill();
}
function drawWall(st,night){
  const p=cube(st.gx,st.gy,WALLH,HUES[st.hue]);
  // revestimiento horizontal en ambas caras
  ctx.strokeStyle='rgba(0,0,0,.13)';ctx.lineWidth=1;
  for(let s=1;s<5;s++){const yy=-WALLH*s/5;
    ctx.beginPath();ctx.moveTo(p.dx,p.dy+yy);ctx.lineTo(p.cx,p.cy+yy);
    ctx.moveTo(p.cx,p.cy+yy);ctx.lineTo(p.bx,p.by+yy);ctx.stroke();}
  // zócalo oscuro abajo
  ctx.fillStyle='rgba(0,0,0,.17)';
  ctx.beginPath();ctx.moveTo(p.dx,p.dy);ctx.lineTo(p.cx,p.cy);ctx.lineTo(p.cx,p.cy-6);ctx.lineTo(p.dx,p.dy-6);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(p.cx,p.cy);ctx.lineTo(p.bx,p.by);ctx.lineTo(p.bx,p.by-6);ctx.lineTo(p.cx,p.cy-6);ctx.closePath();ctx.fill();
  // alero claro arriba
  ctx.fillStyle='rgba(255,252,240,.09)';
  ctx.beginPath();ctx.moveTo(p.dx,p.dy-WALLH);ctx.lineTo(p.cx,p.cy-WALLH);ctx.lineTo(p.cx,p.cy-WALLH+4);ctx.lineTo(p.dx,p.dy-WALLH+4);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(p.cx,p.cy-WALLH);ctx.lineTo(p.bx,p.by-WALLH);ctx.lineTo(p.bx,p.by-WALLH+4);ctx.lineTo(p.cx,p.cy-WALLH+4);ctx.closePath();ctx.fill();
  // regueros de suciedad/humedad (estables por muro)
  ctx.fillStyle='rgba(18,14,9,.13)';
  for(const[e0x,e0y,e1x,e1y,fr]of[[p.dx,p.dy,p.cx,p.cy,.34],[p.dx,p.dy,p.cx,p.cy,.7],
      [p.cx,p.cy,p.bx,p.by,.4],[p.cx,p.cy,p.bx,p.by,.72]]){
    const tx=lerp(e0x,e1x,fr),ty=lerp(e0y,e1y,fr);
    ctx.beginPath();ctx.moveTo(tx-1.4,ty-WALLH+3);ctx.lineTo(tx+1.4,ty-WALLH+3);
    ctx.lineTo(tx+1.4,ty-2);ctx.lineTo(tx-1.4,ty-2);ctx.closePath();ctx.fill();
  }
  if(st.win){
    const glow=night?'rgba(232,197,107,.92)':'rgba(140,170,190,.85)';
    ctx.fillStyle=glow;
    const mx1=(p.dx+p.cx)/2,my1=(p.dy+p.cy)/2;
    ctx.fillRect(mx1-7,my1-WALLH*.72,11,13);
    const mx2=(p.cx+p.bx)/2,my2=(p.cy+p.by)/2;
    ctx.fillRect(mx2-4,my2-WALLH*.72,11,13);
    ctx.strokeStyle='rgba(0,0,0,.4)';
    ctx.strokeRect(mx1-7,my1-WALLH*.72,11,13);ctx.strokeRect(mx2-4,my2-WALLH*.72,11,13);
    if(barrs[st.gx+','+st.gy]){
      ctx.strokeStyle='#5c4426';ctx.lineWidth=3.4;
      for(const[mx,my]of[[mx1,my1],[mx2,my2]]){
        ctx.beginPath();ctx.moveTo(mx-9,my-WALLH*.68);ctx.lineTo(mx+8,my-WALLH*.6);ctx.stroke();
        ctx.beginPath();ctx.moveTo(mx-9,my-WALLH*.5);ctx.lineTo(mx+8,my-WALLH*.42);ctx.stroke();}
    }
  }
}
function drawFurn(st){
  const f=st.o,F=FURN[f.type],ty=f.type;
  const sx=g2sx(st.gx+.5,st.gy+.5),sy=g2sy(st.gx+.5,st.gy+.5);
  groundShadow(st.gx,st.gy,14,7);
  // muebles bajos (mesa, cama, camilla) se dibujan como tablero + patas,
  // no como bloque; el resto como armario con detalle.
  if(ty==='mesa'){
    for(const[lx,ly]of[[-.28,-.28],[.28,-.28],[.28,.28],[-.28,.28]]){
      const px=g2sx(st.gx+.5+lx,st.gy+.5+ly),py=g2sy(st.gx+.5+lx,st.gy+.5+ly);
      ctx.fillStyle='#5e4a2c';ctx.fillRect(px-1.5,py-13,3,13);}
    cube(st.gx,st.gy,4,['#9a7a4a','#79603a','#b08a54'],.78);
  }else if(ty==='cama'){
    cube(st.gx,st.gy,6,['#6a4f38','#523c2a','#7a5c42'],.9);        // base de madera
    ctx.fillStyle='#8f6d78';                                       // colchón/cobija
    ctx.beginPath();ctx.ellipse(sx,sy-8,15,8,0,0,7);ctx.fill();
    ctx.fillStyle='#a34a52';ctx.beginPath();ctx.ellipse(sx+4,sy-8,10,6,0,0,7);ctx.fill();
    ctx.fillStyle='#eae4d6';ctx.beginPath();ctx.ellipse(sx-9,sy-9,6,4,0,0,7);ctx.fill(); // almohada
  }else if(ty==='camilla'){
    for(const[lx,ly]of[[-.3,-.3],[.3,.3]]){
      const px=g2sx(st.gx+.5+lx,st.gy+.5+ly),py=g2sy(st.gx+.5+lx,st.gy+.5+ly);
      ctx.fillStyle='#8b9096';ctx.fillRect(px-1.5,py-12,3,12);}
    cube(st.gx,st.gy,10,['#c9cdc9','#9aa09a','#dfe3df'],.82);
    ctx.strokeStyle='#c94a3a';ctx.lineWidth=2;                     // cruz roja
    ctx.beginPath();ctx.moveTo(sx-4,sy-12);ctx.lineTo(sx+4,sy-12);
    ctx.moveTo(sx,sy-16);ctx.lineTo(sx,sy-8);ctx.stroke();
  }else{
    cube(st.gx,st.gy,F.h,[F.c[0],F.c[1],F.c[0]],.82);
    const topY=sy-F.h;
    if(ty==='nevera'){
      ctx.strokeStyle='rgba(0,0,0,.3)';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(sx-11,sy-F.h*.55);ctx.lineTo(sx+9,sy-F.h*.55-3);ctx.stroke(); // división
      ctx.strokeStyle='#8a8f8a';ctx.lineWidth=2.4;                 // manija
      ctx.beginPath();ctx.moveTo(sx-9,topY+11);ctx.lineTo(sx-9,topY+20);ctx.stroke();
    }else if(ty==='estante'){
      ctx.strokeStyle='rgba(0,0,0,.28)';ctx.lineWidth=1;
      for(let s=1;s<=2;s++){const yy=sy-F.h*(s/3);
        ctx.beginPath();ctx.moveTo(sx-11,yy+3);ctx.lineTo(sx+9,yy);ctx.stroke();}
      const cans=['#b0503a','#3d6a8a','#5a8a4a','#c9a83a'];        // productos
      for(let s=0;s<4;s++){ctx.fillStyle=cans[s%4];
        ctx.fillRect(sx-9+s*5,sy-F.h*((s%2)+1)/3-6,3.5,6);}
    }else if(ty==='ropero'||ty==='alacena'){
      ctx.strokeStyle='rgba(0,0,0,.32)';ctx.lineWidth=1;           // dos puertas
      ctx.beginPath();ctx.moveTo(sx,topY+3);ctx.lineTo(sx,sy-2);ctx.stroke();
      ctx.fillStyle='#c9b98a';                                     // manijas
      ctx.beginPath();ctx.arc(sx-3,sy-F.h*.5,1.3,0,7);ctx.fill();
      ctx.beginPath();ctx.arc(sx+3,sy-F.h*.5,1.3,0,7);ctx.fill();
    }else if(ty==='casillero'){
      ctx.strokeStyle='rgba(0,0,0,.3)';ctx.lineWidth=1;            // rejillas
      for(let s=1;s<=3;s++){const yy=topY+5+s*4;
        ctx.beginPath();ctx.moveTo(sx-8,yy);ctx.lineTo(sx+7,yy-1.5);ctx.stroke();}
      ctx.fillStyle='#d9c26a';ctx.beginPath();ctx.arc(sx-6,sy-F.h*.42,1.4,0,7);ctx.fill();
    }else if(ty==='botiquin'){
      ctx.fillStyle='#c94a3a';ctx.fillRect(sx-2,topY+6,4,10);ctx.fillRect(sx-5,topY+9,10,4);
    }else if(ty==='bomba'){
      ctx.fillStyle='#1c1c18';ctx.fillRect(sx-7,topY+5,14,7);      // pantalla
      ctx.fillStyle='#7dd97d';ctx.fillRect(sx-5,topY+7,10,3);
      ctx.strokeStyle='#2a2a26';ctx.lineWidth=2;                   // manguera
      ctx.beginPath();ctx.moveTo(sx+8,topY+9);ctx.quadraticCurveTo(sx+14,sy-6,sx+11,sy);ctx.stroke();
    }
  }
  if(!f.looted){ctx.fillStyle='#d9c26a';
    ctx.beginPath();ctx.arc(sx,sy-F.h-6,2.5,0,7);ctx.fill();}
}
function drawCrate(st){
  const c=st.o;
  groundShadow(st.gx,st.gy,11,6);
  cube(st.gx,st.gy,14,c.looted?['#3d3d36','#33332c','#46463e']:['#6b4f2a','#57401f','#7d5f38'],.7);
  if(!c.looted){const sx=g2sx(st.gx+.5,st.gy+.5),sy=g2sy(st.gx+.5,st.gy+.5);
    ctx.fillStyle='#d9c26a';ctx.beginPath();ctx.arc(sx,sy-20,2.5,0,7);ctx.fill();}
}
function drawTree(st,fade){
  const i=st.gx,j=st.gy,s=st.s;
  const sx=g2sx(i+.5,j+.5),sy=g2sy(i+.5,j+.5);
  ctx.fillStyle='rgba(0,0,0,.2)';                       // sombra de la copa en el suelo
  ctx.beginPath();ctx.ellipse(sx+5,sy+1,22*s,11*s,0,0,7);ctx.fill();
  cube(i,j,12,['#4a3620','#3a2a18','#5c4628'],.34);
  if(fade)ctx.globalAlpha=.36;
  ctx.fillStyle='#182415';ctx.beginPath();ctx.ellipse(sx+3,sy-25*s,24*s,17*s,0,0,7);ctx.fill();
  ctx.fillStyle='#223318';ctx.beginPath();ctx.ellipse(sx-2,sy-32*s,19*s,14*s,0,0,7);ctx.fill();
  ctx.fillStyle='#2c421f';ctx.beginPath();ctx.ellipse(sx-6,sy-37*s,12*s,9*s,0,0,7);ctx.fill();
  ctx.fillStyle='rgba(120,150,80,.5)';                  // luz moteada (estable)
  for(let k=0;k<4;k++)ctx.fillRect(sx-10*s+k*5*s,sy-40*s+Math.sin(i*3+k*2)*3,2,2);
  ctx.globalAlpha=1;
}
// Tipos de vehículo: medidas (medio largo/ancho en tiles), alturas de
// carrocería y cabina, tramo de la cabina a lo largo (f0..f1) y su ancho (wi).
const VTYPE={
  sedan: {len:.95,wid:.56,body:8, roof:9, r:.72,f0:.22,f1:.76,wi:.82,
          col:['#7a3b32','#3b5a7a','#6e6e64','#4c6b3f','#8a7a3a','#5a4a6a','#8f8f88']},
  van:   {len:1.1, wid:.62,body:10,roof:14,r:.82,f0:.16,f1:.9, wi:.86,
          col:['#8a8a82','#3d5a4a','#6a5140','#4a5568','#9a9490']},
  pickup:{len:1.15,wid:.58,body:8, roof:10,r:.8, f0:.1, f1:.5, wi:.82,bed:true,
          col:['#6e6e64','#7a3b32','#3d4a5a','#5a4a3a','#455a45']},
  truck: {len:1.4, wid:.68,body:11,roof:15,r:.95,f0:.04,f1:.4, wi:.9, cargo:true,
          col:['#5a6068','#7a4030','#3d5a6a','#6a6252']},
  bus:   {len:1.75,wid:.72,body:11,roof:13,r:1.05,f0:.05,f1:.96,wi:.9,rows:true,
          col:['#b0902a','#7a3b32','#3b5a7a','#c9a83a']}
};
// Caja isométrica extruida desde un rectángulo de tiles, elevada `lift` px.
function boxIso(gx0,gy0,gx1,gy1,lift,h,cols){
  const P=[[gx0,gy0],[gx1,gy0],[gx1,gy1],[gx0,gy1]]
    .map(p=>[g2sx(p[0],p[1]),g2sy(p[0],p[1])-lift]);
  ctx.fillStyle=cols[0];                                      // cara SO
  ctx.beginPath();ctx.moveTo(P[3][0],P[3][1]-h);ctx.lineTo(P[2][0],P[2][1]-h);
  ctx.lineTo(P[2][0],P[2][1]);ctx.lineTo(P[3][0],P[3][1]);ctx.closePath();ctx.fill();
  ctx.fillStyle=cols[1];                                      // cara SE
  ctx.beginPath();ctx.moveTo(P[2][0],P[2][1]-h);ctx.lineTo(P[1][0],P[1][1]-h);
  ctx.lineTo(P[1][0],P[1][1]);ctx.lineTo(P[2][0],P[2][1]);ctx.closePath();ctx.fill();
  ctx.fillStyle=cols[2];                                      // tapa
  ctx.beginPath();ctx.moveTo(P[0][0],P[0][1]-h);ctx.lineTo(P[1][0],P[1][1]-h);
  ctx.lineTo(P[2][0],P[2][1]-h);ctx.lineTo(P[3][0],P[3][1]-h);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.32)';ctx.lineWidth=1;ctx.stroke();
  return P.map(p=>[p[0],p[1]-h]);                             // esquinas de la tapa
}
function drawCar(c){
  const T=VTYPE[c.type]||VTYPE.sedan,along=c.axis==='x';
  const hx=along?T.len:T.wid,hy=along?T.wid:T.len;
  const gx0=c.gx-hx,gx1=c.gx+hx,gy0=c.gy-hy,gy1=c.gy+hy;
  const body=c.hp<45?shade(c.col,-55):c.col,clear=3;
  // sombra
  const SP=[[gx0,gy0],[gx1,gy0],[gx1,gy1],[gx0,gy1]].map(p=>[g2sx(p[0],p[1]),g2sy(p[0],p[1])]);
  ctx.fillStyle='rgba(0,0,0,.26)';
  ctx.beginPath();ctx.moveTo(SP[0][0],SP[0][1]+4);
  for(let k=1;k<4;k++)ctx.lineTo(SP[k][0],SP[k][1]+4);ctx.closePath();ctx.fill();
  // ruedas (asoman bajo la carrocería)
  ctx.fillStyle='#14171b';
  const iw=.82;
  for(const[wx,wy]of[[-1,-1],[1,-1],[1,1],[-1,1]]){
    const x=g2sx(c.gx+hx*iw*wx,c.gy+hy*iw*wy),y=g2sy(c.gx+hx*iw*wx,c.gy+hy*iw*wy);
    ctx.beginPath();ctx.ellipse(x,y-1,3.6,2.1,0,0,7);ctx.fill();
  }
  // carrocería
  boxIso(gx0,gy0,gx1,gy1,clear,T.body,[shade(body,-26),shade(body,-44),body]);
  // caja de carga del camión (atrás), gris metálico
  if(T.cargo){
    let bx0,bx1,by0,by1;
    if(along){bx0=lerp(gx0,gx1,.46);bx1=lerp(gx0,gx1,.99);by0=c.gy-hy*.96;by1=c.gy+hy*.96;}
    else{by0=lerp(gy0,gy1,.46);by1=lerp(gy0,gy1,.99);bx0=c.gx-hx*.96;bx1=c.gx+hx*.96;}
    boxIso(bx0,by0,bx1,by1,clear+T.body*.2,T.roof,['#7f817c','#63655f','#96988f']);
  }
  // cabina/techo
  let cgx0,cgx1,cgy0,cgy1;
  if(along){cgx0=lerp(gx0,gx1,T.f0);cgx1=lerp(gx0,gx1,T.f1);cgy0=c.gy-hy*T.wi;cgy1=c.gy+hy*T.wi;}
  else{cgy0=lerp(gy0,gy1,T.f0);cgy1=lerp(gy0,gy1,T.f1);cgx0=c.gx-hx*T.wi;cgx1=c.gx+hx*T.wi;}
  const top=boxIso(cgx0,cgy0,cgx1,cgy1,clear+T.body,T.roof,
    [shade(body,-12),shade(body,-30),shade(body,12)]);
  // ventanas (vidrio en las dos caras visibles de la cabina)
  const glass=(a,b)=>{
    const i0=.14,ax=lerp(a[0],b[0],i0),ay=lerp(a[1],b[1],i0),
          bx=lerp(b[0],a[0],i0),by=lerp(b[1],a[1],i0),dh=T.roof*.6;
    ctx.fillStyle='rgba(150,182,208,.5)';
    ctx.beginPath();ctx.moveTo(ax,ay+2);ctx.lineTo(bx,by+2);
    ctx.lineTo(bx,by+2+dh);ctx.lineTo(ax,ay+2+dh);ctx.closePath();ctx.fill();
    if(T.rows){ctx.strokeStyle='rgba(30,40,55,.6)';ctx.lineWidth=1; // divisiones de bus
      for(let s=1;s<6;s++){const t=s/6,x=lerp(ax,bx,t),y=lerp(ay,by,t);
        ctx.beginPath();ctx.moveTo(x,y+2);ctx.lineTo(x,y+2+dh);ctx.stroke();}}
  };
  glass(top[3],top[2]);glass(top[2],top[1]);
  // faros y calaveras
  const fr=along?[gx1,c.gy]:[c.gx,gy1],re=along?[gx0,c.gy]:[c.gx,gy0];
  ctx.fillStyle='#ffe9a8';let ls=g2sx(fr[0],fr[1]),lsy=g2sy(fr[0],fr[1]);
  ctx.beginPath();ctx.arc(ls,lsy-clear-T.body*.45,1.8,0,7);ctx.fill();
  ctx.fillStyle='#c9433a';ls=g2sx(re[0],re[1]);lsy=g2sy(re[0],re[1]);
  ctx.beginPath();ctx.arc(ls,lsy-clear-T.body*.45,1.8,0,7);ctx.fill();
  // conductor
  const mx=(top[0][0]+top[2][0])/2,my=(top[0][1]+top[2][1])/2;
  if(inCar===c){ctx.fillStyle='#d8b08c';ctx.beginPath();ctx.arc(mx,my+1,3.5,0,7);ctx.fill();
    ctx.fillStyle='#3a2e22';ctx.beginPath();ctx.arc(mx,my-1,3.5,Math.PI,2*Math.PI);ctx.fill();}
  if(!c.looted){ctx.fillStyle='#d9c26a';
    ctx.beginPath();ctx.arc(mx,my-T.roof-8,2.5,0,7);ctx.fill();}
}
function shade(hex,amt){
  const n=parseInt(hex.slice(1),16);
  let r=(n>>16)+amt,g=((n>>8)&255)+amt,b=(n&255)+amt;
  r=clamp(r,0,255);g=clamp(g,0,255);b=clamp(b,0,255);
  return 'rgb('+r+','+g+','+b+')';
}

/* ================= PERSONAJES ================= */
function faceOf(gdir){
  const a=grid2scrA(Math.cos(gdir),Math.sin(gdir))*180/Math.PI;
  return (a>-135&&a<=-45)?'N':(a>-45&&a<=45)?'E':(a>45&&a<=135)?'S':'W';
}
function drawWeaponSide(c,tier,gun,gunFlash){
  if(gun){c.fillStyle='#23231f';c.fillRect(3,-2,11,4);c.fillRect(3,0,3,6);
    if(gunFlash>0){c.fillStyle='rgba(255,214,110,'+Math.min(1,gunFlash*12)+')';
      c.beginPath();c.arc(17,0,6,0,7);c.fill();}return;}
  if(tier===0)return;
  if(tier===1){c.fillStyle='#6b4f2a';c.fillRect(1,-1.6,16,3.2);
    c.fillStyle='#9a9a90';c.fillRect(12,-3,2,6);}
  else if(tier===2){c.fillStyle='#8a6a3c';c.fillRect(1,-2,18,4);}
  else{c.fillStyle='#5c4426';c.fillRect(1,-1.6,16,3.2);
    c.fillStyle='#7d2f28';c.fillRect(14,-5.5,6,8);
    c.fillStyle='#b9b9ad';c.fillRect(18.5,-5.5,1.8,8);}
}
function drawHuman(sx,sy,face,o){
  const s=o.scale||1;
  ctx.save();ctx.translate(sx,sy);
  ctx.fillStyle='rgba(0,0,0,.3)';
  ctx.beginPath();ctx.ellipse(0,1,9*s,4.2*s,0,0,7);ctx.fill();
  ctx.scale(s*(face==='W'?-1:1),s);
  const f=(face==='W')?'E':face;
  const skin=o.flash>0?'#e8ecdf':(o.zom?'#93aa84':'#d8b08c');
  const shirt=o.flash>0?'#d7dcc9':o.shirt;
  const wA=Math.sin(o.walk||0)*3;
  if(f==='E'){ /* perfil */
    ctx.fillStyle=o.pants;
    ctx.fillRect(-4+wA*.7,-11,4,11);ctx.fillRect(0-wA*.7,-11,4,11);
    ctx.fillStyle=shirt;ctx.fillRect(-6,-24,12,14);
    ctx.strokeStyle='rgba(0,0,0,.25)';ctx.strokeRect(-6,-24,12,14);
    if(o.zom){ctx.fillStyle='rgba(92,15,20,.75)';
      ctx.fillRect(-3,-20,4,3);ctx.fillRect(1,-15,3,2.5);}
    /* cabeza perfil */
    ctx.fillStyle=o.hair;ctx.beginPath();ctx.arc(-1.5,-28.5,5.4,0,7);ctx.fill();
    ctx.fillStyle=skin;ctx.beginPath();ctx.arc(1.6,-28,4.4,0,7);ctx.fill();
    ctx.fillStyle=o.zom?'#a31621':'#2a2a26';
    ctx.beginPath();ctx.arc(3.6,-28.6,1,0,7);ctx.fill();
    /* brazos */
    if(o.zom){
      ctx.strokeStyle=skin;ctx.lineWidth=3.2;
      ctx.beginPath();ctx.moveTo(2,-21);ctx.lineTo(13,-17+wA*.6);ctx.stroke();
      ctx.beginPath();ctx.moveTo(2,-19);ctx.lineTo(13,-13-wA*.6);ctx.stroke();
      ctx.fillStyle=skin;
      ctx.beginPath();ctx.arc(14,-17+wA*.6,2.4,0,7);ctx.fill();
      ctx.beginPath();ctx.arc(14,-13-wA*.6,2.4,0,7);ctx.fill();
    }else{
      ctx.save();ctx.translate(2,-20);ctx.rotate(o.swingA||.15);
      ctx.strokeStyle=skin;ctx.lineWidth=3.4;
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(9,2);ctx.stroke();
      ctx.translate(8,2);drawWeaponSide(ctx,o.wTier,o.gun,o.gunFlash);
      ctx.fillStyle=skin;ctx.beginPath();ctx.arc(2,1,2.4,0,7);ctx.fill();
      ctx.restore();
    }
  }else{ /* frente (S) o espalda (N) */
    ctx.fillStyle=o.pants;
    ctx.fillRect(-5,-11+Math.max(0,wA),4,11-Math.max(0,wA));
    ctx.fillRect(1,-11+Math.max(0,-wA),4,11-Math.max(0,-wA));
    ctx.fillStyle=shirt;ctx.fillRect(-7,-24,14,14);
    ctx.strokeStyle='rgba(0,0,0,.25)';ctx.strokeRect(-7,-24,14,14);
    if(f==='N'&&!o.zom&&o.pack){ctx.fillStyle='#6b4f2a';ctx.fillRect(-5,-23,10,11);
      ctx.strokeStyle='#463317';ctx.strokeRect(-5,-23,10,11);}
    if(o.zom&&f==='S'){ctx.fillStyle='rgba(92,15,20,.75)';
      ctx.fillRect(-4,-19,4,3);ctx.fillRect(2,-15,3,2.5);}
    /* brazos */
    if(o.zom){
      ctx.strokeStyle=skin;ctx.lineWidth=3;
      const yy=f==='S'?-6:-20;
      ctx.beginPath();ctx.moveTo(-6,-21);ctx.lineTo(-8,yy+wA*.5);ctx.stroke();
      ctx.beginPath();ctx.moveTo(6,-21);ctx.lineTo(8,yy-wA*.5);ctx.stroke();
      ctx.fillStyle=skin;
      ctx.beginPath();ctx.arc(-8,yy+wA*.5,2.2,0,7);ctx.fill();
      ctx.beginPath();ctx.arc(8,yy-wA*.5,2.2,0,7);ctx.fill();
    }else{
      ctx.fillStyle=skin;
      ctx.fillRect(-9.5,-23,3,9+wA*.4);ctx.fillRect(6.5,-23,3,9-wA*.4);
    }
    /* cabeza */
    ctx.fillStyle=skin;ctx.beginPath();ctx.arc(0,-28,5.2,0,7);ctx.fill();
    ctx.fillStyle=o.hair;
    if(f==='N'){ctx.beginPath();ctx.arc(0,-28,5.2,0,7);ctx.fill();}
    else{ctx.beginPath();ctx.arc(0,-28,5.2,Math.PI,2*Math.PI);
      ctx.lineTo(5.2,-27);ctx.lineTo(-5.2,-27);ctx.closePath();ctx.fill();}
    if(f==='S'){ctx.fillStyle=o.zom?'#a31621':'#2a2a26';
      ctx.beginPath();ctx.arc(-2,-27,1,0,7);ctx.fill();
      ctx.beginPath();ctx.arc(2,-27,1,0,7);ctx.fill();
      if(o.zom){ctx.strokeStyle='#5c0f14';ctx.lineWidth=1.2;
        ctx.beginPath();ctx.moveTo(-1.5,-24.6);ctx.lineTo(1.5,-24.6);ctx.stroke();}}
  }
  ctx.restore();
}

/* ================= ESCENA ================= */
function draw(){
  const psx=g2sx(player.gx,player.gy),psy=g2sy(player.gx,player.gy);
  const la=grid2scrA(Math.cos(player.dir),Math.sin(player.dir));
  const ctx2=clamp(psx-VW/2+Math.cos(la)*32,0,Math.max(0,SW-VW));
  const cty=clamp(psy-VH/2+Math.sin(la)*18,0,Math.max(0,SH-VH));
  if(cam.x===0&&cam.y===0){cam.x=ctx2;cam.y=cty;}
  cam.x=lerp(cam.x,ctx2,.14);cam.y=lerp(cam.y,cty,.14);
  let shx=0,shy=0;
  if(shake>0){shx=rand(-shake,shake);shy=rand(-shake,shake);}
  if(!REDUCE_MOTION&&!inCar)                        // leve balanceo al caminar
    shy+=Math.sin(player.walk*2)*Math.min(1.4,hyp(player.vx||0,player.vy||0)*.28);
  ctx.fillStyle='#10130c';ctx.fillRect(0,0,VW,VH);
  ctx.save();ctx.translate(-cam.x+shx,-cam.y+shy);

  /* piso: rango de tiles visible */
  const corners=[[cam.x,cam.y],[cam.x+VW,cam.y],[cam.x,cam.y+VH],[cam.x+VW,cam.y+VH]];
  let gx0=1e9,gx1=-1e9,gy0=1e9,gy1=-1e9;
  for(const[cx,cy]of corners){
    const a=s2gx(cx,cy),b=s2gy(cx,cy);
    gx0=Math.min(gx0,a);gx1=Math.max(gx1,a);
    gy0=Math.min(gy0,b);gy1=Math.max(gy1,b);
  }
  gx0=clamp(Math.floor(gx0)-1,0,MW);gx1=clamp(Math.ceil(gx1)+1,0,MW);
  gy0=clamp(Math.floor(gy0)-1,0,MH);gy1=clamp(Math.ceil(gy1)+1,0,MH);
  for(let j=gy0;j<gy1;j++)for(let i=gx0;i<gx1;i++){
    const sx=g2sx(i,j),sy=g2sy(i,j);
    if(sx<cam.x-HW-2||sx>cam.x+VW+HW+2||sy<cam.y-HH*2-2||sy>cam.y+VH+2)continue;
    ctx.drawImage(TILES[FKEY[FLOOR[idx(i,j)]]],sx-HW-1,sy-1);
  }

  /* charcos de sangre */
  for(const s of pools){
    const sx=g2sx(s.gx,s.gy),sy=g2sy(s.gx,s.gy);
    if(sx<cam.x-60||sx>cam.x+VW+60||sy<cam.y-40||sy>cam.y+VH+40)continue;
    ctx.globalAlpha=Math.min(.55,s.life/25);ctx.fillStyle='#5c0f14';
    ctx.beginPath();ctx.ellipse(sx,sy,s.r*44,s.r*20,0,0,7);ctx.fill();ctx.globalAlpha=1;
  }
  /* polvo levantado al correr (o salpicaduras si llueve) */
  for(const p of puffs){
    const sx=g2sx(p.gx,p.gy),sy=g2sy(p.gx,p.gy);
    ctx.globalAlpha=Math.max(0,p.life)*.5;
    ctx.fillStyle=p.wet?'#6f7f92':'#7d7259';
    ctx.beginPath();ctx.ellipse(sx,sy-4,p.r*22,p.r*11,0,0,7);ctx.fill();
  }
  ctx.globalAlpha=1;
  /* cadáveres */
  for(const c of corpses){
    const sx=g2sx(c.gx,c.gy),sy=g2sy(c.gx,c.gy);
    if(sx<cam.x-60||sx>cam.x+VW+60||sy<cam.y-40||sy>cam.y+VH+40)continue;
    ctx.globalAlpha=Math.min(.9,c.life/10);
    ctx.fillStyle='#5c0f14';ctx.beginPath();ctx.ellipse(sx,sy,16,8,0,0,7);ctx.fill();
    ctx.save();ctx.translate(sx,sy);ctx.rotate(.5);
    ctx.fillStyle=c.pants;ctx.fillRect(-14,-2,10,5);
    ctx.fillStyle=c.shirt;ctx.fillRect(-4,-3.5,11,7);
    ctx.fillStyle='#93aa84';ctx.beginPath();ctx.arc(10,-1,4.4,0,7);ctx.fill();
    ctx.restore();ctx.globalAlpha=1;
  }

  /* profundidad: estáticos visibles + entidades */
  const night=isNight(),pD=player.gx+player.gy;
  const items=[];
  for(const st of statics){
    if(st.dead)continue;
    const sx=g2sx(st.gx+.5,st.gy+.5),sy=g2sy(st.gx+.5,st.gy+.5);
    if(sx<cam.x-140||sx>cam.x+VW+140||sy<cam.y-80||sy>cam.y+VH+140)continue;
    st._sx=sx;st._sy=sy;items.push(st);
  }
  for(const z of zombies){
    const sx=g2sx(z.gx,z.gy),sy=g2sy(z.gx,z.gy);
    if(sx<cam.x-60||sx>cam.x+VW+60||sy<cam.y-60||sy>cam.y+VH+60)continue;
    items.push({kind:'zom',o:z,d:z.gx+z.gy,_sx:sx,_sy:sy});
  }
  for(const c of cars){
    const sx=g2sx(c.gx,c.gy),sy=g2sy(c.gx,c.gy);
    if(sx<cam.x-120||sx>cam.x+VW+120||sy<cam.y-80||sy>cam.y+VH+80)continue;
    items.push({kind:'carD',o:c,d:c.gx+c.gy,_sx:sx,_sy:sy});
  }
  for(const f of fires){
    const sx=g2sx(f.gx,f.gy),sy=g2sy(f.gx,f.gy);
    if(sx<cam.x-80||sx>cam.x+VW+80||sy<cam.y-80||sy>cam.y+VH+80)continue;
    items.push({kind:'fire',o:f,d:f.gx+f.gy,_sx:sx,_sy:sy});
  }
  for(const kk in barrs){const b=barrs[kk];
    if(b.win)continue;
    const sx=g2sx(b.gx+.5,b.gy+.5),sy=g2sy(b.gx+.5,b.gy+.5);
    if(sx<cam.x-80||sx>cam.x+VW+80||sy<cam.y-60||sy>cam.y+VH+60)continue;
    items.push({kind:'barr',o:b,d:b.gx+b.gy,_sx:sx,_sy:sy});
  }
  if(!inCar)items.push({kind:'ply',d:pD,_sx:psx,_sy:psy});
  items.sort((a,b)=>a.d-b.d);

  for(const it of items){
    if(it.kind==='wall'){
      const fade=it.d>pD+.9&&hyp(it._sx-psx,it._sy-psy)<180;
      if(fade)ctx.globalAlpha=.35;
      drawWall(it,night);ctx.globalAlpha=1;
    }else if(it.kind==='tree'){
      drawTree(it,it.d>pD+.9&&hyp(it._sx-psx,it._sy-psy)<190);
    }else if(it.kind==='furn')drawFurn(it);
    else if(it.kind==='crate')drawCrate(it);
    else if(it.kind==='carD')drawCar(it.o);
    else if(it.kind==='fire')drawFire(it.o,it._sx,it._sy);
    else if(it.kind==='barr')drawBarr(it.o);
    else if(it.kind==='zom'){
      const z=it.o;
      drawHuman(it._sx,it._sy,faceOf(z.dir),{zom:true,shirt:z.shirt,pants:z.pants,
        hair:'#3a3a30',walk:z.anim,flash:z.flash,
        scale:z.type==='tank'?1.35:z.type==='runner'?.9:1});
      if(z.hp<z.mhp){
        ctx.fillStyle='#151a10';ctx.fillRect(it._sx-12,it._sy-42,24,4);
        ctx.fillStyle='#a31621';ctx.fillRect(it._sx-12,it._sy-42,24*(z.hp/z.mhp),4);}
    }else if(it.kind==='ply'){
      const swingA=player.swing>0?lerp(.9,-1.15,player.swing/.18):.15;
      drawHuman(it._sx,it._sy,faceOf(player.dir),{shirt:'#5d738f',pants:'#3a4250',
        hair:'#3a2e22',walk:player.walk,swingA,pack:true,
        wTier:player.wTier,gun:player.useGun&&player.hasGun,gunFlash:player.gunFlash});
      if(player.swing>0){
        const a=grid2scrA(Math.cos(player.dir),Math.sin(player.dir));
        ctx.strokeStyle='rgba(232,228,216,'+(player.swing/.18)*.8+')';ctx.lineWidth=3;
        ctx.save();ctx.translate(it._sx,it._sy-16);ctx.scale(1,.55);
        ctx.beginPath();ctx.arc(0,0,MELEE[player.wTier].range*44,a-.9,a+.9);ctx.stroke();
        ctx.restore();
      }
    }
  }

  /* balas trazadoras */
  for(const s of shots){
    ctx.strokeStyle='rgba(255,225,140,'+Math.min(1,s.life*12)+')';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(g2sx(s.x1,s.y1),g2sy(s.x1,s.y1)-16);
    ctx.lineTo(g2sx(s.x2,s.y2),g2sy(s.x2,s.y2)-16);ctx.stroke();
  }
  /* sangre voladora */
  ctx.fillStyle='#a31621';
  for(const p of parts){
    ctx.globalAlpha=p.life*2;
    ctx.fillRect(g2sx(p.gx,p.gy)-2,g2sy(p.gx,p.gy)-14,4,4);
  }
  ctx.globalAlpha=1;
  /* números de daño */
  ctx.font='bold 13px Courier New';ctx.textAlign='center';
  for(const d2 of dmgs){
    const sx=g2sx(d2.gx,d2.gy),sy=g2sy(d2.gx,d2.gy)-40+d2.oy;
    ctx.globalAlpha=Math.min(1,d2.life*2.2);
    ctx.fillStyle='#000';ctx.fillText(d2.txt,sx+1,sy+1);
    ctx.fillStyle=d2.col;ctx.fillText(d2.txt,sx,sy);
  }
  ctx.globalAlpha=1;
  /* letreros de edificios especiales */
  ctx.font='bold 11px Courier New';ctx.textAlign='center';
  for(const b of buildings){
    if(!b.name)continue;
    if(hyp(b.x+b.w/2-player.gx,b.y+b.h/2-player.gy)>15)continue;
    const sx=g2sx(b.x+b.w/2,b.y+.5),sy=g2sy(b.x+b.w/2,b.y+.5)-WALLH-10;
    ctx.fillStyle='rgba(12,15,10,.8)';
    ctx.fillRect(sx-b.name.length*3.8-6,sy-11,b.name.length*7.6+12,15);
    ctx.fillStyle='#d9c26a';ctx.fillText(b.name,sx,sy);
  }
  /* punto de extracción */
  if(radioFound){
    const ex=g2sx(EP.x,EP.y),ey=g2sy(EP.x,EP.y);
    const pul=1+Math.sin(gameTime*4)*.15;
    ctx.strokeStyle='rgba(125,217,125,.8)';ctx.lineWidth=3;
    ctx.save();ctx.translate(ex,ey);ctx.scale(1,.5);
    ctx.beginPath();ctx.arc(0,0,34*pul,0,7);ctx.stroke();ctx.restore();
    ctx.fillStyle='#7dd97d';ctx.font='bold 18px Courier New';
    ctx.fillText('H',ex,ey+6);
    if(dayNum()>=CFG.survivalDays){
      for(let k=0;k<5;k++){const t=(gameTime*1.3+k*.9)%3;
        ctx.globalAlpha=.5*(1-t/3);
        ctx.fillStyle=k%2?'#d97d7d':'#c9c9c9';
        ctx.beginPath();ctx.arc(ex+Math.sin(gameTime+k)*6,ey-20-t*36,7+t*5,0,7);ctx.fill();}
      ctx.globalAlpha=1;
      if(winT>0){ctx.fillStyle='#7dd97d';ctx.fillRect(ex-30,ey-92,60*(winT/CFG.extractHold),6);
        ctx.strokeStyle='#0d100a';ctx.strokeRect(ex-30,ey-92,60,6);}
    }
  }
  ctx.textAlign='left';
  ctx.restore();

  gradeOverlay();                                  // tinte cálido/frío según la hora

  /* oscuridad + linterna */
  const dk=darkness();
  if(dk>.02&&started){
    lctx.clearRect(0,0,VW,VH);
    lctx.fillStyle='rgba(7,9,20,'+dk+')';lctx.fillRect(0,0,VW,VH);
    const px=psx-cam.x+shx,py=psy-cam.y+shy-14;
    lctx.globalCompositeOperation='destination-out';
    let g=lctx.createRadialGradient(px,py,8,px,py,85);
    g.addColorStop(0,'rgba(0,0,0,.85)');g.addColorStop(1,'rgba(0,0,0,0)');
    lctx.fillStyle=g;lctx.beginPath();lctx.arc(px,py,85,0,7);lctx.fill();
    const fogR=1-foggy()*.4;                        // la niebla acorta tu visión
    const a=grid2scrA(Math.cos(player.dir),Math.sin(player.dir)),R=280*fogR,half=.55;
    g=lctx.createRadialGradient(px,py,20,px,py,R);
    g.addColorStop(0,'rgba(0,0,0,.95)');g.addColorStop(1,'rgba(0,0,0,0)');
    lctx.fillStyle=g;
    lctx.beginPath();lctx.moveTo(px,py);lctx.arc(px,py,R,a-half,a+half);lctx.closePath();lctx.fill();
    for(const f of fires){                          // luz de fogatas y generadores
      const fx=g2sx(f.gx,f.gy)-cam.x+shx,fy=g2sy(f.gx,f.gy)-cam.y+shy-6;
      if(fx<-160||fx>VW+160||fy<-160||fy>VH+160)continue;
      const rr=f.gen?150:80+Math.sin(gameTime*9+f.gx*3)*9;   // 💡 luz más amplia
      g=lctx.createRadialGradient(fx,fy,8,fx,fy,rr);
      g.addColorStop(0,'rgba(0,0,0,.92)');g.addColorStop(1,'rgba(0,0,0,0)');
      lctx.fillStyle=g;lctx.beginPath();lctx.arc(fx,fy,rr,0,7);lctx.fill();
    }
    if(player.gunFlash>0){
      g=lctx.createRadialGradient(px,py,10,px,py,200);
      g.addColorStop(0,'rgba(0,0,0,.9)');g.addColorStop(1,'rgba(0,0,0,0)');
      lctx.fillStyle=g;lctx.beginPath();lctx.arc(px,py,200,0,7);lctx.fill();}
    lctx.globalCompositeOperation='source-over';
    ctx.drawImage(lightC,0,0,VW,VH);
  }
  drawAmbient(shx,shy);                             // motas de día / luciérnagas de noche
  drawWeather();                                    // lluvia y niebla en pantalla
  if(player.sleeping){
    ctx.fillStyle='rgba(4,6,12,.62)';ctx.fillRect(0,0,VW,VH);
    ctx.fillStyle='#c8d3b0';ctx.font='20px Courier New';ctx.textAlign='center';
    ctx.fillText('Durmiendo… Zzz',VW/2,VH/2-8);
    ctx.font='13px Courier New';ctx.fillStyle='#7d8a68';
    ctx.fillText('(el tiempo vuela — un zombi cerca te despierta)',VW/2,VH/2+16);
    ctx.textAlign='left';
  }
  drawMini();
}
// Gradación de color: cálida al amanecer/atardecer, fría de noche, neutra al mediodía.
function gradeOverlay(){
  const h=(12+tOfDay()*24)%24;
  let col,a;
  if(h<5||h>=21){col='#12203f';a=.30;}             // noche (azul frío)
  else if(h<7){col='#ff9a4d';a=.34;}               // amanecer
  else if(h<9){col='#ffdca6';a=.18;}
  else if(h<16){return;}                            // mediodía neutro
  else if(h<18.5){col='#ffc07a';a=.16;}            // tarde dorada
  else if(h<20){col='#ff8a45';a=.32;}              // atardecer dorado
  else{col='#ff6a3a';a=.30;}
  ctx.save();ctx.globalCompositeOperation='soft-light';
  ctx.globalAlpha=a;ctx.fillStyle=col;ctx.fillRect(0,0,VW,VH);ctx.restore();
}
function drawAmbient(shx,shy){
  for(const p of amb){
    const sx=g2sx(p.gx,p.gy)-cam.x+shx,sy=g2sy(p.gx,p.gy)-cam.y+shy-18;
    if(sx<-10||sx>VW+10||sy<-10||sy>VH+10)continue;
    const tw=Math.sin(p.ph)*.5+.5;
    if(p.night){                                    // luciérnagas
      ctx.globalAlpha=(.3+tw*.7)*Math.min(1,p.life);
      ctx.fillStyle='#c8e87a';
      ctx.beginPath();ctx.arc(sx,sy,1.8,0,7);ctx.fill();
      ctx.globalAlpha*=.4;ctx.beginPath();ctx.arc(sx,sy,4.5,0,7);ctx.fill();
    }else{                                          // motas de polvo/polen
      ctx.globalAlpha=(.12+tw*.16)*Math.min(1,p.life);
      ctx.fillStyle='#e8e6d0';
      ctx.fillRect(sx,sy,1.6,1.6);
    }
  }
  ctx.globalAlpha=1;
}
function drawWeather(){
  const it=weather?weather.inten:0;
  if(weather&&weather.type==='rain'&&it>.02){
    ctx.strokeStyle='rgba(155,180,210,'+(.2+it*.28)+')';ctx.lineWidth=1;
    ctx.beginPath();
    const t=gameTime,n=Math.floor(it*230*(VW/900));
    for(let i=0;i<n;i++){
      const x=(i*137.5+t*760)%(VW+40)-20,y=(i*97.3+t*1180)%(VH+40)-20;
      ctx.moveTo(x,y);ctx.lineTo(x-6,y+15);
    }
    ctx.stroke();
    ctx.fillStyle='rgba(38,52,78,'+it*.14+')';ctx.fillRect(0,0,VW,VH);
  }
  if(weather&&weather.type==='fog'&&it>.02){
    ctx.fillStyle='rgba(150,158,150,'+it*.32+')';ctx.fillRect(0,0,VW,VH);
  }
}
function drawMini(){
  mctx.drawImage(miniBase,0,0);
  const k=130/MW;
  mctx.fillStyle='#a31621';
  for(const z of zombies)mctx.fillRect(z.gx*k-1,z.gy*k-1,2.4,2.4);
  mctx.fillStyle='#6a9ad4';
  for(const c of cars)mctx.fillRect(c.gx*k-1.5,c.gy*k-1.5,3,3);
  if(radioFound&&Math.floor(gameTime*2)%2===0){
    mctx.fillStyle='#7dd97d';mctx.fillRect(EP.x*k-3,EP.y*k-3,6,6);}
  mctx.fillStyle='#f2e9dc';
  mctx.fillRect(player.gx*k-2,player.gy*k-2,4,4);
}

/* ================= INPUT ================= */
addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();keys[k]=true;
  if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
  if(k==='m'){muted=!muted;if(started)msg(muted?'🔇 Sonido silenciado':'🔊 Sonido activado');return;}
  if(k==='f9'){e.preventDefault();toggleCatador();return;}
  if((k==='p'||k==='escape')&&started&&!dead){
    if(crafting){toggleCraft();return;}
    if(skillsOpen){toggleSkills();return;}
    paused=!paused;return;}
  if(k==='c'&&started&&!dead&&!paused&&!skillsOpen){toggleCraft();return;}
  if(k==='h'&&started&&!dead&&!paused&&!crafting){toggleSkills();return;}
  if(!player||paused||crafting||skillsOpen||!started)return;
  if(k===' ')atkHold=true;
  if(k==='e')tryLoot();
  if(k==='q'&&player.hasGun){player.useGun=!player.useGun;sfx(340,.07,'triangle',.04);}
  if(k==='1')useItem('food');
  if(k==='2')useItem('water');
  if(k==='3')useItem('med');
  if(k==='4')useItem('anti');
  if(k==='f')enterExitCar();
  if(k==='b')tryBuild();
  if(k==='z')trySleep();
  if(k==='x')tryCook();
  if(k==='g')manualSave();
});
addEventListener('keyup',e=>{const k=e.key.toLowerCase();keys[k]=false;if(k===' ')atkHold=false;});
cv.addEventListener('mousemove',e=>{aim.x=e.clientX;aim.y=e.clientY;aim.has=true;});
cv.addEventListener('mousedown',e=>{if(!TOUCH){aim.x=e.clientX;aim.y=e.clientY;aim.has=true;atkHold=true;attack();}});
addEventListener('mouseup',()=>{if(!TOUCH)atkHold=false;});
cv.addEventListener('contextmenu',e=>e.preventDefault());

const zone=document.getElementById('joyZone'),base=document.getElementById('joyBase'),
      stick=document.getElementById('joyStick');
let joyId=null,jOrigin=null;
zone.addEventListener('touchstart',e=>{
  e.preventDefault();const t=e.changedTouches[0];
  joyId=t.identifier;jOrigin={x:t.clientX,y:t.clientY};
  base.style.display='block';base.style.left=(t.clientX-59)+'px';base.style.top=(t.clientY-59)+'px';
  joy={x:0,y:0,m:0};
},{passive:false});
zone.addEventListener('touchmove',e=>{
  e.preventDefault();
  for(const t of e.changedTouches)if(t.identifier===joyId&&jOrigin){
    const dx=t.clientX-jOrigin.x,dy=t.clientY-jOrigin.y,d=hyp(dx,dy);
    const m=Math.min(1,d/58);
    joy=(d>0&&m>.1)?{x:dx/d*m,y:dy/d*m,m:m}:{x:0,y:0,m:0};
    const cl=Math.min(d,58);
    stick.style.left=(33+(d?dx/d*cl:0))+'px';stick.style.top=(33+(d?dy/d*cl:0))+'px';
  }
},{passive:false});
function joyEnd(e){
  for(const t of e.changedTouches)if(t.identifier===joyId){
    joyId=null;joy=null;base.style.display='none';
    stick.style.left='33px';stick.style.top='33px';}
}
zone.addEventListener('touchend',joyEnd);zone.addEventListener('touchcancel',joyEnd);

const bAtk=document.getElementById('btnAtk');
bAtk.addEventListener('touchstart',e=>{e.preventDefault();atkHold=true;attack();},{passive:false});
bAtk.addEventListener('touchend',e=>{e.preventDefault();atkHold=false;},{passive:false});
function bindTap(id,fn){
  const el=document.getElementById(id);
  el.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();fn();},{passive:false});
  el.addEventListener('mousedown',e=>{e.preventDefault();fn();});
}
bindTap('btnLoot',tryLoot);
bindTap('btnCraft',toggleCraft);
bindTap('btnGun',()=>{if(player.hasGun){player.useGun=!player.useGun;sfx(340,.07,'triangle',.04);}});
bindTap('btnCar',enterExitCar);
bindTap('btnBed',trySleep);
bindTap('btnBuild',tryBuild);
bindTap('btnCook',tryCook);
bindTap('btnSkills',toggleSkills);
const slotK=[['s0','food'],['s1','water'],['s2','med'],['s3','anti']];
for(const[id,k]of slotK)bindTap(id,()=>useItem(k));

/* ================= v4: AUTOS ================= */
function nearCar(){let best=null,bd=2.1;
  for(const c of cars){const d=hyp(c.gx-player.gx,c.gy-player.gy);
    if(d<bd){bd=d;best=c;}}return best;}
function carPush(e){for(const c of cars){
  const dx=e.gx-c.gx,dy=e.gy-c.gy,d=hyp(dx,dy),m=e.r+c.r;
  if(d<m&&d>0){e.gx=c.gx+dx/d*m;e.gy=c.gy+dy/d*m;}}}
function enterExitCar(){
  if(dead||player.sleeping)return;
  if(inCar){
    const c=inCar,offs=[[0,1.3],[0,-1.3],[1.5,0],[-1.5,0]];
    for(const[ox,oy]of offs){
      const nx=c.gx+ox,ny=c.gy+oy,ti=Math.floor(nx),tj=Math.floor(ny);
      if(ti>0&&tj>0&&ti<MW-1&&tj<MH-1&&!SOLID[idx(ti,tj)]){
        player.gx=nx;player.gy=ny;break;}}
    inCar=null;msg('Bajaste del auto');return;}
  const c=nearCar();if(!c)return;
  if(!c.drivable){
    if(sk('mech')>=2){c.drivable=true;gainXP('mech',25);
      msg('🔧 Hiciste puente al motor — ¡arrancó!');sfx(70,.4,'sawtooth',.06,140);}
    else{msg('Este auto no enciende… (Mecánica 2 para hacer puente)',true);
      sfx(90,.3,'sawtooth',.05,50);return;}}
  if(c.fuel<15&&player.gas>0){player.gas--;c.fuel+=30;msg('⛽ Echaste un bidón (+30)');}
  if(c.fuel<=0){msg('Sin gasolina — busca bidones en la GASOLINERA',true);return;}
  inCar=c;msg('🚗 Al volante (el motor hace RUIDO…)');sfx(80,.4,'sawtooth',.06,130);
}
function driveCar(dt){
  const c=inCar;
  let ix=0,iy=0;
  if(keys['w']||keys['arrowup'])iy-=1;
  if(keys['s']||keys['arrowdown'])iy+=1;
  if(keys['a']||keys['arrowleft'])ix-=1;
  if(keys['d']||keys['arrowright'])ix+=1;
  if(joy){ix=joy.x;iy=joy.y;}
  const il=hyp(ix,iy);
  let gv={x:0,y:0};
  if(il>0&&c.fuel>0){const g=scr2grid(ix,iy),gl=hyp(g.x,g.y)||1;
    gv={x:g.x/gl,y:g.y/gl};}
  const fl=FLOOR[idx(clamp(Math.floor(c.gx),0,MW-1),clamp(Math.floor(c.gy),0,MH-1))];
  const onRoad=fl>=4&&fl<6;
  const maxSp=(onRoad?8.2:4.6)*(c.hp<40?.6:1);
  const ac=1-Math.pow(.02,dt);
  c.vx=lerp(c.vx,gv.x*maxSp,ac);c.vy=lerp(c.vy,gv.y*maxSp,ac);
  let sp=hyp(c.vx,c.vy);
  if(Math.abs(c.vx)>Math.abs(c.vy)*1.15)c.axis='x';
  else if(Math.abs(c.vy)>Math.abs(c.vx)*1.15)c.axis='y';
  const tx=c.gx+c.vx*dt,ty=c.gy+c.vy*dt;
  c.gx=tx;c.gy=ty;
  collideTiles(c);
  if(hyp(c.gx-tx,c.gy-ty)>.02){
    if(sp>3){c.hp-=sp*1.8;shake=Math.max(shake,5);sfx(70,.2,'sawtooth',.08);
      msg('💥 ¡Chocaste!',true);}
    c.vx*=.15;c.vy*=.15;sp=hyp(c.vx,c.vy);}
  c.fuel=Math.max(0,c.fuel-sp*.09*dt*(1-Math.min(.5,sk('mech')*.09)));  // 🔧 -gasto
  if(sp>1){engineT-=dt;player.mechAcc=(player.mechAcc||0)+dt;
    if(player.mechAcc>3){player.mechAcc=0;gainXP('mech',6);}          // aprendes manejando
    if(engineT<=0){engineT=.4;noise(c.gx,c.gy,9);sfx(62,.12,'sawtooth',.018);}}
  for(const z of zombies){
    const d=hyp(z.gx-c.gx,z.gy-c.gy);
    if(d<c.r+z.r+.1){
      if(sp>2.6){const dm=sp*8;z.hp-=dm;z.stun=.4;z.forced=8;
        blood(z.gx,z.gy,10);dmgText(z.gx,z.gy,Math.round(dm),'#ffd27a');
        const dd=Math.max(d,.1);
        z.gx+=(z.gx-c.gx)/dd*.9;z.gy+=(z.gy-c.gy)/dd*.9;
        c.hp-=1.5;c.vx*=.94;c.vy*=.94;shake=Math.max(shake,4);
        sfx(110,.1,'square',.07);}
      else{const dd=Math.max(d,.1),m=c.r+z.r;
        z.gx=c.gx+(z.gx-c.gx)/dd*m;z.gy=c.gy+(z.gy-c.gy)/dd*m;}
    }
  }
  player.gx=c.gx;player.gy=c.gy;
  if(sp>.3)player.dir=Math.atan2(c.vy,c.vx);
  player.sta=clamp(player.sta+9*dt,0,100);
}
/* ================= v4: BARRICADAS Y TALA ================= */
const bKey=(i,j)=>i+','+j;
const barrHP=()=>Math.round(130*(1+sk('carp')*.22));   // 🔨 muros +resistentes
function nearBarrSpot(){
  for(const b of buildings)for(const d of b.doors){
    if(hyp(d.i+.5-player.gx,d.j+.5-player.gy)<1.5)return{i:d.i,j:d.j,win:false};}
  for(const st of statics){
    if(st.kind==='wall'&&st.win&&hyp(st.gx+.5-player.gx,st.gy+.5-player.gy)<1.5)
      return{i:st.gx,j:st.gy,win:true};}
  return null;
}
function tryBuild(){
  if(inCar||player.sleeping||dead)return;
  const sp=nearBarrSpot();if(!sp)return;
  const k=bKey(sp.i,sp.j);
  if(barrs[k]){
    delete barrs[k];player.wood++;
    if(!sp.win)SOLID[idx(sp.i,sp.j)]=0;
    msg('Quitaste la barricada (+1 🪵)');sfx(180,.12,'square',.04);return;}
  if(player.wood<2){msg('Necesitas 2 tablones 🪵 (tala árboles con el hacha)',true);return;}
  player.wood-=2;gainXP('carp',10);
  const bh=barrHP();barrs[k]={gx:sp.i,gy:sp.j,hp:bh,mhp:bh,win:sp.win};
  if(!sp.win)SOLID[idx(sp.i,sp.j)]=5;
  msg(sp.win?'🔨 Ventana tapiada':'🔨 Puerta tapiada');
  sfx(220,.07,'square',.05);sfx(260,.07,'square',.05);
}
function barricadeAhead(z){
  const ti=Math.floor(z.gx+Math.cos(z.dir)*.75),
        tj=Math.floor(z.gy+Math.sin(z.dir)*.75);
  if(ti<0||tj<0||ti>=MW||tj>=MH)return null;
  const sc=SOLID[idx(ti,tj)];
  if(sc===5)return barrs[bKey(ti,tj)]||null;
  if(sc===2&&barrs[bKey(ti,tj)])return barrs[bKey(ti,tj)];
  return null;
}
function hitBarr(b,z){
  b.hp-=rand(7,13);
  sfx(95,.08,'square',.05);
  if(hyp(player.gx-b.gx,player.gy-b.gy)<9)shake=Math.max(shake,1.5);
  if(b.hp<=0){
    delete barrs[bKey(b.gx,b.gy)];
    if(!b.win)SOLID[idx(b.gx,b.gy)]=0;
    msg('💥 ¡Rompieron una barricada!',true);
    sfx(60,.3,'sawtooth',.09,35);
  }
}
function chopTree(w){
  const ti=Math.floor(player.gx+Math.cos(player.dir)*1.05),
        tj=Math.floor(player.gy+Math.sin(player.dir)*1.05);
  if(ti<0||tj<0||ti>=MW||tj>=MH||SOLID[idx(ti,tj)]!==3)return false;
  const t=treesL.find(t=>t.gx===ti&&t.gy===tj&&!t.dead);
  if(!t)return false;
  t.hp-=w.dmg;shake=Math.max(shake,2);
  sfx(140,.09,'square',.06);
  if(t.hp<=0){t.dead=true;SOLID[idx(ti,tj)]=0;
    for(const st of statics)if(st.kind==='tree'&&st.gx===ti&&st.gy===tj)st.dead=true;
    const n=irand(2,4)+(sk('carp')>=2?1:0);player.wood+=n;   // 🔨 carpintería: +madera
    gainXP('carp',12);
    msg('🪵 Talaste el árbol (+'+n+' tablones)');
    sfx(90,.25,'sawtooth',.07,40);}
  return true;
}
// Desmantelar muebles con un arma/herramienta: cada tipo suelta materiales
// coherentes (metal→chatarra, madera→tablones, telas→tela).
const DISMANTLE={
  nevera:{hp:55,yield:{scrap:3}},
  estante:{hp:30,yield:{wood:2}},
  camilla:{hp:30,yield:{scrap:1,cloth:1}},
  botiquin:{hp:22,yield:{scrap:1}},
  casillero:{hp:55,yield:{scrap:3}},
  alacena:{hp:35,yield:{wood:2}},
  ropero:{hp:40,yield:{wood:2,cloth:1}},
  cama:{hp:35,yield:{wood:2,cloth:1}},
  mesa:{hp:28,yield:{wood:2}},
  bomba:{hp:70,yield:{scrap:2}}
};
function dismantleFurniture(w){
  const ti=Math.floor(player.gx+Math.cos(player.dir)*1.05),
        tj=Math.floor(player.gy+Math.sin(player.dir)*1.05);
  if(ti<0||tj<0||ti>=MW||tj>=MH||SOLID[idx(ti,tj)]!==4)return false;
  const f=furns.find(f=>f.gx===ti&&f.gy===tj&&!f.gone);
  if(!f)return false;
  const D=DISMANTLE[f.type];if(!D)return false;
  if(f.dhp===undefined)f.dhp=D.hp;
  f.dhp-=w.dmg;shake=Math.max(shake,2);
  sfx(150,.08,'square',.06);
  if(f.dhp<=0){
    f.gone=true;SOLID[idx(ti,tj)]=0;
    for(const st of statics)if(st.kind==='furn'&&st.o===f)st.dead=true;
    let txt='';gainXP('carp',15);
    for(const m in D.yield){player[m]+=D.yield[m];txt+=MATS[m].ic+'+'+D.yield[m]+' ';}
    msg('🔨 Desarmaste: '+FURN[f.type].label+' → '+txt);
    sfx(90,.25,'sawtooth',.07,40);
  }else dmgText(f.gx+.5,f.gy+.5,'🔨');
  return true;
}
/* ================= v4: SUEÑO Y VICTORIA ================= */
function nearBed(){
  for(const fo of furns)if((fo.type==='cama'||fo.type==='camilla')&&!fo.gone&&
    hyp(fo.gx+.5-player.gx,fo.gy+.5-player.gy)<1.6)return fo;
  return null;
}
function trySleep(){
  if(inCar||player.sleeping||dead)return;
  if(!nearBed()){msg('Necesitas una cama para dormir');return;}
  if(player.slp>=85){msg('No tienes sueño todavía');return;}
  for(const z of zombies)if(hyp(z.gx-player.gx,z.gy-player.gy)<6){
    msg('Demasiado peligro para dormir…',true);return;}
  player.sleeping=true;msg('😴 Durmiendo…');
  saveGame();                                      // punto de control al dormir
}
function sleepTick(dt){
  const gdt=dt*CFG.sleepTimeScale;
  gameTime+=gdt;
  player.slp=Math.min(100,player.slp+CFG.sleepRecover*dt);
  player.food=Math.max(0,player.food-.16*gdt);
  player.water=Math.max(0,player.water-.2*gdt);
  if(player.food>15&&player.water>15)player.hp=clamp(player.hp+CFG.sleepHeal*dt,0,100);
  const night=isNight();
  if(night&&!prevNight&&dayNum()>=2){prevNight=night;player.sleeping=false;
    horde();msg('¡Gruñidos afuera te despertaron!',true);return;}
  prevNight=night;
  for(const z of zombies)if(hyp(z.gx-player.gx,z.gy-player.gy)<4){
    player.sleeping=false;msg('¡Un ruido cercano te despertó!',true);return;}
  if(player.slp>=99){player.sleeping=false;msg('Despertaste descansado ☀️');}
  else if(player.food<=0||player.water<=0){player.sleeping=false;
    msg('El hambre te despertó…',true);}
}
function win(){
  clearSave();                                     // la partida terminó
  won=true;dead=true;
  const mins=Math.floor(gameTime/60);
  const r=updateRecords(true);
  const oh=document.querySelector('#over h1');
  oh.textContent='🚁 TE EXTRAJERON — SOBREVIVISTE';
  oh.style.color='#7dd97d';
  document.getElementById('stats').innerHTML=
    'Aguantaste <b>'+dayNum()+'</b> días ('+mins+' min)<br>'+
    'Zombis eliminados: <b>'+kills+'</b><br>Lo lograste. Pocos pueden decirlo.<br>'+recLine(r);
  document.getElementById('over').style.display='flex';
  sfx(523,.2,'sine',.07);sfx(659,.2,'sine',.07);sfx(784,.45,'sine',.08);
}
function drawFire(f,sx,sy){
  if(f.gen){                                     // generador eléctrico
    cube(f.gx-.5,f.gy-.5,14,['#5a5f55','#454a42','#6d7267'],.6);
    const bl=Math.sin(gameTime*3)*.5+.5;
    ctx.fillStyle='rgba(255,236,150,'+(.5+bl*.5)+')';
    ctx.beginPath();ctx.arc(sx,sy-18,3.2,0,7);ctx.fill();
    ctx.fillStyle='#7dd97d';ctx.fillRect(sx-4,sy-9,8,2);
    return;
  }
  ctx.fillStyle='#3a3a36';                       // círculo de piedras
  ctx.beginPath();ctx.ellipse(sx,sy,13,7,0,0,7);ctx.fill();
  ctx.fillStyle='#22221c';
  ctx.beginPath();ctx.ellipse(sx,sy,8,4.2,0,0,7);ctx.fill();
  ctx.strokeStyle='#4a3620';ctx.lineWidth=3;      // leña cruzada
  ctx.beginPath();ctx.moveTo(sx-6,sy+2);ctx.lineTo(sx+6,sy-2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(sx-6,sy-2);ctx.lineTo(sx+6,sy+2);ctx.stroke();
  const fl=Math.sin(gameTime*11+f.gx*3)*.5+.5;    // llamas con parpadeo
  const cols=['#e0531f','#f0902a','#ffd257'];
  for(let i=0;i<3;i++){
    const h=15+fl*7-i*3.5,w=7-i*2;
    ctx.fillStyle=cols[i];
    ctx.beginPath();ctx.moveTo(sx,sy-h);
    ctx.quadraticCurveTo(sx+w,sy-h*.4,sx,sy+1);
    ctx.quadraticCurveTo(sx-w,sy-h*.4,sx,sy-h);ctx.fill();
  }
}
function drawBarr(b){
  const mh=b.mhp||130;
  const cols=b.hp>mh*.46?['#6b4f2a','#57401f','#7d5f38']:['#4c3820','#3a2a16','#5a4426'];
  cube(b.gx,b.gy,26,cols,.92);
  const sx=g2sx(b.gx+.5,b.gy+.5),sy=g2sy(b.gx+.5,b.gy+.5);
  ctx.strokeStyle='rgba(0,0,0,.4)';ctx.lineWidth=1.5;
  for(let k=0;k<3;k++){ctx.beginPath();
    ctx.moveTo(sx-13,sy-7-k*8);ctx.lineTo(sx+13,sy-9-k*8);ctx.stroke();}
  if(b.hp<mh){ctx.fillStyle='#151a10';ctx.fillRect(sx-12,sy-38,24,3);
    ctx.fillStyle='#d9c26a';ctx.fillRect(sx-12,sy-38,24*(b.hp/mh),3);}
}

/* ================= ATMÓSFERA (clima · ambiente · movilidad) ================= */
// El clima empeora conforme avanzan los días (el mundo se degrada).
function rollWeather(){
  const day=dayNum(),r=Math.random();
  const bad=Math.min(.6,.22+day*.05);            // más lluvia/niebla con el tiempo
  if(r<1-bad){weather.type='clear';weather.target=0;}
  else if(r<1-bad*.38){weather.type='rain';weather.target=rand(.55,1);}
  else{weather.type='fog';weather.target=rand(.4,.85);}
  weather.t=rand(35,80);
  const nm={clear:'☀️ El cielo se despeja',rain:'🌧️ Empieza a llover…',fog:'🌫️ Baja la niebla'};
  if(started)msg(nm[weather.type]);
}
function updateWeather(dt){
  weather.t-=dt;
  if(weather.t<=0)rollWeather();
  weather.inten=lerp(weather.inten,weather.target,1-Math.pow(.25,dt));
}
const raining=()=>weather&&weather.type==='rain'&&weather.inten>.3;
const foggy=()=>weather&&weather.type==='fog'?weather.inten:0;
function updateAmbient(dt){
  const night=isNight(),want=night?12:16;
  for(let g=0;g<2&&amb.length<want;g++)
    amb.push({gx:player.gx+rand(-15,15),gy:player.gy+rand(-10,10),
      vx:rand(-.35,.35),vy:rand(-.25,.25),ph:rand(0,7),life:rand(4,9),night});
  for(const p of amb){p.gx+=p.vx*dt;p.gy+=p.vy*dt;p.ph+=dt*2.2;p.life-=dt;
    if(hyp(p.gx-player.gx,p.gy-player.gy)>19)p.life=0;}
  amb=amb.filter(p=>p.life>0);
  for(const p of puffs){p.gx+=p.vx*dt;p.gy+=p.vy*dt;p.r+=dt*1.6;p.life-=dt;}
  puffs=puffs.filter(p=>p.life>0);
}
function footPuff(){                              // polvo al correr/frenar en tierra
  if(puffs.length>40)return;
  const fl=FLOOR[idx(clamp(Math.floor(player.gx),0,MW-1),clamp(Math.floor(player.gy),0,MH-1))];
  if(fl===6)return;                              // no en madera de interiores
  puffs.push({gx:player.gx+rand(-.1,.1),gy:player.gy+rand(-.1,.1),
    vx:rand(-.3,.3),vy:rand(-.3,.3),r:rand(.1,.2),life:rand(.4,.7),wet:raining()});
}

/* ================= HABILIDADES Y LIBROS ================= */
// Se aprenden practicando (por hacer) y leyendo libros. Cada nivel mejora
// algo tangible: daño, curación, resistencia de construcciones, autos…
const SKILL_NAMES={carp:'🔨 Carpintería',mech:'🔧 Mecánica',elec:'⚡ Electricidad',
  med:'💊 Medicina',str:'💪 Fuerza'};
const SKILL_PERK={
  carp:'Construcciones +resistentes · desbloquea muebles y muros',
  mech:'Menos gasto de gasolina · arrancar autos averiados · reparar autos',
  elec:'Desbloquea el generador (luz sin fuego)',
  med:'Tus curaciones sanan más',
  str:'Más daño cuerpo a cuerpo'};
const BOOKS={carp:'Manual de Carpintería',mech:'Guía del Mecánico',
  elec:'Electricidad para Todos',med:'Primeros Auxilios',str:'Rutina de Entrenamiento'};
function xpNeed(lvl){return 100+lvl*90;}
function gainXP(s,amt){
  if(!player.skills)return;
  player.xp[s]+=amt;
  while(player.xp[s]>=xpNeed(player.skills[s])){
    player.xp[s]-=xpNeed(player.skills[s]);player.skills[s]++;
    msg('⭐ '+SKILL_NAMES[s]+' subió a nivel '+player.skills[s]);
    sfx(520,.14,'triangle',.06);sfx(720,.2,'triangle',.05);vib(30);
  }
}
const sk=n=>player.skills?player.skills[n]:0;      // atajo de lectura
function giveBook(s){player.books.push({skill:s,name:BOOKS[s],cap:3});
  msg('📖 Encontraste: '+BOOKS[s]);sfx(300,.12,'sine',.05);}
function readBook(i){
  const bk=player.books[i];if(!bk)return;
  for(const z of zombies)if(hyp(z.gx-player.gx,z.gy-player.gy)<6){
    msg('Demasiado peligro para concentrarte…',true);return;}
  const lvl=player.skills[bk.skill];
  if(lvl>=bk.cap)msg('Ya sabes más que este libro ('+SKILL_NAMES[bk.skill]+' '+lvl+')');
  else{gainXP(bk.skill,xpNeed(lvl)-player.xp[bk.skill]+5);gameTime+=45;}
  player.books.splice(i,1);renderSkills();
}
function toggleSkills(){
  if(!started||dead||player.sleeping)return;
  if(crafting)toggleCraft();
  skillsOpen=!skillsOpen;
  DOM.skills.style.display=skillsOpen?'flex':'none';
  if(skillsOpen){atkHold=false;renderSkills();sfx(340,.06,'triangle',.04);}
}
function renderSkills(){
  let h='';
  for(const s in SKILL_NAMES){
    const lv=player.skills[s],need=xpNeed(lv),cur=player.xp[s];
    h+='<div class="srow"><div class="sh"><span>'+SKILL_NAMES[s]+
      '</span><b>Nivel '+lv+'</b></div>'+
      '<div class="sbar"><i style="width:'+Math.min(100,cur/need*100)+'%"></i></div>'+
      '<div class="sp">'+SKILL_PERK[s]+'</div></div>';
  }
  h+='<div class="bhead">📚 Libros por leer</div>';
  if(!player.books.length)h+='<div class="bnone">No tienes libros. Búscalos saqueando.</div>';
  else player.books.forEach((bk,i)=>{
    h+='<div class="brow"><span>📖 '+bk.name+'</span>'+
      '<button class="rbtn" data-i="'+i+'">LEER</button></div>';
  });
  DOM.skillList.innerHTML=h;
}

/* ================= FABRICACIÓN ================= */
// Materiales: se saquean de muebles temáticos (roperos→tela, casilleros→
// chatarra, botiquines→alcohol) o talando árboles (madera).
const MATS={
  wood:{ic:'🪵',n:'madera'},scrap:{ic:'🔩',n:'chatarra'},
  cloth:{ic:'🧵',n:'tela'},alcohol:{ic:'🧪',n:'alcohol'}
};
const RECIPES=[
  {id:'tabla',ic:'🔪',n:'Tabla con clavos',d:'Arma nivel 1',cost:{wood:2,scrap:1},
    can:()=>player.wTier<1,why:'Ya tienes un arma igual o mejor',
    make(){equipWeapon(1);msg('🔪 Fabricaste: Tabla con clavos');}},
  {id:'hacha',ic:'🪓',n:'Hacha artesanal',d:'Arma nivel 3 · tala árboles',cost:{wood:3,scrap:4},
    req:{carp:2},can:()=>player.wTier<3,why:'Ya tienes un arma igual o mejor',
    make(){equipWeapon(3);msg('🪓 Fabricaste: Hacha artesanal');}},
  {id:'vendas',ic:'🩹',n:'Vendas',d:'+1 curación (ranura 3)',cost:{cloth:2},
    make(){addInv('med','🩹 Vendas caseras');}},
  {id:'medicina',ic:'💊',n:'Medicina casera',d:'+1 antibiótico (ranura 4)',cost:{alcohol:2,cloth:1},
    make(){addInv('anti','💊 Medicina casera');}},
  {id:'balas',ic:'🔸',n:'Balas 9mm ×4',d:'Recargas artesanales',cost:{scrap:3},
    can:()=>player.hasGun,why:'Aún no tienes pistola',
    make(){player.ammo+=4;msg('🔸 Fabricaste 4 balas');}},
  {id:'chaleco',ic:'🦺',n:'Chaleco acolchado',d:'Reduce el daño a la mitad mientras aguanta',
    cost:{cloth:3,scrap:2},
    can:()=>player.armor<50,why:'Tu chaleco aún está en buen estado',
    make(){player.armor=100;msg('🦺 Chaleco puesto (100)');}},
  {id:'muro',ic:'🧱',n:'Muro de madera',d:'Se levanta frente a ti · los zombis lo golpean',
    cost:{wood:3},req:{carp:1},make:()=>placeWall()},
  {id:'cama',ic:'🛏️',n:'Cama improvisada',d:'Se coloca frente a ti · sirve para dormir',
    cost:{wood:4,cloth:2},req:{carp:1},make:()=>placeBed()},
  {id:'fogata',ic:'🔥',n:'Fogata',d:'Cocina carne cruda y da luz de noche',
    cost:{wood:2,scrap:1},make:()=>placeFire()},
  {id:'generador',ic:'💡',n:'Generador',d:'Da luz de noche sin fuego, en un área amplia',
    cost:{scrap:4,wood:2},req:{elec:2},make:()=>placeGen()},
  {id:'reparauto',ic:'🚗',n:'Reparar auto',d:'Repara el auto que tengas al lado',
    cost:{scrap:3},req:{mech:1},
    can:()=>!!nearCar()||!!inCar,why:'Acércate a un auto',
    make:()=>repairCar()},
  {id:'reparar',ic:'🔧',n:'Reparar arma',d:'Restaura la condición del arma equipada',
    cost:{scrap:2},
    can:()=>player.wTier>0&&player.wDur<player.wDurMax,
    why:'Sin arma que reparar o ya está impecable',
    make(){player.wDur=player.wDurMax;msg('🔧 Arma reparada al 100%');}}
];
function freeTileAhead(){
  const ti=Math.floor(player.gx+Math.cos(player.dir)*1.3),
        tj=Math.floor(player.gy+Math.sin(player.dir)*1.3);
  if(ti<1||tj<1||ti>=MW-1||tj>=MH-1||SOLID[idx(ti,tj)]!==0)return null;
  if(Math.floor(player.gx)===ti&&Math.floor(player.gy)===tj)return null;
  for(const c of cars)if(hyp(c.gx-(ti+.5),c.gy-(tj+.5))<c.r+.8)return null;
  return{ti,tj};
}
function placeWall(){
  const t=freeTileAhead();
  if(!t){msg('No hay espacio libre enfrente',true);return false;}
  const bh=barrHP();barrs[bKey(t.ti,t.tj)]={gx:t.ti,gy:t.tj,hp:bh,mhp:bh,win:false};
  SOLID[idx(t.ti,t.tj)]=5;gainXP('carp',8);
  msg('🧱 Muro levantado');sfx(220,.07,'square',.05);sfx(260,.07,'square',.05);
  return true;
}
function placeBed(){
  const t=freeTileAhead();
  if(!t){msg('No hay espacio libre enfrente',true);return false;}
  const f={gx:t.ti,gy:t.tj,type:'cama',looted:true,rt:Infinity};
  furns.push(f);SOLID[idx(t.ti,t.tj)]=4;
  statics.push({kind:'furn',o:f,gx:t.ti,gy:t.tj,d:t.ti+t.tj});
  msg('🛏️ Cama lista — duerme con Z');sfx(240,.1,'triangle',.05);
  return true;
}
function placeFire(){
  const t=freeTileAhead();
  if(!t){msg('No hay espacio libre enfrente',true);return false;}
  fires.push({gx:t.ti+.5,gy:t.tj+.5});
  msg('🔥 Fogata encendida — cocina con X (o el botón 🔥)');
  sfx(120,.35,'sawtooth',.05,55);
  return true;
}
function placeGen(){
  const t=freeTileAhead();
  if(!t){msg('No hay espacio libre enfrente',true);return false;}
  fires.push({gx:t.ti+.5,gy:t.tj+.5,gen:true});   // luz eléctrica: no cocina
  msg('💡 Generador encendido');sfx(90,.3,'square',.04);
  return true;
}
function repairCar(){
  const c=inCar||nearCar();if(!c){msg('Acércate a un auto',true);return false;}
  if(c.hp>=100){msg('Ese auto ya está en buen estado');return false;}
  c.hp=Math.min(100,c.hp+50);gainXP('mech',35);
  msg('🚗 Reparaste el auto ('+Math.round(c.hp)+'/100)');sfx(200,.15,'square',.05);
  return true;
}
function nearFire(){
  for(const f of fires)if(!f.gen&&hyp(f.gx-player.gx,f.gy-player.gy)<1.7)return f;
  return null;
}
function tryCook(){
  if(inCar||player.sleeping||dead||crafting)return;
  if(!nearFire()){msg('Necesitas estar junto a una fogata 🔥');return;}
  if(player.rawFood<=0){msg('No tienes carne cruda 🥩');return;}
  let cooked=0;
  while(player.rawFood>0&&player.inv.food<6){player.rawFood--;player.inv.food++;cooked++;}
  if(cooked>0){msg('🍳 Cocinaste '+cooked+' → 🍖 (ranura 1)');gainXP('med',8);
    sfx(300,.14,'triangle',.05);sfx(380,.1,'triangle',.04);vib(15);}
  else msg('Tu inventario de comida está lleno');
}
function canAfford(rec){
  for(const m in rec.cost)if((player[m]||0)<rec.cost[m])return false;
  return true;
}
function meetsReq(rec){
  if(!rec.req)return true;
  for(const s in rec.req)if(sk(s)<rec.req[s])return false;
  return true;
}
function reqText(rec){
  if(!rec.req)return'';
  return Object.keys(rec.req).map(s=>SKILL_NAMES[s]+' '+rec.req[s]).join(' · ');
}
function craftItem(id){
  const rec=RECIPES.find(r=>r.id===id);if(!rec)return;
  if(!meetsReq(rec)){msg('Necesitas '+reqText(rec),true);return;}
  if(rec.can&&!rec.can()){msg(rec.why,true);return;}
  if(!canAfford(rec)){msg('Te faltan materiales',true);return;}
  if(rec.make()===false){renderCraft();return;}  // no se pudo colocar: no gasta
  for(const m in rec.cost)player[m]-=rec.cost[m];
  sfx(300,.12,'triangle',.05);vib(15);
  renderCraft();
}
function toggleCraft(){
  if(!started||dead||player.sleeping)return;
  crafting=!crafting;
  DOM.craft.style.display=crafting?'flex':'none';
  if(crafting){atkHold=false;renderCraft();sfx(340,.06,'triangle',.04);}
}
function renderCraft(){
  let mh='Tienes: ';
  for(const m in MATS)mh+=MATS[m].ic+' <b>'+(player[m]||0)+'</b> '+MATS[m].n+' · ';
  DOM.craftMats.innerHTML=mh.slice(0,-3);
  let h='';
  for(const rec of RECIPES){
    const noReq=!meetsReq(rec),blocked=rec.can&&!rec.can(),afford=canAfford(rec);
    const off=noReq||blocked||!afford;
    let ch='';
    for(const m in rec.cost){
      const lack=(player[m]||0)<rec.cost[m];
      ch+='<span'+(lack?' class="lack"':'')+'>'+MATS[m].ic+rec.cost[m]+'</span> ';
    }
    if(rec.req)ch+='<span'+(noReq?' class="lack"':'')+'>🎓'+reqText(rec)+'</span> ';
    h+='<div class="rrow'+(off?' off':'')+'">'+
      '<div class="ric">'+rec.ic+'</div>'+
      '<div class="rinfo"><div class="rn">'+rec.n+'</div>'+
      '<div class="rd">'+(noReq?'Requiere '+reqText(rec):blocked?rec.why:rec.d)+'</div>'+
      '<div class="rc">'+ch+'</div></div>'+
      '<button class="rbtn" data-id="'+rec.id+'"'+(off?' disabled':'')+'>CREAR</button>'+
      '</div>';
  }
  DOM.recList.innerHTML=h;
}
DOM.recList.addEventListener('click',e=>{
  const b=e.target.closest('.rbtn');
  if(b&&!b.disabled)craftItem(b.dataset.id);
});
$('btnCraftClose').addEventListener('click',()=>{if(crafting)toggleCraft();});
DOM.skillList.addEventListener('click',e=>{
  const b=e.target.closest('.rbtn');
  if(b&&b.dataset.i!==undefined)readBook(+b.dataset.i);
});
$('btnSkillsClose').addEventListener('click',()=>{if(skillsOpen)toggleSkills();});

/* ================= EL CATADOR ================= */
// El infiltrado del sistema. Como el catador que probaba cada plato del rey
// antes de que él lo comiera, este vigilante "prueba" el estado del juego en
// cada frame: si detecta veneno (NaN, valores corruptos, errores de JS,
// entidades desbocadas, FPS en caída) lo traga él —lo registra y lo
// neutraliza— antes de que llegue al jugador y rompa la partida.
// F9 abre su informe en vivo.
const CAT={panel:false,log:[],errs:0,fixes:0,fps:60,acc:0,frames:0,uiT:0};
const catEl=$('catador');
const finite=v=>typeof v==='number'&&isFinite(v);
function catLog(sev,txt){
  CAT.log.push({sev,txt,t:started?(gameTime||0).toFixed(0)+'s':'—'});
  if(CAT.log.length>8)CAT.log.shift();
  if(sev==='err')CAT.errs++;
  console[sev==='err'?'error':'warn']('[CATADOR] '+txt);
}
addEventListener('error',e=>catLog('err','JS: '+(e.message||'desconocido')));
addEventListener('unhandledrejection',e=>catLog('err','Promesa: '+((e.reason&&e.reason.message)||e.reason||'?')));
function toggleCatador(){
  CAT.panel=!CAT.panel;
  catEl.style.display=CAT.panel?'block':'none';
  if(CAT.panel)CAT.uiT=0;
}
function catadorTaste(dt){
  // ritmo de frames
  CAT.acc+=dt;CAT.frames++;
  if(CAT.acc>=1){CAT.fps=Math.round(CAT.frames/CAT.acc);CAT.frames=0;CAT.acc=0;
    if(CAT.fps<30&&!paused)catLog('warn','FPS bajo: '+CAT.fps);}
  if(!player)return;
  // el plato principal: el jugador
  if(!finite(player.gx)||!finite(player.gy)||!finite(player.vx)||!finite(player.vy)){
    catLog('err','Posición del jugador corrupta → restaurada');
    player.gx=MW/2;player.gy=MH/2;player.vx=player.vy=0;CAT.fixes++;}
  for(const k of['hp','food','water','sta','slp']){
    if(!finite(player[k])){catLog('err','Stat "'+k+'" corrupta → 50');player[k]=50;CAT.fixes++;}
    else if(player[k]>100){player[k]=100;CAT.fixes++;}}
  for(const k of['ammo','wood','scrap','cloth','alcohol','gas','armor','rawFood','wDur']){
    if(player[k]<0||!finite(player[k])){
      catLog('warn','Recurso "'+k+'" inválido → 0');player[k]=0;CAT.fixes++;}}
  if(fires&&fires.length>40){catLog('warn','Fogatas desbocadas → poda');fires.length=40;CAT.fixes++;}
  if(amb&&amb.length>60){amb.length=30;CAT.fixes++;}
  if(puffs&&puffs.length>80){puffs.length=40;CAT.fixes++;}
  // los acompañantes: zombis y autos
  let bad=0;
  for(let i=zombies.length-1;i>=0;i--){const z=zombies[i];
    if(!finite(z.gx)||!finite(z.gy)||!finite(z.hp)){zombies.splice(i,1);bad++;}}
  if(bad){catLog('err',bad+' zombi(s) corrupto(s) purgado(s)');CAT.fixes+=bad;}
  for(const c of cars)if(!finite(c.gx)||!finite(c.gy)||!finite(c.vx)||!finite(c.vy)){
    catLog('err','Auto corrupto → detenido y recolocado');
    c.gx=MW/2;c.gy=Math.floor(MH/2)+.5;c.vx=c.vy=0;CAT.fixes++;}
  // desbordes de entidades (fugas de memoria en potencia)
  if(zombies.length>CFG.spawnCap+20){
    catLog('warn','Zombis desbocados ('+zombies.length+') → poda');
    zombies.length=CFG.spawnCap;CAT.fixes++;}
  if(parts.length>600){catLog('warn','Partículas desbocadas → poda');parts.length=300;CAT.fixes++;}
  if(dmgs.length>200){catLog('warn','Textos de daño desbocados → poda');dmgs.length=100;CAT.fixes++;}
  // el reloj del reino
  if(started&&(!finite(gameTime)||gameTime<0)){
    catLog('err','Reloj de juego corrupto → reiniciado a 0');gameTime=0;CAT.fixes++;}
}
// Informe en vivo del catador (se dibuja aunque la partida no haya empezado)
function catadorPanel(dt){
  if(!CAT.panel)return;
  CAT.uiT-=dt;if(CAT.uiT>0)return;CAT.uiT=.25;
  let h='<b>🍷 EL CATADOR</b> — '+(CAT.errs?'<span class="bad">'+CAT.errs+' veneno(s) detectado(s)</span>'
    :'<span class="ok">sin veneno</span>')+
    '<br>FPS '+CAT.fps+' · zombis '+(zombies?zombies.length:0)+
    ' · partículas '+(parts?parts.length:0)+' · curas '+CAT.fixes;
  for(const l of CAT.log)h+='<br><span class="'+(l.sev==='err'?'bad':'wrn')+'">['+l.t+'] '+l.txt+'</span>';
  if(!CAT.log.length)h+='<br><span class="ok">Todos los platos probados. El rey puede comer.</span>';
  catEl.innerHTML=h;
}

/* ================= PAUSA ================= */
function drawPause(){
  ctx.fillStyle='rgba(4,6,10,.55)';ctx.fillRect(0,0,VW,VH);
  ctx.fillStyle='#c8d3b0';ctx.font='26px Courier New';ctx.textAlign='center';
  ctx.fillText('‖ PAUSA',VW/2,VH/2-6);
  ctx.font='13px Courier New';ctx.fillStyle='#7d8a68';
  ctx.fillText('P/ESC seguir · G guardar · M sonido '+(muted?'OFF':'ON')+' · F9 catador',VW/2,VH/2+18);
  ctx.textAlign='left';
}

/* ================= ARRANQUE ================= */
buildTiles();
(function showStartRecords(){
  const r=loadRec();if(!r.runs)return;
  const el=$('recLine');el.style.display='block';
  el.innerHTML=recLine(r)+' · '+r.runs+' intento(s)';
})();
(function showContinue(){
  if(!hasSave())return;
  const bc=$('btnContinue');bc.style.display='inline-block';
  bc.addEventListener('click',()=>{
    if(loadGame()){document.getElementById('start').style.display='none';
      sfx(300,.15,'triangle',.05);msg('▶ Partida cargada');}
    else msg('El guardado está dañado o es de otra versión',true);
  });
})();
document.getElementById('btnStart').addEventListener('click',()=>{
  init();started=true;
  document.getElementById('start').style.display='none';
  sfx(220,.15,'triangle');
});
document.getElementById('btnRetry').addEventListener('click',()=>{init();sfx(220,.15,'triangle');});

let last=0;
function loop(ts){
  const dt=Math.min(.05,(ts-last)/1000||0);last=ts;
  if(freeze>0)freeze-=dt;
  else if(started&&!dead&&!paused&&!crafting&&!skillsOpen)update(dt);
  catadorTaste(dt);catadorPanel(dt);
  if(started){draw();if(paused)drawPause();}
  else{ctx.fillStyle='#0d100a';ctx.fillRect(0,0,VW,VH);}
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
