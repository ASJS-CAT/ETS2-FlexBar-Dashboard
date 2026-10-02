const test=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {RallySession}=require('../src/rally-session.cjs');
const {startRuntime,CID}=require('../src/runtime.cjs');
const {settings}=require('../src/model.cjs');
const {drive}=require('./fixtures.cjs');
const flush=()=>new Promise(r=>setImmediate(r));
const cfg=settings();
function packet(seq,extra={}){const p=drive();return {...p,sessionId:'game-A',processId:12345,seq,...extra,
  values:{...p.values,'truck.odometer':100+seq*.1,'truck.fuel.amount':100-seq*.03,...extra.values}};}
test('10 s / 60 s silence, pause and background preserve the page, warning timer and trip',()=>{
  const logs=[],r=new RallySession((event,detail)=>logs.push({event,...detail}));
  for(let i=0;i<10;i++)r.accept(packet(i),i*100,cfg);
  r.dash.nextSection();r.dash.select('job',r.now,cfg);r.advance(950,cfg);
  const dash=r.dash,average=r.status().trip.averageConsumption,distance=r.status().trip.distanceTravelled;
  for(const seconds of [10,60]){
    const before=r.cached,now=r.lastTick+seconds*1000,remaining=r.dash.manualRemainingMs;
    r.setForeground(false,'test_AltTab');r.advance(now,cfg);
    assert.equal(r.state,'STALE');assert.equal(r.view(cfg).page,'job');assert.equal(r.view(cfg).inputReady,false);
    assert.equal(r.dash.manualRemainingMs,remaining);assert.equal(r.cached,before);
    assert.equal(r.status().trip.distanceTravelled,distance);assert.equal(r.status().trip.averageConsumption,average);
    r.accept(packet(9,{foreground:true}),now+1,cfg);
    assert.equal(r.state,'CONNECTED');assert.equal(r.dash,dash);assert.equal(r.cached.section,1);
    assert.equal(r.cached.page,'job');assert.equal(r.dash.manualRemainingMs,remaining);
  }
  const now=r.lastTick;r.accept(packet(10,{paused:true}),now+1,cfg);r.advance(now+60001,cfg);
  assert.equal(r.cached.page,'job');assert.equal(r.status().trip.averageConsumption,average);
  r.accept(packet(11),now+60002,cfg);assert.equal(r.cached.page,'job');assert.equal(r.dash,dash);
  assert.ok(r.status().trip.distanceTravelled>distance);assert.ok(!logs.some(l=>l.event==='trip.reset'));
});
test('only explicit user reset and confirmed new session reset accumulated trip',()=>{
  const logs=[],r=new RallySession((event,detail)=>logs.push({event,...detail}));
  for(let i=0;i<10;i++)r.accept(packet(i),i*100,cfg);
  const average=r.dash.consumption.output;r.accept(packet(10,{values:{'truck.fuel.amount':null}}),1000,cfg);
  assert.equal(r.dash.consumption.output,average);
  r.accept(packet(11),1100,cfg);r.accept(packet(12,{values:{'truck.fuel.amount':150}}),1200,cfg);
  assert.equal(r.dash.consumption.output,average,'refuel rebases instead of clearing trip');
  r.resetTrip();assert.equal(r.dash.consumption.output,null);assert.equal(r.dash.consumption.distance,0);
  for(let i=13;i<23;i++)r.accept(packet(i),i*100,cfg);
  const old=r.dash;r.accept(packet(0,{sessionId:'game-B'}),2300,cfg);
  assert.notEqual(r.dash,old);assert.equal(r.dash.consumption.distance,0);
  r.processExited('test_confirmed_process_exit');assert.equal(r.advance(2400,cfg).page,'offline');
  assert.equal(r.state,'DISCONNECTED');assert.ok(logs.some(l=>l.reason==='test_confirmed_process_exit'));
  assert.deepEqual(logs.filter(l=>l.event==='trip.reset').map(l=>l.reason),['user_explicit_reset','bridge_session_changed']);
});
test('no mounted view still accumulates; re-entry, focus return and host reconnect need no touch',async()=>{
  let now=0;const handlers={},draws=[],logs=[],socket=new EventEmitter();
  socket.bind=(_p,_h,cb)=>cb();socket.send=(_b,_p,_h,cb)=>cb?.();socket.close=()=>{};
  const plugin={on:(e,f)=>handlers[e]=f,getConfig:async()=>({}),directDraw:(...args)=>{draws.push(args);return Promise.resolve();}};
  const runtime=startRuntime(plugin,{error:e=>assert.fail(e),info:(name,e)=>logs.push(e)},
    {clock:()=>now,socket,probeProcess:async()=>true});
  const receive=p=>socket.emit('message',Buffer.from(JSON.stringify(p)),{address:'127.0.0.1',port:29763});
  const key={cid:CID,uid:38};
  try{
    for(let i=0;i<10;i++){now=i*100;receive(packet(i));}
    assert.ok(runtime.rally.dash.consumption.output>0,'collect before view exists');
    handlers['plugin.alive']({serialNumber:'A',keys:[key]});await flush();
    const dash=runtime.rally.dash;dash.nextSection();dash.select('job',runtime.rally.now,cfg);
    handlers['plugin.data']({serialNumber:'A',data:{key}});await flush();assert.equal(runtime.rally.dash,dash);
    handlers['system.actwin']({newWin:{owner:{processId:222}}});
    handlers['plugin.dead']({serialNumber:'A',keys:[key]});assert.equal(runtime.sessions.size,0);
    const count=draws.length;now+=60000;runtime.tick();assert.equal(runtime.rally.state,'STALE');
    handlers['system.actwin']({newWin:{owner:{processId:12345}}});await flush();
    assert.equal(runtime.sessions.size,1);assert.ok(draws.length>count,'focus handler redraws without plugin.data/touch');
    assert.equal(runtime.sessions.get('A').view.page,'job');assert.equal(runtime.sessions.get('A').view.section,1);
    now+=1;receive(packet(11,{foreground:true}));runtime.tick();await flush();
    runtime.disconnected();assert.equal(runtime.sessions.size,0);now+=100;receive(packet(12));
    runtime.connected();await flush();assert.equal(runtime.sessions.size,1);assert.equal(runtime.sessions.get('A').dash,dash);
    handlers['plugin.alive']({serialNumber:'A',keys:[]});const distance=dash.consumption.distance;
    now+=100;receive(packet(13));assert.ok(dash.consumption.distance>distance);
    handlers['plugin.alive']({serialNumber:'A',keys:[key]});await flush();
    assert.equal(runtime.sessions.get('A').view.page,'job');assert.ok(!logs.some(l=>l?.event==='trip.reset'));
    handlers['device.status']([{serialNumber:'A',status:'disconnected'}]);now+=100;
    handlers['device.status']([{serialNumber:'A',status:'connected'}]);await flush();assert.equal(runtime.sessions.get('A').dash,dash);
  }finally{runtime.stop();}
});
test('OS probe distinguishes a silent living process, unknown result and confirmed exit',async()=>{
  let now=0,alive=null;const socket=new EventEmitter(),handlers={};
  socket.bind=(_p,_h,cb)=>cb();socket.send=(_b,_p,_h,cb)=>cb?.();socket.close=()=>{};
  const runtime=startRuntime({on:(e,f)=>handlers[e]=f},{info:()=>{},error:assert.fail},
    {clock:()=>now,socket,probeProcess:async()=>alive});
  try{
    socket.emit('message',Buffer.from(JSON.stringify(packet(1))),{address:'127.0.0.1',port:29763});
    for(const result of [null,true,false]){alive=result;now+=3000;runtime.tick();await flush();runtime.tick();
      assert.equal(runtime.rally.state,result===false?'DISCONNECTED':'STALE');}
    assert.equal(runtime.rally.view(cfg).page,'offline');
  }finally{runtime.stop();}
});

test('pause binding remains functional and local page changes preserve frozen telemetry',()=>{
 const r=new RallySession();r.accept(packet(1),0,cfg);r.accept(packet(2,{paused:true}),1,cfg);
 const binding={...cfg,bindingMode:true};let v=r.advance(2,binding);assert.equal(v.inputReady,true);assert.ok(v.quick.controls.some(c=>c.id==='bind_next'));
 r.dash.nextSection();r.refreshLocal(cfg);assert.equal(r.view(cfg).section,1);assert.equal(r.dash.consumption.distance,0);
});
test('remount during in-flight draw schedules a new full frame after the old acknowledgement',async()=>{
 let now=0;const handlers={},draws=[],socket=new EventEmitter();socket.bind=(_p,_h,cb)=>cb();socket.send=(_b,_p,_h,cb)=>cb?.();socket.close=()=>{};
 const runtime=startRuntime({on:(e,f)=>handlers[e]=f,getConfig:async()=>({}),directDraw:(...args)=>new Promise(resolve=>draws.push({args,resolve}))},{info:()=>{},error:assert.fail},{clock:()=>now,socket});
 try{
  const key={cid:CID,uid:38};handlers['plugin.alive']({serialNumber:'A',keys:[key]});assert.equal(draws.length,1);
  handlers['plugin.dead']({serialNumber:'A',keys:[key]});handlers['plugin.alive']({serialNumber:'A',keys:[key]});
  assert.equal(draws.length,1);draws[0].resolve();await flush();assert.equal(draws.length,2);assert.equal(draws[1].args[3],false);
  draws[1].resolve();await flush();
 }finally{runtime.stop();}
});
