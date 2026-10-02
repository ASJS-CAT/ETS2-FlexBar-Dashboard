const test=require('node:test'),assert=require('node:assert/strict');
const {Dashboard,settings,decode}=require('../src/model.cjs');
const {TelemetryState,QuickControlResolver}=require('../src/quick-controls.cjs');
const {render}=require('../src/render.cjs');
const {drive}=require('./fixtures.cjs');
const cfg=settings();
test('offline exposes no vehicle buttons; Static remains fixed even while reversing',()=>{
 const d=new Dashboard();assert.deepEqual(d.view(null,0,0,cfg).quick.controls,[]);
 const p=drive(),s=new TelemetryState(p,5,-2),q=new QuickControlResolver().resolve(s,{REVERSING:true},settings({quickControlsMode:'static'}),0);
 assert.deepEqual(q.controls.map(c=>c.id),require('../src/quick-controls.cjs').STATIC_IDS);
});
test('lights follow OFF / position / low / high / OFF and unknown is not lit',()=>{
 const p=drive(),s=new TelemetryState(p,80,10),q=new QuickControlResolver(),ctx={DRIVING:true};
 for(const [low,high,position,label,on] of [[0,0,0,'OFF',false],[0,0,1,'POSITION',false],[1,0,1,'LOW BEAM',true],[1,1,1,'LOW + HIGH',true],[0,0,0,'OFF',false]]){
 Object.assign(p.values,{'truck.light.beam.low':low,'truck.light.beam.high':high,'truck.light.parking':position});
 const b=q.resolve(s,ctx,cfg,0).controls.find(c=>c.id==='lights');assert.equal(b.state,label);assert.equal(b.on,on);
 }
 delete p.values['truck.light.beam.low'];delete p.values['truck.light.beam.high'];assert.equal(s.on('lights'),null);
});
test('ordered preferences and pins merge, hidden controls are excluded',()=>{
 const s=new TelemetryState(drive(),80,10),q=new QuickControlResolver();
 const controls=q.resolve(s,{DRIVING:true},settings({quickControlsMode:'hybrid',pinnedControls:['parking','hazard'],controlOrder:['camera','lights'],hiddenControls:['lights']}),0).controls;
 assert.deepEqual(controls.slice(0,3).map(c=>c.id),['parking','hazard','camera']);assert.ok(!controls.some(c=>c.id==='lights'));assert.equal(controls[2].on,null);
});
test('running engine shutdown always requires hold; detach disallowed while rolling',()=>{
 const p=drive();p.values['truck.engine.enabled']=1;
 const controls=new QuickControlResolver().resolve(new TelemetryState(p,2,1),{STOPPED:true,TRAILER_ATTACHED:true},{...cfg,section:1},0).controls;
 assert.equal(controls.find(c=>c.id==='engine').holdMs,800);assert.ok(!controls.some(c=>c.id==='trailer'));
});
test('payments deduplicate, queue, use configurable visible duration, pause under game pause',()=>{
 const p=drive(),d=new Dashboard(),c=settings({paymentSeconds:1});p.payments=[{id:'a',type:'fine',amount:123},{id:'b',type:'ferry',amount:45}];
 assert.equal(d.view(p,0,0,c).tollNotice.id,'a');
 p.paused=true;for(let t=100;t<=2000;t+=100)d.view(p,t,t,c);
 assert.equal(d.tollQueue[0].shownMs,0);assert.equal(d.tollQueue.length,2);
 p.paused=false;for(let t=2100;t<=3300;t+=100)d.view(p,t,t,c);
 assert.equal(d.tollQueue[0].id,'b');assert.equal(d.tollQueue.length,1);
});
test('UTF-8 decoding retains international text; font fallback draws distinct CJK glyphs',()=>{
 const p=drive();p.values['job.cargo']='药品 München Москва Łódź';const decoded=decode(Buffer.from(JSON.stringify(p)));
 assert.equal(decoded.values['job.cargo'],p.values['job.cargo']);
 const {createCanvas}=require('@napi-rs/canvas'),{FONT_FAMILY,fontDiagnostics}=require('../src/fonts.cjs');
 if(process.platform==='win32')assert.equal(fontDiagnostics.cjkAvailable,true);
 const glyph=s=>{const c=createCanvas(60,40),x=c.getContext('2d');x.font=`24px ${FONT_FAMILY}`;x.fillText(s,0,30);return c.toBuffer('image/png');};
 assert.notDeepEqual(glyph('药'),glyph('品'));assert.notDeepEqual(glyph('药'),glyph('□'));
});
test('R1 and R2 differ; gear size and RPM scale settings change actual renderer output',()=>{
 const p=drive();p.values['truck.displayed.gear']=-1;const d=new Dashboard(),v=d.view(p,0,0,cfg);
 const bytes=(v,c)=>render(v,c).toBuffer('image/png');
 assert.notDeepEqual(bytes(v,cfg),bytes({...v,gear:-2},cfg));assert.notDeepEqual(bytes(v,cfg),bytes(v,settings({gearFontSize:26})));
 assert.notDeepEqual(bytes(v,cfg),bytes(v,settings({rpmScaleFormat:'x100',rpmLabelCount:4})));
});
test('location alternate rotates only when supplied and uses same renderer',()=>{
 const p=drive();p.values['job.destination.city']='München';p.values['job.destination.city.alternate']='Munich';
 const d=new Dashboard(),c=settings({cyclePanels:['route'],locationRotationSeconds:2}),v=d.view(p,0,0,c);
 assert.notDeepEqual(render(v,c,0).toBuffer('image/png'),render(v,c,2000).toBuffer('image/png'));
 delete p.values['job.destination.city.alternate'];assert.deepEqual(render(v,c,0).toBuffer('image/png'),render(v,c,2000).toBuffer('image/png'));
});
