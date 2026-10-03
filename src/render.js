import * as THREE from '../vendor/three.module.js';
import { SIZE, HEIGHT, WATER_LEVEL, BLOCKS, hash2 } from './world.js';
import { meshChunk } from './mesher.js';

export function makeAtlas() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 72;
  const ctx = canvas.getContext('2d');
  const palette = ['#88ad54','#8f7750','#94704e','#a2aaa0','#e0cf98','#95754e','#bb9464','#729951','#caa773','#bddde0','#b97864','#76bec4','#485750'];
  for (let tile = 0; tile < palette.length; tile++) {
    const ox = tile % 4 * 18 + 1, oy = Math.floor(tile / 4) * 18 + 1;
    ctx.fillStyle = palette[tile]; ctx.fillRect(ox,oy,16,16);
    for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) {
      const n = hash2(x,y, tile * 151 + 42);
      ctx.fillStyle = n > .55 ? 'rgba(255,244,206,' + ((n - .55) * .25) + ')' : 'rgba(32,45,25,' + ((.55 - n) * .24) + ')';
      ctx.fillRect(ox + x,oy + y,1,1);
    }
    if (tile === 1) {
      ctx.fillStyle = '#81a752'; ctx.fillRect(ox,oy,16,4);
      for (let x = 0; x < 16; x++) { ctx.fillStyle = '#75964b'; ctx.fillRect(ox+x,oy+3,1,1+Math.floor(hash2(x,0,11)*3)); }
    }
    if (tile === 5) for (let x = 2; x < 16; x += 4) { ctx.fillStyle='#745c3a';ctx.fillRect(ox+x,oy,1,16);ctx.fillStyle='#ad8658';ctx.fillRect(ox+x+1,oy,1,16); }
    if (tile === 6) { ctx.strokeStyle='#8f7048'; for (let d = 3; d < 15; d += 4) ctx.strokeRect(ox+d/2,oy+d/2,16-d,16-d); }
    if (tile === 7) for (let i = 0; i < 22; i++) { ctx.fillStyle=i%2 ? '#608641' : '#86aa5b';ctx.fillRect(ox+hash2(i,1,7)*14,oy+hash2(i,2,7)*14,2,2); }
    if (tile === 8) { ctx.fillStyle='#a3855d';for(let y=3;y<16;y+=4) ctx.fillRect(ox,oy+y,16,1);ctx.fillRect(ox+7,oy,1,4);ctx.fillRect(ox+3,oy+4,1,4);ctx.fillRect(ox+11,oy+8,1,4); }
    if (tile === 9) {
      ctx.clearRect(ox,oy,16,16);ctx.fillStyle='rgba(172,214,218,0.2)';ctx.fillRect(ox,oy,16,16);
      ctx.strokeStyle='rgba(223,245,240,0.85)';ctx.lineWidth=1;ctx.strokeRect(ox+.5,oy+.5,15,15);ctx.fillStyle='rgba(223,245,240,0.55)';ctx.fillRect(ox+2,oy+3,2,5);ctx.fillRect(ox+4,oy+2,3,1);
    }
    if (tile === 10) { ctx.fillStyle='#d9b897';for(let y=0;y<16;y+=5){ctx.fillRect(ox,oy+y,16,1);for(let x=(y%10===0?0:4);x<16;x+=8)ctx.fillRect(ox+x,oy+y,1,5);} }
    if (tile === 11) { ctx.fillStyle='#abd9d1';ctx.globalAlpha=.13;ctx.fillRect(ox+2,oy+5,8,1);ctx.fillRect(ox+6,oy+12,7,1);ctx.globalAlpha=1; }
    // One-pixel gutter protects tile edges during interpolation.
    ctx.drawImage(canvas,ox,oy,16,1,ox,oy-1,16,1);ctx.drawImage(canvas,ox,oy+15,16,1,ox,oy+16,16,1);
    ctx.drawImage(canvas,ox,oy-1,1,18,ox-1,oy-1,1,18);ctx.drawImage(canvas,ox+15,oy-1,1,18,ox+16,oy-1,1,18);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter; texture.generateMipmaps = false;
  return { texture, canvas };
}

export function blockIcon(block, atlas) {
  const c = document.createElement('canvas'); c.width=56;c.height=60;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
  function face(points,tile,opacity=1) {
    ctx.save();ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();
    const [a,b,,d]=points;ctx.setTransform((b[0]-a[0])/16,(b[1]-a[1])/16,(d[0]-a[0])/16,(d[1]-a[1])/16,a[0],a[1]);
    ctx.globalAlpha=opacity;ctx.drawImage(atlas,tile%4*18+1,Math.floor(tile/4)*18+1,16,16,0,0,16,16);ctx.restore();
  }
  face([[28,4],[52,17],[28,30],[4,17]],block.top);
  face([[4,17],[28,30],[28,56],[4,43]],block.side,.78);
  face([[28,30],[52,17],[52,43],[28,56]],block.side,.96);
  return c.toDataURL();
}
export function geometry(data) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));
  geo.setAttribute('normal',new THREE.Float32BufferAttribute(data.normals,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(data.colors,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(data.uvs,2));
  geo.setIndex(data.indices);geo.computeBoundingSphere();return geo;
}

export class View {
  constructor(canvas, settings) {
    this.renderer = new THREE.WebGLRenderer({ canvas,antialias:true,powerPreference:'high-performance' });
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.08;
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(73,1,.05,450);this.camera.rotation.order='YXZ';this.scene.add(this.camera);
    this.scene.fog=new THREE.Fog('#b8d3cf',36,105);
    this.atlas=makeAtlas();this.icons=BLOCKS.slice(0,9).map(b=>blockIcon(b,this.atlas.canvas));
    this.materials={
      opaque:new THREE.MeshLambertMaterial({map:this.atlas.texture,vertexColors:true}),
      water:new THREE.MeshPhongMaterial({map:this.atlas.texture,vertexColors:true,transparent:true,opacity:.63,shininess:90,specular:0xb2e0d8,depthWrite:false,side:THREE.DoubleSide}),
      glass:new THREE.MeshLambertMaterial({map:this.atlas.texture,vertexColors:true,transparent:true,opacity:.85,alphaTest:.04,depthWrite:false,side:THREE.DoubleSide})
    };
    this.chunks=new Map();this.worldGroup=new THREE.Group();this.scene.add(this.worldGroup);
    this.ambient=new THREE.HemisphereLight(0xdceefa,0x677751,2.1);this.scene.add(this.ambient);
    this.sun=new THREE.DirectionalLight(0xffe3b5,2.3);this.sun.position.set(-35,85,50);this.sun.target.position.set(64,12,64);this.scene.add(this.sun,this.sun.target);
    this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-35,right:35,top:35,bottom:-35,near:1,far:220});this.sun.shadow.bias=-.0005;this.sun.shadow.normalBias=.05;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(150,24,16),new THREE.ShaderMaterial({
      uniforms:{top:{value:new THREE.Color('#7cadc0')},bottom:{value:new THREE.Color('#dce3c3')}},
      vertexShader:'varying vec3 vPosition; void main(){ vPosition=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader:'uniform vec3 top; uniform vec3 bottom; varying vec3 vPosition; void main(){ float h=normalize(vPosition).y; gl_FragColor=vec4(mix(bottom,top,smoothstep(-0.04,0.65,h)),1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
      side:THREE.BackSide,depthWrite:false
    }));this.sky.renderOrder=-10;this.scene.add(this.sky);
    const oceanMaterial=new THREE.MeshPhongMaterial({color:'#67aeb4',transparent:true,opacity:.85,shininess:80});
    for(const [w,h,x,z] of [[512,192,64,-96],[512,192,64,224],[192,128,-96,64],[192,128,224,64]]){
      const plane=new THREE.Mesh(new THREE.PlaneGeometry(w,h),oceanMaterial);plane.rotation.x=-Math.PI/2;plane.position.set(x,WATER_LEVEL+.88,z);this.scene.add(plane);
    }
    this.clouds=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshLambertMaterial({color:0xfff8e1,transparent:true,opacity:.8,depthWrite:false}),72);
    const transform=new THREE.Object3D();
    for(let i=0;i<72;i++){ const cluster=Math.floor(i/4);transform.position.set(hash2(cluster,1,123)*230-45+(i%4)*3,52+hash2(cluster,2,123)*13,hash2(cluster,3,123)*230-45);transform.scale.set(8+hash2(i,4,22)*8,1.4+hash2(i,5,22)*2,6+hash2(i,6,22)*6);transform.updateMatrix();this.clouds.setMatrixAt(i,transform.matrix); }
    this.scene.add(this.clouds);
    this.selection=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006,1.006,1.006)),new THREE.LineBasicMaterial({color:0xf1f7c6,transparent:true,opacity:.85}));this.selection.visible=false;this.scene.add(this.selection);
    this.held=new THREE.Mesh(new THREE.BoxGeometry(.25,.25,.25),this.materials.opaque.clone());this.held.material.vertexColors=false;this.held.position.set(.43,-.33,-.65);this.held.rotation.set(.25,-.45,.04);this.camera.add(this.held);this.held.visible=false;
    this.heldLight=new THREE.PointLight(0xffefd4,2,.9,1);this.heldLight.position.set(.2,.1,-.3);this.camera.add(this.heldLight);
    this.particles=[];this.particleGeometry=new THREE.BoxGeometry(.07,.07,.07);this.particleMaterials=new Map();
    this.updateSettings(settings);this.resize();
    window.addEventListener('resize',()=>this.resize());
  }
  resize(){this.renderer.setSize(window.innerWidth,window.innerHeight,false);this.camera.aspect=window.innerWidth/window.innerHeight;this.camera.updateProjectionMatrix();}
  updateSettings(settings){this.settings=settings;this.renderer.setPixelRatio(Math.min(devicePixelRatio,settings.quality==='high'?1.75:settings.quality==='low'?1:1.3));this.renderer.shadowMap.enabled=settings.quality==='high';this.scene.fog.near=settings.distance*.48;this.scene.fog.far=settings.distance;this.camera.far=Math.max(180,settings.distance*2);this.camera.updateProjectionMatrix();this.resize();}
  clear(){for(const mesh of this.chunks.values()){this.worldGroup.remove(mesh);mesh.geometry.dispose();}this.chunks.clear();this.selection.visible=false;for(const p of this.particles)this.scene.remove(p.mesh);this.particles=[];}
  build(world,key){
    const [x,y,z]=key.split(',').map(Number), data=meshChunk(world,x,y,z);
    for(const kind of ['opaque','water','glass']){
      const meshKey=key+'/'+kind,old=this.chunks.get(meshKey);if(old){this.worldGroup.remove(old);old.geometry.dispose();this.chunks.delete(meshKey);}
      if(!data[kind].indices.length)continue;
      const mesh=new THREE.Mesh(geometry(data[kind]),this.materials[kind]);mesh.castShadow=kind==='opaque';mesh.receiveShadow=kind==='opaque';mesh.userData.center=new THREE.Vector3(x*16+8,y*16+8,z*16+8);this.worldGroup.add(mesh);this.chunks.set(meshKey,mesh);
    }
    world.dirty.delete(key);
  }
  updateChunks(world,budget=6){const started=performance.now();for(const key of world.dirty){this.build(world,key);if(performance.now()-started>budget)break;}}
  updateVisibility(){for(const mesh of this.chunks.values()){const p=mesh.userData.center;mesh.visible=Math.hypot(p.x-this.camera.position.x,p.z-this.camera.position.z)<this.settings.distance+14;}}
  setPlayer(player){const eye=player.eye;this.camera.position.set(eye.x,eye.y,eye.z);this.camera.rotation.set(player.pitch,player.yaw,0,'YXZ');this.held.visible=true;const bob=Math.sin(player.distanceWalked*2.7)*.009;this.held.position.y=-.33+bob;this.sun.target.position.set(eye.x,10,eye.z);}
  setHeld(index){
    const block=BLOCKS[index],uv=this.held.geometry.attributes.uv;
    // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z.
    for(let face=0;face<6;face++){const tile=face===2?block.top:face===3?block.bottom:block.side;for(let i=0;i<4;i++){const base=i===0?[0,1]:i===1?[1,1]:i===2?[0,0]:[1,0];uv.setXY(face*4+i,((tile%4)*18+1+base[0]*16)/72,1-(Math.floor(tile/4)*18+17-base[1]*16)/72);}}
    uv.needsUpdate=true;this.held.material.transparent=index===7;this.held.material.opacity=index===7?.8:1;this.held.material.needsUpdate=true;
  }
  setTarget(target){this.selection.visible=Boolean(target);if(target)this.selection.position.set(target.x+.5,target.y+.5,target.z+.5);}
  breakParticles(target){
    let material=this.particleMaterials.get(target.id);if(!material){material=new THREE.MeshLambertMaterial({color:BLOCKS[target.id-1].color});this.particleMaterials.set(target.id,material);}
    for(let i=0;i<10;i++){if(this.particles.length>=80){const old=this.particles.shift();this.scene.remove(old.mesh);}const mesh=new THREE.Mesh(this.particleGeometry,material);mesh.position.set(target.x+.5,target.y+.5,target.z+.5);this.scene.add(mesh);this.particles.push({mesh,v:new THREE.Vector3((Math.random()-.5)*3,Math.random()*3,(Math.random()-.5)*3),life:.55+Math.random()*.3});}
  }
  animate(dt,time){
    const angle=(time-.25)*Math.PI*2,day=Math.max(0,Math.sin(angle)),light=.18+day*.82;
    this.ambient.intensity=.4+light*1.6;this.sun.intensity=day*2.3;
    const focus=this.sun.target.position;this.sun.position.set(focus.x+Math.cos(angle)*85,Math.max(8,Math.sin(angle)*100)+18,focus.z+45);
    const top=new THREE.Color('#7cadc0').lerp(new THREE.Color('#111c36'),1-light),bottom=new THREE.Color('#dce3c3').lerp(new THREE.Color('#33494f'),1-light);
    this.sky.material.uniforms.top.value.copy(top);this.sky.material.uniforms.bottom.value.copy(bottom);this.scene.fog.color.copy(bottom);this.sky.position.copy(this.camera.position);
    this.clouds.position.x=(Math.sin(time*Math.PI*2)*12);this.clouds.material.opacity=.35+light*.4;
    for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.life-=dt;p.v.y-=9*dt;p.mesh.position.addScaledVector(p.v,dt);p.mesh.rotation.x+=dt*3;if(p.life<0){this.scene.remove(p.mesh);this.particles.splice(i,1);}}
  }
  render(){this.renderer.render(this.scene,this.camera);}
}
