const test=require('node:test'),assert=require('node:assert/strict');
const {createCanvas}=require('@napi-rs/canvas');
const {Dashboard,settings}=require('../src/model.cjs'),{render}=require('../src/render.cjs'),{drive}=require('./fixtures.cjs');
const cfg=settings({refuelExitSeconds:1.8});
function setup(){const d=new Dashboard(),p=drive();Object.assign(p.values,{'truck.speed':0,'truck.fuel.amount':12,'truck.adblue':1,'truck.fuel.warning':1,'truck.adblue.warning':1});return {d,p};}
for(const field of ['truck.fuel.amount','truck.adblue'])test(`${field}: first rise takes precedence over both resource warnings, which return after filling`,()=>{
 const {d,p}=setup();let v=d.view(p,0,0,cfg);assert.equal(v.page,'alert');
 p.seq++;p.values[field]+=.1;v=d.view(p,50,50,cfg);
 assert.equal(v.page,'refueling');assert.equal(v.panel,'fuel');
 assert.equal(v.refueling,field==='truck.fuel.amount');assert.equal(v.adblueRefilling,field==='truck.adblue');
 assert.deepEqual(v.alerts.map(a=>a.id),['fuel','adblue']);assert.ok(v.alerts.every(a=>!a.acknowledged));assert.equal(d.acknowledged.size,0);
 assert.ok(!v.quick.controls.some(c=>c.id==='ack'));
 assert.equal(d.view(p,1849,1849,cfg).page,'refueling');
 v=d.view(p,1850,1850,cfg);assert.equal(v.page,'alert');assert.ok(v.quick.controls.some(c=>c.id==='ack'));
 assert.equal(p.values['truck.adblue.warning'],1);assert.equal(p.values['truck.fuel.warning'],1);
});
test('critical warnings retain priority during filling; ACK and trip totals remain independent',()=>{
 const {d,p}=setup();p.values['truck.brake.air.pressure.emergency']=1;d.consumption.output=32;d.consumption.distance=5;d.consumption.fuelUsed=1.6;
 d.view(p,0,0,cfg);p.seq++;p.values['truck.fuel.amount']+=1;let v=d.view(p,50,50,cfg);
 assert.equal(v.page,'alert');assert.equal(v.activeAlert.id,'air-emergency');assert.ok(v.refueling);
 d.acknowledge('air-emergency');v=d.view(p,60,60,cfg);assert.equal(v.page,'refueling');
 assert.deepEqual([...d.acknowledged],['air-emergency']);assert.equal(d.consumption.output,32);assert.equal(d.consumption.distance,5);assert.equal(d.consumption.fuelUsed,1.6);
});
test('filling pauses manual pages, yields back to them when resource warnings clear, and does not change section',()=>{
 const {d,p}=setup();delete p.values['truck.fuel.warning'];delete p.values['truck.adblue.warning'];p.values['truck.fuel.amount']=300;
 d.section=2;d.select('job',0,cfg);d.view(p,0,0,cfg);p.seq++;p.values['truck.adblue']+=.5;
 let v=d.view(p,50,50,cfg);assert.equal(v.page,'refueling');const hold=d.manualRemainingMs;
 d.view(p,1500,1500,cfg);assert.equal(d.manualRemainingMs,hold);
 v=d.view(p,1850,1850,cfg);assert.equal(v.page,'job');assert.equal(v.section,2);
});
test('fresh rises extend the hold, repeated renders do not, and tiny drift cannot trigger filling',()=>{
 const {d,p}=setup();d.view(p,0,0,cfg);p.seq++;p.values['truck.fuel.amount']+=.005;
 assert.equal(d.view(p,50,50,cfg).refueling,false);
 p.seq++;p.values['truck.fuel.amount']+=1;d.view(p,100,100,cfg);
 p.seq++;p.values['truck.fuel.amount']+=1;d.view(p,1000,1000,cfg);
 assert.equal(d.view(p,2799,2799,cfg).refueling,true);assert.equal(d.view(p,2800,2800,cfg).refueling,false);
});
for(const state of ['moving','unknown_speed','paused','missing_previous','missing_current'])test(`${state}: do not invent refueling from invalid or ineligible samples`,()=>{
 const {d,p}=setup();
 if(state==='missing_previous'){delete p.values['truck.fuel.amount'];delete p.values['truck.adblue'];}
 d.view(p,0,0,cfg);p.seq++;p.values['truck.fuel.amount']=100;p.values['truck.adblue']=10;
 if(state==='moving')p.values['truck.speed']=5;
 if(state==='unknown_speed')delete p.values['truck.speed'];
 if(state==='paused')p.paused=true;
 if(state==='missing_current'){delete p.values['truck.fuel.amount'];delete p.values['truck.adblue'];}
 const v=d.view(p,50,50,cfg);assert.equal(v.refueling,false);assert.equal(v.adblueRefilling,false);
});
test('fuel percent and litres share the baseline, with litres to the right in normal and filling views',()=>{
 const proto=Object.getPrototypeOf(createCanvas(1,1).getContext('2d')),original=proto.fillText;let calls=[];
 proto.fillText=function(s,x,y,...rest){calls.push({s:String(s),x,y});return original.call(this,s,x,y,...rest);};
 try{for(const filling of [false,true])for(const language of ['en','zh']){
  calls=[];const d=new Dashboard(),p=drive(),c=settings({dashboardLanguage:language});p.values['truck.speed']=0;d.view(p,0,0,c);
  if(filling){p.seq++;p.values['truck.fuel.amount']+=1;}
  render(d.view(p,50,50,c),c);const percent=calls.find(a=>a.x===884&&a.y===35),litres=calls.find(a=>a.x===941&&a.y===35);
  assert.equal(percent.s,'65%');assert.equal(litres.s,filling?'391.0 L':'390.0 L');assert.equal(litres.y,percent.y);
 }
 }finally{proto.fillText=original;}
});
