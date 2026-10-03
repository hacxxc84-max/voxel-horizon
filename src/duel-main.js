import { ArenaWorld,MAPS,mapById } from './arenas.js';
import { Player,movementAction,collides } from './physics.js';
import { castVoxel } from './world.js';
import { Storage } from './storage.js';
import { WEAPONS,COLORS,SKINS,normalizeProfile } from './weapons.js';
import { Network } from './network.js';
import { DuelView } from './duel-view.js';
import { Sound } from './audio.js';

const $=id=>document.getElementById(id),canvas=$('game'),network=new Network(),sound=new Sound();
let backend;try{backend=localStorage;}catch{backend={getItem:()=>null,setItem:()=>{}};}
const storage=new Storage(backend);let settings=storage.settings(),profile;try{profile=normalizeProfile(JSON.parse(backend.getItem('horizon-duel-profile')||'{}'));}catch{profile=normalizeProfile();}
let view,world,player,state=null,me=null,selectedMap='foundry',slot=0,mode='loading',overlay=null,settingsReturn=null,serverInfo={};
const input={forward:false,backward:false,left:false,right:false,jump:false,sprint:false,fire:false};
let aim=false,sequence=0,lastSend=0,lastFrame=performance.now(),accumulator=0,lastSpawn=-1,lastAck=-1,history=new Map(),lastPredictedShot=-100,toastTimer,hitTimer,damageTimer;
let mouseDrag=false,lastMouse=null,dragDistance=0,pendingButton=null,fallback=false,statsElapsed=0,statsFrames=0,hudFrame=0,lastWalk=0;
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4200);}
function fatal(error){console.error(error);resetInput();mode='error';$('error-message').textContent=error.message||'Le rendu 3D n’est pas disponible.';$('error').hidden=false;}
function resetInput(){for(const key in input)input[key]=false;aim=false;mouseDrag=false;lastMouse=null;pendingButton=null;dragDistance=0;sendInput(true);}
function profileSave(){try{backend.setItem('horizon-duel-profile',JSON.stringify(profile));}catch{}$('profile-name').textContent=profile.name;view?.setProfile(profile);}
function selectMap(id){selectedMap=mapById(id).id;for(const button of $('map-cards').children){const selected=button.dataset.map===selectedMap;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));}if(!network.room&&view)loadArena(selectedMap);}
function loadArena(id){world=new ArenaWorld(id).generate();view.loadWorld(world);selectedMap=world.map.id;for(const button of $('map-cards').children)button.classList.toggle('active',button.dataset.map===selectedMap);$('hud-map').textContent=world.map.name.toUpperCase();}
const weaponIcons=[
  '<path d="M4 13h53v-3h22v4h16v4H53l-5 7H35l4-8H23l-3 9h-7l2-9H4Z"/><path d="M51 19h13l-3 11h-9Z"/>',
  '<path d="M25 7h48v10H46l-4 14H28l4-14h-7Z"/><path d="M52 19h10v4H49Z"/>',
  '<path d="m9 21 29-4 2 9-29 5Z"/><path d="m39 15 47-9-9 13-37 9Z"/>',
  '<path d="m32 4 21 11-21 11-21-11Z"/><path d="m11 17 19 10v10L11 27Zm23 10 19-10v10L34 37Z"/>'
];
function buildUi(){
  for(const map of MAPS){const button=document.createElement('button');button.className='map-card';button.dataset.map=map.id;button.setAttribute('aria-label',map.name);button.title=map.description;const strong=document.createElement('strong');strong.textContent=map.name;const span=document.createElement('span');span.textContent=map.tagline;const small=document.createElement('small');small.textContent=map.icon;button.append(strong,span,small);button.addEventListener('click',()=>selectMap(map.id));$('map-cards').append(button);const option=document.createElement('option');option.value=map.id;option.textContent=map.name;$('lobby-map').append(option);}
  for(const weapon of WEAPONS){const button=document.createElement('button');button.className='slot';button.setAttribute('aria-label',weapon.name+' (touche '+(weapon.slot+1)+')');button.innerHTML='<small>'+(weapon.slot+1)+'</small><svg viewBox="0 0 100 40" fill="currentColor" aria-hidden="true">'+weaponIcons[weapon.slot]+'</svg><span>'+weapon.name+'</span>';button.addEventListener('click',()=>switchWeapon(weapon.slot));$('loadout').append(button);}
  for(const [id,colors,key] of [['colors',COLORS,'color'],['skins',SKINS,'skin']])colors.forEach((color,index)=>{const button=document.createElement('button');button.className='swatch';button.style.background=color;button.dataset.color=color;button.setAttribute('aria-label',(key==='color'?'Tenue ':'Teint ')+(index+1));button.addEventListener('click',()=>{profile={...profile,[key]:color};profileSave();syncProfile();});$(id).append(button);});
  syncProfile();syncSettings();selectMap(selectedMap);updateSlots();
}
function syncProfile(){ $('nickname').value=profile.name;$('helmet').value=profile.helmet;for(const [id,key] of [['colors','color'],['skins','skin']])for(const button of $(id).children){const active=button.dataset.color===profile[key];button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}profileSave(); }
function updateSlots(){for(let i=0;i<$('loadout').children.length;i++){const button=$('loadout').children[i];button.classList.toggle('active',i===slot);button.setAttribute('aria-pressed',String(i===slot));}if(view)view.rig.setSlot(slot);}
function switchWeapon(index){if(!me||index<0||index>3)return;slot=index;input.fire=false;aim=false;network.send({type:'switch',slot});sendInput(true);updateSlots();canvas.focus({preventScroll:true});updateHud();}
function sendInput(force=false){
  if(!network.room||!player)return;const now=performance.now();if(!force&&now-lastSend<32)return;lastSend=now;
  const active=mode==='playing'&&!overlay&&state?.phase==='playing';
  const message={type:'input',seq:++sequence,yaw:player.yaw,pitch:player.pitch,...(active?input:Object.fromEntries(Object.keys(input).map(key=>[key,false])))};
  if(network.send(message)){history.set(sequence,{...player.position});while(history.size>150)history.delete(history.keys().next().value);}
}
function requestLock(){
  if(!settings.captureMouse||fallback)return;
  try{const result=canvas.requestPointerLock?.();if(!canvas.requestPointerLock){fallback=true;return;}result?.catch(()=>{fallback=true;toast('Capture indisponible : glisse pour regarder, clique pour tirer.');});}catch{fallback=true;}
}
function startCombat(){
  $('home').hidden=true;$('lobby').hidden=true;$('result').hidden=true;$('pause').hidden=true;$('hud').hidden=false;$('pause-button').hidden=false;overlay=null;mode='playing';document.body.classList.add('playing');resetInput();canvas.focus({preventScroll:true});sound.unlock();
  if(settings.captureMouse&&!fallback)toast('Clique dans l’arène pour capturer la souris. ZQSD pour te déplacer.');
}
function pause(){if(mode!=='playing'||overlay)return;overlay='pause';resetInput();$('pause').hidden=false;$('help').hidden=true;if(document.pointerLockElement)document.exitPointerLock();}
function resume(){overlay=null;$('pause').hidden=true;$('settings').hidden=true;resetInput();canvas.focus({preventScroll:true});sound.unlock();requestLock();}
function leave(){resetInput();network.close();state=null;me=null;player=null;lastSpawn=-1;lastAck=-1;history.clear();sequence=0;overlay=null;mode='home';if(document.pointerLockElement)document.exitPointerLock();for(const id of ['lobby','pause','result','hud','settings'])$(id).hidden=true;$('home').hidden=false;$('pause-button').hidden=true;document.body.classList.remove('playing');view.setAvatars([],null,0);loadArena(selectedMap);$('create').disabled=$('join').disabled=false;}
function renderLobby(){
  if(!state)return;$('copy-code').textContent=network.room;$('lobby-map').value=state.map;$('lobby-map').disabled=state.host!==network.id;
  $('lobby-players').replaceChildren();
  for(let index=0;index<2;index++){const p=state.players.find(q=>q.slot===index),card=document.createElement('div');card.className='player-card'+(p?.ready?' ready':'');const dot=document.createElement('span');dot.className='player-dot';dot.style.background=p?.profile.color||'#3b535a';const strong=document.createElement('strong');strong.textContent=p?p.profile.name+(p.id===network.id?' · toi':''):'Place disponible';const status=document.createElement('p');status.textContent=p?(p.ready?'✓ Prêt pour le duel':'En préparation…'):'Partage le code pour inviter un ami.';card.append(dot,strong,status);$('lobby-players').append(card);}
  const own=state.players.find(p=>p.id===network.id);$('ready').textContent=own?.ready?'Prêt · en attente de l’adversaire':'Je suis prêt ✓';$('ready').disabled=Boolean(own?.ready);$('lobby-status').textContent=state.players.length<2?'En attente d’un adversaire…':'Vous êtes deux. Chaque joueur doit se déclarer prêt.';
}
function handleState(next){
  if(!network.room)return;const previousPhase=state?.phase;state=next;const own=state.players.find(p=>p.id===network.id);if(!own)return;me=own;
  if(world.map.id!==state.map){loadArena(state.map);history.clear();lastSpawn=-1;}
  if(!player||own.spawn!==lastSpawn){player=new Player({x:own.x,y:own.y,z:own.z});player.yaw=own.yaw;player.pitch=own.pitch;player.velocityY=own.velocityY;slot=own.weapon;lastSpawn=own.spawn;lastAck=-1;history.clear();resetInput();updateSlots();}
  else if(own.ack!==lastAck&&history.has(own.ack)){
    const predicted=history.get(own.ack),delta={x:own.x-predicted.x,y:own.y-predicted.y,z:own.z-predicted.z};
    if(Math.hypot(delta.x,delta.y,delta.z)>2){Object.assign(player.position,{x:own.x,y:own.y,z:own.z});player.velocityY=own.velocityY;history.clear();}
    else{for(const axis of ['x','y','z']){const correction=delta[axis]*.7;player.position[axis]+=correction;for(const [seq,position] of history)if(seq>own.ack)position[axis]+=correction;}for(const seq of history.keys())if(seq<=own.ack)history.delete(seq);}
    if(collides(world,player.position)){Object.assign(player.position,{x:own.x,y:own.y,z:own.z});player.velocityY=own.velocityY;history.clear();}
    lastAck=own.ack;
  }
  if(state.phase==='waiting'){
    if(mode==='playing'){resetInput();if(document.pointerLockElement)document.exitPointerLock();}
    mode='lobby';overlay=null;$('lobby').hidden=false;$('hud').hidden=true;$('pause').hidden=true;$('result').hidden=true;$('pause-button').hidden=true;document.body.classList.remove('playing');view.menuCamera();renderLobby();
  }else if(state.phase==='matchEnd'){
    if(document.pointerLockElement)document.exitPointerLock();overlay='result';mode='playing';resetInput();$('pause').hidden=true;$('result').hidden=false;const enemy=state.players.find(p=>p.id!==network.id);$('result-title').textContent=own.score>=5?'Victoire.':'Bien joué.';$('result-score').textContent=own.score+' — '+(enemy?.score||0)+' · '+(own.score>=5?'L’horizon est à toi.':'Un nouveau duel t’attend.');$('rematch').textContent=own.ready?'En attente de l’adversaire…':'Prêt pour la revanche ↗';$('rematch').disabled=own.ready;
  }else if(mode==='lobby'||previousPhase==='matchEnd')startCombat();
  updateHud();
}
network.on('welcome',message=>{
  loadArena(message.map);world.resetCover();for(const block of message.covers)world.putCover(block.x,block.y,block.z,block.owner);view.updateWorld(world);$('home').hidden=true;mode='lobby';lastSpawn=-1;handleState({...message.state,host:message.host,code:message.code});toast('Salon '+message.code+' · partage le code avec ton adversaire.');
});
network.on('state',handleState);
network.on('error',message=>{toast(message.message);$('create').disabled=$('join').disabled=false;});
network.on('disconnect',()=>{if(mode!=='home'&&mode!=='loading'){leave();toast('Connexion interrompue. Le salon a été quitté.');}});
network.on('event',({event})=>{
  if(event.kind==='block'){world.set(event.x,event.y,event.z,event.id);view.updateWorld(world);if(event.id===3)sound.play('place');}
  if(event.kind==='reset'){world.resetCover();world.data.set(world.base);world.changes.clear();for(let x=0;x<3;x++)for(let z=0;z<3;z++)world.dirty.add([x,0,z].join(','));view.updateWorld(world);}
  if(event.kind==='shot'){if(event.player!==network.id||performance.now()-lastPredictedShot>85)view.shot(event,network.id);sound.gun(event.weapon);}
  if(event.kind==='hit'){
    if(event.player===network.id){$('hitmarker').hidden=false;$('hitmarker').classList.toggle('head',event.head);clearTimeout(hitTimer);hitTimer=setTimeout(()=>$('hitmarker').hidden=true,180);}
    if(event.victim===network.id){$('damage-flash').style.opacity='1';clearTimeout(damageTimer);damageTimer=setTimeout(()=>$('damage-flash').style.opacity='0',240);}
  }
  if(event.kind==='kill'){const winner=state?.players.find(p=>p.id===event.player);$('killfeed').textContent=(winner?.profile.name||'Opérateur')+' · '+WEAPONS[event.weapon].name+(event.head?' · tir à la tête':'');setTimeout(()=>$('killfeed').textContent='',3500);}
  if(event.kind==='notice'&&event.player===network.id)toast(event.text);
});

function updateHud(){
  if(!me||!state)return;const enemy=state.players.find(p=>p.id!==network.id),w=WEAPONS[slot],ammo=me.ammo[slot];
  $('self-name').textContent=me.profile.name;$('enemy-name').textContent=enemy?.profile.name||'Adversaire';$('self-score').textContent=me.score;$('enemy-score').textContent=enemy?.score||0;$('round-label').textContent='MANCHE '+state.round;
  $('health-value').textContent=me.health;$('health-fill').style.width=me.health+'%';$('health-fill').style.background=me.health>35?'#b9efa9':'#ee937f';$('enemy-health-value').textContent=(enemy?.health||0)+' PV';$('enemy-health-fill').style.width=(enemy?.health||0)+'%';$('enemy-health-label').textContent=enemy?.profile.name.toUpperCase()||'ADVERSAIRE';
  $('weapon-name').textContent=w.name.toUpperCase();$('ammo').textContent=slot<2?ammo.mag:slot===3?me.blocks:'∞';$('reserve').textContent=slot<2?'/ '+ammo.reserve:slot===3?'/ 24':'';$('reload-label').textContent=me.reload>0?'RECHARGEMENT · '+me.reload.toFixed(1)+' s':slot<2?'R · RECHARGER':slot===3?'CLIC DROIT · POSER':'COMBAT RAPPROCHÉ';
  $('motion-state').textContent=me.health===0?'ÉLIMINÉ':input.sprint&&(input.forward||input.backward||input.left||input.right)?'SPRINT · ARME ABAISSÉE':me.moving?'EN MOUVEMENT':'PRÊT AU COMBAT';$('hud-room').textContent='SALON '+network.room;$('ping').textContent=network.rtt+' ms';
  const show=['countdown','roundEnd'].includes(state.phase);$('match-banner').hidden=!show;
  if(state.phase==='countdown'){$('match-title').textContent=Math.max(1,Math.ceil(state.remaining));$('match-detail').textContent='Manche '+state.round+' · prépare ton angle.';}
  if(state.phase==='roundEnd'){$('match-title').textContent=me.health>0?'Manche remportée.':'Manche perdue.';$('match-detail').textContent='Nouvelle manche dans '+Math.max(1,Math.ceil(state.remaining))+' s';}
  $('crosshair').classList.toggle('aim',aim);updateSlots();
}
function fire(button){
  if(mode!=='playing'||overlay||state?.phase!=='playing'||me.health<=0)return;const look={yaw:player.yaw,pitch:player.pitch};
  if(slot===3){network.send({type:button===2?'place':'remove',...look});return;}
  if(input.sprint&&(input.forward||input.backward||input.left||input.right))return;
  if(button===2){aim=true;return;}
  if(button===0){input.fire=true;network.send({type:'fire',...look});if(!me.reload&&me.ammo[slot].mag>0||slot===2){view.rig.fire();lastPredictedShot=performance.now();}sendInput(true);}
}
function frame(now){
  requestAnimationFrame(frame);if(!view||mode==='error')return;const dt=Math.max(0,Math.min(.05,(now-lastFrame)/1000));lastFrame=now;
  if(mode==='playing'&&player&&me){
    const active=!overlay&&state.phase==='playing'&&me.health>0;accumulator=Math.min(accumulator+dt,.1);
    while(accumulator>=1/120){if(active)player.step(world,input,1/120);accumulator-=1/120;}
    const moving=active&&(input.forward||input.backward||input.left||input.right);if(moving&&input.sprint)aim=false;view.setPlayer(player,{...me,weapon:slot,moving,sprint:moving&&input.sprint,aim},dt);view.setAvatars(state.players,network.id,dt);
    const target=slot===3?castVoxel(world,player.eye,player.direction,5.5):null;view.setTarget(target);$('target-label').textContent=target?'Pierre · protection':'';sendInput();
    if(player.grounded&&player.distanceWalked-lastWalk>.95){sound.play('step');lastWalk=player.distanceWalked;}if(++hudFrame%10===0)updateHud();
  }else{view.showWeapon=false;view.setTarget(null);}
  view.render(dt,{menu:mode==='home'||mode==='lobby',preview:mode==='home'||overlay==='profile'});statsElapsed+=dt;statsFrames++;if(statsElapsed>=1){$('fps').textContent=Math.round(statsFrames/statsElapsed)+' FPS';statsElapsed=0;statsFrames=0;}
}
function syncSettings(){for(const id of ['sensitivity','quality','distance'])$(id).value=settings[id];$('volume').value=Math.round(settings.volume*100);$('capture-mouse').checked=settings.captureMouse;$('sensitivity-value').value=settings.sensitivity.toFixed(1);$('volume-value').value=Math.round(settings.volume*100)+' %';sound.volume=settings.volume;}
function updateSettings(){settings={...settings,sensitivity:Number($('sensitivity').value),volume:Number($('volume').value)/100,quality:$('quality').value,distance:Number($('distance').value),captureMouse:$('capture-mouse').checked};storage.writeSettings(settings);view.applySettings(settings);syncSettings();fallback=!settings.captureMouse;}
function openSettings(){settingsReturn=overlay;overlay='settings';resetInput();$('settings').hidden=false;syncSettings();}
function customize(){overlay='profile';$('profile').hidden=false;syncProfile();}
async function connectRoom(type){
  const code=$('join-code').value.trim().toUpperCase();if(type==='join'&&!/^[A-Z2-9]{6}$/.test(code)){toast('Saisis le code de salon à 6 caractères.');return;}
  $('create').disabled=$('join').disabled=true;
  try{sound.unlock();await network.connect();network.send(type==='create'?{type,map:selectedMap,profile}:{type,code,profile});}catch(error){toast(error.message);$('create').disabled=$('join').disabled=false;}
}
async function copy(text){try{await navigator.clipboard.writeText(text);toast('Invitation copiée.');}catch{toast(text);}}

$('create').addEventListener('click',()=>connectRoom('create'));$('join').addEventListener('click',()=>connectRoom('join'));$('join-code').addEventListener('keydown',event=>{if(event.key==='Enter')connectRoom('join');});
$('customize').addEventListener('click',customize);$('customize-card').addEventListener('click',customize);$('profile-close').addEventListener('click',()=>{profile=normalizeProfile({...profile,name:$('nickname').value,helmet:$('helmet').value});profileSave();$('profile').hidden=true;overlay=null;});$('helmet').addEventListener('change',()=>{profile={...profile,helmet:$('helmet').value};profileSave();});
$('nickname').addEventListener('input',()=>{profile={...profile,name:$('nickname').value};profileSave();});
$('ready').addEventListener('click',()=>network.send({type:'ready',value:true}));$('lobby-map').addEventListener('change',()=>network.send({type:'map',map:$('lobby-map').value}));
$('copy-code').addEventListener('click',()=>copy(network.room));$('invite').addEventListener('click',()=>{const local=['localhost','127.0.0.1'].includes(location.hostname);const origin=serverInfo.publicUrl||(local?serverInfo.addresses?.[0]:null)||location.origin;copy(origin+'/?room='+network.room);});
for(const id of ['leave-lobby','leave-game','result-leave'])$(id).addEventListener('click',leave);$('rematch').addEventListener('click',()=>network.send({type:'ready',value:true}));
$('pause-button').addEventListener('click',pause);$('continue').addEventListener('click',resume);$('home-settings').addEventListener('click',openSettings);$('pause-settings').addEventListener('click',openSettings);$('settings-close').addEventListener('click',()=>{updateSettings();$('settings').hidden=true;overlay=settingsReturn;});
for(const id of ['sensitivity','volume','quality','distance','capture-mouse'])$(id).addEventListener('input',updateSettings);
$('network-help').addEventListener('click',()=>{$('network-modal').hidden=false;});$('network-close').addEventListener('click',()=>$('network-modal').hidden=true);$('reload').addEventListener('click',()=>location.reload());
window.addEventListener('keydown',event=>{
  if(event.key==='Escape'){if(overlay==='pause')resume();else if(mode==='playing')pause();return;}
  if(mode!=='playing'||overlay)return;const action=movementAction(event);if(action){input[action]=true;event.preventDefault();sendInput(true);}
  if(event.repeat)return;if(/^Digit[1-4]$/.test(event.code))switchWeapon(Number(event.code.slice(5))-1);
  if(event.key.toLowerCase()==='r')network.send({type:'reload'});if(event.key.toLowerCase()==='h')$('help').hidden=!$('help').hidden;if(event.key.toLowerCase()==='v')fire(0);
});
window.addEventListener('keyup',event=>{const action=movementAction(event);if(action){input[action]=false;sendInput(true);}if(event.key?.toLowerCase()==='v'){input.fire=false;sendInput(true);}});
window.addEventListener('blur',()=>{resetInput();if(mode==='playing'&&!overlay)pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){resetInput();if(mode==='playing'&&!overlay)pause();}});window.addEventListener('pagehide',()=>network.close());
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement!==canvas&&mode==='playing'&&!overlay)pause();});document.addEventListener('pointerlockerror',()=>{fallback=true;toast('Glisse pour regarder, clique pour tirer.');});
canvas.addEventListener('contextmenu',event=>event.preventDefault());
canvas.addEventListener('mousedown',event=>{
  if(mode!=='playing'||overlay)return;event.preventDefault();sound.unlock();
  if(settings.captureMouse&&!fallback&&document.pointerLockElement!==canvas){requestLock();return;}
  if(document.pointerLockElement!==canvas){mouseDrag=true;lastMouse={x:event.clientX,y:event.clientY};dragDistance=0;pendingButton=event.button;return;}
  fire(event.button);
});
window.addEventListener('mousemove',event=>{if(mode!=='playing'||overlay||!player)return;if(document.pointerLockElement===canvas)player.look(event.movementX,event.movementY,settings.sensitivity);else if(mouseDrag&&lastMouse){const dx=event.clientX-lastMouse.x,dy=event.clientY-lastMouse.y;dragDistance+=Math.hypot(dx,dy);player.look(dx,dy,settings.sensitivity);lastMouse={x:event.clientX,y:event.clientY};}});
window.addEventListener('mouseup',()=>{const button=pendingButton,moved=dragDistance;mouseDrag=false;lastMouse=null;pendingButton=null;dragDistance=0;if(button!==null&&moved<5)fire(button);input.fire=false;aim=false;sendInput(true);});
canvas.addEventListener('wheel',event=>{if(mode==='playing'&&!overlay){event.preventDefault();switchWeapon((slot+(event.deltaY>0?1:3))%4);}},{passive:false});
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();network.close();fatal(new Error('Le rendu graphique a été interrompu. Recharge la page pour reprendre.'));});

async function init(){
  try{
    view=new DuelView(canvas,$('avatar-preview'),settings,profile);buildUi();loadArena(selectedMap);fallback=!settings.captureMouse;mode='home';$('loading').hidden=true;$('create').disabled=$('join').disabled=false;requestAnimationFrame(frame);
    const code=new URLSearchParams(location.search).get('room');if(code)$('join-code').value=code.slice(0,6).toUpperCase();
    try{const response=await fetch('/__voxel_health');serverInfo=await response.json();$('server-label').textContent=['localhost','127.0.0.1'].includes(location.hostname)?'SERVEUR LOCAL / 1V1':'SERVEUR PARTAGÉ / 1V1';for(const address of serverInfo.addresses||[]){const a=document.createElement('a');a.href=address;a.textContent=address;$('lan-addresses').append(a,document.createElement('br'));}if(!['localhost','127.0.0.1'].includes(location.hostname))$('public-status').textContent='Utilise cette adresse de serveur pour inviter ton adversaire : '+location.origin;}catch{}
  }catch(error){fatal(error);}
}
init();
