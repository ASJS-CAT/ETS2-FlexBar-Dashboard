'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createCanvas}=require('@napi-rs/canvas');
const led=require('../src/airport-led.cjs');
const {Dashboard,settings}=require('../src/model.cjs');
const {drive}=require('./fixtures.cjs');
const pixel=(canvas,x,y)=>[...canvas.getContext('2d').getImageData(x,y,1,1).data];

test('original LED glyphs cover the required alphabet with distinct digits and fixed cells',()=>{
 const required='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ/-:.%+ ';
 for(const [matrix,glyphs,rows]of [['5x7',led.GLYPHS,7]]){
  for(const ch of required){assert.equal(glyphs[ch].length,rows);assert.ok(glyphs[ch].every(row=>/^[01]{5}$/.test(row)));}
  assert.equal(new Set([...required].map(ch=>glyphs[ch].join(''))).size,required.length);
  const a=led.layout('111',{pitch:4,matrix}),b=led.layout('888',{pitch:4,matrix});
  assert.equal(a.width,b.width);assert.equal(a.height,rows*4);
  assert.equal(led.layout('abc: 90%',{matrix}).text,'ABC: 90%');
 }
});

test('each LED cell draws bright and dim dots with real black gaps and no painted overflow',()=>{
 for(const matrix of ['5x7']){
  const canvas=createCanvas(80,40),ctx=canvas.getContext('2d');
  assert.equal(led.draw(ctx,'0',{x:3,y:4,matrix,pitch:2,color:'#ffcc66',dim:'#242a26',background:'#080b0a'}),true);
  assert.deepEqual(pixel(canvas,3,4),[36,42,38,255],'unlit LED remains visible');
  assert.deepEqual(pixel(canvas,5,4),[255,204,102,255],'lit LED is much brighter');
  assert.deepEqual(pixel(canvas,6,4),[8,11,10,255],'one-pixel gap stays dark');
  const plan=led.layout('0',{pitch:2,matrix});
  assert.equal(pixel(canvas,3+plan.width,4)[3],0);assert.equal(pixel(canvas,3,4+plan.height)[3],0);
 }
});

test('legacy 5x8 input renders the same fixed 5x7 glyphs and board as the supported mode',()=>{
 const label='08692 RKMNAHP',options={pitch:3,color:'#ffcc66',dim:'#242a26',background:'#080b0a'};
 const normal=led.layout(label,{...options,matrix:'5x7'}),legacy=led.layout(label,{...options,matrix:'5x8'});
 assert.equal(led.rowCount('5x8'),7);assert.equal(legacy.rows,7);assert.equal(legacy.height,21);
 for(const key of ['width','height','rows','columns','cells','text'])assert.equal(legacy[key],normal[key]);
 const a=createCanvas(240,30),b=createCanvas(240,30);
 assert.equal(led.draw(a.getContext('2d'),label,{...options,x:2,y:2,matrix:'5x7'}),true);
 assert.equal(led.draw(b.getContext('2d'),label,{...options,x:2,y:2,matrix:'5x8'}),true);
 assert.deepEqual(a.getContext('2d').getImageData(0,0,240,30).data,b.getContext('2d').getImageData(0,0,240,30).data);
});

test('a long name scrolls over a fixed physical dot grid, bounded by the original viewport',()=>{
 const options={x:2,y:2,pitch:2,maxWidth:58,pad:true,scroll:true,color:'#ffcc66',dim:'#242a26',background:'#080b0a'};
 const a=createCanvas(70,30),b=createCanvas(70,30);
 led.draw(a.getContext('2d'),'FRANKFURT AM MAIN',{...options,elapsedMs:0});
 led.draw(b.getContext('2d'),'FRANKFURT AM MAIN',{...options,elapsedMs:2300});
 const plan=led.layout('FRANKFURT AM MAIN',options);assert.ok(plan.scrolling);assert.equal(plan.truncated,false);
 assert.notDeepEqual(a.toBuffer('image/png'),b.toBuffer('image/png'));
 for(let y=0;y<30;y++)for(let x=0;x<70;x++){
  const pa=pixel(a,x,y),pb=pixel(b,x,y),inside=x>=2&&x<2+plan.width&&y>=2&&y<2+plan.height;
  if(!inside){assert.equal(pa[3],0);assert.equal(pb[3],0);}
  else if((x-2)%2||(y-2)%2)assert.deepEqual(pa,pb,'the fixed backplate must never move');
  else{assert.ok([36,255].includes(pa[0]));assert.ok([36,255].includes(pb[0]));}
 }
 assert.equal(led.layout('FRANKFURT AM MAIN',{...options,elapsedMs:800}).offset,0);
 const last='FRANKFURT AM MAIN'.length*6-1-plan.columns;
 assert.equal(led.layout('FRANKFURT AM MAIN',{...options,elapsedMs:900+last*120}).offset,last);
 assert.equal(led.layout('FRANKFURT AM MAIN',{...options,elapsedMs:1800+last*120}).offset,0);
});

test('unsupported letters and impossible widths cleanly fall back instead of losing characters',()=>{
 const canvas=createCanvas(80,30),ctx=canvas.getContext('2d');
 for(const label of ['北京','Санкт-Петербург','MÜNCHEN'])assert.equal(led.draw(ctx,label,{x:0,y:0,pitch:2}),false);
 assert.equal(led.layout('123456',{maxWidth:10}),null);
 assert.equal(led.layout('123',{pitch:1}),null);
 assert.equal(pixel(canvas,0,0)[3],0);
 assert.equal(led.layout('1234567890',{maxWidth:58,truncate:true}).text,'12...');
});

test('scroll time follows the existing carousel and resets on touch without changing its page list',()=>{
 const cfg=settings({cyclePanels:['route','fuel'],textStyle:'airport_led'}),d=new Dashboard(),p=drive();
 let v=d.view(p,0,0,cfg);assert.equal(v.panel,'route');assert.equal(v.panelElapsedMs,0);
 v=d.view(p,2300,2300,cfg);assert.equal(v.panelElapsedMs,2300);
 assert.ok(d.nextCarouselPage(2300,cfg,v));v=d.view(p,2300,2300,cfg);assert.equal(v.panel,'fuel');assert.equal(v.panelElapsedMs,0);
 assert.ok(d.nextCarouselPage(4700,cfg,v));v=d.view(p,4700,4700,cfg);assert.equal(v.panel,'route');assert.equal(v.panelElapsedMs,0);
 d.select('job',5000,cfg);v=d.view(p,5000,5000,cfg);assert.equal(v.panel,'job_overview');assert.equal(v.panelElapsedMs,0);
 v=d.view(p,7200,7200,cfg);assert.equal(v.panelElapsedMs,2200);
 assert.ok(d.nextInformationPage(7200,cfg,v));v=d.view(p,7200,7200,cfg);assert.equal(v.panel,'job_timing');assert.equal(v.panelElapsedMs,0);
});
