const AnimalHabits=[
 {pace:16,pause:4,note:'Fox has a favourite shortcut. It is rarely shorter.',hello:'Oh, there you are.',snack:'For me? Good choice.'},
 {pace:21,pause:3,note:'Bunny checks on the flowers between games.',hello:'Come and look at this.',snack:'Saving a bit for later.'},
 {pace:11,pause:6,note:'Panda has declared this a perfectly good place to stop.',hello:'No hurry. Stay a while.',snack:'An excellent interruption.'},
 {pace:15,pause:5,note:'Cat is waiting for the warm patch of sun to move.',hello:'You may sit here.',snack:'I was just thinking of a snack.'},
 {pace:12,pause:5,note:'Bear knows exactly which bench gets the afternoon sun.',hello:'Room for one more.',snack:'That hit the spot.'},
 {pace:18,pause:4,note:'Frog is listening to the pond. Apparently it has news.',hello:'Good pond weather.',snack:'A very fine catch.'},
 {pace:10,pause:7,note:'Koala has made very few plans for today.',hello:'Still here. Still comfy.',snack:'Worth waking up for.'},
 {pace:17,pause:4,note:'Penguin collects smooth pebbles, then forgets where.',hello:'Seen a round pebble?',snack:'A snack and good company.'}
];
function habitOf(animal){return AnimalHabits[animal]||AnimalHabits[0]}
const Soundscape={
 enabled:false,context:null,volume:null,timer:0,
 async toggle(){try{if(!this.context){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio){toast('Sound is unavailable in this browser.');return}const c=this.context=new Audio(),out=this.volume=c.createGain();out.gain.value=0;out.connect(c.destination);const buffer=c.createBuffer(1,c.sampleRate*3,c.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.45;const source=c.createBufferSource(),filter=c.createBiquadFilter();source.buffer=buffer;source.loop=true;filter.type='lowpass';filter.frequency.value=480;source.connect(filter);filter.connect(out);source.start();this.timer=setInterval(()=>{if(this.enabled&&!document.hidden)this.chirp()},10000)}this.enabled=!this.enabled;if(this.enabled)await this.context.resume();this.sync();this.fade()}catch{this.enabled=false;this.sync();toast('Sound could not start. You can try again.')}},
 fade(){if(!this.context)return;const gain=this.volume.gain,c=this.context;gain.cancelScheduledValues(c.currentTime);gain.setTargetAtTime(this.enabled&&!document.hidden ? .028 : 0,c.currentTime,.6)},
 sync(){document.querySelectorAll('[data-sound-toggle]').forEach(b=>{b.textContent=this.enabled?'Sound on':'Sound off';b.setAttribute('aria-pressed',String(this.enabled));b.setAttribute('aria-label',this.enabled?'Mute nature sounds':'Turn on nature sounds')})},
 tone(freq,duration,level=.035,type='sine',end=freq){if(!this.enabled||document.hidden||!this.context)return;const c=this.context,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,c.currentTime);o.frequency.exponentialRampToValueAtTime(end,c.currentTime+duration);g.gain.setValueAtTime(0,c.currentTime);g.gain.linearRampToValueAtTime(level,c.currentTime+.015);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+duration);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+duration)},
 chirp(){this.tone(1300,.16,.009,'sine',1800);setTimeout(()=>this.tone(1550,.12,.006,'sine',1100),230)},
 effect(kind){if(kind==='catch'){this.tone(380,.35,.025,'sine',640);setTimeout(()=>this.tone(640,.4,.018),120)}else if(kind==='snack')this.tone(320,.18,.025,'sine',140);else this.tone(220,.1,.015,'sine',180)}
};
document.addEventListener('visibilitychange',()=>Soundscape.fade());
function toggleZooRest(force){if(!zoo)return;zoo.resting=force===undefined?!zoo.resting:force;if(zoo.resting){stopZooInput();clearGroveMoment();}zoo.keys.clear();zoo.dx=zoo.dy=zoo.vx=zoo.vy=0;document.getElementById('zoo-explore').classList.toggle('resting',zoo.resting);const button=document.getElementById('rest-toggle');button.textContent=zoo.resting?'Back to wandering':'Rest a while';button.setAttribute('aria-pressed',String(zoo.resting));if(zoo.resting){document.getElementById('rest-caption').textContent=habitOf(me.animal).note;stopPetAction(document.getElementById('world-player'))}}
function residentSay(n,text){const el=document.getElementById('world-resident-'+n.index);if(!el)return;let bubble=el.querySelector('.resident-thought');if(!bubble){bubble=document.createElement('span');bubble.className='resident-thought';el.appendChild(bubble)}bubble.textContent=text;clearTimeout(n.bubbleTimer);n.bubbleTimer=setTimeout(()=>bubble.remove(),3500)}
function residentStep(n,dt,time,paused){
 if(paused){n.goal=null;n.nextWander=Math.max(n.nextWander||0,time+800);return false}
 const habit=habitOf(n.animal);
 if(!n.goal&&time>=(n.nextWander||0)){const angle=Math.random()*Math.PI*2,distance=12+Math.random()*26,target={x:n.homeX+Math.cos(angle)*distance,y:n.homeY+Math.sin(angle)*distance};let clear=true;const length=Math.hypot(target.x-n.x,target.y-n.y);for(let step=0;step<=length;step+=1){const t=length?step/length:0;if(ZooMath.blocked(n.x+(target.x-n.x)*t,n.y+(target.y-n.y)*t)){clear=false;break}}if(clear&&!ZooMath.blocked(target.x,target.y))n.goal=target;else n.nextWander=time+2000}
 if(!n.goal)return false;const distance=Math.hypot(n.goal.x-n.x,n.goal.y-n.y),step=habit.pace*Math.min(Math.max(dt,0),.04);if(distance<=step){n.x=n.goal.x;n.y=n.goal.y;n.goal=null;n.nextWander=time+(habit.pause+Math.random()*5)*1000;return false}const x=n.x+(n.goal.x-n.x)/distance*step,y=n.y+(n.goal.y-n.y)/distance*step;if(ZooMath.blocked(x,y)){n.goal=null;n.nextWander=time+2000;return false}n.x=x;n.y=y;return true
}
