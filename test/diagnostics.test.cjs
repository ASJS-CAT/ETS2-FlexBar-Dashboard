const test=require('node:test'),assert=require('node:assert/strict');
const {diagnostics}=require('../src/diagnostics.cjs');
test('diagnostics queries hardware and configuration without any page activation; limits captured data',async()=>{
  let cfg,calls=[];
  const transport={ws:{readyState:1},pendingCalls:{reply:{}},call:async(type,p,timeout)=>{
    calls.push([type,p,timeout]);
    return p.api==='getDeviceStatus'?[{serialNumber:'A',connected:true,privateField:'omit'}]:{theme:'el'};
  }};
  const wakes=[];const d=diagnostics({uuid:'test',transport,sendControlCommand:async(s,c)=>wakes.push([s,c])},v=>cfg=v);
  await d.refresh();assert.equal(cfg.theme,'el');assert.equal(d.state.hardware[0].connected,true);
  assert.equal(d.state.hardware[0].privateField,undefined);assert.equal(d.state.configLoaded,true);
  assert.ok(calls.every(c=>c[2]===1500));
  await d.wakeDevices();await d.wakeDevices();assert.deepEqual(wakes,[['A','sys.wake']]);assert.equal(d.state.wakeSucceeded,1);
  d.observe(JSON.stringify({uuid:'reply',type:'response',payload:{secret:'omit'}}));assert.deepEqual(d.state.events,{});
  d.observe(JSON.stringify({type:'plugin.alive',payload:{serialNumber:'A',keys:[{cid:'test.key',cfg:{keyType:'directDraw'},image:'omit'}]}}));
  assert.equal(d.state.lastEvent.keys[0].keyType,'directDraw');assert.equal(d.state.lastEvent.keys[0].image,undefined);
  d.observe(JSON.stringify({type:'ui.message',payload:{action:'status'}}));assert.equal(d.state.lastEvent.type,'plugin.alive');
  transport.call=async()=>{throw Error('timeout');};await d.refresh();assert.equal(d.state.hardware,null);assert.equal(d.state.configLoaded,false);
  assert.equal(d.state.hardwareError,'timeout');
});
