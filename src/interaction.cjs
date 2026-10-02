'use strict';
// One coordinate definition is shared by rendering and hit testing.
const WIDTH = 2170, HEIGHT = 60;
const PAGE_SELECTOR={id:'section_next',label:'SECTION',x:0,w:110,local:true,capability:'conditional_action'};
const CONTROLS = [
  {id:'auto', label:'AUTO', x:1450,w:90}, {id:'ack',label:'ACK',x:1540,w:90},
  {id:'lights',label:'LIGHT',x:1630,w:90,bit:0}, {id:'wipers',label:'WIPER',x:1720,w:90,bit:1},
  {id:'cruise',label:'CRUISE',x:1810,w:90,bit:2}, {id:'hazard',label:'HAZARD',x:1900,w:90,bit:3},
  {id:'retarder',label:'RET',x:1990,w:90,bit:4}, {id:'horn',label:'HORN',x:2080,w:90,bit:5}
];
function hit(x,y,controls=CONTROLS) { return Number.isFinite(x) && Number.isFinite(y) && y >= 0 && y < HEIGHT ? controls.find(b=>x>=b.x && x<b.x+b.w) : undefined; }
class Touch {
  constructor() { this.down = null; this.last = -Infinity; }
  event(e,now,controls=CONTROLS) {
    if (e.state === 'down') { this.down = {button:hit(e.x,e.y,controls),x:e.x,y:e.y,time:now,feedback:false}; return null; }
    if (e.state === 'pressing') {
      if (this.down && (Math.abs(e.x-this.down.x)>25 || Math.abs(e.y-this.down.y)>25)) this.down = null;
      if(this.down?.button?.holdMs&&now-this.down.time>=this.down.button.holdMs&&!this.down.feedback){this.down.feedback=true;return {feedback:true};}
      return null;
    }
    if (e.state !== 'up' && e.state !== 'end') return null;
    const d = this.down; this.down = null;
    // ACK confirms the warning captured on down. Keep its original rectangle
    // through context relayout; vehicle actions still require the live target.
    const releaseControls=d?.button?.id==='ack'?[d.button]:controls;
    if (!d?.button || hit(e.x,e.y,releaseControls)?.id !== d.button.id || now-d.time>3000 || now-this.last<200) return null;
    if(d.button.holdMs&&now-d.time<d.button.holdMs)return {cancelled:true};
    this.last = now; return {...d.button, long:now-d.time>=900};
  }
  progress(now){return this.down?.button?.holdMs?{id:this.down.button.id,value:Math.min(1,(now-this.down.time)/this.down.button.holdMs)}:null;}
}
class Inputs {
  constructor() { this.expires = new Map(); }
  pulse(bit,now) { if (Number.isInteger(bit) && bit>=0 && bit<14) this.expires.set(bit,now+220); }
  clear() { this.expires.clear(); }
  packet(now,enabled) {
    let mask=0;
    for (const [bit,until] of this.expires) { if (until<=now || !enabled) this.expires.delete(bit); else mask|=1<<bit; }
    const b=Buffer.alloc(8); b.write('EFB1'); b.writeUInt32LE(mask,4); return b;
  }
}
module.exports = { WIDTH,HEIGHT,CONTROLS,PAGE_SELECTOR,hit,Touch,Inputs };
