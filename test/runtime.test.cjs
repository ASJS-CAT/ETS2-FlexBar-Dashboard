const test=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {startRuntime,CID}=require('../src/runtime.cjs');
const {drive}=require('./fixtures.cjs');
const flush=()=>new Promise(r=>setImmediate(r));
test('lifecycle, multiple devices, source filtering, backpressure and touch gating',async()=>{
  let now=0;const handlers={},draws=[],sent=[];const socket=new EventEmitter();
  socket.bind=(_p,_h,cb)=>cb();socket.send=(b,_p,_h,cb)=>{sent.push(b.readUInt32LE(4));cb?.();};socket.close=()=>{};
  let resolveDraw;const plugin={on:(e,f)=>handlers[e]=f,getConfig:async()=>({quickControlsMode:'static'}),
    directDraw:(serial,key)=>{draws.push([serial,key.uid]);return new Promise(r=>{resolveDraw=r;});}};
  const runtime=startRuntime(plugin,{error:e=>{throw Error(e);}},{clock:()=>now,socket});
  try{
    await handlers['plugin.alive']({serialNumber:'A',keys:[{cid:CID,uid:1}]});
    const p=drive();socket.emit('message',Buffer.from(JSON.stringify(p)),{address:'8.8.8.8',port:29763});
    runtime.tick();assert.equal(runtime.sessions.get('A').view.page,'offline');
    resolveDraw();await flush();resolveDraw();await flush();now=100;
    socket.emit('message',Buffer.from(JSON.stringify(p)),{address:'127.0.0.1',port:29763});
    runtime.tick();assert.equal(runtime.sessions.get('A').view.page,'drive');
    now=200;runtime.tick();assert.equal(draws.length,3,'one in-flight draw only');
    handlers['device.touch']({serialNumber:'A',state:'down',x:1650,y:20});now=250;
    handlers['device.touch']({serialNumber:'A',state:'up',x:1650,y:20});assert.equal(runtime.sessions.get('A').pressed.id,'lights');runtime.tick();assert.equal(sent.at(-1),1);
    now=500;handlers['device.touch']({serialNumber:'A',state:'down',x:50,y:20});now=550;handlers['device.touch']({serialNumber:'A',state:'up',x:50,y:20});assert.equal(runtime.sessions.get('A').dash.section,1);runtime.tick();assert.equal(sent.at(-1),0,'local section selector must not emit an Input SDK bit');
    handlers['plugin.dead']({serialNumber:'A',keys:[{uid:99}]});assert.equal(runtime.sessions.size,1);
    handlers['plugin.dead']({serialNumber:'A',keys:[{uid:1}]});runtime.tick();assert.equal(sent.at(-1),0);assert.equal(runtime.sessions.size,0);
    resolveDraw();await flush();
    await handlers['plugin.alive']({serialNumber:'B',keys:[{cid:CID,uid:1}]});
    resolveDraw();await flush();now=2000;runtime.tick();assert.equal(runtime.sessions.get('B').view.page,'drive');
    handlers['device.status']([{serialNumber:'B',status:'disconnected'}]);assert.equal(runtime.sessions.size,1);assert.equal(runtime.sessions.get('B').deviceDisconnected,true);
    resolveDraw();
  }finally{runtime.stop();}
});
test('Direct Draw activation, ambiguous status, failed send recovery and periodic full refresh',async()=>{
  let now=0,fail=true;const handlers={},draws=[];const socket=new EventEmitter();
  socket.bind=(_p,_h,cb)=>cb();socket.send=(_b,_p,_h,cb)=>cb?.();socket.close=()=>{};
  const plugin={on:(e,f)=>handlers[e]=f,getConfig:async()=>({}),directDraw:(...args)=>{
    if(fail){fail=false;throw Error('transient send failure');}draws.push(args);return Promise.resolve();
  }};
  const runtime=startRuntime(plugin,{error:()=>{}},{clock:()=>now,socket});
  try{
    handlers['plugin.data']({serialNumber:'A',data:{key:{cid:CID,uid:3}}});
    handlers['device.status']([{serialNumber:'A',status:'busy'}]);
    assert.equal(runtime.sessions.size,1);
    runtime.tick();assert.equal(runtime.sessions.get('A').busy,false);
    now=100;runtime.tick();await flush();assert.equal(draws.length,1);
    now=500;runtime.tick();await flush();assert.equal(draws.length,1);
    now=1150;runtime.tick();await flush();assert.equal(draws.length,2);
    assert.equal(draws.at(-1)[3],false,'refresh must be a full frame');
    const status=handlers['ui.message']({action:'status'});assert.equal(status.stats.drawErrors,1);assert.equal(status.stats.draws,2);
  }finally{runtime.stop();}
});


test('duplicate instance fails closed on a telemetry port conflict without continuing to draw',async()=>{
 const handlers={},socket=new EventEmitter();let draws=0,conflicts=0,closed=false;
 socket.bind=()=>{};socket.close=()=>{closed=true;};socket.send=()=>assert.fail('unbound instance must not send inputs');
 const plugin={on:(e,f)=>handlers[e]=f,getConfig:()=>new Promise(()=>{}),directDraw:async()=>{draws++;}};
 const runtime=startRuntime(plugin,{error:()=>{}},{socket,onPortConflict:()=>conflicts++});
 try{
  handlers['plugin.alive']({serialNumber:'A',keys:[{cid:CID,uid:1}]});await flush();
  socket.emit('error',Object.assign(Error('port occupied'),{code:'EADDRINUSE'}));
  const before=draws;runtime.tick();handlers['device.touch']({serialNumber:'A',state:'down',x:50,y:20});
  await flush();assert.equal(draws,before);assert.equal(runtime.sessions.size,0);assert.equal(conflicts,1);assert.equal(closed,true);
 }finally{runtime.stop();}
});
