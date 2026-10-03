export class Network {
  constructor(){this.socket=null;this.room=null;this.id=null;this.handlers=new Map();this.rtt=0;this.pingTimer=null;this.intentional=false;}
  on(type,handler){if(!this.handlers.has(type))this.handlers.set(type,[]);this.handlers.get(type).push(handler);}
  emit(type,data){for(const handler of this.handlers.get(type)||[])handler(data);}
  async connect(){
    if(this.socket?.readyState===WebSocket.OPEN)return;
    this.intentional=false;
    const url=(location.protocol==='https:'?'wss://':'ws://')+location.host+'/duel';
    await new Promise((resolve,reject)=>{
      const socket=new WebSocket(url);this.socket=socket;let opened=false;const timeout=setTimeout(()=>{socket.close();reject(new Error('Le serveur ne répond pas. Vérifiez le lanceur ou la connexion.'));},6000);
      socket.onopen=()=>{opened=true;clearTimeout(timeout);this.pingTimer=setInterval(()=>this.send({type:'ping',time:performance.now()}),1500);resolve();};
      socket.onerror=()=>{clearTimeout(timeout);reject(new Error('Connexion au serveur impossible. Lancez Jouer.cmd ou utilisez le lien du serveur partagé.'));};
      socket.onclose=()=>{clearTimeout(timeout);if(!opened)reject(new Error('Le serveur a fermé la connexion.'));if(this.socket!==socket)return;clearInterval(this.pingTimer);this.room=null;if(!this.intentional)this.emit('disconnect',{});};
      socket.onmessage=event=>{try{const message=JSON.parse(event.data);if(message.type==='pong'){this.rtt=Math.max(0,Math.round(performance.now()-message.time));return;}if(message.type==='welcome'){this.room=message.code;this.id=message.id;}this.emit(message.type,message);}catch(error){console.error(error);this.emit('error',{message:'Un message du serveur n’a pas pu être lu.'});}};
    });
  }
  send(message){if(this.socket?.readyState===WebSocket.OPEN&&this.socket.bufferedAmount<64000){this.socket.send(JSON.stringify(message));return true;}return false;}
  close(){this.intentional=true;clearInterval(this.pingTimer);this.socket?.close();this.socket=null;this.room=null;this.id=null;}
}
