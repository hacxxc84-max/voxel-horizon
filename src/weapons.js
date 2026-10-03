export const WEAPONS = Object.freeze([
  { id: 'ak', name: 'AK-47', short: 'AK', slot: 0, damage: 25, headMultiplier: 2, interval: .1, magazine: 30, reserve: 90, reload: 2.1, range: 80, automatic: true },
  { id: 'pistol', name: 'Pistolet', short: 'PST', slot: 1, damage: 34, headMultiplier: 1.8, interval: .26, magazine: 12, reserve: 60, reload: 1.25, range: 65, automatic: false },
  { id: 'knife', name: 'Couteau', short: 'CT', slot: 2, damage: 55, headMultiplier: 1, interval: .55, magazine: 0, reserve: 0, reload: 0, range: 2.6, automatic: false },
  { id: 'stone', name: 'Protection en pierre', short: 'PR', slot: 3, damage: 0, headMultiplier: 1, interval: .2, magazine: 0, reserve: 0, reload: 0, range: 5.5, automatic: false }
]);
export const weaponById = id => WEAPONS.find(w=>w.id===id)||WEAPONS[0];
export const COLORS = ['#83b88a','#6ca5da','#de9661','#a8b4c4','#b483bb','#5b6878'];
export const SKINS = ['#ecc6a6','#c89a77','#986b4d','#694938'];
export const HELMETS = ['helmet','hood','cap'];
export function normalizeProfile(raw={}) {
  return { name:typeof raw.name==='string' ? raw.name.replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,16)||'Opérateur' : 'Opérateur', color:COLORS.includes(raw.color)?raw.color:COLORS[0], skin:SKINS.includes(raw.skin)?raw.skin:SKINS[0], helmet:HELMETS.includes(raw.helmet)?raw.helmet:'helmet' };
}
export function rayBox(origin,direction,min,max,range=100) {
  let near=0,far=range;
  for(const axis of ['x','y','z']) {
    if(Math.abs(direction[axis])<1e-9){if(origin[axis]<min[axis]||origin[axis]>max[axis])return null;continue;}
    let a=(min[axis]-origin[axis])/direction[axis],b=(max[axis]-origin[axis])/direction[axis];if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return null;
  }
  return near;
}
export function hitPlayer(origin,direction,position,range) {
  const p=position;
  const head=rayBox(origin,direction,{x:p.x-.24,y:p.y+1.4,z:p.z-.24},{x:p.x+.24,y:p.y+1.78,z:p.z+.24},range);
  const body=rayBox(origin,direction,{x:p.x-.29,y:p.y,z:p.z-.29},{x:p.x+.29,y:p.y+1.4,z:p.z+.29},range);
  if(head!==null&&(body===null||head<=body))return {distance:head,head:true};
  return body!==null?{distance:body,head:false}:null;
}
