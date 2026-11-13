
const $=i=>document.getElementById(i);
const cv=$('c'),ctx=cv.getContext('2d');let W,H;
function rs(){W=cv.width=innerWidth;H=cv.height=innerHeight}rs();addEventListener('resize',rs);
const pal=[['#00f2fe','#0072ff'],['#ffb347','#ff5e62'],['#a8ff78','#38a169'],['#d4a5ff','#7f00ff'],['#ff9ed8','#ff007f'],['#fff27a','#ff9800']];
const cname=['Blue','Orange','Green','Purple','Pink','Yellow'];

// ---------- 15 missions: [name, briefing, modifiers, stages[type,goal]] ----------
const MS=[
['Shallow Start','Learn to swim, eat smaller fish and grab your first pearls.',[],[['eat',12],['pearl',3],['eat',16]]],
['Growing Up','Big fish rule the reef. Eat your way up to a giant.',[],[['size',28],['eat',14],['size',38]]],
['Pearl Diver','Pearls sink from the surface in bursts. Collect them all.',[],[['pearl',6],['eat',14],['pearl',9],['size',42]]],
['Stinging Jellies','Glowing jellyfish drift through the reef and sting. Keep clear.',['jelly'],[['eat',14],['pearl',5],['eat',18],['size',44]]],
['Colour Hunt','Only fish with the glowing ring count. Wrong colours cost progress.',[],[['color',8],['color',10],['color',12],['eat',14]]],
['Strong Current','A tide pushes you sideways. Fight it and keep swimming.',['current'],[['eat',16],['pearl',6],['survive',45],['eat',18]]],
['Baby Rescue','Lost baby fish need a lift. Touch them to bring them home, do not eat them.',['jelly'],[['rescue',5],['eat',14],['rescue',8],['pearl',6]]],
['Combo Reef','Eat fish back to back before the combo timer runs out.',[],[['combo',4],['eat',16],['combo',6],['combo',8]]],
['Night Dive','The lights are out. Only your own glow shows the way.',['dark'],[['pearl',6],['eat',16],['survive',45],['pearl',8],['eat',16]]],
['Shark Alley','A hungry shark hunts you down. Never stop moving.',['shark'],[['survive',40],['eat',14],['pearl',6],['survive',50]]],
['Fishing Nets','Fishermen sweep nets across the reef. Slip through the gaps.',['net'],[['eat',16],['pearl',6],['eat',20],['survive',45],['combo',5]]],
['Golden Chase','Golden fish sprint away from you. Corner them among the jellies.',['jelly'],[['golden',3],['eat',16],['golden',5],['golden',7]]],
['Storm Surge','Current, nets and jellies strike together.',['current','net','jelly'],[['eat',18],['pearl',7],['survive',50],['color',10],['eat',22]]],
['Deep Trench','Black water, a shark and stinging jellies. Pearls light the path.',['dark','shark','jelly'],[['pearl',7],['color',10],['survive',50],['golden',4],['pearl',9]]],
['The Megalodon','The giant shark wakes. Survive every danger the abyss has.',['dark','shark','boss','net','jelly'],[['eat',20],['rescue',6],['combo',7],['golden',5],['pearl',10],['survive',70]]]
];
const G=s=>s[0]==='size'?Math.round(s[1]*1.3):Math.ceil(s[1]*(s[0]==='combo'?1.25:1.6));
const label=s=>{const n=G(s);return({eat:'Eat '+n+' fish',size:'Grow to size '+n,pearl:'Collect '+n+' pearls',survive:'Survive '+n+' seconds',color:'Eat '+n+' ringed fish',combo:'Reach a x'+n+' combo',rescue:'Rescue '+n+' baby fish',golden:'Catch '+n+' golden fish'})[s[0]]};

// ---------- save data ----------
let S={coins:0,gems:0,unlocked:1,stars:Array(15).fill(0),claimed:0,profileComplete:false};
try{Object.assign(S,JSON.parse(localStorage.getItem('happyFish2')||'{}'))}catch(e){}
S.stats=Object.assign({played:0,won:0,lost:0,rounds:0,right:0,fish:0,best:0},S.stats||{});
// Existing named local profiles remain valid after this update.\nif(typeof S.profileComplete!=='boolean')S.profileComplete=!!S.name;


let cloudUser=null, cloudTimer=null, cloudBusy=false, cloudAgain=false, authHandling='';
const firebaseReady=()=>!!(window.firebase && window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey && window.FIREBASE_CONFIG.projectId);
let cloudDb=null, cloudAuth=null;
if(firebaseReady()){
  try{
    if(!firebase.apps.length)firebase.initializeApp(window.FIREBASE_CONFIG);
    cloudAuth=firebase.auth(); cloudDb=firebase.firestore();
  }catch(e){console.error('Firebase setup error:',e)}
}
const save=()=>{
  try{localStorage.setItem('happyFish2',JSON.stringify(S))}catch(e){}
  if(cloudUser)scheduleCloudSave();
};
function scheduleCloudSave(){
  clearTimeout(cloudTimer);
  cloudTimer=setTimeout(async()=>{
    if(cloudBusy){cloudAgain=true;return}
    cloudBusy=true;
    try{
      await cloudDb.collection('users').doc(cloudUser.uid).set({
        profile:S,email:cloudUser.email||'',updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      },{merge:true});
      window.dispatchEvent(new CustomEvent('happyfish:sync',{detail:{ok:true}}));
    }catch(err){
      console.error('Cloud save failed:',err);
      window.dispatchEvent(new CustomEvent('happyfish:sync',{detail:{ok:false,error:err.message}}));
    }finally{cloudBusy=false;if(cloudAgain){cloudAgain=false;scheduleCloudSave()}}
  },650);
}
async function loadCloudProfile(user){
  const ref=cloudDb.collection('users').doc(user.uid),snap=await ref.get();
  if(snap.exists && snap.data().profile){
    Object.assign(S,snap.data().profile);
    S.stats=Object.assign({played:0,won:0,lost:0,rounds:0,right:0,fish:0,best:0},S.stats||{});
    if(!Array.isArray(S.stars))S.stars=Array(15).fill(0);
  }else{
    S.authProvider='google';S.email=user.email||'';S.googleName=user.displayName||'';
    S.googlePicture=user.photoURL||'';S.name=(user.displayName||'Player').slice(0,16);
    if(user.photoURL)S.avatar={t:'img',v:user.photoURL};
    S.profileComplete=false;
  }
  cloudUser=user;
  try{localStorage.setItem('happyFish2',JSON.stringify(S))}catch(e){}
  if(!snap.exists)await ref.set({profile:S,email:user.email||'',createdAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
  return snap.exists;
}
async function startGoogleLogin(){
  if(!cloudAuth){alert('Google sign-in setup is incomplete. Check config.js and Firebase setup in README.txt.');return}
  const provider=new firebase.auth.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
  try{await cloudAuth.signInWithPopup(provider)}
  catch(err){
    if(err.code==='auth/popup-blocked'||err.code==='auth/popup-closed-by-user'){
      try{await cloudAuth.signInWithRedirect(provider)}catch(e){alert('Google sign-in failed: '+e.message)}
    }else{console.error('Google sign-in error:',err);alert('Google sign-in failed: '+err.message)}
  }
}
$('googleLogin').addEventListener('click',startGoogleLogin);
if(cloudAuth){
  cloudAuth.getRedirectResult().catch(err=>console.error('Google redirect sign-in:',err));
  cloudAuth.onAuthStateChanged(async user=>{
    if(!user){cloudUser=null;authHandling='';return}
    if(authHandling===user.uid)return;
    authHandling=user.uid;
    try{await loadCloudProfile(user);S.authProvider='google';renderMe();enterGame()}
    catch(err){console.error('Could not load cloud player data:',err);alert('Signed in, but player data could not load. Check Firestore rules: '+err.message)}
    finally{authHandling=''}
  });
}


let mode='menu',T=0,lives=3,inv=0,shake=0,score=0,cur=0,d=0,st={stage:0},M=MS[0],sel=0;
const pl={x:0,y:0,tx:0,ty:0,size:18,dir:1,tail:0};
let fishes=[],bubbles=[],pops=[],pearls=[],jel=[],sharks=[],nets=[],baby=[],gold=[];
for(let i=0;i<45;i++)bubbles.push({x:Math.random()*innerWidth,y:Math.random()*innerHeight,r:2+Math.random()*5,s:.6+Math.random()*1.6,o:.2+Math.random()*.4});

let ac;
function AC(){if(!ac){ac=new (window.AudioContext||window.webkitAudioContext)();ac.mg=ac.createGain();ac.mg.connect(ac.destination);ac.mus=ac.createGain();ac.mus.gain.value=.5;ac.mus.connect(ac.mg)}if(ac.state==='suspended')ac.resume();return ac}
function tone(f1,f2,dur,type='sine',vol=.1,delay=0){if(S.mute)return;try{const a=AC(),o=a.createOscillator(),g=a.createGain(),t=a.currentTime+delay;o.type=type;o.frequency.setValueAtTime(f1,t);if(f2!==f1)o.frequency.exponentialRampToValueAtTime(Math.max(20,f2),t+dur);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g);g.connect(a.mg);o.start(t);o.stop(t+dur+.02)}catch(e){}}
function beep(f,t,y='sine',v=.05){tone(f,f,t,y,v*1.6)}
const sfx={click(){tone(900,600,.06,'sine',.08)},eat(z){const f=650-Math.min(z,80)*4;tone(f,f*1.9,.09,'sine',.14);tone(f*1.4,f*2.4,.07,'triangle',.08,.06)},hurt(){tone(320,70,.35,'sawtooth',.1)},pearl(){tone(1200,1600,.12,'sine',.1);tone(1600,2000,.15,'sine',.08,.09)},ok(){tone(660,880,.12,'triangle',.12);tone(880,1320,.18,'triangle',.1,.1)},bad(){tone(200,120,.28,'square',.07)},win(){[523,659,784,1047].forEach((f,i)=>tone(f,f,.25,'triangle',.12,i*.12))},lose(){[392,330,262,196].forEach((f,i)=>tone(f,f*.97,.3,'sawtooth',.07,i*.16))},stage(){tone(660,990,.15,'square',.05);tone(990,1320,.2,'square',.05,.12)}};
// home song: a gentle music-box loop (C, Am, F, G), 0.28s per step
const MUS=['menu','home','me','reward','brief','perm'];
const MEL=[12,16,19,16,12,16,19,null,9,12,16,12,9,12,16,null,9,12,17,12,9,12,17,null,11,14,19,14,11,14,19,null],BASS=[-12,-15,-19,-17];
const music={r:0,i:0,t:0,on(){if(this.r)return;this.r=1;this.i=0;this.t=0;this.h=setInterval(()=>this.tick(),90)},off(){this.r=0;clearInterval(this.h)},
  tick(){if(!this.r||S.mute||!ac||ac.state!=='running')return;if(this.t<ac.currentTime)this.t=ac.currentTime+.05;
    while(this.t<ac.currentTime+.4){const k=this.i++%32,n=MEL[k];if(n!==null)this.n(261.63*Math.pow(2,n/12),.5,'triangle',.07);if(k%4===0)this.n(261.63*Math.pow(2,BASS[k>>3]/12),1,'sine',.1);this.t+=.28}},
  n(f,d,ty,v){const o=ac.createOscillator(),g=ac.createGain();o.type=ty;o.frequency.value=f;g.gain.setValueAtTime(0,this.t);g.gain.linearRampToValueAtTime(v,this.t+.02);g.gain.exponentialRampToValueAtTime(.001,this.t+d);o.connect(g);g.connect(ac.mus);o.start(this.t);o.stop(this.t+d+.05)}};
$('mute').textContent=S.mute?'🔇':'🔊';
$('mute').onclick=()=>{S.mute=S.mute?0:1;save();$('mute').textContent=S.mute?'🔇':'🔊';if(!S.mute)AC()};
document.addEventListener('click',e=>{if(e.target.closest('button,.node,label.btn')){AC();sfx.click()}},true);

// ---------- screens ----------
const SC=['menu','home','reward','me','brief','perm','gate','pause','over'];
function show(...a){SC.forEach(i=>$(i).style.display=a.includes(i)?'flex':'none');$('hud').style.display=(mode==='play'||mode==='pause')?'flex':'none';a.some(x=>MUS.includes(x))?music.on():music.off()}
function setMode(m){mode=m;cv.style.cursor=m==='play'?'none':'default';$('pb').textContent=m==='play'?'⏸ Pause':'▶ Start'}
function goHome(){GS=null;stopHw();setMode('home');fishes=[];pearls=[];jel=[];sharks=[];nets=[];baby=[];gold=[];pops=[];buildMap();show('home',S.claimed?'':'reward')}
function openFirstProfile(){S.onboarding=true;renderMe();$('profileHeading').textContent='Set Up Your Profile';$('msave').textContent='Save profile & continue';$('mback').style.display='none';show('me')}
function enterGame(){if(!S.profileComplete){openFirstProfile();return}goHome()}
document.querySelectorAll('[data-login]').forEach(b=>b.onclick=enterGame);

function paintAv(el){const A=S.avatar;if(A&&A.t==='img'){el.textContent='';el.style.backgroundImage='url('+A.v+')';el.style.backgroundSize='cover';el.style.backgroundPosition='center'}else{el.style.backgroundImage='';el.textContent=A?A.v:'🐠'}}
const EMO=['🐠','🐟','🐡','🦈','🐬','🐳','🦑','🐙'];
function renderMe(){
  paintAv($('mav'));paintAv($('avb'));$('mnm').value=S.name||'Guest';$('mrank').textContent='Captain rank '+S.unlocked;
  $('emo').innerHTML='';EMO.forEach(em=>{const b=document.createElement('button');b.textContent=em;b.setAttribute('aria-label','Use '+em);if(S.avatar&&S.avatar.t==='emoji'&&S.avatar.v===em)b.className='on';b.onclick=()=>{S.avatar={t:'emoji',v:em};save();renderMe()};$('emo').appendChild(b)});
  const st=S.stats,tot=S.stars.reduce((a,b)=>a+b,0),acc=st.rounds?Math.round(st.right/st.rounds*100):0;
  $('mst').innerHTML=[['Missions played',st.played],['Missions won',st.won],['Missions lost',st.lost],['Gate rounds played',st.rounds],['Gate rounds correct',st.right+' ('+acc+'%)'],['Fish eaten',st.fish],['Best score',st.best],['Stars',tot+' / 45'],['Unlocked',S.unlocked+' / 15 missions'],['Wallet','🪙 '+S.coins+'  💎 '+S.gems]].map(([k,v])=>'<div>'+k+'<b>'+v+'</b></div>').join('');
  $('mres').innerHTML=MS.map((x,i)=>'<div>'+(i+1)+'<b style="font-size:.75rem">'+(i<S.unlocked?'★'.repeat(S.stars[i])+'☆'.repeat(3-S.stars[i]):'🔒')+'</b></div>').join('');
}
const saveName=()=>{S.name=($('mnm').value.trim()||'Player').slice(0,16);save()};
document.querySelector('.pf').onclick=()=>{S.onboarding=false;renderMe();$('profileHeading').textContent='My Profile';$('msave').textContent='Save profile';$('mback').style.display='';show('home','me')};
$('msave').onclick=()=>{
  saveName();S.profileComplete=true;S.onboarding=false;save();renderMe();buildMap();
  $('profileHeading').textContent='My Profile';$('mback').style.display='';
  $('msave').textContent='Saved ✔';setTimeout(()=>{$('msave').textContent='Save profile'},1200);
  goHome();
};
$('mback').onclick=()=>{saveName();S.onboarding=false;save();$('profileHeading').textContent='My Profile';$('mback').style.display='';goHome()};
$('mfile').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();
  r.onload=()=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=c.height=160;const x=c.getContext('2d'),m=Math.min(im.width,im.height);
    x.drawImage(im,(im.width-m)/2,(im.height-m)/2,m,m,0,0,160,160);S.avatar={t:'img',v:c.toDataURL('image/jpeg',.82)};save();renderMe()};im.src=r.result};
  r.readAsDataURL(f);e.target.value=''};
$('claim').onclick=()=>{S.coins+=1250;S.gems+=45;S.claimed=1;save();buildMap();show('home')};

function buildMap(){
  $('coins').textContent=S.coins.toLocaleString();$('gems').textContent=S.gems;$('rank').textContent='Captain rank '+S.unlocked;$('pname').textContent=S.name||'Guest';paintAv($('avb'));
  const pos=[0,-120,-70,0,75,120,75,0,-70,-120,-70,0,75,120,0],m=$('map');m.innerHTML='';
  MS.forEach((x,i)=>{
    const n=document.createElement('button'),ok=i<S.unlocked;
    n.className='node'+(ok?(S.stars[i]?' done':''):' lock')+(i===S.unlocked-1?' cur':'');
    n.style.transform='translateX('+pos[i]+'px)';
    n.setAttribute('aria-label','Mission '+(i+1)+': '+x[0]);
    n.innerHTML=ok?'<b>'+(i+1)+'</b><small>Mission</small><span class="stars">'+'★'.repeat(S.stars[i])+'☆'.repeat(3-S.stars[i])+'</span>':'<span style="font-size:1.4rem">🔒</span><b>'+(i+1)+'</b>';
    n.onclick=()=>brief(i);m.appendChild(n);
  });
}
function brief(i){
  sel=i;const ok=i<S.unlocked;
  $('bt').textContent='Mission '+(i+1)+': '+MS[i][0];
  $('bd').textContent=ok?MS[i][1]:'Finish mission '+i+' to unlock this one.';
  $('bl').innerHTML=ok?MS[i][3].map((s,k)=>'<li>Stage '+(k+1)+': '+label(s)+'</li>').join(''):'';
  $('go').disabled=!ok;$('go').textContent=ok?'Start mission':'Locked';
  show('home','brief');
}
$('bx').onclick=()=>show('home');$('go').onclick=()=>needPerm()?show('home','perm'):openGate(sel);

// ---------- helpers ----------
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const near=(a,b,k)=>Math.hypot(a.x-b.x,a.y-b.y)<(a.size+b.size)*k;
function say(t){const b=$('banner');b.textContent=t;b.style.opacity=1;setTimeout(()=>b.style.opacity=0,1500)}
function pop(x,y,t,col){pops.push({x,y,t,col,l:50})}
const cp=()=>{const t=M[3][st.stage][0];return t==='size'?pl.size:t==='survive'?st.t:t==='combo'?st.combo:st.prog};

function fish(x,y,s,dir,c,tail,glow,alpha,kind){
  ctx.save();ctx.translate(x,y);ctx.scale(dir,1);ctx.globalAlpha=alpha==null?1:alpha;
  if(glow){ctx.shadowColor=glow;ctx.shadowBlur=14}
  const w=Math.sin(tail)*s*.18;ctx.fillStyle=c[1];
  ctx.beginPath();ctx.moveTo(-s*.8,0);ctx.lineTo(-s*1.5,-s*.55+w);ctx.lineTo(-s*1.5,s*.55+w);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(-s*.3,-s*.55);ctx.quadraticCurveTo(0,-s*1.05,s*.35,-s*.5);ctx.closePath();ctx.fill();
  const g=ctx.createRadialGradient(s*.2,-s*.2,s*.1,0,0,s);g.addColorStop(0,'#fff');g.addColorStop(.35,c[0]);g.addColorStop(1,c[1]);
  ctx.fillStyle=g;ctx.beginPath();
  if(kind==='tri'){ctx.moveTo(s*1.1,0);ctx.lineTo(-s*.6,-s*.9);ctx.lineTo(-s*.6,s*.9);ctx.closePath();ctx.fill();ctx.strokeStyle=c[1];ctx.lineWidth=s*.12;ctx.beginPath();ctx.moveTo(-s*.1,-s*.6);ctx.lineTo(-s*.1,s*.6);ctx.stroke()}
  else if(kind==='shark'){ctx.moveTo(s*1.4,0);ctx.quadraticCurveTo(s*.3,-s*.62,-s*.9,-s*.2);ctx.lineTo(-s*.9,s*.2);ctx.quadraticCurveTo(s*.3,s*.62,s*1.4,0);ctx.fill();ctx.fillStyle='rgba(255,255,255,.85)';ctx.beginPath();ctx.ellipse(s*.2,s*.2,s*.75,s*.12,0,0,7);ctx.fill()}
  else if(kind==='puff'){ctx.ellipse(0,0,s*.95,s*.85,0,0,7);ctx.fill();ctx.fillStyle=c[1];for(let k=0;k<10;k++){const a=k*Math.PI/5;ctx.beginPath();ctx.moveTo(Math.cos(a-.14)*s*.92,Math.sin(a-.14)*s*.82);ctx.lineTo(Math.cos(a)*s*1.2,Math.sin(a)*s*1.08);ctx.lineTo(Math.cos(a+.14)*s*.92,Math.sin(a+.14)*s*.82);ctx.fill()}}
  else{ctx.ellipse(0,0,s,s*.64,0,0,7);ctx.fill()}
  ctx.shadowBlur=0;
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(s*.5,-s*.18,s*.2,0,7);ctx.fill();
  ctx.fillStyle='#111';ctx.beginPath();ctx.arc(s*.56,-s*.18,s*.1,0,7);ctx.fill();ctx.restore();
}
function jelly(j){
  ctx.save();ctx.translate(j.x,j.y);ctx.shadowColor='#ff7ad9';ctx.shadowBlur=16;ctx.fillStyle='rgba(255,130,220,.72)';
  ctx.beginPath();ctx.arc(0,0,j.r,Math.PI,0);ctx.fill();ctx.strokeStyle='rgba(255,170,230,.85)';ctx.lineWidth=3;
  for(let k=-2;k<=2;k++){ctx.beginPath();ctx.moveTo(k*j.r*.35,0);ctx.quadraticCurveTo(k*j.r*.35+Math.sin(T*.08+k)*8,j.r*.8,k*j.r*.35,j.r*1.5);ctx.stroke()}
  ctx.restore();
}

// ---------- spawning ----------
function spawn(){
  const amb=mode==='menu'||mode==='home',s=amb?22:pl.size,sp=amb?1:1+d*.05;
  let ci=Math.floor(Math.random()*pal.length),small=Math.random()>(amb?.5:.36+d*.015);
  if(!amb&&M[3][st.stage][0]==='color'&&Math.random()<.45){ci=st.tc;small=true}
  let size=amb?10+Math.random()*30:clamp(small?s*(.35+Math.random()*.55):s*(1.1+Math.random()*.9),9,120);
  const left=Math.random()<.5;
  fishes.push({x:left?-size*2.5:W+size*2.5,y:H*(.1+Math.random()*.72),size,ci,c:pal[ci],kind:kd(),tail:Math.random()*6,ph:Math.random()*6,
    sp:(.7+Math.random()*1.3)*(left?1:-1)*sp*(1.25-Math.min(size,90)/150)});
}
const mkShark=(size,sp)=>({x:Math.random()<.5?-size*2:W+size*2,y:H/2,size,sp,vx:0,vy:0,tail:0});
function spawnBaby(){const l=Math.random()<.5;baby.push({x:l?-20:W+20,y:H*(.15+Math.random()*.65),size:10,vx:(l?1:-1)*(.6+Math.random()*.5),tail:0})}
function spawnGold(){gold.push({x:Math.random()*W,y:H*(.15+Math.random()*.6),size:Math.max(12,pl.size*.55),vx:1,vy:0,tail:0,life:15})}

// ---------- mission flow ----------
function startMission(i){
  S.stats.played++;M=MS[i];d=i;st={stage:0,prog:0,t:0,combo:0,comboT:0,tc:0};lives=3;inv=0;shake=0;score=0;
  fishes=[];pearls=[];pops=[];jel=[];sharks=[];nets=[];baby=[];gold=[];
  Object.assign(pl,{x:W/2,y:H/2,tx:W/2,ty:H/2,size:18});
  if(M[2].includes('jelly'))for(let k=0;k<2+Math.floor(i/3);k++)jel.push({x:Math.random()*W,y:H*(.2+Math.random()*.55),r:24+Math.random()*10,ph:Math.random()*6});
  if(M[2].includes('shark'))sharks.push(mkShark(85,2+i*.08));
  if(M[2].includes('boss'))sharks.push(mkShark(150,1.5+i*.05));
  setMode('pause');stageInit();for(let k=0;k<7;k++){spawn();fishes[k].x=Math.random()*W}
  $('ptt').textContent='Ready?';$('psub').textContent='Mission '+(i+1)+': '+M[0]+'. Move your mouse or finger to swim.';$('resume').textContent='▶ Start';show('pause');
}
function stageInit(){
  const s=M[3][st.stage];st.prog=0;st.t=0;st.combo=0;st.comboT=0;st.tc=Math.floor(Math.random()*pal.length);st.need=G(s);
  $('mn').textContent='Mission '+(st.i===undefined?d+1:d+1)+': '+M[0];$('sg').textContent='Stage '+(st.stage+1)+' of '+M[3].length;
  $('goal').textContent=label(s)+(s[0]==='color'?' ('+cname[st.tc]+')':'');
  say(label(s)+(s[0]==='color'?': '+cname[st.tc]:''));hud();
}
function hud(){
  $('sc').textContent=score;$('hp').textContent='❤️'.repeat(Math.max(lives,0))||'💔';
  const p=cp();$('pt').textContent=Math.floor(p)+' / '+st.need;$('bar').style.width=clamp(p/st.need*100,0,100)+'%';
}
function nextStage(){
  score+=200;sfx.stage();st.stage++;
  if(st.stage>=M[3].length)return finish(true);
  stageInit();
}
function hurt(){
  if(inv>0)return;lives--;inv=130;shake=14;st.combo=0;pl.size=Math.max(14,pl.size*.92);
  pop(pl.x,pl.y-30,'Ouch!','#ff5e62');sfx.hurt();hud();if(lives<=0)finish(false);
}
function finish(win){S.stats[win?'won':'lost']++;S.stats.best=Math.max(S.stats.best,score);save();
  setMode('over');$('next').style.display='none';$('continueCoins').style.display='none';$('continueGems').style.display='none';
  if(win){
    const stars=lives,coins=150+d*60+stars*50,gems=stars+(d===14?10:0);
    S.coins+=coins;S.gems+=gems;S.stars[d]=Math.max(S.stars[d],stars);S.unlocked=Math.min(15,Math.max(S.unlocked,d+2));save();
    $('oi').textContent=d===14?'🏆':'🌟';$('ot').textContent=d===14?'Ocean Champion!':'Mission complete!';
    $('os').textContent='★'.repeat(stars)+'☆'.repeat(3-stars);
    $('od').textContent='Score '+score+'. You earned 🪙 '+coins+' and 💎 '+gems+'.';
    if(d<14)$('next').style.display='flex';sfx.win();
  }else{
    $('oi').textContent='🦈';$('ot').textContent='You got caught!';$('os').textContent='☆☆☆';
    $('od').textContent='Score '+score+'. Stage '+(st.stage+1)+' of '+M[3].length+' reached. Spend coins or gems to continue from this stage!';$('continueCoins').style.display='flex';$('continueGems').style.display='flex';sfx.lose();
  }
  show('over');
}

function continueMission(currency){
  const cost=currency==='coins'?500:10;
  if(currency==='coins'&&S.coins<cost){alert('Not enough coins. You need '+cost+' coins.');return}
  if(currency==='gems'&&S.gems<cost){alert('Not enough gems. You need '+cost+' gems.');return}
  if(currency==='coins')S.coins-=cost;else S.gems-=cost;
  lives=1;inv=180;shake=0;
  fishes=[];pearls=[];pops=[];jel=[];sharks=[];nets=[];baby=[];gold=[];
  Object.assign(pl,{x:W/2,y:H/2,tx:W/2,ty:H/2,size:18});
  if(M[2].includes('jelly'))for(let k=0;k<2+Math.floor(d/3);k++)jel.push({x:Math.random()*W,y:H*(.2+Math.random()*.55),r:24+Math.random()*10,ph:Math.random()*6});
  if(M[2].includes('shark'))sharks.push(mkShark(85,2+d*.08));
  if(M[2].includes('boss'))sharks.push(mkShark(150,1.5+d*.05));
  for(let k=0;k<7;k++){spawn();fishes[k].x=Math.random()*W}
  save();setMode('play');hud();show();beep(520,.1);
}
$('continueCoins').onclick=()=>continueMission('coins');
$('continueGems').onclick=()=>continueMission('gems');

$('next').onclick=()=>openGate(d+1);$('retry').onclick=()=>startMission(d);$('omap').onclick=goHome;
function setPause(p){if(mode==='play'&&p){setMode('pause');$('ptt').textContent='Paused';$('psub').textContent='The ocean will wait.';$('resume').textContent='▶ Resume';show('pause')}else if(mode==='pause'&&!p){setMode('play');show();beep(520,.1)}}
$('resume').onclick=()=>setPause(false);$('pb').onclick=()=>setPause(mode==='play');$('quit').onclick=goHome;
addEventListener('keydown',e=>{
  if(e.key==='p'||e.key==='Escape')setPause(mode==='play');
  const k={ArrowLeft:[-60,0],ArrowRight:[60,0],ArrowUp:[0,-60],ArrowDown:[0,60],a:[-60,0],d:[60,0],w:[0,-60],s:[0,60]}[e.key];
  if(k&&mode==='play'){pl.tx=clamp(pl.tx+k[0],0,W);pl.ty=clamp(pl.ty+k[1],0,H)}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)setPause(true)});
const mv=e=>{pl.tx=e.clientX;pl.ty=e.clientY};cv.addEventListener('pointermove',mv);cv.addEventListener('pointerdown',mv);

// ---------- fish kinds ----------
const KD=['round','round','tri','tri','puff','shark'];
function kd(){const cs=(mode==='play'||mode==='pause')&&M[3][st.stage][0]==='color';const a=cs?KD.filter(k=>k!=='shark'):KD;return a[Math.floor(Math.random()*a.length)]}

// ---------- access gates: live Marc Conrad Fish Game API ----------
// API documentation: https://marcconrad.com/uob/fish/doc.php
const FISH_API='https://marcconrad.com/uob/fish/api.php?out=json';
// Missions share the same fish-count API question; difficulty changes by time,
// movement, blur, fog and memory rounds. Every round fetches a fresh API puzzle.
const GATES=[
  {},{t:30},{mv:1},{mv:1,t:24},{mv:1,t:20},{mv:2,t:18,pen:3},
  {fl:3,t:18},{mv:2,t:16},{blur:1,mv:1,t:15},{mv:3,t:14,pen:3},
  {mv:2,t:18},{mv:3,fog:1,t:13},{mv:3,t:12,pen:4,rd:2},
  {fl:1.5,t:14},{mv:3,fog:1,fl:2,t:12,rd:3}
];
let GS=null,hw={};const sc=document.createElement('canvas');sc.width=320;sc.height=240;
const rnd=(a,b)=>a+Math.floor(Math.random()*(b-a+1)),msg=t=>$('gm').textContent=t;
function apiImageAndAnswer(j){
  const d=j&&typeof j==='object'?(j.data&&typeof j.data==='object'?j.data:j):{};
  const image=d.question||d.image||d.image_url||d.url||d.picture||j.question||j.image||j.image_url||j.url||j.picture;
  const raw=d.solution??d.answer??d.fish??d.count??d.result??j.solution??j.answer??j.fish??j.count??j.result;
  const answer=Number.parseInt(raw,10);
  if(!image||!Number.isFinite(answer)||answer<0)throw new Error('API response did not include an image and numeric solution.');
  let src=/^(data:image\/|https?:\/\/)/i.test(String(image))?String(image):new URL(String(image),FISH_API).href;
  if(src.startsWith('http://'))src='https://'+src.slice(7);
  return {question:src,fish:answer};
}
async function getQ(){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch(FISH_API,{method:'GET',cache:'no-store',headers:{Accept:'application/json'},signal:controller.signal});
    if(!response.ok)throw new Error('Fish API returned HTTP '+response.status+'.');
    return apiImageAndAnswer(await response.json());
  }catch(e){
    if(e.name==='AbortError')throw new Error('Fish API request timed out. Please try again.');
    if(e instanceof TypeError)throw new Error('Cannot connect to the Fish API. Check your internet connection or run the game on localhost/HTTPS.');
    throw e;
  }finally{clearTimeout(timer)}
}
function loadScene(q){return new Promise((resolve,reject)=>{
  const im=new Image();let done=false;
  const finish=(ok)=>{if(done)return;done=true;if(ok){const x=sc.getContext('2d');x.clearRect(0,0,sc.width,sc.height);x.drawImage(im,0,0,sc.width,sc.height);resolve(true)}else reject(new Error('Could not load the question image from the Fish API.'))};
  im.onload=()=>finish(true);im.onerror=()=>finish(false);setTimeout(()=>finish(false),10000);im.src=q.question;
})}
function openGate(i){
  sel=i;const cf=Object.assign({rd:1,ui:'t',ask:'fish'},GATES[i]),ch=false,gc=$('gc'),w=Math.min(340,innerWidth-70);
  gc.width=w;gc.height=Math.round(w*.78);
  GS={i,cf,n:0,got:0,rid:0,ph:'load',bub:[],x:10,y:10,vx:0,vy:0,left:0,el:0,fl:0};
  $('gin').style.display='block';$('ghw').style.display='flex';$('ga').value='';$('gretry').style.display='none';
  $('gh').textContent=(cf.mv?'The picture keeps moving. ':'')+(cf.fl?'You only see it for '+cf.fl+' seconds. ':'')+(cf.blur?'It starts blurry. ':'')+(cf.fog?'Fog hides parts of it. ':'')+'Type the number of fish. '+(cf.t?'You have '+cf.t+' seconds. ':'No time limit. ')+(cf.rd>1?'Win '+cf.rd+' rounds in a row.':'');
  msg('Connecting to Marc Conrad Fish API…');show('gate');newRound();
}
function newRound(){
  if(!GS)return;const rid=++GS.rid;GS.ph='load';$('gretry').style.display='none';msg('Loading a new fish-count question…');
  getQ().then(q=>loadScene(q).then(()=>{
    if(!GS||GS.rid!==rid)return;const cf=GS.cf,w=$('gc').width,h=$('gc').height;
    GS.ans=q.fish;$('gs').textContent='How many FISH are in this picture? Type the exact number.';
    GS.x=10;GS.y=10;GS.vx=(Math.random()<.5?-1:1)*(cf.mv||0)*1.3*(.7+Math.random()*.6);GS.vy=(Math.random()<.5?-1:1)*(cf.mv||0)*1.3*(.7+Math.random()*.6);
    GS.left=cf.t||0;GS.el=0;GS.fl=cf.fl||0;GS.ph=cf.fl?'show':'ask';S.stats.rounds++;$('ga').value='';$('ga').focus({preventScroll:true});msg('');
  })).catch(e=>{
    if(!GS||GS.rid!==rid)return;GS.ph='error';msg(e.message||'Fish API is unavailable. Please retry.');$('gretry').style.display='block';
  });
}
function answer(v){
  if(!GS||GS.ph!=='ask')return;const cf=GS.cf;
  if(+v===GS.ans){
    GS.got++;S.stats.right++;save();sfx.ok();
    if(GS.got>=cf.rd){GS.ph='done';msg('Correct! Gate unlocked. Diving in…');stopHw();const i=GS.i;setTimeout(()=>{if(GS&&GS.ph==='done'){GS=null;startMission(i)}},900)}
    else{msg('Correct! Round '+(GS.got+1)+' of '+cf.rd);newRound()}
  }else{
    sfx.bad();if(cf.rd>1)GS.got=0;if(cf.t)GS.left-=cf.pen||3;
    msg('Not quite'+(cf.t?'. -'+(cf.pen||3)+' seconds':'')+(cf.rd>1?'. Streak reset':'')+'. Try again!');
    GS.bub=GS.bub.filter(b=>b.v!==+v);$('ga').value='';GS.mt=performance.now();
  }
}
function gateFrame(dt){
  const c=$('gc').getContext('2d'),w=$('gc').width,h=$('gc').height,cf=GS.cf,ch=cf.ui==='c',ih=ch?h*.58:h;
  c.clearRect(0,0,w,h);c.fillStyle='#021a3d';c.fillRect(0,0,w,h);c.textAlign='center';c.font='600 17px Fredoka,sans-serif';c.fillStyle='#a4d8ff';
  $('gr').textContent='Mission '+(GS.i+1)+(cf.rd>1?'  Round '+Math.min(GS.got+1,cf.rd)+' of '+cf.rd:'');
  if(GS.ph==='load'){c.fillText('Loading Fish API question…',w/2,h/2);return}
  if(GS.ph==='error'){c.fillStyle='#ffb4b4';c.fillText('Question unavailable',w/2,h/2);return}
  if(GS.ph==='show'){GS.fl-=dt;if(GS.fl<=0){GS.ph='ask';$('ga').focus({preventScroll:true})}}
  else if(GS.ph==='ask'){GS.el+=dt;if(cf.t){GS.left-=dt;if(GS.left<=0){msg('Time is up! Loading a new API question…');GS.got=0;GS.ph='load';beep(150,.3,'sawtooth');return newRound()}}}
  $('gb').style.width=(cf.t?clamp(GS.left/cf.t*100,0,100):100)+'%';$('gk').textContent=cf.t?'⏱ '+Math.max(0,GS.left).toFixed(1)+'s':'No time limit';
  if(GS.ph==='ask'&&cf.fl){c.fillText('Memory round: the picture is hidden!',w/2,ih/2-8);c.font='700 42px Fredoka,sans-serif';c.fillText('?',w/2,ih/2+40)}
  else{
    const sw=w*(cf.mv?.64:.94),sh=sw*.75;
    if(!cf.mv){GS.x=(w-sw)/2;GS.y=(ih-sh)/2}else{GS.x+=GS.vx;GS.y+=GS.vy;if(GS.x<0||GS.x>w-sw)GS.vx*=-1;if(GS.y<0||GS.y>ih-sh)GS.vy*=-1;GS.x=clamp(GS.x,0,w-sw);GS.y=clamp(GS.y,0,ih-sh)}
    if(cf.blur&&GS.ph==='ask')c.filter='blur('+Math.max(0,7-GS.el*1.2).toFixed(1)+'px)';
    c.drawImage(sc,GS.x,GS.y,sw,sh);c.filter='none';
    if(cf.fog)for(let k=0;k<5;k++){const bx=(Math.sin(T*.011+k*2)*.5+.5)*w,by=(Math.cos(T*.014+k*1.7)*.5+.5)*ih,g=c.createRadialGradient(bx,by,5,bx,by,w*.26);g.addColorStop(0,'rgba(215,235,255,.8)');g.addColorStop(1,'rgba(215,235,255,0)');c.fillStyle=g;c.fillRect(0,0,w,ih)}
    if(GS.ph==='show'){c.fillStyle='#ffd54a';c.fillText('Memorize! '+Math.max(0,GS.fl).toFixed(1)+'s',w/2,20)}
  }
  if(ch&&GS.ph==='ask')GS.bub.forEach(b=>{
    b.x+=b.vx;b.y+=b.vy;if(b.x<b.r||b.x>w-b.r)b.vx*=-1;if(b.y<ih+b.r||b.y>h-b.r)b.vy*=-1;b.x=clamp(b.x,b.r,w-b.r);b.y=clamp(b.y,ih+b.r,h-b.r);
    const g=c.createRadialGradient(b.x-7,b.y-7,2,b.x,b.y,b.r);g.addColorStop(0,'#fff');g.addColorStop(1,'#00aaff');c.fillStyle=g;c.beginPath();c.arc(b.x,b.y,b.r,0,7);c.fill();
    c.fillStyle='#021a3d';c.font='700 20px Fredoka,sans-serif';c.fillText(b.v,b.x,b.y+7)});
}
$('gretry').onclick=()=>newRound();
$('gok').onclick=()=>{const v=$('ga').value;if(v!=='')answer(v)};
$('ga').addEventListener('keydown',e=>{if(e.key==='Enter'){const v=$('ga').value;if(v!=='')answer(v)}});
$('gback').onclick=()=>{GS=null;stopHw();show('home')};

// ---------- ask for camera and microphone before the first gate ----------
let permSkip=0;
const needPerm=()=>!S.perm&&!permSkip;
$('pallow').onclick=async()=>{
  $('pallow').disabled=true;$('pm2').textContent='Waiting for your permission…';const out=[];let ok=0;
  for(const[k,c]of[['camera',{video:true}],['microphone',{audio:true}]]){
    try{const s=await navigator.mediaDevices.getUserMedia(c);s.getTracks().forEach(t=>t.stop());ok++;out.push(k+' allowed')}catch(e){out.push(k+' blocked')}}
  if(ok){S.perm=1;save()}else permSkip=1;
  $('pm2').textContent=out.join(', ')+(ok?'.':'. You can still type your answers.');
  setTimeout(()=>{$('pallow').disabled=false;openGate(sel)},1300);
};
$('pno').onclick=()=>{permSkip=1;openGate(sel)};

// ---------- hardware answers: camera (fingers) and microphone (claps) ----------
function stopHw(){clearInterval(hw.t);if(hw.s)hw.s.getTracks().forEach(t=>t.stop());if(hw.a&&hw.a.close)hw.a.close();hw={};$('gvw').style.display='none';$('glw').style.display='none';$('gcal').style.display='none'}
const hmsg=t=>{if(!GS||performance.now()-(GS.mt||0)>1600)msg(t)};
const FW=160,FH=140;
// Finger counter: skin mask (optionally calibrated to your hand) inside the green box, smoothed,
// palm centre = widest point of the hand, then count the skin arcs crossing a circle around the palm.
function analyze(x,v,ov){
  const vw=v.videoWidth,vh=v.videoHeight;if(!vw)return -1;const n=FW*FH;
  x.drawImage(v,vw*.2,vh*.3,vw*.6,vh*.7,0,0,FW,FH);
  const d=x.getImageData(0,0,FW,FH).data,cr=new Float32Array(n),cb=new Float32Array(n),Yv=new Float32Array(n);
  for(let i=0;i<n;i++){const r=d[i*4],g=d[i*4+1],b=d[i*4+2],Y=.299*r+.587*g+.114*b;Yv[i]=Y;cr[i]=(r-Y)*.713+128;cb[i]=(b-Y)*.564+128}
  if(hw.calReq){const A=[],B=[];for(let y=70;y<110;y++)for(let xx=60;xx<100;xx++){A.push(cr[y*FW+xx]);B.push(cb[y*FW+xx])}
    A.sort((p,q)=>p-q);B.sort((p,q)=>p-q);hw.cr0=A[A.length>>1];hw.cb0=B[B.length>>1];hw.calReq=0;msg('Calibrated to your hand. Now hold it still.');GS&&(GS.mt=performance.now())}
  const c0=hw.cr0!=null,l1=c0?hw.cr0-13:135,h1=c0?hw.cr0+13:175,l2=c0?hw.cb0-13:77,h2=c0?hw.cb0+13:127,m=new Uint8Array(n);
  for(let i=0;i<n;i++)m[i]=(Yv[i]>35&&cr[i]>l1&&cr[i]<h1&&cb[i]>l2&&cb[i]<h2)?1:0;
  const m2=new Uint8Array(n);
  for(let y=1;y<FH-1;y++)for(let xx=1;xx<FW-1;xx++){const i=y*FW+xx;m2[i]=(m[i-FW-1]+m[i-FW]+m[i-FW+1]+m[i-1]+m[i]+m[i+1]+m[i+FW-1]+m[i+FW]+m[i+FW+1])>=5?1:0}
  const lab=new Int16Array(n);let best=0,bl=0,L=0;
  for(let i=0;i<n;i++)if(m2[i]&&!lab[i]){L++;let k=0;const st=[i];lab[i]=L;
    while(st.length){const p=st.pop();k++;const px=p%FW,py=(p/FW)|0;for(const q of[px>0?p-1:-1,px<FW-1?p+1:-1,py>0?p-FW:-1,py<FH-1?p+FW:-1])if(q>=0&&m2[q]&&!lab[q]){lab[q]=L;st.push(q)}}
    if(k>best){best=k;bl=L}}
  ov.clearRect(0,0,200,150);
  if(best>=900){const id=hw.id;for(let i=0;i<n;i++){const o=i*4;id.data[o]=125;id.data[o+1]=255;id.data[o+2]=160;id.data[o+3]=lab[i]===bl?120:0}hw.mc.getContext('2d').putImageData(id,0,0);ov.drawImage(hw.mc,40,45,120,105)}
  ov.strokeStyle='#7dffa0';ov.lineWidth=2;ov.setLineDash([6,4]);ov.strokeRect(40,45,120,105);ov.setLineDash([]);
  if(best<900)return -1;
  const dt=new Float32Array(n);for(let i=0;i<n;i++)dt[i]=lab[i]===bl?999:0;
  for(let y=0;y<FH;y++)for(let xx=0;xx<FW;xx++){const i=y*FW+xx;if(!dt[i])continue;let a=dt[i];
    if(xx===0||y===0||xx===FW-1)a=Math.min(a,1);if(xx>0)a=Math.min(a,dt[i-1]+1);
    if(y>0){a=Math.min(a,dt[i-FW]+1);if(xx>0)a=Math.min(a,dt[i-FW-1]+1.4);if(xx<FW-1)a=Math.min(a,dt[i-FW+1]+1.4)}dt[i]=a}
  let R=0,cx=0,cy=0;
  for(let y=FH-1;y>=0;y--)for(let xx=FW-1;xx>=0;xx--){const i=y*FW+xx;if(!dt[i])continue;let a=dt[i];
    if(xx<FW-1)a=Math.min(a,dt[i+1]+1);if(y<FH-1){a=Math.min(a,dt[i+FW]+1);if(xx<FW-1)a=Math.min(a,dt[i+FW+1]+1.4);if(xx>0)a=Math.min(a,dt[i+FW-1]+1.4)}
    dt[i]=a;if(a>R){R=a;cx=xx;cy=y}}
  if(R<10)return -1;
  const rr=R*1.8,N=180,on=[];
  for(let k=0;k<N;k++){const t=k/N*2*Math.PI,px=Math.round(cx+Math.cos(t)*rr),py=Math.round(cy+Math.sin(t)*rr);on.push(px>=0&&py>=0&&px<FW&&py<FH&&lab[py*FW+px]===bl?1:0)}
  const s0=on.indexOf(0);let count=0;
  if(s0>=0){let k=0;while(k<N){if(on[(s0+k)%N]){let len=0,j=k;while(j<N&&on[(s0+j)%N]){len++;j++}
      const t=((s0+k+len/2)%N)/N*2*Math.PI;if(len>=5&&Math.sin(t)<.5)count++;k=j}else k++}}
  const sc2=.75,ox=40+cx*sc2,oy=45+cy*sc2;ov.lineWidth=2;ov.strokeStyle='#ffd54a';ov.beginPath();ov.arc(ox,oy,R*sc2,0,7);ov.stroke();
  ov.strokeStyle='#ff5e62';ov.beginPath();ov.arc(ox,oy,rr*sc2,0,7);ov.stroke();
  return Math.min(count,5);
}
$('gcam').onclick=async()=>{
  stopHw();
  try{
    const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}}});hw.s=s;
    const v=$('gv');v.srcObject=s;$('gvw').style.display='block';$('gcal').style.display='flex';await v.play();
    const c2=document.createElement('canvas');c2.width=FW;c2.height=FH;const x=c2.getContext('2d',{willReadFrequently:true}),ov=$('gov').getContext('2d');
    hw.mc=document.createElement('canvas');hw.mc.width=FW;hw.mc.height=FH;hw.id=hw.mc.getContext('2d').createImageData(FW,FH);
    const hist=[];let cool=0;
    msg('Put your open hand in the green box (palm in the middle, fingers spread and up), then press Calibrate.');
    hw.t=setInterval(()=>{
      const n=analyze(x,v,ov);hist.push(n);if(hist.length>14)hist.shift();
      const cnt={};hist.forEach(k=>{if(k>0)cnt[k]=(cnt[k]||0)+1});let bk=0,bc=0;for(const k in cnt)if(cnt[k]>bc){bc=cnt[k];bk=+k}
      if(n>0)hmsg('I see '+n+' finger'+(n>1?'s':'')+'. Hold still… '+Math.min(bc,10)+'/10');else if(n===0)hmsg('No fingers up. Open your hand and spread the fingers.');else hmsg('No hand found. Keep it in the green box, then press Calibrate.');
      if(performance.now()>cool&&hist.length>=14&&bc>=10){cool=performance.now()+2500;hist.length=0;answer(bk)}},110);
  }catch(e){msg('Camera is not available here ('+((e&&e.name)||'error')+'). Type your answer instead.')}
};
$('gcal').onclick=()=>{hw.calReq=1};
$('gmic').onclick=async()=>{
  stopHw();
  const a=new (window.AudioContext||window.webkitAudioContext)();hw.a=a;
  try{
    await a.resume();
    const s=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});hw.s=s;await a.resume();
    const an=a.createAnalyser();an.fftSize=1024;a.createMediaStreamSource(s).connect(an);
    const buf=new Uint8Array(an.fftSize);let n=0,lt=0,base=5,prev=0;$('glw').style.display='block';
    msg('Clap once for each one. I count after a short pause.');
    hw.t=setInterval(()=>{
      an.getByteTimeDomainData(buf);let m=0;for(let i=0;i<buf.length;i++)m=Math.max(m,Math.abs(buf[i]-128));
      $('gl').style.width=Math.min(100,m/80*100)+'%';
      const thr=Math.max(26,base*4),now=performance.now();
      if(m>thr&&prev<=thr&&now-lt>200){n++;lt=now;hmsg('Claps heard: '+n)}else if(m<=thr)base=base*.97+m*.03;
      prev=m;if(n&&now-lt>1500){const k=n;n=0;answer(k)}},25);
  }catch(e){msg('Microphone is not available here ('+((e&&e.name)||'error')+'). Type your answer instead.')}
};

// ---------- game update ----------
function update(dt){
  T++;const ty=M[3][st.stage][0];st.t+=dt;
  if(Math.random()<.03&&fishes.length<8+Math.ceil(d/2))spawn();
  if(Math.random()<(ty==='pearl'?.018:.0015)&&pearls.length<(ty==='pearl'?4:1))pearls.push({x:60+Math.random()*(W-120),y:-20});
  if(ty==='rescue'&&baby.length<3&&Math.random()<.02)spawnBaby();
  if(ty==='golden'&&gold.length<1&&Math.random()<.05)spawnGold();
  if(M[2].includes('net')&&T%Math.max(90,200-d*5)===0){const l=Math.random()<.5,h=H*.6;nets.push({x:l?-40:W+40,y:Math.random()*(H-h),w:46,h,sp:(l?1:-1)*(1.6+d*.08)})}
  // player
  cur=M[2].includes('current')?Math.sin(T*.008)*(1.4+d*.12):0;
  const dx=pl.tx-pl.x;pl.x=clamp(pl.x+dx*.11+cur,0,W);pl.y=clamp(pl.y+(pl.ty-pl.y)*.11,pl.size*.6,H-pl.size*.6);
  if(Math.abs(dx)>3)pl.dir=dx>0?1:-1;pl.tail+=.2+Math.abs(dx)*.004;
  if(inv>0)inv--;if(shake>0)shake--;
  if(st.comboT>0){st.comboT-=dt;if(st.comboT<=0)st.combo=0}
  // fish
  for(let i=fishes.length-1;i>=0;i--){
    const f=fishes[i];f.x+=f.sp;f.y+=Math.sin(T*.03+f.ph)*.35;f.tail+=.12+Math.abs(f.sp)*.04;
    if(f.x<-f.size*4||f.x>W+f.size*4){fishes.splice(i,1);continue}
    if(near(f,pl,.62)){
      if(pl.size>f.size){
        fishes.splice(i,1);const pts=Math.round(f.size)*(1+Math.floor(st.combo/3));score+=pts;
        pl.size=Math.min(75,pl.size+f.size*.06);S.stats.fish++;st.combo=st.comboT>0?st.combo+1:1;st.comboT=3;
        if(ty==='eat')st.prog++;
        if(ty==='color'){if(f.ci===st.tc)st.prog++;else{st.prog=Math.max(0,st.prog-1);pop(f.x,f.y-20,'Wrong colour!','#ff9966')}}
        pop(f.x,f.y,'+'+pts,'#a8ff78');sfx.eat(f.size);
        for(let k=0;k<5;k++)bubbles.push({x:f.x,y:f.y,r:2+Math.random()*3,s:1+Math.random()*2,o:.7,t:1});
      }else hurt();
    }
  }
  // pearls
  for(let i=pearls.length-1;i>=0;i--){
    const p=pearls[i];p.y+=.9+(ty==='pearl'?d*.03:0);p.x+=Math.sin(T*.04+i)*.5;
    if(Math.hypot(p.x-pl.x,p.y-pl.y)<pl.size+14){pearls.splice(i,1);score+=50;if(ty==='pearl')st.prog++;if(lives<3&&Math.random()<.25){lives++;pop(p.x,p.y-24,'+1 heart','#ff8aa0')}pop(p.x,p.y,'+50','#fff');sfx.pearl()}
    else if(p.y>H+20)pearls.splice(i,1);
  }
  // hazards
  jel.forEach(j=>{j.y+=Math.sin(T*.02+j.ph)*.8;j.x+=Math.sin(T*.013+j.ph)*.7;j.x=clamp(j.x,0,W);if(Math.hypot(j.x-pl.x,j.y+j.r*.3-pl.y)<j.r*.9+pl.size*.5)hurt()});
  sharks.forEach(h=>{const a=Math.atan2(pl.y-h.y,pl.x-h.x);h.vx+=(Math.cos(a)*h.sp-h.vx)*.02;h.vy+=(Math.sin(a)*h.sp-h.vy)*.02;h.x+=h.vx;h.y+=h.vy;h.tail+=.12;if(near(h,pl,.55))hurt()});
  for(let i=nets.length-1;i>=0;i--){const n=nets[i];n.x+=n.sp;
    if(n.x<-80||n.x>W+80){nets.splice(i,1);continue}
    if(Math.abs(pl.x-n.x)<n.w/2+pl.size*.6&&pl.y>n.y-pl.size*.3&&pl.y<n.y+n.h+pl.size*.3)hurt()}
  // babies and golden fish
  for(let i=baby.length-1;i>=0;i--){const b=baby[i];b.x+=b.vx;b.y+=Math.sin(T*.05+i)*.5;b.tail+=.2;
    if(Math.hypot(b.x-pl.x,b.y-pl.y)<pl.size+16){baby.splice(i,1);if(ty==='rescue')st.prog++;score+=100;pop(b.x,b.y,'Saved! +100','#ff9ed8');sfx.pearl()}
    else if(b.x<-40||b.x>W+40)baby.splice(i,1)}
  for(let i=gold.length-1;i>=0;i--){const g=gold[i];g.life-=dt;g.tail+=.3;
    const ax=g.x-pl.x,ay=g.y-pl.y,dist=Math.hypot(ax,ay)||1,fl=dist<280?3+d*.1:.8;
    g.vx+=((dist<280?ax/dist:Math.cos(T*.02))*fl-g.vx)*.1;g.vy+=((dist<280?ay/dist:Math.sin(T*.02))*fl-g.vy)*.1;
    g.x=clamp(g.x+g.vx,20,W-20);g.y=clamp(g.y+g.vy,30,H-40);
    if(Math.hypot(g.x-pl.x,g.y-pl.y)<(g.size+pl.size)*.7){gold.splice(i,1);if(ty==='golden')st.prog++;score+=300;pop(g.x,g.y,'Golden! +300','#ffd54a');sfx.pearl()}
    else if(g.life<=0)gold.splice(i,1)}
  pops.forEach(p=>{p.y-=.8;p.l--});pops=pops.filter(p=>p.l>0);
  hud();if(mode==='play'&&cp()>=st.need)nextStage();
}

// ---------- drawing ----------
function draw(){
  ctx.clearRect(0,0,W,H);ctx.save();
  if(shake>0)ctx.translate((Math.random()-.5)*8,(Math.random()-.5)*8);
  const playing=mode==='play'||mode==='pause';
  if(playing&&cur){ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=2;for(let k=0;k<14;k++){const x=((k*137+T*cur*7)%W+W)%W,y=(k*71)%H;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+cur*22,y);ctx.stroke()}}
  for(let i=bubbles.length-1;i>=0;i--){
    const b=bubbles[i];if(mode!=='pause')b.y-=b.s;
    if(b.t){b.o-=.02;if(b.o<=0){bubbles.splice(i,1);continue}}else if(b.y<-10){b.y=H+10;b.x=Math.random()*W}
    ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,7);ctx.fillStyle='rgba(0,242,254,'+b.o+')';ctx.fill();ctx.strokeStyle='rgba(255,255,255,.5)';ctx.stroke();
  }
  const ring=playing&&M[3][st.stage][0]==='color'?st.tc:-1;
  fishes.forEach(f=>{
    const danger=playing&&f.size>=pl.size;
    fish(f.x,f.y,f.size,f.sp>0?1:-1,danger?['#ff8a8a','#b00020']:f.kind==='shark'?['#cfd9e3','#5b6f86']:f.c,f.tail,danger?'#ff2b2b':playing?'#7dffa0':null,1,f.kind);
    if(f.ci===ring){ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(f.x,f.y,f.size*1.25,0,7);ctx.stroke()}
  });
  pearls.forEach(p=>{const g=ctx.createRadialGradient(p.x-3,p.y-3,1,p.x,p.y,11);g.addColorStop(0,'#fff');g.addColorStop(1,'#bfe6ff');
    ctx.shadowColor='#fff';ctx.shadowBlur=14;ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y,10,0,7);ctx.fill();ctx.shadowBlur=0});
  jel.forEach(jelly);
  gold.forEach(g=>fish(g.x,g.y,g.size,g.vx>0?1:-1,['#fff6a0','#ffb300'],g.tail,'#ffd54a',1,'tri'));
  baby.forEach(b=>{fish(b.x,b.y,b.size,b.vx>0?1:-1,['#d8f8ff','#6bd6ff'],b.tail,'#fff');ctx.font='16px sans-serif';ctx.textAlign='center';ctx.fillText('💗',b.x,b.y-18)});
  sharks.forEach(h=>fish(h.x,h.y,h.size,h.vx>0?1:-1,['#c4d2e0','#4b5d73'],h.tail,'#ff2b2b',1,'shark'));
  nets.forEach(n=>{ctx.strokeStyle='rgba(255,230,160,.85)';ctx.lineWidth=2;ctx.fillStyle='rgba(255,230,160,.12)';ctx.fillRect(n.x-n.w/2,n.y,n.w,n.h);
    ctx.beginPath();for(let y=n.y;y<=n.y+n.h;y+=16){ctx.moveTo(n.x-n.w/2,y);ctx.lineTo(n.x+n.w/2,y)}for(let k=0;k<=3;k++){ctx.moveTo(n.x-n.w/2+k*n.w/3,n.y);ctx.lineTo(n.x-n.w/2+k*n.w/3,n.y+n.h)}ctx.stroke()});
  if(playing)fish(pl.x,pl.y,pl.size,pl.dir,['#ffe36b','#ff8a00'],pl.tail,'#ffd54a',inv>0&&Math.floor(inv/6)%2?.35:1);
  if(playing&&M[2].includes('dark')){const g=ctx.createRadialGradient(pl.x,pl.y,50,pl.x,pl.y,270);g.addColorStop(0,'rgba(0,4,14,0)');g.addColorStop(1,'rgba(0,4,14,.94)');ctx.fillStyle=g;ctx.fillRect(-10,-10,W+20,H+20)}
  ctx.font='700 18px Fredoka,sans-serif';ctx.textAlign='center';
  pops.forEach(p=>{ctx.globalAlpha=p.l/50;ctx.fillStyle=p.col;ctx.fillText(p.t,p.x,p.y)});ctx.globalAlpha=1;ctx.restore();
}

let last=performance.now();
function loop(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  if(mode==='play')update(dt);
  else if(mode==='menu'||mode==='home'){T++;if(Math.random()<.03&&fishes.length<12)spawn();fishes.forEach(f=>{f.x+=f.sp;f.tail+=.15});fishes=fishes.filter(f=>f.x>-f.size*4&&f.x<W+f.size*4)}
  if(GS)gateFrame(dt);draw();requestAnimationFrame(loop);
}
show('menu');requestAnimationFrame(loop);

let pr=0;const iv=setInterval(()=>{pr=Math.min(100,pr+Math.floor(Math.random()*8)+3);$('lp').style.width=pr+'%';$('lt').textContent='Loading ocean… '+pr+'%';
  if(pr===100){clearInterval(iv);setTimeout(()=>{$('loader').style.opacity=0;$('loader').style.visibility='hidden'},400)}},70);
