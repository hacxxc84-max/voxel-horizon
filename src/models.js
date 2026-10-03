import * as THREE from '../vendor/three.module.js';
import { normalizeProfile } from './weapons.js';

const geometries=new Map(),materials=new Map();
const flashGeometry=new THREE.ConeGeometry(.057,.17,6),flashMaterial=new THREE.MeshBasicMaterial({color:0xffe99f,transparent:true,opacity:.94,blending:THREE.AdditiveBlending,depthWrite:false});
function boxGeometry(w,h,d){const key=[w,h,d].join(',');if(!geometries.has(key))geometries.set(key,new THREE.BoxGeometry(w,h,d));return geometries.get(key);}
function material(color,metal=false){const key=color+'/'+metal;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:metal?.43:.83,metalness:metal?.55:0}));return materials.get(key);}
function box(parent,dimensions,position,color,metal=false,rotation=null){const mesh=new THREE.Mesh(boxGeometry(...dimensions),material(color,metal));mesh.position.set(...position);if(rotation)mesh.rotation.set(...rotation);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
export function weaponModel(slot=0){
  const group=new THREE.Group();group.userData.slot=slot;
  if(slot===0){
    box(group,[.095,.11,.4],[0,0,-.18],'#303b40',true);
    box(group,[.09,.085,.24],[0,-.015,.17],'#926340');
    box(group,[.085,.07,.18],[0,-.005,-.44],'#a77348');
    box(group,[.029,.034,.25],[0,.012,-.64],'#263036',true);
    box(group,[.048,.057,.025],[0,.058,-.72],'#27353b',true);
    box(group,[.023,.035,.025],[0,.073,-.72],'#93b8b5',true);
    box(group,[.058,.14,.075],[0,-.12,-.03],'#705239',false,[-.22,0,0]);
    box(group,[.055,.11,.12],[0,-.135,-.23],'#313d42',true,[-.12,0,0]);
    box(group,[.054,.095,.11],[0,-.23,-.215],'#303a40',true,[-.28,0,0]);
    box(group,[.052,.07,.095],[0,-.307,-.184],'#303a40',true,[-.42,0,0]);
    box(group,[.023,.025,.31],[0,.076,-.14],'#1c272d',true);
    box(group,[.021,.043,.027],[0,.11,-.03],'#323d40',true);
    for(let i=0;i<4;i++)box(group,[.099,.008,.012],[0,.034,-.04-i*.06],'#536167',true);
  }else if(slot===1){
    box(group,[.078,.087,.255],[0,0,-.16],'#5d6b75',true);
    box(group,[.063,.04,.23],[0,-.055,-.16],'#243039',true);
    box(group,[.06,.155,.092],[0,-.139,-.072],'#263039',false,[-.18,0,0]);
    box(group,[.052,.028,.024],[0,.063,-.25],'#212b30',true);
    box(group,[.013,.016,.011],[0,.064,-.285],'#b9e6bc');
    box(group,[.09,.013,.036],[0,-.217,-.061],'#46525c',true);
  }else if(slot===2){
    box(group,[.048,.042,.21],[0,-.009,.075],'#323b42');
    box(group,[.12,.028,.032],[0,0,-.049],'#8a999b',true);
    box(group,[.053,.023,.235],[0,.005,-.18],'#c5d6d7',true);
    box(group,[.034,.022,.055],[0,.005,-.315],'#dae6e4',true);
    for(let i=0;i<3;i++)box(group,[.052,.046,.013],[0,-.009,.018+i*.055],'#617164');
  }else{box(group,[.23,.23,.23],[0,-.035,-.08],'#8f9d9b');}
  const flash=new THREE.Mesh(flashGeometry,flashMaterial);flash.rotation.x=-Math.PI/2;flash.position.set(0,.01,slot===0?-.83:-.39);flash.visible=false;group.add(flash);group.userData.flash=flash;
  return group;
}

export class Avatar {
  constructor(profile){this.root=new THREE.Group();this.phase=0;this.lastPosition=null;this.flashTime=0;this.weaponSlot=0;this.setProfile(profile);}
  setProfile(raw){
    this.profile=normalizeProfile(raw);this.root.clear();const p=this.profile;
    this.torso=new THREE.Group();this.root.add(this.torso);
    box(this.torso,[.49,.56,.28],[0,1.08,0],p.color);
    box(this.torso,[.38,.32,.038],[0,1.14,-.16],'#303f44');
    for(let i=0;i<3;i++)box(this.torso,[.095,.12,.04],[-.115+i*.115,1.09,-.19],'#536468');
    box(this.torso,[.46,.08,.31],[0,.8,0],'#34454a');
    this.head=new THREE.Group();this.head.position.y=1.55;this.root.add(this.head);
    box(this.head,[.41,.37,.35],[0,0,0],p.skin);
    box(this.head,[.35,.08,.035],[0,.035,-.192],'#122934',true);
    box(this.head,[.27,.014,.038],[0,.065,-.211],'#a2e6de');
    if(p.helmet==='helmet'){box(this.head,[.46,.19,.4],[0,.19,0],p.color);box(this.head,[.49,.038,.43],[0,.085,0],'#425b5b');}
    if(p.helmet==='hood'){box(this.head,[.46,.46,.12],[0,.02,.15],p.color);box(this.head,[.46,.08,.38],[0,.22,0],p.color);for(const x of [-.22,.22])box(this.head,[.08,.35,.35],[x,.005,0],p.color);}
    if(p.helmet==='cap'){box(this.head,[.43,.13,.38],[0,.2,0],'#34484e');box(this.head,[.42,.032,.2],[0,.135,-.24],p.color);}
    this.leftLeg=new THREE.Group();this.rightLeg=new THREE.Group();this.leftLeg.position.set(-.14,.78,0);this.rightLeg.position.set(.14,.78,0);this.root.add(this.leftLeg,this.rightLeg);
    for(const leg of [this.leftLeg,this.rightLeg]){box(leg,[.2,.63,.22],[0,-.315,0],'#42535b');box(leg,[.215,.14,.31],[0,-.71,-.036],'#27383c');}
    this.leftArm=new THREE.Group();this.rightArm=new THREE.Group();this.leftArm.position.set(-.335,1.36,0);this.rightArm.position.set(.335,1.36,0);this.root.add(this.leftArm,this.rightArm);
    for(const arm of [this.leftArm,this.rightArm]){box(arm,[.18,.42,.19],[0,-.21,0],p.color);box(arm,[.16,.13,.19],[0,-.483,0],p.skin);box(arm,[.17,.09,.2],[0,-.52,0],'#304447');}
    this.gun=new THREE.Group();this.gun.position.set(.28,1.02,-.38);this.gun.scale.setScalar(.75);this.root.add(this.gun);this.setWeapon(this.weaponSlot);
  }
  setWeapon(slot){this.weaponSlot=slot;this.gun.clear();this.gunModel=weaponModel(slot);this.gun.add(this.gunModel);}
  update(state,dt,{preview=false}={}){
    if(state.weapon!==undefined&&state.weapon!==this.weaponSlot)this.setWeapon(state.weapon);
    const desired=new THREE.Vector3(state.x||0,state.y||0,state.z||0);
    if(!this.lastPosition||this.root.position.distanceTo(desired)>4)this.root.position.copy(desired);else this.root.position.lerp(desired,1-Math.exp(-dt*16));
    this.lastPosition=desired;
    let delta=(state.yaw||0)-this.root.rotation.y;delta=Math.atan2(Math.sin(delta),Math.cos(delta));this.root.rotation.y+=delta*(1-Math.exp(-dt*16));
    const moving=preview||state.moving,sprint=state.sprint;this.phase+=dt*(moving?(sprint?15:10):3);
    const swing=moving?Math.sin(this.phase)*(sprint?.85:.47):Math.sin(this.phase)*.015;
    this.leftLeg.rotation.x=swing;this.rightLeg.rotation.x=-swing;
    this.torso.position.y=moving?Math.abs(Math.sin(this.phase))*(sprint?.035:.018):Math.sin(this.phase)*.008;
    this.leftArm.rotation.x=moving?-swing*.65:-.1;this.rightArm.rotation.x=sprint?swing*.75:-.67;
    if(!sprint){this.leftArm.rotation.x=-.72+(state.pitch||0);this.rightArm.rotation.x=-.77+(state.pitch||0);}
    this.head.rotation.x=state.pitch||0;this.gun.rotation.x=-(state.pitch||0);this.gun.position.y=sprint?.85:1.04;this.gun.rotation.z=sprint?.2:0;
    this.flashTime=Math.max(0,this.flashTime-dt);this.gunModel.userData.flash.visible=this.flashTime>0&&this.weaponSlot<2;
    this.root.visible=state.health!==0;
  }
  fire(){this.flashTime=.075;}
}

export class WeaponRig {
  constructor(profile){this.root=new THREE.Group();this.profile=normalizeProfile(profile);this.models=Array.from({length:4},(_,i)=>weaponModel(i));this.mount=new THREE.Group();this.root.add(this.mount);for(const model of this.models)this.mount.add(model);this.slot=0;this.recoil=0;this.flash=0;this.swing=0;this.switchTime=0;this.phase=0;
    this.rightArm=box(this.mount,[.11,.13,.34],[.06,-.23,.18],this.profile.color,false,[-.1,-.1,.02]);this.glove=box(this.mount,[.095,.1,.12],[0,-.14,.015],'#304447');
    this.leftArm=box(this.mount,[.095,.095,.4],[-.09,-.14,-.21],this.profile.color,false,[.22,.3,.1]);this.leftGlove=box(this.mount,[.1,.075,.11],[-.04,-.04,-.41],'#304447');this.setSlot(0);
  }
  setProfile(profile){this.profile=normalizeProfile(profile);this.rightArm.material=material(this.profile.color);this.leftArm.material=material(this.profile.color);}
  setSlot(slot){if(slot!==this.slot)this.switchTime=.23;this.slot=slot;this.models.forEach((m,i)=>m.visible=i===slot);}
  fire(){this.recoil=Math.min(1.4,this.recoil+.8);this.flash=.045;if(this.slot===2)this.swing=.4;}
  update(dt,{moving=false,sprint=false,reload=0,aim=false}={}){
    this.phase+=dt*(sprint?15:10);this.recoil=Math.max(0,this.recoil-dt*9);this.flash=Math.max(0,this.flash-dt);this.swing=Math.max(0,this.swing-dt);this.switchTime=Math.max(0,this.switchTime-dt);
    const bob=moving?Math.sin(this.phase)*.012:Math.sin(this.phase*.3)*.002;
    const reloadPose=reload>0?Math.sin(Math.min(1,reload/WEAPON_RELOAD[this.slot])*Math.PI)*.85:0;
    this.mount.position.set(aim?.12:.32,-.30+bob-(sprint?.14:0)-this.switchTime*.45,-.54+this.recoil*.028);
    this.mount.rotation.set(this.recoil*.075+reloadPose*.7+(sprint?.35:0),reloadPose*-.55,sprint?-.25:Math.sin(this.phase)*.006*(moving?1:0));
    if(this.swing>0){const attack=Math.sin((1-this.swing/.4)*Math.PI);this.mount.position.x-=attack*.3;this.mount.position.z-=attack*.3;this.mount.rotation.z-=attack*1.1;}
    this.leftArm.position.y=-.14-reloadPose*.22;this.leftArm.rotation.z=.1-reloadPose*.4;this.leftGlove.visible=this.slot===0;this.leftArm.visible=this.slot===0||reload>0;
    for(const m of this.models)m.userData.flash.visible=this.flash>0&&this.slot<2&&m.visible;
  }
}
const WEAPON_RELOAD=[2.1,1.25,0,0];
