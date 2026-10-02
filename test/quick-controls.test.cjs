const test=require('node:test'),assert=require('node:assert/strict');
const {settings}=require('../src/model.cjs');
const {CAPABILITIES,STATIC_IDS,TelemetryState,DrivingContext,QuickControlResolver}=require('../src/quick-controls.cjs');
const {drive}=require('./fixtures.cjs');

const resolve=(p,cfg,times)=>{const context=new DrivingContext(),resolver=new QuickControlResolver();let result;
  for(const now of times){const state=new TelemetryState(p,Math.abs(p.values['truck.speed'])*3.6,p.values['truck.displayed.gear']);result=resolver.resolve(state,context.update(state,now),cfg,now);}
  return result;
};
test('every Quick Control has explicit capability metadata',()=>{for(const id of Object.keys(CAPABILITIES))assert.ok(['stateful','momentary','conditional_action'].includes(CAPABILITIES[id]));});
test('only telemetry-backed stateful controls expose persistent state',()=>{const p=drive(),cfg=settings({quickControlsMode:'static'}),q=resolve(p,cfg,[0]);
  for(const control of q.controls){assert.equal(control.capability,CAPABILITIES[control.id]);if(control.capability!=='stateful')assert.equal(control.on,null);}
  assert.equal(q.controls.find(c=>c.id==='lights').on,true);delete p.values['truck.wipers'];
  assert.equal(resolve(p,cfg,[0]).controls.find(c=>c.id==='wipers').on,null,'missing telemetry must be unknown, not OFF');
});
test('stateful highlights refresh from telemetry without a layout change',()=>{const p=drive(),cfg=settings(),context=new DrivingContext(),resolver=new QuickControlResolver();
  let state=new TelemetryState(p,80,12),q=resolver.resolve(state,context.update(state,0),cfg,0);assert.equal(q.controls.find(c=>c.id==='hazard').on,false);
  p.values['truck.hazard.warning']=1;state=new TelemetryState(p,80,12);q=resolver.resolve(state,context.update(state,50),cfg,50);assert.equal(q.controls.find(c=>c.id==='hazard').on,true);
});
test('dynamic driving removes high-frequency controller duplicates',()=>{const q=resolve(drive(),settings(),[0]);const ids=q.controls.map(c=>c.id);
  for(const id of ['horn','wipers','cruise','retarder','route','truck','page'])assert.ok(!ids.includes(id));assert.ok(ids.includes('hazard'));for(const c of q.controls){assert.equal(Number.isInteger(c.x),true);assert.equal(Number.isInteger(c.w),true);}
});
test('stopped, parked, reversing and trailer rules merge after debounce',()=>{const cfg=settings(),p=drive();p.values['truck.speed']=0;
  let q=resolve(p,cfg,[0,601]);assert.equal(q.context.STOPPED,true);assert.ok(q.controls.some(c=>c.id==='engine'));
  p.values['truck.brake.parking']=1;p.values['trailer.connected']=1;q=resolve(p,cfg,[0,601,852,1103]);
  assert.equal(q.context.PARKED,true);assert.equal(q.context.TRAILER_ATTACHED,true);assert.equal(q.controls.find(c=>c.id==='trailer').holdMs,800);
  p.values['truck.displayed.gear']=-1;q=resolve(p,cfg,[0,151]);assert.equal(q.context.REVERSING,true);assert.deepEqual(q.controls.slice(0,2).map(c=>c.id),['camera','mirror']);
});
test('no-trailer filtering, Hybrid pins and Static compatibility are preserved',()=>{const p=drive();
  let q=resolve(p,settings({quickControlsMode:'hybrid',pinnedControls:['lights','hazard','parking','engine']}),[0]);assert.deepEqual(q.controls.slice(0,3).map(c=>c.id),['lights','hazard','parking']);assert.ok(!q.controls.some(c=>c.id.startsWith('trailer')));
  q=resolve(p,settings({quickControlsMode:'static'}),[0]);assert.deepEqual(q.controls.map(c=>c.id),STATIC_IDS);assert.deepEqual(q.controls.map(c=>c.w),Array(8).fill(90));
});
test('CTRL and INFO sections use the same definitions as the live resolver',()=>{const p=drive(),base=settings();
  let q=resolve(p,{...base,section:1},[0]);assert.deepEqual(q.controls.map(c=>c.id),['engine','parking','lights','hazard','axle','diff']);
  q=resolve(p,{...base,section:2},[0]);assert.deepEqual(q.controls.map(c=>c.id),['map_job','brake_info','auto']);
  p.values['trailer.connected']=1;q=resolve(p,{...base,section:2},[0,251]);assert.deepEqual(q.controls.map(c=>c.id),['map_job','trailer_info','brake_info','auto']);
});
test('Binding Mode exposes every generic input in three pages without scene filters or dangerous holds',()=>{const p=drive(),all=[];
  for(let bindingPage=0;bindingPage<3;bindingPage++){const q=resolve(p,{...settings(),bindingMode:true,bindingPage},[0]);assert.equal(q.binding,true);all.push(...q.controls.filter(c=>c.bit!==undefined).map(c=>c.id));assert.equal(q.controls.at(-1).id,'bind_next');}
  assert.deepEqual([...new Set(all)].sort(),['axle','camera','cruise','diff','engine','hazard','horn','lights','mirror','parking','retarder','trailer','trailer_brake','wipers'].sort());
  const trailer=resolve(p,{...settings(),bindingMode:true,bindingPage:1},[0]).controls.find(c=>c.id==='trailer');assert.equal(trailer.holdMs,undefined);assert.equal(trailer.label,'T-COUPLE');
});
