import { SIZE, HEIGHT, CHUNK, WATER, AIR, blockById, isOpaque } from './world.js';
export const FACES = [
  { n: [1,0,0], v: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]], light: .86 },
  { n: [-1,0,0], v: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]], light: .72 },
  { n: [0,1,0], v: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], light: 1 },
  { n: [0,-1,0], v: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], light: .52 },
  { n: [0,0,1], v: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]], light: .9 },
  { n: [0,0,-1], v: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]], light: .77 }
];
function bucket() { return { positions: [], normals: [], colors: [], uvs: [], indices: [] }; }
export function meshChunk(world, cx, cy, cz) {
  const opaque = bucket(), water = bucket(), glass = bucket();
  for (let x = cx * CHUNK; x < Math.min(SIZE, (cx + 1) * CHUNK); x++)
    for (let y = cy * CHUNK; y < Math.min(HEIGHT, (cy + 1) * CHUNK); y++)
      for (let z = cz * CHUNK; z < Math.min(SIZE, (cz + 1) * CHUNK); z++) {
        const id = world.get(x, y, z);
        if (!id) continue;
        const b = id === WATER ? water : id === 8 ? glass : opaque;
        const block = blockById(id);
        for (let faceIndex = 0; faceIndex < FACES.length; faceIndex++) {
          const face = FACES[faceIndex], n = face.n, other = world.get(x + n[0], y + n[1], z + n[2]);
          if (isOpaque(other) || other === id || (id === WATER && other !== AIR)) continue;
          const tile = faceIndex === 2 ? block.top : faceIndex === 3 ? block.bottom : block.side;
          const u0 = ((tile % 4) * 18 + 1) / 72, v0 = 1 - (Math.floor(tile / 4) * 18 + 17) / 72;
          const u1 = u0 + 16 / 72, v1 = v0 + 16 / 72;
          const texcoords = [[u0,v0],[u1,v0],[u1,v1],[u0,v1]];
          const start = b.positions.length / 3;
          for (let i = 0; i < 4; i++) {
            const v = face.v[i];
            let shade = face.light;
            if (id !== WATER && id !== 8) {
              const tangent = [0,1,2].filter(axis => n[axis] === 0);
              const side1 = [x + n[0],y + n[1],z + n[2]], side2 = [...side1], corner = [...side1];
              const a = tangent[0], c = tangent[1], da = v[a] === 0 ? -1 : 1, dc = v[c] === 0 ? -1 : 1;
              side1[a] += da; side2[c] += dc; corner[a] += da; corner[c] += dc;
              const s1 = Number(isOpaque(world.get(...side1))), s2 = Number(isOpaque(world.get(...side2))), sc = Number(isOpaque(world.get(...corner)));
              shade *= 1 - (s1 && s2 ? 3 : s1 + s2 + sc) * .11;
            }
            b.positions.push(x + v[0], y + v[1] - (id === WATER && v[1] === 1 && world.get(x, y + 1, z) !== WATER ? .12 : 0), z + v[2]);
            b.normals.push(...n); b.colors.push(shade, shade, shade); b.uvs.push(...texcoords[i]);
          }
          b.indices.push(start,start + 1,start + 2,start,start + 2,start + 3);
        }
      }
  return { opaque, water, glass };
}
