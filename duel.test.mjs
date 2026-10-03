import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from '../vendor/ws/package/wrapper.mjs';
import { createDuelServer } from '../duel-server.mjs';
import { DuelGame } from '../src/duel-game.js';
import { ArenaWorld,MAPS } from '../src/arenas.js';
import { normalizeProfile,hitPlayer,rayBox } from '../src/weapons.js';
import { collides } from '../src/physics.js';

function active(map='foundry'){const game=new DuelGame(map);game.addPlayer('a',{name:'Alpha'});game.addPlayer('b',{name:'Bravo'});game.setReady('a');game.setReady('b');for(let i=0;i<181;i++)game.step();assert.equal(game.phase,'playing');game.drainEvents();return game;}
function advance(game,seconds){for(let i=0;i<Math.ceil(seconds*60);i++)game.step();}
const fire=(game,id='a',extra={})=>{const p=game.players.find(p=>p.id===id);game.command(id,{type:'fire',yaw:p.body.yaw,pitch:p.body.pitch,...extra});game.step();};

test('Trois cartes distinctes, uniquement pierre et socle, avec des départs libres',()=>{
  const worlds=MAPS.map(m=>new ArenaWorld(m.id).generate());for(const world of worlds){assert.deepEqual([...new Set(world.data)].sort((a,b)=>a-b),[0,3,11]);for(let i=0;i<2;i++)assert.ok(!collides(world,world.spawn(i)));}
  assert.notDeepEqual(worlds[0].data,worlds[1].data);assert.notDeepEqual(worlds[1].data,worlds[2].data);
});
test('Le salon refuse un troisième joueur et attend que les deux soient prêts',()=>{
  const game=new DuelGame();game.addPlayer('a');game.setReady('a');assert.equal(game.phase,'waiting');game.addPlayer('b');assert.throws(()=>game.addPlayer('c'),/complet/);game.setReady('b');assert.equal(game.phase,'countdown');advance(game,3.1);assert.equal(game.phase,'playing');
});
test('Les profils normalisent le pseudo, la tenue, le teint et le casque',()=>{
  const p=normalizeProfile({name:'<Alpha>\u0000',color:'javascript:bad',skin:'bad',helmet:'bad'});assert.equal(p.name,'Alpha');assert.ok(p.color.startsWith('#'));assert.equal(p.helmet,'helmet');assert.equal(normalizeProfile({name:'x'.repeat(100)}).name.length,16);
});
test('Les rayons distinguent la tête, le corps, la portée et un axe parallèle',()=>{
  const p={x:5,y:2,z:5};assert.equal(hitPlayer({x:1,y:3.6,z:5},{x:1,y:0,z:0},p,10).head,true);assert.equal(hitPlayer({x:1,y:3,z:5},{x:1,y:0,z:0},p,10).head,false);assert.equal(hitPlayer({x:1,y:3,z:5},{x:1,y:0,z:0},p,2),null);assert.equal(rayBox({x:1,y:1,z:1},{x:0,y:1,z:0},{x:2,y:0,z:0},{x:3,y:3,z:3}),null);
});
test('AK-47 : dégâts de tête, cadence imposée et munitions gérées par le serveur',()=>{
  const game=active(),a=game.players[0],b=game.players[1];fire(game);assert.equal(b.health,50);assert.equal(a.ammo[0].mag,29);fire(game);assert.equal(b.health,50);assert.equal(a.ammo[0].mag,29);advance(game,.11);fire(game);assert.equal(b.health,0);assert.equal(a.score,1);assert.equal(game.phase,'roundEnd');
});
test('L’AK tire en automatique tant que les commandes sont récentes',()=>{
  const game=active(),a=game.players[0];a.body.pitch=.8;game.command('a',{type:'input',seq:1,fire:true,yaw:a.body.yaw,pitch:.8});advance(game,.27);assert.ok(a.ammo[0].mag<=27);const ammo=a.ammo[0].mag;advance(game,1);assert.ok(a.ammo[0].mag>=ammo-1);
});
test('Pistolet : un clic produit un tir, maintenir le bouton ne produit pas une rafale',()=>{
  const game=active(),a=game.players[0];game.command('a',{type:'switch',slot:1});game.command('a',{type:'input',seq:1,fire:true,yaw:a.body.yaw,pitch:.7});fire(game,'a',{pitch:.7});assert.equal(a.ammo[1].mag,11);advance(game,.28);assert.equal(a.ammo[1].mag,11);
});
test('Le couteau est limité au combat rapproché et utilise un délai entre attaques',()=>{
  const game=active(),a=game.players[0],b=game.players[1];game.command('a',{type:'switch',slot:2});fire(game);assert.equal(b.health,100);advance(game,.6);b.body.position={x:a.body.position.x+1.5,y:2,z:a.body.position.z};fire(game);assert.equal(b.health,45);fire(game);assert.equal(b.health,45);advance(game,.6);fire(game);assert.equal(b.health,0);
});
test('Le rechargement respecte les réserves et une arme différente annule le rechargement',()=>{
  const game=active(),a=game.players[0];a.ammo[0]={mag:1,reserve:3};fire(game,'a',{pitch:.7});game.command('a',{type:'reload'});assert.ok(a.reloadAt>game.time);advance(game,1);assert.equal(a.ammo[0].mag,0);advance(game,1.2);assert.deepEqual(a.ammo[0],{mag:3,reserve:0});a.ammo[1].mag=2;game.command('a',{type:'switch',slot:1});game.command('a',{type:'reload'});game.command('a',{type:'switch',slot:0});assert.equal(a.reloadAt,0);assert.equal(a.ammo[1].mag,2);
});
test('Le sprint déplace plus vite et empêche de tirer pendant la course',()=>{
  const game=active(),a=game.players[0];game.command('a',{type:'input',seq:1,forward:true,sprint:true,yaw:a.body.yaw,pitch:0});fire(game);assert.equal(a.ammo[0].mag,30);advance(game,.2);assert.ok(a.body.position.x>9.8);
});
test('Les commandes ne permettent ni téléportation ni attribution de dégâts par le client',()=>{
  const game=active(),a=game.players[0],original={...a.body.position};game.command('a',{type:'input',seq:1,x:44,y:30,z:44,health:999,yaw:Infinity,pitch:NaN});game.command('a',{type:'damage',victim:'b',damage:9999});game.step();assert.deepEqual(a.body.position,original);assert.equal(game.players[1].health,100);assert.ok(Number.isFinite(a.body.yaw));game.command('a',{type:'input',seq:0,forward:true});assert.equal(a.input.forward,false);
});
test('La construction est limitée à la pierre, à 24 blocs et hors des corps',()=>{
  const game=active(),a=game.players[0];game.command('a',{type:'switch',slot:3});game.command('a',{type:'place',yaw:a.body.yaw,pitch:-1.53});assert.equal(game.world.cover.size,0,'Aucune pierre ne doit apparaître dans le joueur');advance(game,.21);
  game.command('a',{type:'place',yaw:a.body.yaw,pitch:-1.2});assert.equal(game.world.cover.size,1);assert.equal(game.world.blocksLeft('a'),23);const first=[...game.world.cover.values()][0];assert.equal(game.world.get(first.x,first.y,first.z),3);assert.ok(!game.world.buildable(0,4,0));assert.ok(!game.world.putCover(9,9,9,'a'));
  for(let x=2;x<7&&game.world.cover.size<24;x++)for(let z=2;z<15&&game.world.cover.size<24;z++)game.world.putCover(x,2,z,'a');
  assert.equal(game.world.cover.size,24);assert.equal(game.world.blocksLeft('a'),0);advance(game,.21);game.command('a',{type:'place',yaw:a.body.yaw,pitch:-1.2});assert.equal(game.world.cover.size,24);assert.ok(game.drainEvents().some(e=>e.kind==='notice'&&e.text.includes('24')));
});
test('Les protections arrêtent les balles, sont destructibles et ne permettent pas de détruire la carte',()=>{
  const game=active(),a=game.players[0],b=game.players[1];game.world.putCover(10,3,24,'a');for(let i=0;i<4;i++){fire(game);advance(game,.11);}assert.equal(b.health,100);assert.equal(game.world.get(10,3,24),0);fire(game);assert.equal(b.health,50);const original=game.world.get(47,3,24);fire(game,'a',{yaw:Math.PI/2});assert.equal(game.world.get(47,3,24),original);
});
test('Une nouvelle manche remet vie, armes et protections à zéro, en conservant le score',()=>{
  const game=active(),a=game.players[0];game.world.putCover(10,2,10,'a');fire(game);advance(game,.12);fire(game);assert.equal(a.score,1);advance(game,3.1);assert.equal(game.phase,'countdown');assert.equal(a.health,100);assert.equal(a.ammo[0].mag,30);assert.equal(game.world.cover.size,0);assert.equal(a.score,1);assert.equal(game.round,2);
});
test('Cinq points terminent la partie et la revanche exige les deux joueurs',()=>{
  const game=active(),a=game.players[0];a.score=4;fire(game);advance(game,.11);fire(game);assert.equal(game.phase,'matchEnd');game.setReady('a');assert.equal(game.phase,'matchEnd');game.setReady('b');assert.equal(game.phase,'countdown');assert.equal(a.score,0);
});
test('Quitter le salon suspend le duel et le joueur restant peut accueillir un autre adversaire',()=>{
  const game=active();game.removePlayer('a');assert.equal(game.phase,'waiting');assert.equal(game.players[0].health,100);game.addPlayer('c');assert.equal(game.players.length,2);assert.equal(game.players[1].slot,0);
});

async function client(port){
  const socket=new WebSocket('ws://127.0.0.1:'+port+'/duel'),messages=[],waiting=[];
  socket.on('message',raw=>{const message=JSON.parse(raw.toString());messages.push(message);for(const entry of [...waiting])if(entry.predicate(message)){clearTimeout(entry.timer);waiting.splice(waiting.indexOf(entry),1);entry.resolve(message);}});
  await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
  return {socket,send:message=>socket.send(JSON.stringify(message)),wait(predicate,timeout=6000){const existing=messages.find(predicate);if(existing)return Promise.resolve(existing);return new Promise((resolve,reject)=>{const entry={predicate,resolve,timer:setTimeout(()=>reject(new Error('Message attendu non reçu.')),timeout)};waiting.push(entry);});}};
}
test('Deux vraies connexions réseau rejoignent un salon, combattent et reçoivent la même vie et le même score',async t=>{
  const app=createDuelServer();await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));t.after(()=>app.close());const port=app.server.address().port;
  const a=await client(port),b=await client(port),c=await client(port);a.send({type:'create',map:'foundry',profile:{name:'Alpha',color:'#6ca5da'}});const welcome=await a.wait(m=>m.type==='welcome');assert.match(welcome.code,/^[A-Z2-9]{6}$/);
  b.send({type:'join',code:welcome.code,profile:{name:'Bravo'}});const joined=await b.wait(m=>m.type==='welcome');assert.equal(joined.state.players.length,2);c.send({type:'join',code:welcome.code});assert.match((await c.wait(m=>m.type==='error')).message,/complet/);
  a.send({type:'ready',value:true});b.send({type:'ready',value:true});await a.wait(m=>m.type==='state'&&m.phase==='playing');
  a.send({type:'fire',yaw:-Math.PI/2,pitch:0});await b.wait(m=>m.type==='event'&&m.event.kind==='hit'&&m.event.health===50);await new Promise(resolve=>setTimeout(resolve,130));a.send({type:'fire',yaw:-Math.PI/2,pitch:0});
  const endA=await a.wait(m=>m.type==='state'&&m.players.some(p=>p.score===1)),endB=await b.wait(m=>m.type==='state'&&m.players.some(p=>p.score===1));assert.equal(endA.phase,'roundEnd');assert.equal(endB.phase,'roundEnd');assert.equal(endB.players.find(p=>p.id===joined.id).health,0);
  a.socket.close();const remaining=await b.wait(m=>m.type==='state'&&m.phase==='waiting'&&m.players.length===1);assert.equal(remaining.host,joined.id);
});
