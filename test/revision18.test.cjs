const test=require('node:test'),assert=require('node:assert/strict');
const {Dashboard,settings}=require('../src/model.cjs'),{rpmScale,SPEED}=require('../src/layout.cjs'),{render}=require('../src/render.cjs'),{drive}=require('./fixtures.cjs');
const cfg=settings();
test('new defaults do not overwrite saved custom values',()=>{assert.equal(cfg.fps,20);assert.equal(cfg.airPressureFullPsi,185);assert.equal(settings({fps:15,airPressureFullPsi:175}).fps,15);assert.equal(settings({fps:15,airPressureFullPsi:175}).airPressureFullPsi,175);});
test('25 RPM LEDs, fill thresholds and labels share one coordinate transform in both formats',()=>{
 const p=drive();p.values['rpm.limit']=2900;
 const a=rpmScale(p,cfg),b=rpmScale(p,settings({rpmScaleFormat:'x100'}));assert.equal(a.max,2500);assert.equal(b.max,a.max);assert.equal(a.leds.length,25);
 assert.deepEqual(b.labels.map(l=>l.text),[0,5,10,15,20,25]);assert.deepEqual(a.labels.map(l=>l.x),b.labels.map(l=>l.x));
 for(const l of a.labels.filter(l=>l.rpm>0))assert.ok(a.leds.some(led=>led.rpm===l.rpm&&led.x===l.x));
 assert.equal(rpmScale(p,settings({rpmScaleMax:0})).max,2900);assert.equal(SPEED.numberX,145);assert.ok(SPEED.infoX>SPEED.numberX+SPEED.numberWidth);assert.ok(SPEED.cruiseBaseline<SPEED.unitBaseline);
});
test('ACK confirms only selected warning, critical telemetry remains and recurrence can be acknowledged again',()=>{
 const p=drive(),d=new Dashboard();Object.assign(p.values,{'truck.water.temperature.warning':1,'truck.brake.air.pressure.emergency':1});
 let v=d.view(p,0,0,cfg);const target=v.activeAlert.id;assert.equal(v.quick.controls[0].id,'ack');assert.equal(v.quick.controls[0].warningId,target);
 d.acknowledge(target);v=d.view(p,100,100,cfg);assert.notEqual(v.activeAlert.id,target);assert.ok(v.alerts.find(a=>a.id===target).acknowledged);d.acknowledge(v.activeAlert.id);
 v=d.view(p,200,200,cfg);assert.equal(v.page,'drive');assert.ok(v.urgent);assert.equal(v.acknowledgedWarnings.length,2);assert.ok(!v.quick.controls.some(c=>c.id==='ack'));assert.equal(p.values['truck.water.temperature.warning'],1);
 p.values['truck.water.temperature.warning']=0;d.view(p,300,300,cfg);p.values['truck.water.temperature.warning']=1;v=d.view(p,400,400,cfg);assert.equal(v.activeAlert.id,'water');
});
test('AdBlue refilling and diesel refilling coexist without inventing litres or percent',()=>{
 const p=drive(),d=new Dashboard();p.values['truck.speed']=0;d.view(p,0,0,cfg);
 for(let i=1;i<=2;i++){p.seq++;p.values['truck.adblue']+=.5;p.values['truck.fuel.amount']+=1;d.view(p,i*100,i*100,cfg);}
 let v=d.view(p,300,300,cfg);assert.equal(v.page,'refueling');assert.ok(v.refueling&&v.adblueRefilling);assert.equal(v.adblue,p.values['truck.adblue']);
 delete p.values['adblue.capacity'];v=d.view(p,400,400,cfg);assert.equal(v.adbluePercent,null);assert.ok(v.adblue>0);
 assert.equal(d.view(p,2400,2400,cfg).adblueRefilling,false);
});
test('motion section preserves core and has no normal control buttons, warnings retain priority',()=>{
 const p=drive(),d=new Dashboard();d.section=3;let v=d.view(p,0,0,cfg);assert.equal(v.page,'motion');assert.equal(v.quick.controls.length,0);assert.ok(v.kmh>0);assert.ok(v.rpm>0);assert.equal(render(v,cfg).width,2170);
 p.values['truck.water.temperature.warning']=1;v=d.view(p,100,100,cfg);assert.equal(v.page,'alert');assert.equal(v.quick.controls[0].id,'ack');
});
test('all semantic pages render through the shared model, including battery and four control sections',()=>{
 for(const section of [0,1,2,3])for(const panel of ['fuel','route','systems']){
 const p=drive(),d=new Dashboard(),c=settings({cyclePanels:[panel]});d.section=section;const v=d.view(p,0,0,c);const image=render(v,c);assert.equal(image.width,2170);assert.equal(image.height,60);
 }
 const p=drive(),d=new Dashboard(),c=settings({cyclePanels:['systems']});let v=d.view(p,0,0,c);const first=render(v,c).toBuffer('image/png');p.values['truck.battery.voltage']=24.6;assert.notDeepEqual(first,render(d.view(p,0,0,c),c).toBuffer('image/png'));
 for(const page of ['job','trailer','brake']){d.select(page,0,c);assert.equal(render(d.view(p,0,0,c),c).height,60);}
});
test('entry never embeds a fake offline status',()=>{
 const m=require('../com.local.ets2rally.plugin/manifest.json'),s=m.keyLibrary.children[0].style;
 assert.equal(s.width,2170);assert.equal(s.showImage,true);
 assert.equal(s.image,require('../src/launcher.cjs').renderLauncher({}, {bilingual:true}).toDataURL('image/png'));
});
