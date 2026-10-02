const test=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {startRuntime,CID}=require('../src/runtime.cjs');
const {drive}=require('./fixtures.cjs');
const {render}=require('../src/render.cjs');
const {renderLauncher}=require('../src/launcher.cjs');
const {settings}=require('../src/model.cjs');
const flush=()=>new Promise(r=>setImmediate(r));
function harness(options={}){
 const handlers={},entries=[],direct=[],socket=new EventEmitter();let now=0;
 socket.bind=(_p,_h,cb)=>cb();socket.send=(_b,_p,_h,cb)=>cb?.();socket.close=()=>{};
 const plugin={on:(e,f)=>handlers[e]=f,getConfig:()=>new Promise(()=>{}),
  draw:(serial,key,type,image)=>{entries.push({serial,key,type,image});return Promise.resolve();},
  directDraw:(serial,key,image)=>{direct.push({serial,key,image});return Promise.resolve();},...options};
 const runtime=startRuntime(plugin,{info:()=>{},error:()=>{}},{clock:()=>now,socket});
 return {runtime,handlers,entries,direct,plugin,receive(p){now++;socket.emit('message',Buffer.from(JSON.stringify(p)),{address:'127.0.0.1',port:29763});}};
}
test('alive paints a launcher independent of waiting, telemetry, pause, resume and exit',async()=>{
 const h=harness(),key={cid:CID,uid:38,style:{width:2170}};
 try{
  h.handlers['plugin.alive']({serialNumber:'A',keys:[key]});await flush();
  assert.equal(h.entries.length,1,'initial drawing does not wait for config or UDP');assert.equal(h.entries[0].type,'base64');
  const waiting=h.entries.at(-1).image;assert.equal(h.runtime.sessions.get('A').view.page,'offline');
  assert.equal(waiting,renderLauncher(settings()).toDataURL('image/png'));
  assert.notEqual(h.direct.at(-1).image,waiting);
  h.receive({...drive(),values:{},paused:false});await flush();assert.equal(h.runtime.rally.state,'WAITING');
  const states=[['drive',drive()],['paused',{...drive(),paused:true}],['drive',drive()],['offline',{...drive(),connected:false}]];
  const dash=h.runtime.rally.dash;
  for(const [page,packet]of states){
   const count=h.entries.length;h.receive(packet);await flush();
   assert.equal(h.runtime.sessions.get('A').view.page,page);assert.ok(h.entries.length>count,'state event draws immediately at constant scheduler time');
   assert.equal(h.entries.at(-1).image,waiting,'entry always offers TAP TO OPEN, never a fake connection screen');
   assert.equal(h.direct.at(-1).image,render(h.runtime.rally.view(settings()),settings(),0).toDataURL('image/png'));
  }
  assert.equal(h.runtime.rally.dash,dash,'pause and renderer changes preserve core');
 }finally{h.runtime.stop();}
});
test('transition queued behind an old entry draw immediately replaces it with latest state',async()=>{
 let release;const h=harness({draw:()=>new Promise(r=>{release=r;})}),key={cid:CID,uid:38};
 try{
  h.handlers['plugin.alive']({serialNumber:'A',keys:[key]});await flush();h.receive(drive());
  h.plugin.draw=(_s,_k,_t,image)=>{h.entries.push({image});return Promise.resolve();};
  release();await flush();
  assert.equal(h.runtime.sessions.get('A').view.page,'drive');assert.equal(h.entries.length,1);
  assert.equal(h.direct.length,1,'obsolete WAITING direct frame was discarded');assert.notEqual(h.entries[0].image,h.direct[0].image);
 }finally{h.runtime.stop();}
});
test('temporary device disconnection retains registration and prevents transport writes until reconnect',async()=>{
 const h=harness();try{
  h.handlers['plugin.alive']({serialNumber:'A',keys:[{cid:CID,uid:38}]});await flush();
  const s=h.runtime.sessions.get('A'),count=h.entries.length;
  h.handlers['plugin.alive']({serialNumber:'A',keys:[]});assert.equal(h.runtime.sessions.get('A'),s,'empty alive is not a dead event');
  h.handlers['device.status']([{serialNumber:'A',status:'disconnected'}]);h.receive(drive());await flush();
  assert.equal(h.runtime.sessions.get('A'),s);assert.equal(h.entries.length,count);
  h.handlers['device.status']([{serialNumber:'A',status:'connected'}]);await flush();
  assert.equal(h.runtime.sessions.get('A'),s);assert.equal(s.view.page,'drive');assert.ok(h.entries.length>count);
 }finally{h.runtime.stop();}
});

test('entry drawing failure does not block Direct Draw and is reported separately',async()=>{
 const h=harness({draw:()=>Promise.reject(Error('entry failure'))});
 try{h.handlers['plugin.alive']({serialNumber:'A',keys:[{cid:CID,uid:38}]});await flush();
  assert.equal(h.direct.length,1);const status=h.handlers['ui.message']({action:'status'});
  assert.equal(status.stats.entryDrawErrors,1);assert.equal(status.stats.drawErrors,0);assert.equal(status.stats.draws,1);
  assert.equal(h.runtime.sessions.get('A').lastImage,null,'failed entry remains eligible for retry');
 }finally{h.runtime.stop();}
});

test('paused SDK permits explicit binding mode before a truck frame exists',async()=>{
 const h=harness();try{
  h.runtime.configure({bindingMode:true});h.handlers['plugin.alive']({serialNumber:'A',keys:[{cid:CID,uid:38}]});await flush();
  h.receive({...drive(),paused:true,values:{}});await flush();
  const v=h.runtime.sessions.get('A').view;assert.equal(v.page,'paused');assert.equal(v.inputReady,true);
  assert.equal(h.runtime.rally.hasTelemetry,false);assert.ok(v.quick.controls.some(c=>c.id==='bind_next'));
 }finally{h.runtime.stop();}
});
