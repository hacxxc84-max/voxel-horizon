import { createDuelServer,localAddresses } from './duel-server.mjs';
import { execFile } from 'node:child_process';
const port=Number(process.env.PORT||process.env.VOXEL_PORT||4173),host=process.env.HOST||'0.0.0.0';
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Port de serveur invalide.');
function openBrowser(url){if(process.platform==='win32')execFile('cmd.exe',['/c','start','',url],{windowsHide:true},()=>{});else execFile(process.platform==='darwin'?'open':'xdg-open',[url],()=>{});}
const app=createDuelServer();
let stopping=false;
async function shutdown(){if(stopping)return;stopping=true;await app.close();}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
app.server.on('error',async error=>{
  if(error.code==='EADDRINUSE'){
    try{const response=await fetch('http://127.0.0.1:'+port+'/__voxel_health',{signal:AbortSignal.timeout(1500)}),info=await response.json();if(info.game==='voxel-horizon'&&info.protocol===2){console.log('Horizon Duel est déjà lancé : http://127.0.0.1:'+port);if(process.argv.includes('--open'))openBrowser('http://127.0.0.1:'+port);return;}}catch{}
    console.error('Le port '+port+' est occupé. Arrêtez l’ancien serveur ou utilisez VOXEL_PORT avec un autre port.');
  }else console.error(error.message);
  process.exitCode=1;
});
app.server.listen(port,host,()=>{
  console.log('\n  HORIZON / DUEL — FPS 1 CONTRE 1\n  Sur ce PC : http://127.0.0.1:'+port+'\n');
  for(const address of localAddresses(port))console.log('  Sur le réseau : '+address);
  console.log('\n  ZQSD | Maj : sprint | 1/2/3 : armes | 4 : pierre | R : recharger\n  Gardez cette fenêtre ouverte. Ctrl+C pour arrêter.\n');
  if(process.argv.includes('--open'))openBrowser('http://127.0.0.1:'+port);
});
