import { SIZE, HEIGHT, WATER } from './world.js';
export const SAVE_KEY = 'voxel-horizon-save-v1', SETTINGS_KEY = 'voxel-horizon-settings-v1';
export const DEFAULT_SETTINGS = Object.freeze({ sensitivity: 1, volume: .35, distance: 80, quality: 'medium', dayCycle: true, captureMouse: true });
const finite = (x, min, max) => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
export function validateSave(raw) {
  if (!raw || raw.format !== 'voxel-horizon' || raw.version !== 1 || raw.generator !== 1 || typeof raw.seed !== 'string' || raw.seed.length < 1 || raw.seed.length > 48) throw new Error('Ce fichier n’est pas une sauvegarde Voxel Horizon compatible.');
  if (!Array.isArray(raw.changes) || raw.changes.length > SIZE * SIZE * (HEIGHT - 1)) throw new Error('Liste de blocs invalide.');
  const seen = new Set();
  for (const entry of raw.changes) {
    if (!Array.isArray(entry) || entry.length !== 2 || !Number.isInteger(entry[0]) || entry[0] < SIZE * SIZE || entry[0] >= SIZE * SIZE * HEIGHT || !Number.isInteger(entry[1]) || entry[1] < 0 || entry[1] > WATER || seen.has(entry[0])) throw new Error('La sauvegarde contient des blocs invalides.');
    seen.add(entry[0]);
  }
  const p = raw.player;
  if (!p || !finite(p.x, .29, SIZE - .29) || !finite(p.y, 0, HEIGHT + 8) || !finite(p.z, .29, SIZE - .29) || !finite(p.yaw, -1e8, 1e8) || !finite(p.pitch, -Math.PI / 2, Math.PI / 2) || !Number.isInteger(raw.selected) || raw.selected < 0 || raw.selected > 8 || !finite(raw.time, 0, 1)) throw new Error('Position du joueur ou réglages de partie invalides.');
  // Copy accepted fields only; never trust arbitrary imported properties.
  return { format: 'voxel-horizon', version: 1, generator: 1, seed: raw.seed, changes: raw.changes.map(([index,id]) => [index,id]), player: { x:p.x,y:p.y,z:p.z,yaw:p.yaw,pitch:p.pitch }, selected: raw.selected, time: raw.time, savedAt: typeof raw.savedAt === 'string' ? raw.savedAt.slice(0,40) : '' };
}
export function makeSave(world, player, selected, time) {
  return validateSave({ format:'voxel-horizon',version:1,generator:1,seed:world.seed,changes:[...world.changes],player:{...player.position,yaw:player.yaw,pitch:player.pitch},selected,time,savedAt:new Date().toISOString() });
}
export function normalizeSettings(raw) {
  const d = DEFAULT_SETTINGS;
  return { sensitivity:finite(raw?.sensitivity,.3,2.5) ? raw.sensitivity : d.sensitivity,volume:finite(raw?.volume,0,1) ? raw.volume : d.volume,distance:[48,80,128].includes(raw?.distance) ? raw.distance : d.distance,quality:['low','medium','high'].includes(raw?.quality) ? raw.quality : d.quality,dayCycle:typeof raw?.dayCycle === 'boolean' ? raw.dayCycle : d.dayCycle,captureMouse:typeof raw?.captureMouse === 'boolean' ? raw.captureMouse : d.captureMouse };
}
export class Storage {
  constructor(backend) { this.backend = backend; this.lastError = ''; }
  read() {
    try { const text = this.backend.getItem(SAVE_KEY); return text ? validateSave(JSON.parse(text)) : null; }
    catch (error) { this.lastError = error.message; return null; }
  }
  write(save) {
    try { this.backend.setItem(SAVE_KEY, JSON.stringify(validateSave(save))); this.lastError = ''; return true; }
    catch { this.lastError = 'Le stockage du navigateur est plein ou inaccessible. Exportez votre partie pour la conserver.'; return false; }
  }
  settings() { try { return normalizeSettings(JSON.parse(this.backend.getItem(SETTINGS_KEY))); } catch { return { ...DEFAULT_SETTINGS }; } }
  writeSettings(settings) { try { this.backend.setItem(SETTINGS_KEY,JSON.stringify(normalizeSettings(settings))); return true; } catch { return false; } }
}
