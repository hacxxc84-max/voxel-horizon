import test from 'node:test';
import assert from 'node:assert/strict';
import { World, SIZE, HEIGHT, WATER, BEDROCK, blockIndex, castVoxel } from '../src/world.js';
import { Player, collides, overlapsBlock, movementAction } from '../src/physics.js';
import { meshChunk, FACES } from '../src/mesher.js';
import { Storage, SAVE_KEY, validateSave, makeSave, normalizeSettings } from '../src/storage.js';

function flatWorld(){const world=new World('TEST');for(let x=0;x<SIZE;x++)for(let z=0;z<SIZE;z++)world.data[blockIndex(x,0,z)]=BEDROCK;world.base=world.data.slice();world.ready=true;return world;}
const input=(extra={})=>({forward:false,backward:false,left:false,right:false,jump:false,sprint:false,...extra});
const tick=(world,player,keys,seconds)=>{for(let i=0;i<Math.round(seconds*120);i++)player.step(world,keys,1/120);};

test('Un monde se régénère identiquement, une autre graine change le terrain',()=>{
  const a=new World('HORIZON').generate(),b=new World('HORIZON').generate(),c=new World('AUTRE').generate();
  assert.deepEqual(a.data,b.data);assert.notDeepEqual(a.data,c.data);
  for(const world of [a,c]){assert.equal(world.data.length,SIZE*SIZE*HEIGHT);assert.equal(world.get(10,0,10),BEDROCK);assert.ok(!collides(world,world.spawn()));}
});
test('Les changements sont réversibles et le socle reste protégé',()=>{
  const world=flatWorld();assert.equal(world.set(1,0,1,0),false);assert.equal(world.set(-1,3,2,1),false);assert.equal(world.set(1,3,2,99),false);assert.equal(world.set(1.5,3,2,1),false);
  assert.ok(world.set(1,2,3,7));assert.equal(world.changes.size,1);assert.ok(world.set(1,2,3,0));assert.equal(world.changes.size,0);
});
test('Une modification au coin d’un chunk invalide ses voisins pour les faces et l’AO',()=>{
  const world=flatWorld();world.set(15,15,15,3);assert.equal(world.dirty.size,8);assert.ok(world.dirty.has('1,1,1'));assert.ok(world.dirty.has('0,0,0'));
});
test('Le rendu retire les faces cachées, y compris entre chunks',()=>{
  const world=flatWorld();world.data.fill(0);world.set(15,5,5,3);world.set(16,5,5,3);
  const left=meshChunk(world,0,0,0),right=meshChunk(world,1,0,0);
  assert.equal(left.opaque.indices.length,30);assert.equal(right.opaque.indices.length,30);
  world.set(16,5,5,0);assert.equal(meshChunk(world,0,0,0).opaque.indices.length,36);
});
test('Les faces ont des triangles orientés vers l’extérieur',()=>{
  for(const face of FACES){const [a,b,c]=face.v,u=b.map((n,i)=>n-a[i]),v=c.map((n,i)=>n-a[i]);const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];assert.ok(cross.reduce((s,n,i)=>s+n*face.n[i],0)>0);}
});
test('Le ciblage donne la bonne face, respecte la portée et ignore l’eau',()=>{
  const world=flatWorld();world.set(4,3,4,3);world.set(4,3,5,WATER);
  const origin={x:4.5,y:3.5,z:8.5},direction={x:0,y:0,z:-1};
  const target=castVoxel(world,origin,direction,6);assert.deepEqual([target.x,target.y,target.z],[4,3,4]);assert.deepEqual(target.normal,{x:0,y:0,z:1});assert.equal(target.distance,3.5);
  assert.equal(castVoxel(world,origin,direction,3),null);
  assert.equal(castVoxel(world,origin,{x:0,y:0,z:0}),null);
  const down=castVoxel(world,{x:4.5,y:7,z:4.5},{x:0,y:-1,z:0});assert.deepEqual(down.normal,{x:0,y:1,z:0});
});
test('ZQSD utilise les lettres AZERTY et les chiffres restent physiques',()=>{
  assert.equal(movementAction({key:'z',code:'KeyW'}),'forward');assert.equal(movementAction({key:'q',code:'KeyA'}),'left');assert.equal(movementAction({key:'s',code:'KeyS'}),'backward');assert.equal(movementAction({key:'D',code:'KeyD'}),'right');
  assert.equal(movementAction({key:'w',code:'KeyW'}),null);assert.equal(movementAction({key:' ',code:'Space'}),'jump');
});
test('Le joueur s’arrête devant un mur, glisse sur les côtés et ne traverse pas le sol',()=>{
  const world=flatWorld();for(let x=8;x<14;x++)for(let y=1;y<5;y++)world.set(x,y,8,3);
  const p=new Player({x:10.5,y:1.02,z:10.5});p.yaw=0;tick(world,p,input({forward:true}),2);
  assert.ok(p.position.z>=9.29-1e-4);assert.ok(p.position.z<9.31);assert.ok(p.grounded);assert.ok(Math.abs(p.position.y-1)<.001);assert.ok(!collides(world,p.position));
  const x=p.position.x;tick(world,p,input({forward:true,right:true}),.3);assert.ok(p.position.x>x);
});
test('Le saut atterrit et maintenir Espace ne provoque pas de sauts automatiques',()=>{
  const world=flatWorld(),p=new Player({x:10.5,y:1.02,z:10.5});tick(world,p,input(),.2);assert.ok(p.grounded);
  tick(world,p,input({jump:true}),.2);assert.ok(p.position.y>1.9);tick(world,p,input({jump:true}),2);assert.ok(p.grounded);assert.ok(p.position.y<1.001);
});
test('La vitesse diagonale reste normale et la course est plus rapide',()=>{
  const world=flatWorld(),a=new Player({x:30,y:1,z:30}),b=new Player({x:30,y:1,z:30}),c=new Player({x:30,y:1,z:30});a.yaw=b.yaw=c.yaw=0;
  tick(world,a,input({forward:true}),1);tick(world,b,input({forward:true,right:true}),1);tick(world,c,input({forward:true,sprint:true}),1);
  assert.ok(Math.abs(a.distanceWalked-b.distanceWalked)<1e-8);assert.ok(c.distanceWalked>a.distanceWalked*1.5);
});
test('Les limites du monde et l’intersection avec un bloc protègent le joueur',()=>{
  const world=flatWorld(),p=new Player({x:.3,y:1,z:20});p.yaw=0;tick(world,p,input({left:true,sprint:true}),4);assert.ok(p.position.x>=.29-1e-8);
  assert.ok(overlapsBlock({x:10.5,y:2,z:10.5},10,2,10));assert.ok(!overlapsBlock({x:10.5,y:2,z:10.5},10,4,10));
});
test('L’eau ralentit les déplacements et permet de remonter avec Espace',()=>{
  const world=flatWorld();for(let x=10;x<16;x++)for(let z=10;z<16;z++)for(let y=1;y<=5;y++)world.set(x,y,z,WATER);
  const p=new Player({x:12.5,y:1.5,z:12.5});tick(world,p,input({jump:true}),.2);assert.ok(p.inWater);assert.ok(p.position.y>2);
});
test('Une sauvegarde reconstruit les mêmes blocs et conserve la position et la sélection',()=>{
  const original=new World('SAVE-TEST').generate();original.set(15,35,15,7);original.set(16,35,15,8);
  const p=new Player(original.spawn());p.yaw=.75;p.pitch=-.25;const save=validateSave(JSON.parse(JSON.stringify(makeSave(original,p,6,.52))));
  const restored=new World(save.seed).generate();restored.applyChanges(save.changes);assert.deepEqual(restored.data,original.data);assert.equal(save.selected,6);assert.equal(save.player.yaw,.75);assert.equal(save.time,.52);
});
test('L’import refuse versions inconnues, coordonnées impossibles et doublons',()=>{
  const world=flatWorld(),p=new Player({x:10,y:1,z:10}),save=makeSave(world,p,0,.3);
  for(const bad of [{...save,version:2},{...save,generator:2},{...save,player:{...save.player,x:Infinity}},{...save,changes:[[0,3]]},{...save,changes:[[blockIndex(5,2,5),3],[blockIndex(5,2,5),4]]},{...save,changes:[[blockIndex(5,2,5),255]]}])assert.throws(()=>validateSave(bad));
});
test('Un stockage saturé signale un échec sans annoncer une sauvegarde réussie',()=>{
  const storage=new Storage({getItem:()=>'{broken',setItem:()=>{throw new Error('QuotaExceeded');}});assert.equal(storage.read(),null);
  const world=flatWorld(),save=makeSave(world,new Player({x:10,y:1,z:10}),0,.3);assert.equal(storage.write(save),false);assert.match(storage.lastError,/plein ou inaccessible/);
});
test('Le stockage normal conserve la partie, les réglages invalides reviennent aux valeurs sûres',()=>{
  const map=new Map(),storage=new Storage({getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)}),world=flatWorld();
  const save=makeSave(world,new Player({x:10,y:1,z:10}),0,.3);assert.ok(storage.write(save));assert.deepEqual(storage.read(),save);assert.ok(map.has(SAVE_KEY));
  const settings=normalizeSettings({sensitivity:NaN,volume:-1,distance:999,quality:'unknown',dayCycle:'yes'});assert.equal(settings.sensitivity,1);assert.equal(settings.distance,80);assert.equal(settings.quality,'medium');
});
