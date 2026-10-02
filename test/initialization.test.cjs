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
test('manifest launcher remains intact while only DirectDraw paints waiting, telemetry, pause, resume and exit',async()=>{
 const h=harness(),key={cid:CID,uid:38,style:{width:2170}};
 try{
  h.handlers['plugin.alive']({serialNumber:'A',keys:[key]});await flush();
  assert.equal(h.entries.length,0,'ordinary key draws must never replace the DirectDraw touch surface');
  const waiting=require('../com.local.ets2rally.plugin/manifest.json').keyLibrary.children[0].style.image;assert.equal(h.runtime.sessions.get('A').view.page,'offline');
  assert.equal(waiting,renderLauncher({}, {bilingual:true}).toDataURL('image/png'));
  assert.notEqual(h.direct.at(-1).image,waiting);
  h.receive({...drive(),values:{},paused:false});await flush();assert.equal(h.runtime.rally.state,'WAITING');
  const states=[['drive',drive()],['paused',{...drive(),paused:true}],['drive',drive()],['offline',{...drive(),connected:false}]];
  const dash=h.runtime.rally.dash;
  for(const [page,packet]of states){
   const count=h.direct.length;h.receive(packet);await flush();
   assert.equal(h.runtime.sessions.get('A').view.page,page);assert.ok(h.direct.length>count,'state event draws immediately at constant scheduler time');
   assert.equal(h.entries.length,0,'state changes never redraw the host key');
   assert.equal(h.direct.at(-1).image,render(h.runtime.rally.view(settings()),settings(),0).toDataURL('image/png'));
  }
  assert.equal(h.runtime.rally.dash,dash,'pause and renderer changes preserve core');
 }finally{h.runtime.stop();}
});
test('transition queued behind an old DirectDraw frame replaces it with latest state',async()=>{
 let release;const h=harness({directDraw:()=>new Promise(r=>{release=r;})}),key={cid:CID,uid:38};
 try{
  h.handlers['plugin.alive']({serialNumber:'A',keys:[key]});await flush();h.receive(drive());
  h.plugin.directDraw=(_s,_k,image)=>{h.direct.push({image});return Promise.resolve();};
  release();await flush();
  assert.equal(h.runtime.sessions.get('A').view.page,'drive');assert.equal(h.entries.length,0);
  assert.equal(h.direct.length,1);assert.equal(h.runtime.sessions.get('A').presented.view.page,'drive');
 }finally{h.runtime.stop();}
});

test('temporary device disconnection retains registration and prevents transport writes until reconnect',async()=>{
 const h=harness();try{
  h.handlers['plugin.alive']({serialNumber:'A',keys:[{cid:CID,uid:38}]});await flush();
  const s=h.runtime.sessions.get('A'),count=h.direct.length;
  h.handlers['plugin.alive']({serialNumber:'A',keys:[]});assert.equal(h.runtime.sessions.get('A'),s,'empty alive is not a dead event');
  h.handlers['device.status']([{serialNumber:'A',status:'disconnected'}]);h.receive(drive());await flush();
  assert.equal(h.runtime.sessions.get('A'),s);assert.equal(h.direct.length,count);
  h.handlers['device.status']([{serialNumber:'A',status:'connected'}]);await flush();
  assert.equal(h.runtime.sessions.get('A'),s);assert.equal(s.view.page,'drive');assert.ok(h.direct.length>count);assert.equal(h.entries.length,0);
 }finally{h.runtime.stop();}
});

test('activation, configuration and reconnect never issue ordinary key draws',async()=>{
 const h=harness({draw:()=>assert.fail('ordinary draw replaces DirectDraw touch ownership')});
 try{
  const event={serialNumber:'A',keys:[{cid:CID,uid:38}]};
  h.handlers['plugin.alive'](event);await flush();
  h.handlers['plugin.data']({serialNumber:'A',data:{key:event.keys[0]}});await flush();
  h.handlers['plugin.config.updated']({language:'zh',dashboardLanguage:'zh'});await flush();
  h.runtime.disconnected();h.runtime.connected();await flush();
  assert.ok(h.direct.length>=4);assert.equal(h.entries.length,0);
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
