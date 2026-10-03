import { World, SIZE, CHUNK, HEIGHT, BEDROCK, blockIndex } from './world.js';

export const ARENA_SIZE = 48;
export const MAPS = Object.freeze([
  { id: 'foundry', name: 'Fonderie', tagline: 'Trois lignes. Un seul vainqueur.', description: 'Coursives industrielles et couverts bas. Un terrain équilibré pour apprendre le duel.', accent: '#a6e49b', sky: '#789da9', ground: '#899794', icon: '01', spawns: [{ x: 8.5, y: 2, z: 24.5, yaw: -Math.PI / 2 }, { x: 39.5, y: 2, z: 24.5, yaw: Math.PI / 2 }] },
  { id: 'bastion', name: 'Bastion', tagline: 'Prenez les hauteurs.', description: 'Une cour fortifiée, des piliers et deux terrasses. Changez d’angle pour surprendre l’adversaire.', accent: '#e9c88a', sky: '#9ba9ac', ground: '#aaa391', icon: '02', spawns: [{ x: 7.5, y: 2, z: 24.5, yaw: -Math.PI / 2 }, { x: 40.5, y: 2, z: 24.5, yaw: Math.PI / 2 }] },
  { id: 'canyon', name: 'Faille', tagline: 'Rapprochez-vous. Frappez vite.', description: 'Passages étroits et murs décalés. Une arène pour les attaques rapides et les protections en pierre.', accent: '#b6b3ff', sky: '#9294b5', ground: '#98949e', icon: '03', spawns: [{ x: 8.5, y: 2, z: 24.5, yaw: -Math.PI / 2 }, { x: 39.5, y: 2, z: 24.5, yaw: Math.PI / 2 }] }
]);
export const mapById = id => MAPS.find(m => m.id === id) || MAPS[0];
export class ArenaWorld extends World {
  constructor(mapId = 'foundry') {
    super(mapId); this.map = mapById(mapId); this.cover = new Map();
  }
  box(x0, y0, z0, x1, y1, z1) {
    for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) this.data[blockIndex(x, y, z)] = y === 0 ? BEDROCK : 3;
  }
  generate() {
    this.box(0,0,0,48,2,48);
    this.box(0,2,0,48,10,1); this.box(0,2,47,48,10,48);
    this.box(0,2,1,1,10,47); this.box(47,2,1,48,10,47);
    if (this.map.id === 'foundry') {
      for (const x of [13,32]) for (const z of [9,34]) this.box(x,2,z,x+3,5,z+5);
      for (const z of [15,30]) { this.box(21,2,z,27,4,z+2); this.box(22,4,z,26,5,z+1); }
      for (const x of [5,40]) this.box(x,2,4,x+3,3,44);
      this.box(19,2,4,21,7,12); this.box(27,2,36,29,7,44);
    } else if (this.map.id === 'bastion') {
      for (const x of [16,30]) for (const z of [13,31]) this.box(x,2,z,x+2,7,z+3);
      this.box(19,2,6,29,4,12); this.box(19,2,36,29,4,42);
      this.box(19,2,12,29,3,14); this.box(19,2,34,29,3,36);
      for (const x of [10,35]) { this.box(x,2,17,x+3,4,20); this.box(x,2,29,x+3,4,32); }
      for (const z of [4,42]) this.box(4,2,z,12,5,z+2);
    } else {
      for (const x of [14,31]) { this.box(x,2,6,x+3,7,19); this.box(x,2,30,x+3,7,43); }
      this.box(22,2,10,25,5,21); this.box(23,2,28,26,5,39);
      for (const x of [6,39]) { this.box(x,2,13,x+3,4,17); this.box(x,2,32,x+3,4,36); }
      this.box(18,2,43,31,4,45); this.box(18,2,3,31,4,5);
    }
    this.base = this.data.slice(); this.ready = true; this.changes.clear(); this.cover.clear(); this.dirty.clear();
    for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) this.dirty.add([x,0,z].join(','));
    return this;
  }
  buildable(x,y,z) { return Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z) && x >= 2 && z >= 2 && x < 46 && z < 46 && y >= 2 && y <= 7; }
  resetCover() {
    for (const index of this.cover.keys()) { const y=Math.floor(index/(SIZE*SIZE)),z=Math.floor(index/SIZE)%SIZE,x=index%SIZE; super.set(x,y,z,this.base[index]); }
    this.cover.clear();
  }
  putCover(x,y,z,owner) {
    if (!this.buildable(x,y,z) || this.get(x,y,z)) return false;
    if (!super.set(x,y,z,3)) return false;
    this.cover.set(blockIndex(x,y,z),{x,y,z,owner,hp:100}); return true;
  }
  damageCover(x,y,z,damage) {
    const index=blockIndex(x,y,z),cover=this.cover.get(index); if (!cover) return null;
    cover.hp=Math.max(0,cover.hp-damage);
    if (!cover.hp) { this.cover.delete(index); super.set(x,y,z,0); }
    return {...cover,removed:cover.hp===0};
  }
  blocksLeft(owner) { let used=0; for (const block of this.cover.values()) if(block.owner===owner) used++; return Math.max(0,24-used); }
  spawn(slot=0) { return { ...this.map.spawns[slot===1?1:0] }; }
}
