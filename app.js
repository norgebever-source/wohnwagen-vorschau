(()=>{
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const body=document.body, G=window.GALERIEN, F=window.FENSTER;
const W=(u,w)=>u+'?w='+w;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let phase='aussen';
function setPhase(p){body.classList.remove('phase-'+phase);phase=p;body.classList.add('phase-'+p)}

/* ---------- Wischen: 1:1, rAF, Schwung; Tipp bleibt Tipp ---------- */
const TAP=24, NAV=120, NAV_V=.55, GAIN=2.2, FRICTION=.95, MIN_V=.08, MAX_V=3.5, REDUCE=matchMedia('(prefers-reduced-motion: reduce)').matches;
const pans=[];
let didDrag=false,navLock=0;
function attachPan(vp,opts){
  if(!vp)return{stop(){},goto(){},clamp(){}};
  let drag=false,moved=false,blockClick=false,pid=null,sx=0,sy=0,sp=0,lx=0,ly=0,lt=0,vx=0,samples=[],raf=0,inert=0,glide=0;
  const stopAnim=()=>{if(raf)cancelAnimationFrame(raf);if(inert)cancelAnimationFrame(inert);if(glide)cancelAnimationFrame(glide);raf=inert=glide=0;vx=0};
  const clamp=p=>{const b=opts.bounds();return Math.max(b.min,Math.min(b.max,p))};
  const apply=p=>opts.set(clamp(p));
  const onDown=e=>{if(!opts.active()||e.button)return;stopAnim();drag=true;moved=false;didDrag=false;blockClick=false;pid=e.pointerId;sx=lx=e.clientX;sy=ly=e.clientY;sp=opts.get();lt=performance.now();vx=0;samples=[{x:lx,t:lt}];if(!raf)raf=requestAnimationFrame(function tick(){if(!drag){raf=0;return}if(moved)apply(sp+(lx-sx));raf=requestAnimationFrame(tick)})};
  const onMove=e=>{if(!drag||e.pointerId!==pid)return;const now=performance.now(),x=e.clientX,y=e.clientY;if(Math.hypot(x-sx,y-sy)>TAP){moved=true;didDrag=true}samples.push({x,t:now});while(samples.length>24||(samples[0]&&now-samples[0].t>180))samples.shift();lx=x;ly=y;lt=now};
  const onEnd=e=>{if(!drag||(e.pointerId!=null&&e.pointerId!==pid))return;drag=false;pid=null;if(raf){cancelAnimationFrame(raf);raf=0}if(moved){apply(sp+(lx-sx));blockClick=true;setTimeout(()=>blockClick=false,350)}else{didDrag=false}if(!moved)return;const now=performance.now();if(now-lt>80)return;const last=samples[samples.length-1]||{x:lx,t:lt};let old=samples[0]||last;for(const s of samples){if(last.t-s.t<=100){old=s;break}}const dt=Math.max(16,last.t-old.t);let v=(last.x-old.x)/dt*GAIN;const dx=lx-sx,dy=ly-sy;if(opts.swipe){const b=opts.bounds(),canPan=b.max-b.min>4;const atEdge=canPan&&((dx>0&&opts.get()>=b.max-2)||(dx<0&&opts.get()<=b.min+2));const firm=Math.abs(dx)>=NAV&&Math.abs(dx)>Math.abs(dy)*1.15;if(dx&&Math.sign(v)===Math.sign(dx)&&((firm&&Math.abs(v)>=NAV_V)||(atEdge&&Math.abs(dx)>=70&&Math.abs(v)>=.4))){if(opts.swipe(dx>0?'left':'right'))return}}if(REDUCE)return;if(opts.aim){const aim=opts.aim(v,opts.get());if(aim!=null){const need=aim-opts.get(),coast=v*16/(1-FRICTION);if(need!==0&&Math.sign(need)===Math.sign(v)&&Math.abs(coast)<Math.abs(need))v=need*(1-FRICTION)/16}}if(Math.abs(v)<MIN_V)return;vx=Math.max(-MAX_V,Math.min(MAX_V,v));let prev=now;inert=requestAnimationFrame(function tick(ts){const d=Math.min(32,ts-prev);prev=ts;const b=opts.bounds(),n=opts.get()+vx*d;vx*=Math.pow(FRICTION,d/16);if(n<=b.min||n>=b.max){apply(n<=b.min?b.min:b.max);vx=0;inert=0;return}opts.set(n);if(Math.abs(vx)<.02){vx=0;inert=0;return}inert=requestAnimationFrame(tick)})};
  vp.addEventListener('pointerdown',onDown,{passive:true});
  addEventListener('pointermove',onMove,{passive:true});
  addEventListener('pointerup',onEnd,{passive:true});
  addEventListener('pointercancel',onEnd,{passive:true});
  vp.addEventListener('click',e=>{if(blockClick||moved){e.preventDefault();e.stopPropagation();blockClick=false}},true);
  const ctl={stop(){drag=false;pid=null;stopAnim()},clamp(){apply(opts.get())},goto(target,ms){stopAnim();const from=opts.get(),to=clamp(target),t0=performance.now();if(REDUCE||!ms){opts.set(to);return}glide=requestAnimationFrame(function tick(t){const k=Math.min(1,(t-t0)/ms),e=1-Math.pow(1-k,3);opts.set(from+(to-from)*e);if(k<1)glide=requestAnimationFrame(tick);else glide=0})}};
  pans.push(ctl);return ctl}
function stopPans(){pans.forEach(p=>p.stop())}
function bindTap(el,fn){if(!el)return;let handled=0;el.addEventListener('pointerup',e=>{if(e.button||didDrag||performance.now()<navLock)return;handled=performance.now();fn(e)},{passive:true});el.addEventListener('click',e=>{if(didDrag||performance.now()<navLock||performance.now()-handled<500){e.preventDefault();e.stopPropagation();return}fn(e)})}

/* ---------- Außen: Tür im Bild zentrieren ---------- */
let pan=0;
function aussenBounds(){const vw=innerWidth,vh=innerHeight,Wd=Math.max(vw,vh*16/9);
  const overflow=Math.max(0,(Wd-vw)/2);
  const shift=Math.min(0.182*Wd,overflow);
  if(Wd<=vw)return{min:0,max:0,shift:0};
  return{min:-overflow-shift,max:overflow-shift,shift}}
function fitAussen(){const b=aussenBounds();$('#stageA').style.setProperty('--shift',b.shift+'px');pan=Math.max(b.min,Math.min(b.max,pan));$('#stageA').style.setProperty('--pan',pan+'px')}
function aussenSignPan(){const vw=innerWidth,vh=innerHeight,Wd=Math.max(vw,vh*16/9);const shift=Math.min(0.182*Wd,Math.max(0,(Wd-vw)/2));return Math.max(aussenBounds().min,-0.13*Wd-shift)}
const panA=attachPan($('#vpA'),{bounds:aussenBounds,get:()=>pan,set:p=>{$('#stageA').style.setProperty('--pan',(pan=p)+'px')},active:()=>phase==='aussen'&&!busy,aim:(v,p)=>v<0?aussenSignPan():null,swipe:dir=>{if(busy||phase!=='aussen'||performance.now()<navLock)return false;goView(dir==='left'?'fjord':'berge');return phase==='fjord'||phase==='berge'}});

/* Fjord / Berge: vom Zentrum aus wischen */
let panF=0,panB=0;
function viewBounds(){const vw=innerWidth,vh=innerHeight,Wd=Math.max(vw,vh*16/9);if(Wd<=vw)return{min:0,max:0};const r=(Wd-vw)/2;return{min:-r,max:r}}
function fitViews(){const b=viewBounds();panF=Math.max(b.min,Math.min(b.max,panF));panB=Math.max(b.min,Math.min(b.max,panB));$('#stageF').style.setProperty('--pan',panF+'px');$('#stageB').style.setProperty('--pan',panB+'px')}
attachPan($('#vpF'),{bounds:viewBounds,get:()=>panF,set:p=>{$('#stageF').style.setProperty('--pan',(panF=p)+'px')},active:()=>phase==='fjord'&&!busy});
attachPan($('#vpB'),{bounds:viewBounds,get:()=>panB,set:p=>{$('#stageB').style.setProperty('--pan',(panB=p)+'px')},active:()=>phase==='berge'&&!busy});

/* Innen */
let panI=0;
function innenBounds(){const st=$('#stageI'),vp=$('#vpI');const W=st.offsetWidth,vw=vp.clientWidth;if(W<=vw)return{min:0,max:0};return{min:-(W-vw),max:0}}
function fitInnen(){const b=innenBounds();panI=Math.max(b.min,Math.min(b.max,panI));$('#stageI').style.setProperty('--pan',panI+'px')}
const panInnen=attachPan($('#vpI'),{bounds:innenBounds,get:()=>panI,set:p=>{$('#stageI').style.setProperty('--pan',(panI=p)+'px')},active:()=>phase==='innen'&&!busy&&!ovOpen});

addEventListener('resize',()=>{fitAussen();fitViews();fitInnen()});
fitAussen();fitViews();

/* ---------- Eintreten ---------- */
let busy=false;
function enter(){if(busy||phase!=='aussen')return;busy=true;stopPans();pan=0;fitAussen();setPhase('door');sfx('door');
  setTimeout(()=>$('#stageA').classList.add('dolly'),1250);
  setTimeout(()=>$('#flash').classList.add('on'),2350);
  setTimeout(()=>{setPhase('innen');$('#stageA').classList.remove('dolly');centerRoom();body.classList.add('labels-on');setTimeout(()=>body.classList.remove('labels-on'),5000);
     setTimeout(()=>$('#flash').classList.remove('on'),80);busy=false},3250)}
$('#enter').onclick=enter;bindTap($('#doorBtn'),enter);
$('#out').onclick=()=>{closeOv(true);stopPans();pan=0;fitAussen();setPhase('aussen')};
function goAussen(){if(busy||performance.now()<navLock)return;navLock=performance.now()+500;stopPans();setPhase('aussen');fitAussen();body.classList.add('labels-on');setTimeout(()=>body.classList.remove('labels-on'),4000)}
function goView(id){if(busy||phase!=='aussen'||performance.now()<navLock)return;navLock=performance.now()+500;stopPans();if(id==='fjord'){panF=0;$('#stageF').style.setProperty('--pan','0px')}else{panB=0;$('#stageB').style.setProperty('--pan','0px')}setPhase(id);body.classList.add('labels-on');setTimeout(()=>body.classList.remove('labels-on'),4000)}
bindTap($('#toFjord'),()=>goView('fjord'));
bindTap($('#toBerge'),()=>goView('berge'));
bindTap($('#fromFjord'),goAussen);
bindTap($('#fromBerge'),goAussen);
function centerRoom(){const b=innenBounds();panI=(b.min+b.max)/2;$('#stageI').style.setProperty('--pan',panI+'px')}

/* ---------- Kamera auf Station ---------- */
const stage=$('#stageI');
function openStation(id,el){if(busy)return;const hs=(el&&el.classList.contains('hs')&&stage.contains(el))?el:$(`.hs[data-st="${id}"]`,stage);if(!hs)return;busy=true;
  const r=hs.getBoundingClientRect();
  if(r.left<0||r.right>innerWidth){panInnen.goto(panI-(r.left+r.width/2-innerWidth/2),420)}
  setTimeout(()=>{const cx=(hs.offsetLeft+hs.offsetWidth/2)/stage.offsetWidth*100,cy=(hs.offsetTop+hs.offsetHeight/2)/stage.offsetHeight*100;
    stage.style.transformOrigin=cx+'% '+cy+'%';stage.classList.add('zoom');stage.style.transform='scale(2.3)';sfx('whoosh');
    setTimeout(()=>{showOv(id);busy=false;if(hs===el&&hs.dataset.photo!=null&&STATIONS[id].photos)openLb(STATIONS[id].photos,+hs.dataset.photo)},780)},r.left<0||r.right>innerWidth?420:0)}
$$('[data-st]').forEach(b=>b.addEventListener('click',()=>openStation(b.dataset.st,b)));

/* ---------- Overlay ---------- */
const ov=$('#ov'),ovT=$('#ovTitle'),ovB=$('#ovBody');let ovOpen=false;
function showOv(id){const s=STATIONS[id];ovT.textContent=s.title;ovB.innerHTML='';s.render(ovB);ov.hidden=false;
  requestAnimationFrame(()=>ov.classList.add('show'));ovOpen=true;history.pushState({ov:id},'');$('.panel',ov).scrollTop=0;$('#back').focus({preventScroll:true})}
function closeOv(fromNav){if(!ovOpen){resetCam();return}ovOpen=false;ov.classList.remove('show');stopWindow();
  const tvf=$('iframe',ovB);if(tvf)tvf.src='about:blank';
  setTimeout(()=>{ov.hidden=true;ovB.innerHTML=''},450);resetCam();if(!fromNav&&history.state&&history.state.ov)history.back()}
function resetCam(){stage.style.transform='scale(1)';setTimeout(()=>stage.classList.remove('zoom'),1000)}
$('#back').onclick=()=>closeOv(false);
ov.addEventListener('click',e=>{if(e.target===ov)closeOv(false)});
addEventListener('popstate',()=>{if(!$('#lb').hidden){closeLb();return}if(ovOpen)closeOv(true)});
addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#lb').hidden)closeLb();else if(ovOpen)closeOv(false)}
  if(!$('#lb').hidden){if(e.key==='ArrowRight')lbGo(1);if(e.key==='ArrowLeft')lbGo(-1)}});

/* ---------- Lightbox ---------- */
let lbList=[],lbI=0;const lb=$('#lb');
function openLb(list,i){lbList=list;lbI=i;lb.hidden=false;lbShow()}
function lbShow(){const it=lbList[lbI];$('img',lb).src=W(it.src,1600);$('figcaption',lb).textContent=(it.cap?it.cap+' · ':'')+(lbI+1)+' / '+lbList.length}
function lbGo(d){lbI=(lbI+d+lbList.length)%lbList.length;lbShow()}
function closeLb(){lb.hidden=true;$('img',lb).removeAttribute('src')}
$('.x',lb).onclick=closeLb;$('.prev',lb).onclick=()=>lbGo(-1);$('.next',lb).onclick=()=>lbGo(1);
let tx=null;lb.addEventListener('touchstart',e=>tx=e.touches[0].clientX,{passive:true});
lb.addEventListener('touchend',e=>{if(tx===null)return;const d=e.changedTouches[0].clientX-tx;if(Math.abs(d)>45)lbGo(d<0?1:-1);tx=null});
lb.addEventListener('click',e=>{if(e.target===lb)closeLb()});

/* ---------- Bausteine ---------- */
const h=(html)=>{const t=document.createElement('template');t.innerHTML=html.trim();return t.content};
function galleryView(el,g){el.innerHTML='';
  el.append(h(`<p class="sub">${esc(g.date||'')}${g.date?' · ':''}${g.photos.length} Fotos</p>
  <div class="btnrow"><button class="btn" data-a="frames">‹ Alle Galerien</button><a class="btn primary" href="${g.url}" target="_blank" rel="noopener">Galerie auf dem Blog öffnen ↗</a></div>
  <div class="photos">${g.photos.map((p,i)=>`<button data-i="${i}"><img loading="lazy" src="${W(p,520)}" alt="${esc(g.title)} Foto ${i+1}"></button>`).join('')}</div>`));
  ovT.textContent=g.title;
  $('[data-a=frames]',el).onclick=()=>{ovT.textContent=STATIONS.rahmen.title;STATIONS.rahmen.render(el)};
  const list=g.photos.map(p=>({src:p,cap:g.title}));
  $$('.photos button',el).forEach(b=>b.onclick=()=>openLb(list,+b.dataset.i));
  $('.panel',ov).scrollTop=0}

let winT=null;function stopWindow(){clearInterval(winT);winT=null}

const STATIONS={
fenster:{title:'Blick aus dem Fenster',render(el){
  el.append(h(`<p class="sub">Unsere Reisebilder – wie draußen vorbeiziehende Landschaften.</p>
  <figure class="window-show">${F.map((f,i)=>`<img src="${W(f.src,1400)}" alt="${esc(f.cap)}" ${i?'loading="lazy"':''}>`).join('')}<figcaption></figcaption></figure>
  <div class="thumbs">${F.map((f,i)=>`<button data-i="${i}"><img loading="lazy" src="${W(f.src,200)}" alt=""></button>`).join('')}</div>
  <div class="btnrow"><a class="btn" href="https://www.twitch.tv/maxbiber" target="_blank" rel="noopener">🎥 Live-Webcam jetzt auf Twitch ansehen ↗</a></div>`));
  const imgs=$$('.window-show img',el),th=$$('.thumbs button',el),cap=$('figcaption',el);let i=0;
  const go=n=>{i=(n+F.length)%F.length;imgs.forEach((im,k)=>im.classList.toggle('on',k===i));th.forEach((b,k)=>b.classList.toggle('on',k===i));cap.textContent=F[i].cap};
  go(0);stopWindow();winT=setInterval(()=>go(i+1),5200);
  th.forEach(b=>b.onclick=()=>{go(+b.dataset.i);stopWindow();winT=setInterval(()=>go(i+1),5200)});
  $('.window-show',el).onclick=()=>openLb(F,i)}},
tv:{title:'Fernseher',render(el){
  el.append(h(`<p class="sub"><b>Gastrolle als Angelguide</b> – Allein mit dem Camper nach Norwegen – ich wollte nicht zurück<br><small>von Andreas Hobby &amp; Freizeit · mit Max als Angler aus Bremen</small></p>
  <div class="tv"><div class="scr"><img src="https://i.ytimg.com/vi/rv2EALzhqY8/maxresdefault.jpg" alt="Videovorschau"><button aria-label="Video abspielen">▶</button></div><div class="stand"></div></div>
  <div class="btnrow"><a class="btn" href="https://www.youtube.com/watch?v=rv2EALzhqY8" target="_blank" rel="noopener">▶ Auf YouTube ansehen ↗</a></div>`));
  $('.scr button',el).onclick=e=>{const s=$('.scr',el);s.innerHTML='<iframe src="https://www.youtube-nocookie.com/embed/rv2EALzhqY8?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="YouTube-Video"></iframe>'}}},
rahmen:{title:'Unsere Galerien',render(el){el.innerHTML='';
  el.append(h(`<p class="sub">Jeder Bilderrahmen ist ein Stück unserer Reise – antippen zum Reinschauen.</p>
  <div class="grid">${G.map((g,i)=>`<${g.external?`a href="${g.url}" target="_blank" rel="noopener"`:`button data-g="${i}"`} class="frame"><img loading="lazy" src="${W(g.cover,600)}" alt=""><span class="t">${esc(g.title)}<small>${esc(g.date||'')}${g.external?' · Google Fotos ↗':g.photos.length?' · '+g.photos.length+' Fotos':''}</small></span></${g.external?'a':'button'}>`).join('')}</div>`));
  $$('[data-g]',el).forEach(b=>b.onclick=()=>galleryView(el,G[+b.dataset.g]))}},
platte:{title:'Plattenspieler',render(el){const a=$('#musik');
  el.append(h(`<div class="player"><div class="vinyl ${a.paused?'':'spin'}"></div><div><p class="sub">Leg eine Platte auf.</p>
  <button class="btn primary" id="pp">${a.paused?'▶ Abspielen':'❚❚ Pause'}</button>
  <p class="note">Platzhalter: instrumentale Musik aus unserem „Bever-Film“-Entwurf. Hier können später eure eigenen Lieblingslieder oder eine Playlist rein.</p></div></div>`));
  $('#pp',el).onclick=()=>{if(a.paused){a.volume=.7;a.play();}else a.pause();$('#pp',el).textContent=a.paused?'▶ Abspielen':'❚❚ Pause';$('.vinyl',el).classList.toggle('spin',!a.paused)}}},
radio:{title:'Radio',render(el){
  el.append(h(`<p class="sub">Dreh am Knopf: Fjordrauschen im Wohnwagen – oder schalte live zu uns.</p>
  <div class="btnrow"><button class="btn primary" id="amb">${amb.on?'🔊 Fjordrauschen aus':'📻 Fjordrauschen an'}</button>
  <a class="btn" href="https://www.twitch.tv/maxbiber" target="_blank" rel="noopener">🎥 Live-Webcam auf Twitch ↗</a></div>
  <p class="note">„Falls du mal live mit dabei sein willst …“</p>`));
  $('#amb',el).onclick=()=>{toggleAmb();$('#amb',el).textContent=amb.on?'🔊 Fjordrauschen aus':'📻 Fjordrauschen an'}}},
schublade:{title:'Schubladen',render(el){
  const prints=[];G.forEach((g,gi)=>g.photos.slice(0,2).forEach((p,pi)=>prints.push({gi,pi,src:p,t:g.title})));
  el.append(h(`<p class="sub">Zieh eine Schublade auf.</p><div class="drawers">
  <div class="drawer" data-k="touren"><button>Wanderrouten<small>2 Touren auf Komoot</small></button><div class="in"><div>
    ${[['16983481','Utsira-Hängebrücke – Fjordblick-Runde auf Skjernøya','leicht · 3,7 km · ca. 1 Std · 30 Hm'],['34218473','Ognasanden – Kriegsdenkmal-Wanderung in Hå Runde von Ogna','mäßig · 7,97 km · 2 Std 5 Min · 50 Hm']].map(([id,t,d])=>`<div class="tour"><h3>${t}</h3><p class="sub" style="margin:0">${d}</p><iframe data-src="https://www.komoot.com/smarttour/${id}/embed" title="${t}" loading="lazy"></iframe><div><a class="btn" href="https://www.komoot.de/smarttour/${id}" target="_blank" rel="noopener">Route auf Komoot öffnen ↗</a></div></div>`).join('')}
  </div></div></div>
  <div class="drawer" data-k="apps"><button>Apps nicht nur für Angler<small>Die besten Angel-Apps für Norwegen</small></button><div class="in"><div><ul class="links">
    <li><b>🐟 Fishbuddy</b> – <a href="https://fishbuddy.app/" target="_blank" rel="noopener">fishbuddy.app</a><br>📍 Zeigt Angel-Hotspots &amp; Fischarten in ganz Norwegen · ✅ Funktioniert auch offline – perfekt für Fjorde &amp; Küste</li>
    <li><b>🌍 Fishbrain</b> – <a href="https://www.fishbrain.com" target="_blank" rel="noopener">fishbrain.com</a><br>🎣 Fanglogbuch, Community-Tipps &amp; Angelwetter · ⚠️ Gute Gratis-Version, aber mit Premium noch besser</li>
    <li><b>🗺️ iFiske</b> – <a href="https://www.ifiske.se" target="_blank" rel="noopener">ifiske.se</a><br>🎟️ Digitale Angelkarten (v. a. für schwedische Grenzregionen) · 📱 Ideal für Forellengewässer und Seen im Südosten</li>
    <li><b>🌬️ Windy / Windfinder</b> – <a href="https://www.windy.com" target="_blank" rel="noopener">windy.com</a>, <a href="https://www.windfinder.com" target="_blank" rel="noopener">windfinder.com</a><br>🌊 Zeigen dir Wind, Gezeiten &amp; Wellen – perfekt für Bootsangler</li>
    <li><b>🅿️ Park4Night</b> – <a href="https://park4night.com/" target="_blank" rel="noopener">park4night.com</a><br>🚐 Stellplätze &amp; Campingplätze für Wohnmobil und Wohnwagen finden</li>
    <li><b>🧭 Norgeskart</b> – <a href="https://www.norgeskart.no/" target="_blank" rel="noopener">norgeskart.no</a><br>🗺️ Offizielle norwegische Karte von Kartverket – mit Topokarten &amp; Wanderwegen</li></ul></div></div></div>
  <div class="drawer open" data-k="fotos"><button>Fotokiste<small>${prints.length} Abzüge aus allen Galerien</small></button><div class="in"><div><div class="prints">
    ${prints.map((p,i)=>`<button data-i="${i}" style="transform:rotate(${((i*37)%11)-5}deg)"><img loading="lazy" src="${W(p.src,300)}" alt=""><span>${esc(p.t)}</span></button>`).join('')}
  </div></div></div></div></div>`));
  $$('.drawer>button',el).forEach(b=>b.onclick=()=>{const d=b.parentNode;d.classList.toggle('open');sfx('drawer');
    if(d.classList.contains('open'))$$('iframe[data-src]',d).forEach(f=>{f.src=f.dataset.src;f.removeAttribute('data-src')})});
  $$('.prints button',el).forEach(b=>b.onclick=()=>{const p=prints[+b.dataset.i],g=G[p.gi];openLb(g.photos.map(s=>({src:s,cap:g.title})),p.pi)})}},
ordner:{title:'Ordner: Norwegen-Infos auf einen Blick',render(el){
  const tmp=document.createElement('div');
  const L=(u,t)=>`<li><a href="${u}" target="_blank" rel="noopener">${t}</a></li>`;
  tmp.append(h(`<p class="sub">Hier findest du hilfreiche Ressourcen für deine Reise durch Norwegen – von Fähren über Wetterdienste bis zu aktuellen Reiseinfos.</p><div class="folders">
  <div class="folder" data-tab="Anreise"><h3>Anreise &amp; Fähren</h3><p><b>Ab Deutschland</b></p><ul class="links">${L('https://www.colorline.de/kiel-oslo','🛳️ Color Line Kiel–Oslo')}</ul>
   <p><b>Ab Dänemark</b></p><ul class="links">${L('https://www.colorline.de/hirtshals-kristiansand','🛳️ Color Line Hirtshals–Kristiansand')}${L('https://www.colorline.de/hirtshals-larvik','🛳️ Color Line Hirtshals–Larvik')}${L('https://fjordline.com/de/p/unsere-routen/hirtshals-kristiansand','⛴️ Fjord Line Hirtshals–Kristiansand')}${L('https://fjordline.com/de/p/unsere-routen/hirtshals-stavanger-bergen','🛳️ Fjord Line Hirtshals–Stavanger–Bergen')}${L('https://www.gonordiccruiseline.com/fahre-nach-norwegen/','🛳️ Go Nordic Cruiseline Kopenhagen–Oslo')}</ul>
   <p><b>Ab Schweden</b></p><ul class="links">${L('https://www.colorline.de/sandefjord-stroemstad','🛳️ Color Line Strömstad–Sandefjord')}${L('https://www.norled.no','⛴️ Norled – Fähren &amp; Expressboote')}${L('https://www.colorline.de/','🛳️ Color Line – Deutsche Seite')}</ul>
   <p><b>💡 Spartipp:</b> <a href="https://www.colorline.no/" target="_blank" rel="noopener">Color Line Norwegen</a> – <b>Meine Empfehlung!</b><br><small>Buchst du direkt auf der norwegischen Seite, kannst du richtig Geld sparen! Einfach Preise vergleichen – lohnt sich!</small></p>
   <p><small>Angekündigt: NedNorge IJmuiden–Kristiansand (geplant 2027) und Njordic Eemshaven–Arendal (geplant 2028), noch nicht buchbar. Hinweis für Gespanne: Gesamtlänge und -höhe angeben, Gas vor dem Auffahren schließen. Stand: November 2026.</small></p></div>
  <div class="folder" data-tab="Maut"><h3>Maut-Check Norwegen</h3><p>Welche Mautbox passt zu dir? Beantworte ein paar kurze Fragen zu Fahrzeug, Gewicht, Antrieb, Euro-Klasse und Reise, dann zeigen wir dir <b>das passende Mautsystem</b>.</p>
   <p><a class="btn primary" href="https://norgebever-source.github.io/maut-check/" target="_blank" rel="noopener">Maut-Check starten ›</a></p><p><small>Dauert etwa 1 Minute · Stand 17.11.2026, nur Richtwert · offizielle Tarife: <a href="https://www.autopass.no/no/kunde/takster-og-rabatter/" target="_blank" rel="noopener">autopass.no</a></small></p></div>
  <div class="folder" data-tab="Zoll"><h3>Zoll-App Norwegen</h3><p>Mit der offiziellen App <b>Kvoteappen</b></p><ul class="links">${L('https://play.google.com/store/apps/details?id=no.toll.fortolling.kvoteapp&hl=no&gl=US&pli=1','📱 Toll-App Norwegen (Deklaration &amp; Freigrenzen)')}${L('https://apps.apple.com/no/app/kvoteappen/id1077706940','🍏 Kvoteappen im App Store (iPhone)')}${L('https://www.toll.no/en/services/norwegian-customs-app','ℹ️ Infos von Tolletaten (Englisch)')}</ul>
   <p><small>Tipp: Du kannst bis zu 48 Stunden vor dem Grenzübertritt bezahlen, die Quittung gilt dann 2 Stunden ab der gewählten Zeit. Quelle: <a href="https://www.toll.no/no/verktoy/kvoteappen" target="_blank" rel="noopener">toll.no</a></small></p></div>
  <div class="folder" data-tab="Wetter"><h3>Wetter &amp; Straßen</h3><ul class="links">${L('https://www.vegvesen.no/trafikk/','🚗 Straßenzustand &amp; Verkehrsinfo (Statens Vegvesen)')}${L('https://www.yr.no','🌦️ YR.no – Norwegischer Wetterdienst')}</ul></div>
  <div class="folder" data-tab="Geld"><h3>Geld &amp; Wechselkurs</h3><p>Den tagesaktuellen Kurs Euro zu Kronen findest du hier:</p><p><a class="btn" style="color:#2d1f12" href="https://www.xe.com/currencyconverter/convert/?Amount=1&From=EUR&To=NOK" target="_blank" rel="noopener">🔁 Live-Wechselkurs EUR/NOK prüfen</a></p></div>
  <div class="folder" data-tab="Praktisch"><h3>Praktische Infos</h3><ul class="links" style="gap:8px"><li>🛂 <b>Einreise:</b> Für EU-Bürger visumsfrei bis 90 Tage</li><li>💱 <b>Währung:</b> Norwegische Krone (NOK)</li><li>🔌 <b>Strom:</b> 230 V, Stecker Typ C/F (wie in Deutschland)</li><li>🗺️ <b>Karten:</b> Google Maps funktioniert gut – für Offline-Karten: Maps.me oder Gaia GPS</li><li>🧭 <b>Beste Reisezeit:</b> Mai–September (Wanderung), Dezember–März (Nordlichter &amp; Winter)</li></ul></div>
  <div class="folder" data-tab="Links"><h3>Mehr Norwegen-Seiten</h3><ul class="links">${L('https://www.visitnorway.de','🇳🇴 Visit Norway – Offizielle Tourismusseite')}${L('https://www.suednorwegen.org','🌲 Südnorwegen.org – Tipps für den Süden Norwegens')}${L('https://www.nordlandblog.de/','🏔️ Nordlandblog – Reisen &amp; Abenteuer in Norwegen')}${L('https://www.ut.no','🥾 UT.no – Wanderkarten &amp; Routen')}</ul></div>
  </div>`));
  buildShelf(el,tmp)}},
wir:{title:'Wohnwagen und wir',photos:[{src:'https://norge-bever.blog/wp-content/uploads/2026/11/rabben-feriesenter-03.jpg',cap:'Rabben – Gespann vor dem Wasserfall'},
           {src:'https://norge-bever.blog/wp-content/uploads/2026/11/lone-camping-07.jpg',cap:'Selfie vor der Fantoft Stabkirche'},
           {src:'https://norge-bever.blog/wp-content/uploads/2025/07/img_20211224_154537.jpg',cap:'About'}],render(el){
  const P=this.photos;
  const T=["Moin.Wir sind eine Familie,die das Reisen liebt….", "Wir das sind Nicole,Max und Aaron unser Sohn", "Da wir sehr schöne Reisen unternehmen und auch schon unternommen haben,", "werde wir hier unserer Eindrücke,Erfahrungen,Freuden und auch manchmal Entäuschungen mit Euch teilen.", "Es wird jedoch keine Malle,Strand und Ballermann Berichte geben…", "Wir sind seit einigen Jahren in den Genuss von den eher nordischen Länder gekommen…", "also heisst Norwegen,Schweden,Schottland usw.", "Wir reisen meistens mit dem Auto und unseren treuen Wilki(Wohnwagen)", "Freut Euch auf traumhafte Fotos und Berichte…"];
  el.append(h(`<div class="wirprints">${P.map((p,i)=>`<button data-i="${i}" style="transform:rotate(${[-3,2,-1][i]}deg)"><img src="${W(p.src,700)}" alt="${esc(p.cap)}"><span>${esc(p.cap)}</span></button>`).join('')}</div>
  <div class="about"><h3>About</h3>${T.map(t=>`<p>${esc(t)}</p>`).join('')}</div>
  <div class="btnrow"><a class="btn" href="https://norge-bever.blog/about/" target="_blank" rel="noopener">About-Seite auf dem Blog ↗</a></div>`));
  $$('.wirprints button',el).forEach(b=>b.onclick=()=>openLb(P,+b.dataset.i))}},
karte:{title:'Unsere Route 2026',render(el){
  el.append(h(`<p class="sub">Kommende Reisen – hier zeigen wir bald unsere nächsten Touren.</p>
  <a class="route" href="https://norgebever-source.github.io/route-2026/" target="_blank" rel="noopener"><img src="https://norge-bever.blog/wp-content/uploads/2026/11/route-2026-v3.png?w=1200" alt="Karte unserer Route 2026"></a>
  <p class="sub" style="margin-top:10px">Unsere Route vom 24. Juli bis 9. August 2026</p>
  <div class="btnrow"><a class="btn primary" href="https://norgebever-source.github.io/route-2026/" target="_blank" rel="noopener">Interaktive Route öffnen ↗</a></div>`))}},
kompass:{title:'Svingen',render(el){
  el.append(h(`<div class="app"><img src="https://norge-bever.blog/wp-content/uploads/2026/11/svingen-app-icon-512.png?w=200" alt="Svingen App-Icon">
  <p style="flex:1;min-width:220px;font-size:18px;line-height:1.45">Prüf, ob eine Straße in Norwegen für dein Gespann oder Wohnmobil passierbar ist – und wo die letzte Wendemöglichkeit liegt.</p></div>
  <div class="btnrow"><a class="btn primary" href="https://norgebever-source.github.io/" target="_blank" rel="noopener">Svingen im Browser öffnen ↗</a>
  <a class="btn" href="https://github.com/norgebever-source/svingen/releases/download/v1.0.1/svingen-1.0.1.apk">Für Android herunterladen (APK)</a></div>`))}}
};


/* ---------- Bücherregal (Norwegen-Infos) ---------- */
const BOOK_ICON={Anreise:'🛳️',Maut:'🛣️',Zoll:'📱',Wetter:'🌦️',Geld:'💱',Praktisch:'🧭',Links:'🇳🇴'};
const BOOK_COL=['#7a2e22','#1f4e5a','#5b3a6b','#2f5d3a','#8a6a1f','#3b4a7a','#6b2f3f','#4a5a2a'];
function buildShelf(el,tmp){
  const intro=$('.sub',tmp).outerHTML;
  const books=$$('.folder',tmp).map((f,i)=>{const t=$('h3',f).innerHTML;const c=f.cloneNode(true);$('h3',c).remove();
    return {tab:f.dataset.tab,title:t,html:c.innerHTML,col:BOOK_COL[i%BOOK_COL.length],h:[96,90,100,88,94,98,92][i%7]}});
  el.innerHTML='';
  el.append(h(`${intro}<div class="shelfwrap"><p class="shelfhint">Zieh ein Buch aus dem Regal ›</p><div class="shelf" role="list">${books.map((b,i)=>
    `<button class="book" role="listitem" data-b="${i}" style="--c:${b.col};--h:${b.h}%" aria-label="Buch öffnen: ${b.title.replace(/<[^>]+>/g,'')}"><span class="ico">${BOOK_ICON[b.tab]||'📘'}</span><span class="sp">${b.title}</span><span class="band"></span></button>`).join('')}</div><div class="plank"></div></div>
    <div class="openbook" hidden><div class="btnrow"><button class="btn" data-a="shelf">‹ Zurück zum Regal</button></div>
    <div class="bookstage"><div class="page folder"></div><div class="cover"><span class="ico"></span><span class="ct"></span></div></div></div>`));
  const wrap=$('.shelfwrap',el),ob=$('.openbook',el),page=$('.page',ob),cover=$('.cover',ob);
  $$('.book',el).forEach(bt=>bt.onclick=()=>{const b=books[+bt.dataset.b];bt.classList.add('pull');sfx('drawer');
    setTimeout(()=>{wrap.hidden=true;$('.sub',el).hidden=true;ob.hidden=false;ovT.innerHTML=b.title;
      page.innerHTML=`<h3>${BOOK_ICON[b.tab]||''} ${b.title}</h3>`+b.html;cover.style.setProperty('--c',b.col);$('.ico',cover).textContent=BOOK_ICON[b.tab]||'📘';$('.ct',cover).innerHTML=b.title;
      ob.classList.remove('opened');void ob.offsetWidth;requestAnimationFrame(()=>ob.classList.add('opened'));
      $('.panel',ov).scrollTop=0;bt.classList.remove('pull')},420)});
  $('[data-a=shelf]',ob).onclick=()=>{ob.hidden=true;ob.classList.remove('opened');wrap.hidden=false;$('.sub',el).hidden=false;ovT.textContent=STATIONS.ordner.title;$('.panel',ov).scrollTop=0};
}

/* ---------- Ton (aus bis zum Klick) ---------- */
let ac=null;const amb={on:false,g:null};
function ctx(){if(!ac){ac=new (window.AudioContext||window.webkitAudioContext)()}if(ac.state==='suspended')ac.resume();return ac}
function noise(c){const n=c.sampleRate*4,b=c.createBuffer(2,n,c.sampleRate);for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);let l=0;for(let i=0;i<n;i++){const w=Math.random()*2-1;l=(l+0.02*w)/1.02;d[i]=l*3.5}}
  const s=c.createBufferSource();s.buffer=b;s.loop=true;return s}
function startAmb(){const c=ctx();if(amb.g)return;const g=c.createGain();g.gain.value=0;g.connect(c.destination);
  const s=noise(c),lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=700;const wave=c.createGain();wave.gain.value=.5;
  const lfo=c.createOscillator(),lg=c.createGain();lfo.frequency.value=.11;lg.gain.value=.35;lfo.connect(lg);lg.connect(wave.gain);
  s.connect(lp);lp.connect(wave);wave.connect(g);s.start();lfo.start();amb.g=g;amb.src=[s,lfo]}
function toggleAmb(){amb.on=!amb.on;if(amb.on){startAmb();amb.g.gain.setTargetAtTime(.5,ac.currentTime,.8)}else if(amb.g){amb.g.gain.setTargetAtTime(0,ac.currentTime,.4)}
  const b=$('#sound');b.textContent=amb.on?'🔊 Ton an':'🔇 Ton aus';b.setAttribute('aria-pressed',amb.on)}
$('#sound').onclick=toggleAmb;
function sfx(type){if(!amb.on||!ac)return;const c=ac,t=c.currentTime,s=noise(c),f=c.createBiquadFilter(),g=c.createGain();
  f.type='bandpass';f.frequency.setValueAtTime(type==='door'?300:type==='drawer'?900:1400,t);f.frequency.exponentialRampToValueAtTime(type==='door'?120:400,t+.6);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(type==='whoosh'?.25:.5,t+.05);g.gain.exponentialRampToValueAtTime(.001,t+(type==='door'?1.2:.5));
  s.connect(f);f.connect(g);g.connect(c.destination);s.start(t);s.stop(t+1.3)}
})();
