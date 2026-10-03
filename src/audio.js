export class Sound {
  constructor(){this.context=null;this.volume=.35;}
  unlock(){try{this.context??=new(window.AudioContext||window.webkitAudioContext)();if(this.context.state==='suspended')this.context.resume().catch(()=>{});}catch{/* Audio is optional. */}}
  play(kind='break'){
    if(!this.context||this.context.state!=='running'||this.volume===0)return;
    const ctx=this.context,duration=kind==='step'?.07:kind==='place'?.11:.16;
    const buffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*duration),ctx.sampleRate),samples=buffer.getChannelData(0);
    for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*(1-i/samples.length)**2;
    const source=ctx.createBufferSource();source.buffer=buffer;
    const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=kind==='break'?1800:kind==='place'?650:280;
    const gain=ctx.createGain();gain.gain.value=this.volume*(kind==='step'?.1:.2);source.connect(filter);filter.connect(gain);gain.connect(ctx.destination);source.start();
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  }
  gun(slot=0){
    if(!this.context||this.context.state!=='running'||this.volume===0)return;
    const ctx=this.context,duration=slot===2?.11:.17,buffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*duration),ctx.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/data.length*(slot===2?3:8));
    const noise=ctx.createBufferSource();noise.buffer=buffer;const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=slot===2?3500:slot===1?2600:1700;const gain=ctx.createGain();gain.gain.value=this.volume*(slot===2?.12:.3);noise.connect(filter);filter.connect(gain);gain.connect(ctx.destination);noise.start();noise.onended=()=>{noise.disconnect();filter.disconnect();gain.disconnect();};
  }
}
