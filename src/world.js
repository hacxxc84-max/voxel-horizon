export const SIZE = 128;
export const HEIGHT = 48;
export const CHUNK = 16;
export const WATER_LEVEL = 14;
export const AIR = 0, WATER = 10, BEDROCK = 11;
export const BLOCKS = Object.freeze([
  { id: 1, name: 'Herbe', color: '#82ac53', top: 0, side: 1, bottom: 2 },
  { id: 2, name: 'Terre', color: '#947049', top: 2, side: 2, bottom: 2 },
  { id: 3, name: 'Pierre', color: '#9aa6a0', top: 3, side: 3, bottom: 3 },
  { id: 4, name: 'Sable', color: '#dfce97', top: 4, side: 4, bottom: 4 },
  { id: 5, name: 'Bois', color: '#95734c', top: 6, side: 5, bottom: 6 },
  { id: 6, name: 'Feuilles', color: '#668b49', top: 7, side: 7, bottom: 7 },
  { id: 7, name: 'Planches', color: '#c8a577', top: 8, side: 8, bottom: 8 },
  { id: 8, name: 'Verre', color: '#b9dee0', top: 9, side: 9, bottom: 9 },
  { id: 9, name: 'Briques', color: '#b57561', top: 10, side: 10, bottom: 10 },
  { id: WATER, name: 'Eau', color: '#5dabb1', top: 11, side: 11, bottom: 11 },
  { id: BEDROCK, name: 'Socle', color: '#465650', top: 12, side: 12, bottom: 12 }
]);
export const blockById = id => BLOCKS[id - 1];
export const isSolid = id => id !== AIR && id !== WATER;
export const isOpaque = id => isSolid(id) && id !== 8;
export const blockIndex = (x, y, z) => x + SIZE * (z + SIZE * y);
export function seedHash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function hash2(x, z, seed) {
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function noise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  let tx = x - ix, tz = z - iz;
  tx = tx * tx * (3 - 2 * tx); tz = tz * tz * (3 - 2 * tz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
}
export function terrainHeight(x, z, seed) {
  let h = 12 + noise(x / 32, z / 32, seed) * 13 + noise(x / 65, z / 65, seed + 1) * 9 + noise(x / 9, z / 9, seed + 2) * 2;
  const coast = Math.min(x, z, SIZE - 1 - x, SIZE - 1 - z);
  if (coast < 13) h -= (13 - coast) * .65;
  const river = Math.abs(x - (63 + 14 * Math.sin(z / 23 + (seed % 20) / 10)));
  if (river < 10) h = Math.min(h, 11 + river * .72);
  return Math.max(5, Math.min(HEIGHT - 10, Math.floor(h)));
}

export class World {
  constructor(seed = 'HORIZON') {
    this.seed = String(seed).slice(0, 48) || 'HORIZON';
    this.seedNumber = seedHash(this.seed);
    this.data = new Uint8Array(SIZE * SIZE * HEIGHT);
    this.base = null;
    this.changes = new Map();
    this.dirty = new Set();
    this.ready = false;
  }
  inBounds(x, y, z) { return x >= 0 && z >= 0 && y >= 0 && x < SIZE && z < SIZE && y < HEIGHT; }
  get(x, y, z) { return this.inBounds(x, y, z) ? this.data[blockIndex(x, y, z)] : (y < 0 ? BEDROCK : AIR); }
  solid(x, y, z) { return isSolid(this.get(x, y, z)); }
  surface(x, z) {
    for (let y = HEIGHT - 1; y >= 0; y--) if (isSolid(this.get(x, y, z)) && this.get(x, y, z) !== 6) return y + 1;
    return 1;
  }
  generateColumns(start, end) {
    for (let x = start; x < Math.min(end, SIZE); x++) for (let z = 0; z < SIZE; z++) {
      const h = terrainHeight(x, z, this.seedNumber);
      for (let y = 0; y < HEIGHT; y++) {
        let id = AIR;
        if (y === 0) id = BEDROCK;
        else if (y < h - 3) id = 3;
        else if (y < h) id = h <= WATER_LEVEL + 1 ? 4 : 2;
        else if (y === h) id = h <= WATER_LEVEL + 1 ? 4 : 1;
        else if (y <= WATER_LEVEL) id = WATER;
        this.data[blockIndex(x, y, z)] = id;
      }
    }
  }
  finishGeneration() {
    for (let x = 7; x < SIZE - 7; x++) for (let z = 7; z < SIZE - 7; z++) {
      const h = terrainHeight(x, z, this.seedNumber);
      if (h <= WATER_LEVEL + 2 || hash2(x, z, this.seedNumber + 19) > .014) continue;
      // Keep a clearing near spawn; canopies use air cells only.
      if ((x - 42) ** 2 + (z - 82) ** 2 < 70) continue;
      if (this.get(x, h, z) !== 1 || this.get(x, h + 1, z) !== AIR) continue;
      const trunk = 4 + Math.floor(hash2(x, z, this.seedNumber + 29) * 3);
      for (let y = h + 1; y <= h + trunk; y++) this.data[blockIndex(x, y, z)] = 5;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        const y = h + trunk + dy;
        if (Math.abs(dx) + Math.abs(dz) + Math.max(0, dy) > 4) continue;
        if (this.inBounds(x + dx, y, z + dz) && this.get(x + dx, y, z + dz) === AIR) this.data[blockIndex(x + dx, y, z + dz)] = 6;
      }
    }
    this.base = this.data.slice();
    this.ready = true;
    for (let x = 0; x < SIZE / CHUNK; x++) for (let y = 0; y < HEIGHT / CHUNK; y++) for (let z = 0; z < SIZE / CHUNK; z++) this.dirty.add([x, y, z].join(','));
  }
  generate() { this.generateColumns(0, SIZE); this.finishGeneration(); return this; }
  set(x, y, z, id) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z) || !Number.isInteger(id) || !this.inBounds(x, y, z) || y === 0 || id < 0 || id > WATER) return false;
    const index = blockIndex(x, y, z);
    if (this.data[index] === id) return false;
    this.data[index] = id;
    if (this.base && this.base[index] === id) this.changes.delete(index); else this.changes.set(index, id);
    this.markDirty(x, y, z);
    return true;
  }
  markDirty(x, y, z) {
    // AO also depends on diagonal neighbours. Include every touching chunk.
    const axes = [x, y, z].map(p => [...new Set([Math.floor((p - 1) / CHUNK), Math.floor(p / CHUNK), Math.floor((p + 1) / CHUNK)])]);
    for (const cx of axes[0]) for (const cy of axes[1]) for (const cz of axes[2]) {
      if (cx >= 0 && cx < SIZE / CHUNK && cy >= 0 && cy < HEIGHT / CHUNK && cz >= 0 && cz < SIZE / CHUNK) this.dirty.add([cx, cy, cz].join(','));
    }
  }
  applyChanges(entries) {
    for (const [index, id] of entries) {
      const y = Math.floor(index / (SIZE * SIZE)), z = Math.floor(index / SIZE) % SIZE, x = index % SIZE;
      this.set(x, y, z, id);
    }
  }
  spawn() {
    // Find the nearest clear, dry column; no assumptions about a seed's terrain.
    for (let r = 0; r < SIZE; r++) for (let dx = -r; dx <= r; dx++) for (const dz of r === 0 ? [0] : [-r, r]) {
      const x = 42 + dx, z = 82 + dz;
      if (x < 2 || z < 2 || x >= SIZE - 2 || z >= SIZE - 2) continue;
      const y = this.surface(x, z);
      if (y > WATER_LEVEL + 1 && y < HEIGHT - 2 && !this.solid(x, y, z) && !this.solid(x, y + 1, z)) return { x: x + .5, y: y + .02, z: z + .5 };
    }
    return { x: 42.5, y: this.surface(42, 82) + .02, z: 82.5 };
  }
}

// Grid traversal gives reliable targeting independently of render meshes.
export function castVoxel(world, origin, direction, reach = 6) {
  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
  const steps = [direction.x, direction.y, direction.z].map(d => d > 0 ? 1 : d < 0 ? -1 : 0);
  const deltas = [direction.x, direction.y, direction.z].map(d => d === 0 ? Infinity : Math.abs(1 / d));
  const coords = [x, y, z], pos = [origin.x, origin.y, origin.z], dirs = [direction.x, direction.y, direction.z];
  const times = coords.map((c, i) => dirs[i] === 0 ? Infinity : (steps[i] > 0 ? c + 1 - pos[i] : pos[i] - c) * deltas[i]);
  let distance = 0, normal = { x: 0, y: 0, z: 0 };
  for (let iteration = 0; iteration < 128 && distance <= reach; iteration++) {
    const id = world.get(x, y, z);
    if (isSolid(id)) return { x, y, z, id, normal, distance };
    let axis = times[0] < times[1] ? 0 : 1;
    if (times[2] < times[axis]) axis = 2;
    distance = times[axis]; times[axis] += deltas[axis];
    if (!Number.isFinite(distance)) break;
    if (axis === 0) x += steps[0]; else if (axis === 1) y += steps[1]; else z += steps[2];
    normal = { x: axis === 0 ? -steps[0] : 0, y: axis === 1 ? -steps[1] : 0, z: axis === 2 ? -steps[2] : 0 };
  }
  return null;
}
