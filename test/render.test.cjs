const test=require('node:test'),assert=require('node:assert/strict');
const {render}=require('../src/render.cjs'),{Dashboard,settings}=require('../src/model.cjs');
const {drive}=require('./fixtures.cjs');
function pixel(c,x,y){return [...c.getContext('2d').getImageData(x,y,1,1).data].slice(0,3);}
test('speed header has independent throttle and brake strips, with neutral paused/missing readings',()=>{
  const p=drive(),cfg=settings(),d=new Dashboard();
  p.values['truck.input.brake']=0.2;
  let c=render(d.view(p,0,0,cfg),cfg);
  assert.deepEqual(pixel(c,160,6),[154,255,101]);
  assert.deepEqual(pixel(c,250,6),[41,52,62]);
  assert.deepEqual(pixel(c,160,12),[255,80,90]);
  assert.deepEqual(pixel(c,180,12),[41,52,62]);
  p.paused=true;c=render(d.view(p,0,0,cfg),cfg);assert.deepEqual(pixel(c,160,6),[41,52,62]);
  p.paused=false;delete p.values['truck.input.throttle'];c=render(d.view(p,0,0,cfg),cfg);assert.deepEqual(pixel(c,160,6),[41,52,62]);
});
test('RPM colors progress from green through yellow/orange to red at the defined limits',()=>{
  const {rpmColor}=require('../src/themes.cjs');
  assert.equal(rpmColor(0.1),'#82ed63');assert.equal(rpmColor(0.549),'#82ed63');
  assert.equal(rpmColor(0.55),'#ffe45b');assert.equal(rpmColor(0.85),'#ff4545');
  const yellow=parseInt(rpmColor(0.6).slice(3,5),16),orange=parseInt(rpmColor(0.8).slice(3,5),16);
  assert.ok(yellow>orange);
});
test('font and seven-segment number styles both render and remain visually distinct',()=>{
  const p=drive(),d=new Dashboard(),font=settings({digitStyle:'font'}),segment=settings({digitStyle:'segment'}),v=d.view(p,0,0,font);
  const a=render(v,font).toBuffer('image/png'),b=render(v,segment).toBuffer('image/png');assert.notDeepEqual(a,b);
});
test('EL Mint and EL Amber are selectable, distinct and render every state with the same dimensions',()=>{
  const cfg=settings({theme:'el_mint'}),amber=settings({theme:'el_amber'}),p=drive(),d=new Dashboard();assert.equal(cfg.theme,'el_mint');
  assert.equal(settings({theme:'invalid'}).theme,'rally');
  const normal=render(d.view(p,0,0,cfg),settings()).toBuffer('image/png');
  const el=render(d.view(p,0,0,cfg),cfg).toBuffer('image/png'),warm=render(d.view(p,0,0,amber),amber).toBuffer('image/png');assert.notDeepEqual(normal,el);assert.notDeepEqual(el,warm);
  for(const page of ['drive','navigation','systems','reverse','alert','paused','offline']){
    const v=d.view(p,0,0,cfg);v.page=page;
    if(page==='alert'){v.alerts=[{text:'LOW AIR',critical:true}];v.urgent=true;}
    const c=render(v,cfg);assert.equal(c.width,2170);assert.equal(c.height,60);
  }
});
test('compact overspeed LEDs, trip average area and AdBlue bars render in the speed and rotating panel',()=>{
  const p=drive(),cfg=settings({cyclePanels:['fuel']}),d=new Dashboard();p.values['truck.speed']=30;
  let v=d.view(p,0,0,cfg);v.page='drive';const c=render(v,cfg,0);
  const warning=pixel(c,require('../src/layout.cjs').RECTS.speed.left,30);assert.ok(warning[0]>warning[1]&&warning[0]>warning[2]);
  assert.notDeepEqual(pixel(c,900,43),pixel(c,1010,43),'partially filled fuel bar has distinct track');
  assert.notDeepEqual(pixel(c,1210,43),pixel(c,1325,43),'partially filled AdBlue bar has distinct track');
});
test('external truck controls illuminate cockpit icons and side indicators',()=>{
  const p=drive(),cfg=settings({quickControlsMode:'static'}),d=new Dashboard();p.values['truck.light.lblinker']=1;p.values['truck.wipers']=1;
  const c=render(d.view(p,0,0,cfg),cfg,0);const left=pixel(c,1,30),inactive=pixel(c,25,30);
  assert.ok(left[1]>inactive[1]);assert.notDeepEqual(pixel(c,1750,10),pixel(c,1840,10));
});
test('bright turn indicators extend into peripheral edge area and remain telemetry-driven',()=>{const p=drive(),cfg=settings(),d=new Dashboard();p.values['truck.light.lblinker']=1;
  let c=render(d.view(p,0,0,cfg),cfg,0);assert.ok(pixel(c,40,30)[1]>60);delete p.values['truck.light.lblinker'];c=render(d.view(p,0,0,cfg),cfg,0);assert.ok(pixel(c,40,30)[1]<30);
});
test('one, two and three digit speed limits are visually centered by glyph bounds',()=>{for(const limit of [5,50,120]){const p=drive(),cfg=settings(),d=new Dashboard();p.values['truck.navigation.speed.limit']=limit/3.6;
  const c=render(d.view(p,0,0,cfg),cfg,0),data=c.getContext('2d').getImageData(297,13,41,41).data,xs=[];
  for(let y=0;y<41;y++)for(let x=0;x<41;x++){const i=(y*41+x)*4;if(data[i]<70&&data[i+1]<70&&data[i+2]<70&&Math.hypot(x+297-317,y+13-33)<16)xs.push(x+297);}
  assert.ok(xs.length);assert.ok(Math.abs((Math.min(...xs)+Math.max(...xs))/2-317)<=2,`limit ${limit} is not centered`);
}});
test('active overspeed warning includes a larger centered speed-limit sign',()=>{for(const limit of [80,120]){const p=drive(),cfg=settings(),d=new Dashboard();p.values['truck.navigation.speed.limit']=limit/3.6;p.values['truck.speed']=40;
  const c=render(d.view(p,0,0,cfg),cfg),data=c.getContext('2d').getImageData(1379,5,53,53).data,xs=[];
  for(let y=0;y<53;y++)for(let x=0;x<53;x++){const i=(y*53+x)*4;if(data[i]<70&&data[i+1]<70&&data[i+2]<70&&Math.hypot(x-26,y-26)<21)xs.push(x+1379);}
  assert.ok(xs.length);assert.ok(Math.abs((Math.min(...xs)+Math.max(...xs))/2-1405)<=2,`large limit ${limit} is not centered`);
}});
test('cruise set speed, truck brake air bar, and semantic pages affect rendering',()=>{const p=drive(),cfg=settings(),d=new Dashboard(),plain=render(d.view(p,0,0,cfg),cfg).toBuffer('image/png');p.values['truck.cruise_control']=22;
  const cruise=render(d.view(p,1,1,cfg),cfg).toBuffer('image/png');assert.notDeepEqual(plain,cruise);
  let v=d.view(p,2,2,cfg);v.page='systems';v.panel='systems_brake';const brake=render(v,cfg);assert.notDeepEqual(pixel(brake,1200,46),pixel(brake,1340,46));
  const images=[];for(const panel of ['route','job_overview','job_timing','job_distance','trailer_status','trailer_damage','systems_engine','systems_brake']){v={...v,page:'job',panel};images.push(render(v,cfg).toBuffer('image/png').toString('base64'));}
  assert.equal(new Set(images).size,images.length);
});
test('automatic braking uses a live force bar and the unified warning layout keeps detail on the right',()=>{const p=drive(),cfg=settings(),d=new Dashboard();p.values['truck.input.brake']=.63;
  let v=d.view(p,0,0,cfg),c=render(v,cfg);assert.equal(v.page,'braking');assert.notDeepEqual(pixel(c,750,46),pixel(c,919,46));
  p.values['truck.brake.air.pressure.emergency']=1;v=d.view(p,1,1,cfg);c=render(v,cfg);assert.equal(v.page,'alert');assert.ok(pixel(c,470,30)[0]>30);
  const detail=c.getContext('2d').getImageData(1040,15,300,30).data;assert.ok([...detail].some((n,i)=>i%4!==3&&n>180),'warning detail must render in the right-hand region');
});
