import * as THREE from '../vendor/three.module.js';
import { makeAtlas, geometry } from './render.js';
import { meshChunk } from './mesher.js';
import { Avatar, WeaponRig } from './models.js';
import { mapById } from './arenas.js';

export class DuelView {
  constructor(canvas,previewCanvas,settings,profile) {
    this.canvas=canvas;this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#8cabb6');this.scene.fog=new THREE.Fog('#8cabb6',33,85);
    this.camera=new THREE.PerspectiveCamera(75,1,.04,240);this.camera.rotation.order='YXZ';
    this.atlas=makeAtlas();this.stoneMaterial=new THREE.MeshStandardMaterial({map:this.atlas.texture,vertexColors:true,roughness:.93});this.worldGroup=new THREE.Group();this.scene.add(this.worldGroup);this.chunks=new Map();this.avatars=new Map();this.effects=[];
    this.scene.add(new THREE.HemisphereLight(0xd3ecfa,0x647576,2.1));this.sun=new THREE.DirectionalLight(0xfff0da,2.6);this.sun.position.set(9,62,35);this.sun.target.position.set(24,0,24);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-38,right:38,top:38,bottom:-38,near:1,far:115});this.sun.shadow.bias=-.0004;this.sun.shadow.normalBias=.03;this.scene.add(this.sun,this.sun.target);this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.selection=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006,1.006,1.006)),new THREE.LineBasicMaterial({color:0xb5efb0,transparent:true,opacity:.9}));this.selection.visible=false;this.scene.add(this.selection);
    this.weaponScene=new THREE.Scene();this.weaponCamera=new THREE.PerspectiveCamera(75,1,.04,10);this.weaponScene.add(new THREE.HemisphereLight(0xd2e9e9,0x788579,2.7));const weaponLight=new THREE.DirectionalLight(0xffe3c0,2);weaponLight.position.set(-1,2,3);this.weaponScene.add(weaponLight);this.rig=new WeaponRig(profile);this.weaponScene.add(this.rig.root);this.showWeapon=false;
    this.previewRenderer=new THREE.WebGLRenderer({canvas:previewCanvas,alpha:true,antialias:true});this.previewRenderer.outputColorSpace=THREE.SRGBColorSpace;this.previewRenderer.toneMapping=THREE.ACESFilmicToneMapping;this.previewRenderer.setClearColor(0x000000,0);
    this.previewScene=new THREE.Scene();this.previewScene.add(new THREE.HemisphereLight(0xdaedf4,0x6c847a,3));const previewLight=new THREE.DirectionalLight(0xffe8c1,3);previewLight.position.set(-2,4,-3);this.previewScene.add(previewLight);this.previewCamera=new THREE.PerspectiveCamera(33,1,.1,20);this.previewCamera.position.set(2.1,1.5,-3.9);this.previewCamera.lookAt(0,.92,0);this.previewAvatar=new Avatar(profile);this.previewScene.add(this.previewAvatar.root);
    this.previewAvatar.root.rotation.y=-.28;this.previewTime=0;this.applySettings(settings);window.addEventListener('resize',()=>this.resize());
  }
  resize(){const w=window.innerWidth,h=window.innerHeight;this.renderer.setSize(w,h,false);this.camera.aspect=this.weaponCamera.aspect=w/h;this.camera.updateProjectionMatrix();this.weaponCamera.updateProjectionMatrix();const canvas=this.previewRenderer.domElement,pw=canvas.clientWidth||260,ph=canvas.clientHeight||300;this.previewRenderer.setSize(pw,ph,false);this.previewCamera.aspect=pw/ph;this.previewCamera.updateProjectionMatrix();}
  applySettings(settings){this.settings=settings;this.renderer.setPixelRatio(Math.min(devicePixelRatio,settings.quality==='high'?1.7:settings.quality==='low'?1:1.25));this.renderer.shadowMap.enabled=settings.quality!=='low';this.renderer.shadowMap.needsUpdate=true;this.previewRenderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.scene.fog.far=settings.distance===48?55:settings.distance===128?110:85;this.resize();}
  setProfile(profile){this.rig.setProfile(profile);this.previewAvatar.setProfile(profile);}
  loadWorld(world){
    for(const mesh of this.chunks.values()){this.worldGroup.remove(mesh);mesh.geometry.dispose();}this.chunks.clear();
    const map=world.map;this.scene.background.set(map.sky);this.scene.fog.color.set(map.sky);this.stoneMaterial.color.set(map.ground);
    for(const key of [...world.dirty])this.build(world,key);this.menuCamera();
  }
  build(world,key){const [x,y,z]=key.split(',').map(Number);if(x>=3||z>=3)return world.dirty.delete(key);const data=meshChunk(world,x,y,z).opaque,old=this.chunks.get(key);if(old){this.worldGroup.remove(old);old.geometry.dispose();this.chunks.delete(key);}if(data.indices.length){const mesh=new THREE.Mesh(geometry(data),this.stoneMaterial);mesh.castShadow=true;mesh.receiveShadow=true;this.worldGroup.add(mesh);this.chunks.set(key,mesh);}world.dirty.delete(key);}
  updateWorld(world){for(const key of [...world.dirty])this.build(world,key);}
  menuCamera(){this.camera.position.set(34,19,41);this.camera.lookAt(23,2,23);this.showWeapon=false;this.selection.visible=false;}
  setPlayer(player,state,dt){const eye=player.eye;this.camera.position.set(eye.x,eye.y,eye.z);this.camera.rotation.set(player.pitch,player.yaw,0,'YXZ');const active=state.health>0;this.showWeapon=active;this.rig.setSlot(state.weapon);this.rig.update(dt,{moving:state.moving,sprint:state.sprint,reload:state.reload,aim:state.aim});const fov=state.aim&&state.weapon<2?62:state.sprint?83:75;this.camera.fov+=(fov-this.camera.fov)*(1-Math.exp(-dt*9));this.camera.updateProjectionMatrix();}
  setTarget(target){this.selection.visible=Boolean(target);if(target)this.selection.position.set(target.x+.5,target.y+.5,target.z+.5);}
  setAvatars(players,selfId,dt){
    const ids=new Set(players.filter(p=>p.id!==selfId).map(p=>p.id));for(const [id,data] of this.avatars)if(!ids.has(id)){this.scene.remove(data.avatar.root);data.texture.dispose();data.sprite.material.dispose();this.avatars.delete(id);}
    for(const p of players){if(p.id===selfId)continue;let data=this.avatars.get(p.id);const profileKey=JSON.stringify(p.profile);
      if(data&&data.profileKey!==profileKey){this.scene.remove(data.avatar.root);data.texture.dispose();data.sprite.material.dispose();this.avatars.delete(p.id);data=null;}
      if(!data){const avatar=new Avatar(p.profile),labelCanvas=document.createElement('canvas');labelCanvas.width=256;labelCanvas.height=64;const texture=new THREE.CanvasTexture(labelCanvas),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));sprite.scale.set(1.8,.45,1);sprite.position.y=2.16;avatar.root.add(sprite);this.scene.add(avatar.root);data={avatar,canvas:labelCanvas,texture,sprite,profileKey,health:-1};this.avatars.set(p.id,data);}
      data.avatar.update(p,dt);
      if(data.health!==p.health){const ctx=data.canvas.getContext('2d');ctx.clearRect(0,0,256,64);ctx.fillStyle='#112a32';ctx.globalAlpha=.8;ctx.fillRect(8,4,240,54);ctx.globalAlpha=1;ctx.fillStyle='#f4f7ec';ctx.font='bold 17px Segoe UI';ctx.textAlign='center';ctx.fillText(p.profile.name,128,28);ctx.fillStyle='#405357';ctx.fillRect(25,38,206,7);ctx.fillStyle=p.health>35?'#b0eca0':'#f39483';ctx.fillRect(25,38,206*p.health/100,7);data.texture.needsUpdate=true;data.health=p.health;}
    }
  }
  shot(event,selfId){
    if(event.player===selfId)this.rig.fire();else this.avatars.get(event.player)?.avatar.fire();
    if(event.weapon===2)return;
    const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(event.from.x,event.from.y,event.from.z),new THREE.Vector3(event.to.x,event.to.y,event.to.z)]),mat=new THREE.LineBasicMaterial({color:0xffe6a5,transparent:true,opacity:.65}),line=new THREE.Line(geo,mat);this.scene.add(line);this.effects.push({object:line,life:.075});
    if(this.effects.length>40){const old=this.effects.shift();this.scene.remove(old.object);old.object.geometry.dispose();old.object.material.dispose();}
  }
  render(dt,{menu=false,preview=false}={}){
    for(let i=this.effects.length-1;i>=0;i--){const effect=this.effects[i];effect.life-=dt;effect.object.material.opacity=Math.max(0,effect.life/.075)*.65;if(effect.life<=0){this.scene.remove(effect.object);effect.object.geometry.dispose();effect.object.material.dispose();this.effects.splice(i,1);}}
    if(menu){this.previewTime+=dt;this.camera.position.x=34+Math.sin(this.previewTime*.1)*1.3;this.camera.lookAt(23,2,23);}
    this.renderer.autoClear=true;this.renderer.render(this.scene,this.camera);if(this.showWeapon){this.renderer.autoClear=false;this.renderer.clearDepth();this.renderer.render(this.weaponScene,this.weaponCamera);this.renderer.autoClear=true;}
    if(preview){this.previewAvatar.update({x:0,y:0,z:0,yaw:-.26,health:100,weapon:0,moving:false},dt);this.previewRenderer.render(this.previewScene,this.previewCamera);}
  }
}
