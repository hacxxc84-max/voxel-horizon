import { ArenaWorld, mapById } from './arenas.js';
import { Player, overlapsBlock } from './physics.js';
import { castVoxel, blockIndex } from './world.js';
import { WEAPONS, normalizeProfile, hitPlayer } from './weapons.js';

const emptyInput=()=>({forward:false,backward:false,left:false,right:false,jump:false,sprint:false,fire:false});
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export class DuelGame {
  constructor(mapId='foundry') {
    this.world=new ArenaWorld(mapId).generate(); this.players=[]; this.time=0; this.phase='waiting'; this.remaining=0; this.round=1; this.events=[]; this.eventId=0; this.revision=0;
  }
  emit(kind,data={}) { this.events.push({id:++this.eventId,kind,...data}); if(this.events.length>160)this.events.shift(); }
  addPlayer(id,profile) {
    if(this.players.length>=2||this.players.some(p=>p.id===id))throw new Error('Ce salon est complet (2 joueurs maximum).');
    const used=new Set(this.players.map(p=>p.slot)),slot=used.has(0)?1:0,spawn=this.world.spawn(slot),body=new Player(spawn);body.yaw=spawn.yaw;body.pitch=0;
    const player={id,slot,profile:normalizeProfile(profile),body,input:emptyInput(),health:100,score:0,ready:false,weapon:0,ammo:WEAPONS.map(w=>({mag:w.magazine,reserve:w.reserve})),lastShot:-100,reloadAt:0,reloadWeapon:-1,pendingFire:false,lastInput:this.time,lastSeq:-1,spawn:0};
    this.players.push(player);this.emit('joined',{player:id});return player;
  }
  removePlayer(id) {
    this.players=this.players.filter(p=>p.id!==id);this.phase='waiting';this.remaining=0;this.resetRound();for(const p of this.players){p.ready=false;p.score=0;}this.emit('left',{player:id});
  }
  setMap(id) {
    if(!['waiting','matchEnd'].includes(this.phase))return false;
    this.world=new ArenaWorld(mapById(id).id).generate();this.phase='waiting';this.round=1;this.revision++;this.resetRound();for(const p of this.players){p.ready=false;p.score=0;}this.emit('map',{map:this.world.map.id});return true;
  }
  resetRound() {
    this.world.resetCover();this.revision++;
    for(const p of this.players){const spawn=this.world.spawn(p.slot);p.body=new Player(spawn);p.body.yaw=spawn.yaw;p.body.pitch=0;p.health=100;p.weapon=0;p.ammo=WEAPONS.map(w=>({mag:w.magazine,reserve:w.reserve}));p.input=emptyInput();p.pendingFire=false;p.reloadAt=0;p.reloadWeapon=-1;p.lastShot=-100;p.lastInput=this.time;p.spawn++;}
    this.emit('reset',{revision:this.revision,map:this.world.map.id});
  }
  setReady(id,value=true) {
    const p=this.players.find(p=>p.id===id);if(!p||!['waiting','matchEnd'].includes(this.phase))return;
    p.ready=Boolean(value);
    if(this.players.length===2&&this.players.every(p=>p.ready)){
      if(this.phase==='matchEnd')for(const q of this.players)q.score=0;
      this.round=1;this.resetRound();this.phase='countdown';this.remaining=3;this.emit('countdown',{round:this.round});
    }
  }
  look(p,data) { if(finite(data.yaw)&&Math.abs(data.yaw)<100000)p.body.yaw=((data.yaw+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;if(finite(data.pitch))p.body.pitch=Math.max(-1.53,Math.min(1.53,data.pitch)); }
  command(id,message) {
    const p=this.players.find(p=>p.id===id);if(!p||!message||typeof message!=='object')return;
    if(message.type==='ready'){this.setReady(id,message.value!==false);return;}
    if(message.type==='profile'&&this.phase==='waiting'){p.profile=normalizeProfile(message.profile);return;}
    if(message.type==='input'){
      if(!Number.isInteger(message.seq)||message.seq<=p.lastSeq||message.seq>2147483647)return;
      p.lastSeq=message.seq;p.lastInput=this.time;this.look(p,message);
      for(const key of Object.keys(p.input))p.input[key]=message[key]===true;return;
    }
    if(message.type==='switch'){
      if(Number.isInteger(message.slot)&&message.slot>=0&&message.slot<4&&message.slot!==p.weapon){p.weapon=message.slot;p.reloadAt=0;p.reloadWeapon=-1;p.pendingFire=false;this.emit('switch',{player:id,weapon:p.weapon});}return;
    }
    if(this.phase!=='playing'||p.health<=0)return;
    if(message.type==='fire'){this.look(p,message);p.pendingFire=true;p.lastInput=this.time;return;}
    if(message.type==='reload'){this.reload(p);return;}
    if(message.type==='place'||message.type==='remove'){this.look(p,message);this.build(p,message.type);}
  }
  reload(p) {
    const w=WEAPONS[p.weapon],ammo=p.ammo[p.weapon];
    if(w.magazine&&ammo.mag<w.magazine&&ammo.reserve>0&&!p.reloadAt){p.reloadAt=this.time+w.reload;p.reloadWeapon=p.weapon;this.emit('reload',{player:p.id,weapon:p.weapon,duration:w.reload});}
  }
  build(p,action) {
    if(p.weapon!==3||this.time-p.lastShot<.2)return;
    const target=castVoxel(this.world,p.body.eye,p.body.direction,5.5);if(!target)return;
    p.lastShot=this.time;
    if(action==='remove'){
      const block=this.world.cover.get(blockIndex(target.x,target.y,target.z));if(!block)return;
      this.world.damageCover(block.x,block.y,block.z,100);this.revision++;this.emit('block',{x:block.x,y:block.y,z:block.z,id:0,revision:this.revision});return;
    }
    const x=target.x+target.normal.x,y=target.y+target.normal.y,z=target.z+target.normal.z;
    if(this.world.blocksLeft(p.id)<=0){this.emit('notice',{player:p.id,text:'Vos 24 protections sont déjà en place.'});return;}
    if(!this.world.buildable(x,y,z)||this.players.some(q=>overlapsBlock(q.body.position,x,y,z)))return;
    if(this.world.putCover(x,y,z,p.id)){this.revision++;this.emit('block',{x,y,z,id:3,revision:this.revision});}
  }
  shoot(p) {
    const w=WEAPONS[p.weapon],ammo=p.ammo[p.weapon];
    const moving=p.input.forward||p.input.backward||p.input.left||p.input.right;
    if(p.weapon===3||p.reloadAt||this.time-p.lastShot+1e-6<w.interval||(p.input.sprint&&moving))return;
    if(w.magazine&&ammo.mag<=0){this.reload(p);return;}
    p.lastShot=this.time;if(w.magazine)ammo.mag--;
    const origin=p.body.eye,direction=p.body.direction,block=castVoxel(this.world,origin,direction,w.range);
    let distance=block?block.distance:w.range,hit=null;
    for(const enemy of this.players){if(enemy.id===p.id||enemy.health<=0)continue;const result=hitPlayer(origin,direction,enemy.body.position,w.range);if(result&&result.distance<distance){distance=result.distance;hit={enemy,...result};}}
    const end={x:origin.x+direction.x*distance,y:origin.y+direction.y*distance,z:origin.z+direction.z*distance};
    this.emit('shot',{player:p.id,weapon:p.weapon,from:origin,to:end,hit:Boolean(hit)});
    if(hit){
      const damage=Math.round(w.damage*(hit.head?w.headMultiplier:1));hit.enemy.health=Math.max(0,hit.enemy.health-damage);
      this.emit('hit',{player:p.id,victim:hit.enemy.id,damage,head:hit.head,health:hit.enemy.health});
      if(!hit.enemy.health){p.score++;for(const q of this.players){q.input=emptyInput();q.pendingFire=false;q.ready=false;}
        this.phase=p.score>=5?'matchEnd':'roundEnd';this.remaining=this.phase==='roundEnd'?3:0;this.emit('kill',{player:p.id,victim:hit.enemy.id,weapon:p.weapon,head:hit.head,winner:this.phase==='matchEnd'?p.id:null});}
    }else if(block){const result=this.world.damageCover(block.x,block.y,block.z,w.damage);if(result?.removed){this.revision++;this.emit('block',{x:block.x,y:block.y,z:block.z,id:0,revision:this.revision});}}
  }
  step(dt=1/60) {
    dt=Math.max(0,Math.min(.02,dt));this.time+=dt;
    if(this.phase==='countdown'||this.phase==='roundEnd'){
      this.remaining=Math.max(0,this.remaining-dt);
      if(this.remaining===0){if(this.phase==='countdown'){this.phase='playing';this.emit('start',{round:this.round});}else{this.round++;this.resetRound();this.phase='countdown';this.remaining=2;}}
    }
    if(this.phase!=='playing')return;
    for(const p of this.players){
      if(this.time-p.lastInput>.3)p.input=emptyInput();
      if(p.reloadAt&&this.time>=p.reloadAt){const w=WEAPONS[p.reloadWeapon],ammo=p.ammo[p.reloadWeapon],amount=Math.min(w.magazine-ammo.mag,ammo.reserve);ammo.mag+=amount;ammo.reserve-=amount;p.reloadAt=0;p.reloadWeapon=-1;this.emit('reloaded',{player:p.id});}
      if(p.health>0)p.body.step(this.world,p.input,dt);
    }
    for(const p of this.players){if(this.phase!=='playing')break;const pending=p.pendingFire;p.pendingFire=false;if(p.health>0&&(pending||(p.input.fire&&WEAPONS[p.weapon].automatic)))this.shoot(p);}
  }
  snapshot() {
    return {map:this.world.map.id,phase:this.phase,remaining:this.remaining,round:this.round,time:this.time,revision:this.revision,players:this.players.map(p=>({id:p.id,slot:p.slot,profile:p.profile,...p.body.position,yaw:p.body.yaw,pitch:p.body.pitch,health:p.health,score:p.score,ready:p.ready,weapon:p.weapon,ammo:p.ammo.map(a=>({...a})),reload:Math.max(0,p.reloadAt-this.time),sprint:p.input.sprint&&(p.input.forward||p.input.backward||p.input.left||p.input.right),moving:p.input.forward||p.input.backward||p.input.left||p.input.right,grounded:p.body.grounded,velocityY:p.body.velocityY,ack:p.lastSeq,spawn:p.spawn,blocks:this.world.blocksLeft(p.id)}))};
  }
  drainEvents() { const events=this.events;this.events=[];return events; }
}
