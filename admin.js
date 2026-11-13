
const $=id=>document.getElementById(id);
let auth=null,db=null,currentAdmin=null;
const configured=window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey && !window.FIREBASE_CONFIG.apiKey.startsWith('PASTE_') && window.FIREBASE_CONFIG.projectId && !window.FIREBASE_CONFIG.projectId.startsWith('YOUR_');
if(configured){try{firebase.initializeApp(window.FIREBASE_CONFIG);auth=firebase.auth();db=firebase.firestore()}catch(e){$('loginMessage').textContent='Firebase setup error: '+e.message}}
else $('loginMessage').textContent='Complete Firebase settings in config.js first.';
$('loginForm').addEventListener('submit',async e=>{
 e.preventDefault();
 if(!auth){$('loginMessage').textContent='Firebase is not configured. See README.txt.';return}
 if($('adminPassword').value!==window.HAPPY_FISH_ADMIN_PASSWORD){$('loginMessage').textContent='Incorrect admin password.';return}
 $('loginMessage').textContent='Opening Google sign-in…';
 const provider=new firebase.auth.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
 try{
  const result=await auth.signInWithPopup(provider);
  if((result.user.email||'').toLowerCase()!==(window.HAPPY_FISH_ADMIN_EMAIL||'').toLowerCase())throw new Error('This Google account is not the configured administrator account.');
  currentAdmin=result.user;$('loginPanel').hidden=true;$('dashboard').hidden=false;await loadPlayers();
 }catch(err){$('loginMessage').textContent=err.message;if(auth.currentUser)await auth.signOut()}
});
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function loadPlayers(){
 $('status').textContent='Loading player accounts…';
 try{
  const snap=await db.collection('users').get(),users=snap.docs.map(d=>({id:d.id,...d.data()})).filter(u=>u.profile);
  $('status').textContent=users.length+' player account(s)';
  $('players').innerHTML=users.length?users.map(u=>{const p=u.profile||{};return `<tr><td><b>${esc(p.name||'Player')}</b><small>${esc(u.id.slice(0,12))}…</small></td><td>${esc(u.email||p.email||'')}</td><td>${Number(p.unlocked)||1} / 15</td><td>🪙 ${(Number(p.coins)||0).toLocaleString()} / 💎 ${(Number(p.gems)||0).toLocaleString()}</td><td><div class="actions"><select id="m-${esc(u.id)}">${Array.from({length:15},(_,i)=>`<option value="${i+1}" ${i+1===(Number(p.unlocked)||1)?'selected':''}>Mission ${i+1}</option>`).join('')}</select><button data-id="${esc(u.id)}" class="unlock">Unlock</button><button data-id="${esc(u.id)}" class="all">All 15</button></div></td></tr>`}).join(''):'<tr><td colspan="5" class="empty">No player accounts found yet.</td></tr>';
 }catch(err){$('status').textContent='Could not load players: '+err.message}
}
$('players').addEventListener('click',async e=>{
 const id=e.target.dataset.id;if(!id||!currentAdmin)return;
 try{const ref=db.collection('users').doc(id),snap=await ref.get();if(!snap.exists)throw new Error('Player not found');
  const data=snap.data(),p=data.profile||{};
  if(e.target.classList.contains('unlock'))p.unlocked=Math.max(Number(p.unlocked)||1,Number($('m-'+id).value));
  else if(e.target.classList.contains('all'))p.unlocked=15;else return;
  await ref.set({profile:p,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
  $('status').textContent='Mission access updated.';await loadPlayers();
 }catch(err){$('status').textContent='Update failed: '+err.message}
});
function logout(){if(auth)auth.signOut();currentAdmin=null;$('dashboard').hidden=true;$('loginPanel').hidden=false}
$('refresh').onclick=loadPlayers;$('logout').onclick=logout;
