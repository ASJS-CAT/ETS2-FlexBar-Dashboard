'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {render}=require('../src/render.cjs'),{Dashboard,settings}=require('../src/model.cjs');
const {PALETTES}=require('../src/themes.cjs'),{drive}=require('./fixtures.cjs');
const rgb=hex=>hex.slice(1).match(/../g).map(v=>parseInt(v,16));
const pixel=(c,x,y)=>[...c.getContext('2d').getImageData(x,y,1,1).data].slice(0,3);
function frame(input,effective,theme='rally',state='CONNECTED'){
  const p=drive(),cfg=settings({theme});p.paused=state==='PAUSED';
  for(const name of ['throttle','brake']){
    delete p.values[`truck.input.${name}`];delete p.values[`truck.effective.${name}`];
    if(input!==undefined)p.values[`truck.input.${name}`]=input;
    if(effective!==undefined)p.values[`truck.effective.${name}`]=effective;
  }
  if(Number.isFinite(effective)){
    Object.assign(p.values,{'truck.local.velocity.linear.x':0,'truck.local.velocity.linear.y':0,'truck.local.velocity.linear.z':-20,'truck.local.acceleration.linear.x':0,'truck.local.acceleration.linear.y':0,'truck.local.acceleration.linear.z':effective*9.80665});
  }
  const v=new Dashboard().view(p,0,0,cfg);v.connectionState=state;
  return render(v,cfg);
}
for(const theme of ['rally','el_mint','el_amber'])test(`overlaid pedals preserve both values and exact track extents (${theme})`,()=>{
  for(const [input,effective]of [[.75,.25],[.25,.75],[.5,.5],[0,.75],[.75,0],[-1,2]]){
    const c=frame(input,effective,theme),base=frame(input,0,theme),C=PALETTES[theme];
    for(const [y,physical,actual]of [[5,C.green,'#57e6f2'],[11,C.red,'#ffc34a']]){
      for(let dx=0;dx<140;dx++)for(let row=0;row<3;row++){
        let expected=dx<Math.round(140*Math.max(0,Math.min(1,input)))?physical:C.line;
        if(row>=1&&dx<Math.round(140*Math.max(0,Math.min(1,effective))))expected=actual;
        assert.deepEqual(pixel(c,141+dx,y+row),rgb(expected),`input=${input}, effective=${effective}, x=${dx}, y=${y+row}`);
      }
    }
    const a=c.getContext('2d').getImageData(0,0,2170,60).data,b=base.getContext('2d').getImageData(0,0,2170,60).data;
    for(let y=0;y<60;y++)for(let x=0;x<2170;x++){
      if(x>=141&&x<281&&([6,7,12,13].includes(y)))continue;
      const i=(y*2170+x)*4;for(let ch=0;ch<4;ch++)assert.equal(a[i+ch],b[i+ch],`unexpected change outside overlay x=${x} y=${y}`);
    }
  }
});
test('missing effective throttle / motion data never copies physical input; either channel can render independently',()=>{
  for(const effective of [undefined,NaN,Infinity]){
    const c=frame(.5,effective);assert.deepEqual(pixel(c,160,6),rgb(PALETTES.rally.green));assert.deepEqual(pixel(c,160,12),rgb(PALETTES.rally.red));
  }
  const c=frame(undefined,.5);assert.deepEqual(pixel(c,160,5),rgb(PALETTES.rally.line));assert.deepEqual(pixel(c,160,6),rgb('#57e6f2'));
  assert.deepEqual(pixel(c,160,11),rgb(PALETTES.rally.line));assert.deepEqual(pixel(c,160,12),rgb('#ffc34a'));
});
test('paused and stale telemetry leave both pedal tracks neutral',()=>{
  for(const state of ['PAUSED','STALE']){
    const c=frame(1,1,'rally',state);for(const y of [5,6,7,11,12,13])assert.deepEqual(pixel(c,200,y),rgb(PALETTES.rally.line));
  }
});
