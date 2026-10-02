'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {decelerationG,pedalState,GForce}=require('../src/driving-metrics.cjs');
const {Dashboard,settings}=require('../src/model.cjs'),{drive}=require('./fixtures.cjs');
const G=9.80665;
function packet(velocity,acceleration){
  const p=drive();for(let i=0;i<3;i++){const axis=['x','y','z'][i];p.values['truck.local.velocity.linear.'+axis]=velocity[i];p.values['truck.local.acceleration.linear.'+axis]=acceleration[i];}return p;
}
test('actual deceleration follows motion, including reverse and auxiliary-only braking, not retarder steps',()=>{
  for(const sign of [-1,1]){
    const p=packet([0,0,20*sign],[0,0,-.3*G*sign]);p.values['truck.input.brake']=0;p.values['truck.effective.brake']=0;
    assert.ok(Math.abs(decelerationG(p)-.3)<1e-12);
    for(const level of [0,1,5]){p.values['truck.brake.retarder']=level;assert.ok(Math.abs(pedalState(p).brake-.3)<1e-12);}
    p.values['truck.local.acceleration.linear.z']=G*sign;assert.equal(decelerationG(p),0);
  }
  assert.equal(decelerationG(packet([0,0,-20],[G,0,0])),0,'cornering alone is not longitudinal braking');
  assert.equal(decelerationG(packet([0,0,0],[0,0,G])),0,'no unstable direction at rest');
  assert.equal(pedalState(packet([0,0,-20],[0,0,2*G])).brake,1,'only the bar clamps at 1 g');
  assert.equal(decelerationG(packet([0,0,-20],[0,0,2*G])),2,'numeric metric retains actual value');
});
test('missing motion channels are unknown, not invented from brake input, lights, gear or retarder',()=>{
  for(const value of [undefined,null,NaN,Infinity]){
    const p=packet([0,0,-20],[0,0,G]);p.values['truck.input.brake']=1;p.values['truck.effective.brake']=1;p.values['truck.brake.retarder']=5;
    p.values['truck.local.acceleration.linear.x']=value;assert.equal(decelerationG(p),null);assert.equal(pedalState(p).brake,null);
  }
});
test('G force uses all three axes, records peak, ignores pause and preserves peak across unavailable samples',()=>{
  const metric=new GForce(),p=packet([0,0,-20],[3*G,4*G,0]);
  assert.deepEqual(metric.update(p),{current:5,peak:5});
  p.values['truck.local.acceleration.linear.x']=0;p.values['truck.local.acceleration.linear.y']=G;
  assert.deepEqual(metric.update(p),{current:1,peak:5});
  p.paused=true;p.values['truck.local.acceleration.linear.y']=100*G;assert.deepEqual(metric.update(p),{current:1,peak:5});
  p.paused=false;delete p.values['truck.local.acceleration.linear.y'];assert.deepEqual(metric.update(p),{current:null,peak:5});
  metric.reset();assert.equal(metric.peak,null);
});
test('G peak is tracked outside motion page and resets with existing trip action',()=>{
  const d=new Dashboard(),cfg=settings(),p=packet([0,0,-20],[0,0,.8*G]);
  assert.ok(Math.abs(d.view(p,0,0,cfg).gForce.peak-.8)<1e-12);
  d.section=3;p.seq++;p.values['truck.local.acceleration.linear.z']=.2*G;
  let v=d.view(p,50,50,cfg);assert.equal(v.page,'motion');assert.ok(Math.abs(v.gForce.peak-.8)<1e-12);
  d.resetTrip(p);v=d.view(p,100,100,cfg);assert.ok(Math.abs(v.gForce.peak-.2)<1e-12);
  assert.equal(d.section,3);
});
