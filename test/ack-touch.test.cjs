const test=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {startRuntime,CID}=require('../src/runtime.cjs');
const {Touch}=require('../src/interaction.cjs');
const {drive}=require('./fixtures.cjs');
const flush=()=>new Promise(r=>setImmediate(r));
function harness(mode='dynamic'){
  let now=0,seq=0;const handlers={},sent=[],events=[],socket=new EventEmitter();
  socket.bind=(_p,_h,cb)=>cb();socket.send=(b,_p,_h,cb)=>{sent.push(b.readUInt32LE(4));cb?.();};socket.close=()=>{};
  const plugin={on:(e,f)=>handlers[e]=f,getConfig:()=>new Promise(()=>{}),directDraw:()=>Promise.resolve()};
  const runtime=startRuntime(plugin,{error:assert.fail,info:(_text,e)=>events.push(e)},{clock:()=>now,socket});
  runtime.configure({quickControlsMode:mode,warningRotationSeconds:1});
  const p=drive();Object.assign(p.values,{'truck.brake.air.pressure.emergency':1,'truck.water.temperature.warning':1});
  return {runtime,plugin,p,sent,events,handlers,
    time(t){now=t;},
    receive(t){now=t;p.seq=++seq;socket.emit('message',Buffer.from(JSON.stringify(p)),{address:'127.0.0.1',port:29763});},
    async mount(){handlers['plugin.alive']({serialNumber:'A',keys:[{cid:CID,uid:38}]});await flush();this.receive(0);await this.paint();},
    async paint(){runtime.sessions.get('A').next=0;runtime.tick();await flush();},
    touch(state,t,x=1470){now=t;handlers['device.touch']({serialNumber:'A',state,x,y:25});}
  };
}

test('ACK uses the warning in the delivered frame, even if two-warning rotation advances before down',async()=>{
  const h=harness();try{
    await h.mount();h.receive(990);await h.paint();
    assert.equal(h.runtime.sessions.get('A').view.activeAlert.id,'air-emergency');
    h.receive(1010);assert.equal(h.runtime.rally.cached.activeAlert.id,'water');
    h.touch('down',1010);h.touch('up',1060);
    assert.deepEqual([...h.runtime.rally.dash.acknowledged],['air-emergency']);
    assert.equal(h.runtime.rally.cached.activeAlert.id,'water');
    assert.ok(h.sent.every(mask=>mask===0),'ACK never sends a vehicle input');
  }finally{h.runtime.stop();}
});

test('ACK retains its pressed rectangle across control relayout; vehicle controls still cancel',()=>{
  const t=new Touch(),ack={id:'ack',warningId:'air',x:1450,w:180};
  t.event({state:'down',x:1590,y:25},0,[ack]);
  const changed=[{...ack,warningId:'water',w:90},{id:'engine',x:1540,w:90}];
  assert.equal(t.event({state:'up',x:1590,y:25},100,changed)?.warningId,'air');
  t.event({state:'down',x:1590,y:25},400,[{id:'lights',x:1450,w:180}]);
  assert.equal(t.event({state:'up',x:1590,y:25},500,changed),null);
});

test('pending draw cannot replace the ACK target from the last delivered frame',async()=>{
  const h=harness();let release;try{
    await h.mount();h.receive(990);await h.paint();
    h.plugin.directDraw=()=>new Promise(r=>{release=r;});h.receive(1010);await h.paint();
    assert.equal(h.runtime.sessions.get('A').view.activeAlert.id,'water');
    h.touch('down',1010);h.touch('up',1060);
    assert.deepEqual([...h.runtime.rally.dash.acknowledged],['air-emergency']);
    h.plugin.directDraw=()=>Promise.resolve();release();await flush();
    await h.paint();assert.equal(h.runtime.sessions.get('A').presented.view.activeAlert.id,'water');
  }finally{h.runtime.stop();release?.();}
});

test('two warnings: ACK survives DRIVING to STOPPED relayout during a press and gives down feedback',async()=>{
  const h=harness();try{
    await h.mount();const dash=h.runtime.rally.dash;
    h.touch('down',100,1610);await h.paint();
    assert.equal(h.runtime.sessions.get('A').view.pressed?.id,'ack');
    h.p.values['truck.speed']=0;h.receive(110);h.receive(800);await h.paint();
    const ack=h.runtime.rally.cached.quick.controls.find(c=>c.id==='ack');
    assert.ok(ack.x+ack.w<1610,'new controls really moved this position outside ACK');
    h.touch('up',850,1610);await h.paint();
    assert.deepEqual([...dash.acknowledged],['air-emergency']);
    assert.equal(h.runtime.rally.cached.activeAlert.id,'water');
    assert.ok(h.events.some(e=>e?.event==='warning.ack'));
    assert.equal(h.runtime.rally.dash,dash);assert.ok(h.sent.every(mask=>mask===0));
  }finally{h.runtime.stop();}
});

test('ACK still cancels a swipe or release outside the original button',()=>{
  for(const swipe of [false,true]){
    const t=new Touch(),buttons=[{id:'ack',warningId:'air',x:1450,w:180}];
    t.event({state:'down',x:1500,y:25},0,buttons);
    if(swipe)t.event({state:'pressing',x:1560,y:25},50,buttons);
    assert.equal(t.event({state:'up',x:swipe?1500:1700,y:25},100,buttons),null);
  }
});

for(const mode of ['static','dynamic','hybrid'])test(`${mode}: three warnings ACK one at a time through device.touch, with duplicate release and recurrence`,async()=>{
  const h=harness(mode);try{
    h.p.values['truck.fuel.warning']=1;await h.mount();const dash=h.runtime.rally.dash;
    for(const [i,id]of ['air-emergency','water','fuel'].entries()){
      const t=100+i*300;h.receive(t);await h.paint();assert.equal(h.runtime.sessions.get('A').view.activeAlert.id,id);
      h.touch('down',t);h.touch('up',t+60);h.touch('end',t+61);await h.paint();
      assert.equal(dash.acknowledged.size,i+1);
    }
    assert.notEqual(h.runtime.rally.cached.page,'alert');assert.equal(h.p.values['truck.brake.air.pressure.emergency'],1);
    assert.equal(h.runtime.rally.dash,dash);assert.ok(h.sent.every(mask=>mask===0));
    h.p.values['truck.water.temperature.warning']=0;h.receive(1100);
    h.p.values['truck.water.temperature.warning']=1;h.receive(1200);await h.paint();
    assert.equal(h.runtime.rally.cached.activeAlert.id,'water');
    h.touch('down',1200);h.touch('up',1260);assert.notEqual(h.runtime.rally.cached.page,'alert');
  }finally{h.runtime.stop();}
});

test('ACK does not acknowledge a replacement warning when its pressed warning resolves',async()=>{
  const h=harness();try{
    await h.mount();h.touch('down',100);
    h.p.values['truck.brake.air.pressure.emergency']=0;h.receive(120);h.touch('up',160);
    assert.equal(h.runtime.rally.dash.acknowledged.size,0);
    assert.equal(h.runtime.rally.cached.activeAlert.id,'water');
  }finally{h.runtime.stop();}
});
