import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { WebSocketServer, WebSocket } from './vendor/ws/package/wrapper.mjs';
import { DuelGame } from './src/duel-game.js';
import { mapById } from './src/arenas.js';

const root=path.dirname(fileURLToPath(import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
const send=(ws,data)=>{
  if(ws.readyState!==WebSocket.OPEN)return;
  if(ws.bufferedAmount>=256000){ws.close(1013,'Connexion trop lente. Reconnectez-vous.');return;}
  ws.send(JSON.stringify(data));
};
export function localAddresses(port){const addresses=[];for(const list of Object.values(os.networkInterfaces()))for(const info of list||[])if(info.family==='IPv4'&&!info.internal)addresses.push('http://'+info.address+':'+port);return addresses;}

export function createDuelServer({maxRooms=32}={}) {
  const rooms=new Map(),connections=new Set();
  const server=http.createServer(async(req,res)=>{
    try{
      if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
      const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);
      if(pathname==='/__voxel_health'){
        res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:JSON.stringify({game:'voxel-horizon',version:'2.0.0',protocol:2,addresses:localAddresses(server.address()?.port||4173),publicUrl:process.env.PUBLIC_URL||''}));return;
      }
      const allowed=pathname==='/'||pathname==='/index.html'||pathname==='/icon.svg'||pathname==='/duel.css'||/^\/src\/[a-z0-9-]+\.js$/.test(pathname)||/^\/vendor\/three\.(module|core)\.js$/.test(pathname);
      if(!allowed){res.writeHead(404);res.end('Fichier introuvable');return;}
      const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
      if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
      if(!(await stat(file)).isFile())throw new Error('Missing file');
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(req.method==='HEAD'?undefined:await readFile(file));
    }catch{res.writeHead(404);res.end('Fichier introuvable');}
  });
  const wss=new WebSocketServer({noServer:true,maxPayload:4096,perMessageDeflate:false});
  server.on('upgrade',(req,socket,head)=>{
    let valid=false;try{valid=new URL(req.url,'http://local').pathname==='/duel'&&(!req.headers.origin||new URL(req.headers.origin).host===req.headers.host);}catch{}
    if(!valid||connections.size>=64){socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;}
    wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
  });
  const broadcast=(room,data)=>{for(const ws of room.sockets)send(ws,data);};
  function leave(ws){
    const room=ws.room;if(!room)return;room.sockets.delete(ws);room.game.removePlayer(ws.playerId);ws.room=null;
    if(!room.sockets.size)rooms.delete(room.code);else{if(room.host===ws.playerId)room.host=[...room.sockets][0].playerId;broadcast(room,{type:'state',code:room.code,host:room.host,...room.game.snapshot()});}
  }
  function welcome(ws,room){ws.room=room;room.sockets.add(ws);send(ws,{type:'welcome',id:ws.playerId,code:room.code,host:room.host,map:room.game.world.map.id,covers:[...room.game.world.cover.values()],state:room.game.snapshot()});broadcast(room,{type:'state',code:room.code,host:room.host,...room.game.snapshot()});}
  wss.on('connection',ws=>{
    ws.playerId=crypto.randomUUID();ws.room=null;ws.alive=true;ws.messageWindow=Date.now();ws.messageCount=0;connections.add(ws);
    ws.on('pong',()=>{ws.alive=true;});ws.on('error',()=>{});
    ws.on('message',(data,binary)=>{
      try{
        if(binary)throw new Error('Messages texte uniquement.');
        const now=Date.now();if(now-ws.messageWindow>1000){ws.messageWindow=now;ws.messageCount=0;}if(++ws.messageCount>150){ws.close(1008,'Message rate exceeded');return;}
        const message=JSON.parse(data.toString());if(!message||typeof message.type!=='string')return;
        if(message.type==='ping'){if(typeof message.time==='number'&&Number.isFinite(message.time))send(ws,{type:'pong',time:message.time});return;}
        if(message.type==='create'){
          if(ws.room)throw new Error('Quittez le salon actuel avant d’en créer un autre.');if(rooms.size>=maxRooms)throw new Error('Le serveur est complet. Réessayez plus tard.');
          const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let code;do{code=[...crypto.randomBytes(6)].map(n=>alphabet[n%alphabet.length]).join('');}while(rooms.has(code));
          const room={code,host:ws.playerId,game:new DuelGame(mapById(message.map).id),sockets:new Set()};room.game.addPlayer(ws.playerId,message.profile);rooms.set(code,room);welcome(ws,room);return;
        }
        if(message.type==='join'){
          if(ws.room)throw new Error('Vous êtes déjà dans un salon.');const code=typeof message.code==='string'?message.code.trim().toUpperCase():'';const room=rooms.get(code);if(!room)throw new Error('Salon introuvable. Vérifiez le code et l’adresse du serveur.');room.game.addPlayer(ws.playerId,message.profile);welcome(ws,room);return;
        }
        if(message.type==='leave'){leave(ws);return;}
        const room=ws.room;if(!room)return;
        if(message.type==='map'){if(room.host===ws.playerId)room.game.setMap(message.map);return;}
        room.game.command(ws.playerId,message);
      }catch(error){send(ws,{type:'error',message:error.message||'Message invalide.'});}
    });
    ws.on('close',()=>{connections.delete(ws);leave(ws);});
  });
  let previous=performance.now(),accumulator=0,tick=0,lastBroadcastTick=0;
  const timer=setInterval(()=>{
    const now=performance.now();accumulator+=Math.max(0,Math.min(.1,(now-previous)/1000));previous=now;
    while(accumulator>=1/60){for(const room of rooms.values())room.game.step(1/60);accumulator-=1/60;tick++;}
    const publish=tick-lastBroadcastTick>=3;if(publish)lastBroadcastTick=tick;
    for(const room of rooms.values()){
      for(const event of room.game.drainEvents())broadcast(room,{type:'event',event});
      if(publish)broadcast(room,{type:'state',code:room.code,host:room.host,...room.game.snapshot()});
    }
  },1000/60);timer.unref();
  const heartbeat=setInterval(()=>{for(const ws of connections){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},15000);heartbeat.unref();
  async function close(){clearInterval(timer);clearInterval(heartbeat);for(const ws of connections)ws.terminate();await new Promise(resolve=>wss.close(resolve));await new Promise(resolve=>server.close(resolve));}
  return {server,wss,rooms,close};
}
