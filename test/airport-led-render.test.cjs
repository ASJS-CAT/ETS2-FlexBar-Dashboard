const test=require('node:test'),assert=require('node:assert/strict');
const {render}=require('../src/render.cjs');
const {Dashboard,settings}=require('../src/model.cjs');
const {SPEED,RECTS}=require('../src/layout.cjs');
const {drive}=require('./fixtures.cjs');

const themes=['rally','el_mint','el_amber'],matrices=['5x7'];
function view(){
 const cfg=settings({dashboardLanguage:'en'}),p=drive(),d=new Dashboard();
 let v;for(const t of [0,300,650,1000])v=d.view(p,t,t,cfg);
 return {...v,page:'drive',panel:'route',connectionState:'CONNECTED',panelElapsedMs:0};
}
const pixels=(canvas,x,y,w,h)=>Buffer.from(canvas.getContext('2d').getImageData(x,y,w,h).data);
function onlyChangesWithin(a,b,rect,message){
 const aa=pixels(a,0,0,2170,60),bb=pixels(b,0,0,2170,60);let changed=0;
 for(let y=0;y<60;y++)for(let x=0;x<2170;x++){
  const i=(y*2170+x)*4;
  if(aa[i]===bb[i]&&aa[i+1]===bb[i+1]&&aa[i+2]===bb[i+2]&&aa[i+3]===bb[i+3])continue;
  changed++;assert.ok(x>=rect.x&&x<rect.x+rect.w&&y>=rect.y&&y<rect.y+rect.h,`${message}: changed pixel ${x},${y}`);
 }
 assert.ok(changed>0,`${message}: expected a visible change`);
}

test('Airport speed/gear selection leaves every other field pixel-identical in all themes',()=>{
 const v=view();
 for(const theme of themes)for(const digitMatrix of matrices){
  const cfg=settings({theme,dashboardLanguage:'en'}),normal=render(v,cfg,0);
  const airport=render(v,{...cfg,digitStyle:'airport_led',digitMatrix},0);
  assert.deepEqual(pixels(airport,425,0,1745,60),pixels(normal,425,0,1745,60),`${theme}/${digitMatrix}: RPM, info and controls`);
  assert.deepEqual(pixels(airport,0,0,110,60),pixels(normal,0,0,110,60),'selector is unchanged');
  assert.notDeepEqual(pixels(airport,110,14,315,35),pixels(normal,110,14,315,35));
 }
});

test('Airport other-text selection leaves speed, gear and RPM pixel-identical',()=>{
 const v=view();
 for(const theme of themes)for(const textMatrix of matrices){
  const cfg=settings({theme,dashboardLanguage:'en'}),normal=render(v,cfg,0);
  const airport=render(v,{...cfg,textStyle:'airport_led',textMatrix},0);
  assert.deepEqual(pixels(airport,0,0,875,60),pixels(normal,0,0,875,60),`${theme}/${textMatrix}`);
  assert.notDeepEqual(pixels(airport,875,20,575,35),pixels(normal,875,20,575,35));
 }
});

test('three explicit LED ranges add only digits, information and then button labels in order',()=>{
 const v=view();
 for(const theme of themes){
  const base=settings({theme,dashboardLanguage:'en'}),standard=render(v,base,0);
  const frames=Object.fromEntries(['digits','info','all'].map(ledScope=>[ledScope,render(v,settings({...base,ledScope}),0)]));
  assert.deepEqual(pixels(frames.digits,425,0,1745,60),pixels(standard,425,0,1745,60),'digits-only preserves information, RPM and every button');
  assert.notDeepEqual(pixels(frames.digits,110,14,315,39),pixels(standard,110,14,315,39));
  assert.deepEqual(pixels(frames.info,0,0,875,60),pixels(frames.digits,0,0,875,60));
  assert.notDeepEqual(pixels(frames.info,875,20,575,35),pixels(frames.digits,875,20,575,35));
  assert.deepEqual(pixels(frames.info,1450,0,720,60),pixels(frames.digits,1450,0,720,60),'middle range retains normal button labels');
  onlyChangesWithin(frames.info,frames.all,{x:1450,y:38,w:720,h:15},'all range adds dot labels only');
  const legacy=render(v,settings({...base,digitStyle:'airport_led',textStyle:'airport_led'}),0);
  assert.deepEqual(pixels(frames.all,0,0,2170,60),pixels(legacy,0,0,2170,60),'old independent all-LED configuration keeps its pixels');
  for(const ledScope of ['digits','info','all'])assert.deepEqual(pixels(render(v,{...base,ledScope},0),0,0,2170,60),pixels(frames[ledScope],0,0,2170,60),'raw explicit scope matches normalized configuration');
 }
});

test('5x7 dots keep speed and 48px reverse/neutral/two-digit gears inside calibrated boxes',()=>{
 const v=view();
 for(const theme of themes)for(const digitMatrix of matrices){
  const cfg=settings({theme,digitStyle:'airport_led',digitMatrix,gearFontSize:48}),base=render({...v,gear:1,kmh:0},cfg,0);
  for(const gear of [-2,0,12])onlyChangesWithin(base,render({...v,gear,kmh:0},cfg,0),
   {x:RECTS.gear.left+8,y:RECTS.gear.top,w:RECTS.gear.width-16,h:RECTS.gear.height},`${theme}/${digitMatrix}/gear ${gear}`);
  onlyChangesWithin(base,render({...v,gear:1,kmh:999},cfg,0),
   {x:Math.floor(SPEED.numberCenter-SPEED.numberWidth/2),y:SPEED.numberTop+3,w:SPEED.numberWidth+1,h:SPEED.numberHeight},`${theme}/${digitMatrix}/speed`);
 }
});

test('LED speed leaves a three-pixel gap below the unchanged throttle/brake tracks',()=>{
 const v=view();
 for(const theme of themes)for(const digitMatrix of matrices){
  const cfg=settings({theme,dashboardLanguage:'en'}),normal=render(v,cfg,0),led=render(v,{...cfg,digitStyle:'airport_led',digitMatrix},0);
  assert.deepEqual(pixels(led,SPEED.pedalX,5,SPEED.pedalWidth,9),pixels(normal,SPEED.pedalX,5,SPEED.pedalWidth,9));
  const gap=pixels(led,146,14,84,3);assert.ok([...gap].every((value,index)=>index%4===3||value<80));
  const ink=pixels(led,146,17,84,35);assert.ok([...ink].some((value,index)=>index%4!==3&&value>200));
 }
});

test('long destination pauses at the head then scrolls only inside its original viewport',()=>{
 const v=view();v.p.values['job.destination.city']='NEWCASTLE UPON TYNE INTERNATIONAL';
 delete v.p.values['truck.navigation.time'];v.p.values['truck.navigation.distance']=1000;
 for(const textMatrix of matrices){
  const cfg=settings({textStyle:'airport_led',textMatrix,dashboardLanguage:'en'});
  const start=render({...v,panelElapsedMs:0},cfg,0),held=render({...v,panelElapsedMs:850},cfg,850),scrolled=render({...v,panelElapsedMs:2100},cfg,2100);
  assert.deepEqual(pixels(start,0,0,2170,60),pixels(held,0,0,2170,60),'first characters remain readable during initial pause');
  onlyChangesWithin(start,scrolled,{x:884,y:21,w:152,h:27},`${textMatrix}/destination`);
 }
});

test('unsupported city alphabets keep the original font and long names scroll without escaping',()=>{
 const v=view(),normal=settings({dashboardLanguage:'en'}),airport=settings({textStyle:'airport_led',dashboardLanguage:'en'});
 delete v.p.values['truck.navigation.time'];v.p.values['truck.navigation.distance']=1000;
 for(const city of ['柏林','Zürich']){
  v.p.values['job.destination.city']=city;
  assert.deepEqual(pixels(render(v,airport,0),884,22,152,26),pixels(render(v,normal,0),884,22,152,26),city);
 }
 v.p.values['job.destination.city']='中华人民共和国上海国际物流中心';
 const start=render({...v,panelElapsedMs:0},airport,0),held=render({...v,panelElapsedMs:850},airport,850),scrolled=render({...v,panelElapsedMs:2100},airport,2100);
 assert.deepEqual(pixels(start,884,22,152,26),pixels(held,884,22,152,26));
 onlyChangesWithin(start,scrolled,{x:884,y:22,w:152,h:26},'Chinese destination');
});

test('short English quick-control labels use 5x7 dots confined to the existing label strip',()=>{
 const v=view();
 for(const theme of themes){
  const cfg=settings({theme,dashboardLanguage:'en'});
  const normal=render(v,cfg,0),airport=render(v,{...cfg,textStyle:'airport_led'},0);
  assert.notDeepEqual(pixels(airport,1450,38,720,15),pixels(normal,1450,38,720,15),theme);
  assert.deepEqual(pixels(airport,1450,0,720,38),pixels(normal,1450,0,720,38));
  assert.deepEqual(pixels(airport,1450,53,720,7),pixels(normal,1450,53,720,7));
 }
});

test('renderer forces legacy 5x8 configuration to the same 5x7 output in all themes',()=>{
 const v=view();
 for(const theme of themes)for(const panel of ['route','fuel','systems_engine','systems_brake']){
  const cfg=settings({theme,digitStyle:'airport_led',textStyle:'airport_led',dashboardLanguage:'en'});
  // Deliberately bypass settings migration: rendering itself must stay on the single glyph matrix.
  const normal=render({...v,panel},{...cfg,digitMatrix:'5x7',textMatrix:'5x7'},0);
  const legacy=render({...v,panel},{...cfg,digitMatrix:'5x8',textMatrix:'5x8'},0);
  assert.deepEqual(pixels(normal,0,0,2170,60),pixels(legacy,0,0,2170,60),`${theme}/${panel}`);
 }
});

test('distance and ETA keep units and day inside their enlarged scrolling dot rows, with no footnotes',()=>{
 const v=view(),led=require('../src/airport-led.cjs'),original=led.draw,calls=[];
 v.p.values['truck.navigation.distance']=128400;v.p.values['game.time']=14520;
 const cfg=settings({textStyle:'airport_led',dashboardLanguage:'en'});
 let picture;
 try{
  led.draw=(ctx,label,options)=>{calls.push({label,...options});return original(ctx,label,options);};
  picture=render(v,cfg,0);
 }finally{led.draw=original;}
 for(const [x,label]of [[1054,'128.4 KM'],[1334,'D11 03:45']]){
  const call=calls.find(call=>call.x===x&&call.label===label);
  assert.ok(call,`${label} remains intact in its original field`);assert.equal(call.pitch,3);assert.equal(call.scroll,true);
  const footer=pixels(picture,x,48,x===1054?127:107,11);
  assert.ok([...footer].every((value,index)=>index%4===3||value<80),'no tiny unit/day text below the dot row');
 }
});

test('Airport styles preserve critical warning text',()=>{
 const v=view(),cfg=settings({dashboardLanguage:'en'}),airport={...cfg,digitStyle:'airport_led',textStyle:'airport_led'};
 const alert={...v,page:'alert',activeAlert:{id:'air-emergency',text:'AIR EMERGENCY',detail:'AIR 42 PSI / 23%',critical:true}};
 assert.deepEqual(pixels(render(alert,airport,0),425,0,1025,60),pixels(render(alert,cfg,0),425,0,1025,60));
});

test('offline hides previous, current and fallback controls while keeping diagnostics, but drive and paused still draw controls',()=>{
 const {createCanvas}=require('@napi-rs/canvas'),led=require('../src/airport-led.cjs');
 const proto=Object.getPrototypeOf(createCanvas(1,1).getContext('2d')),originalText=proto.fillText,originalDraw=led.draw;
 const quick={transition:.5,controls:[{id:'horn',label:'HORN',x:1450,w:150,local:true}],previous:[{id:'parking',label:'PARK',x:1600,w:150,local:true}]};
 const empty={controls:[],previous:[],transition:1};
 function captured(v,cfg){
  const labels=[];let picture;
  try{
   proto.fillText=function(label,...args){labels.push(String(label));return originalText.call(this,label,...args);};
   led.draw=(ctx,label,options)=>{const accepted=originalDraw(ctx,label,options);if(accepted)labels.push(String(label));return accepted;};
   picture=render(v,cfg);
  }finally{proto.fillText=originalText;led.draw=originalDraw;}
  return {picture,labels};
 }
 for(const theme of themes)for(const textStyle of ['standard','airport_led']){
  const cfg=settings({theme,textStyle,dashboardLanguage:'en'}),v={...view(),page:'offline',quick};
  const offline=captured(v,cfg),withoutControls=captured({...v,quick:empty},cfg),fallback=captured({...v,quick:undefined},cfg);
  assert.ok(offline.labels.includes('CONNECTION DIAGNOSTICS'));
  assert.ok(offline.labels.includes('FlexDesigner settings / Check connection'));
  assert.ok(!offline.labels.some(label=>['HORN','PARK'].includes(label)),'neither old nor current control labels remain');
  assert.deepEqual(pixels(offline.picture,1450,0,720,60),pixels(withoutControls.picture,1450,0,720,60),'no old/current icons or button backgrounds remain');
  assert.deepEqual(pixels(fallback.picture,1450,0,720,60),pixels(withoutControls.picture,1450,0,720,60),'legacy fallback buttons are hidden too');
  for(const page of ['drive','paused']){
   const active=captured({...v,page},cfg),emptyFrame=captured({...v,page,quick:empty},cfg);
   assert.ok(active.labels.includes('HORN'));assert.ok(active.labels.includes('PARK'));
   assert.notDeepEqual(pixels(active.picture,1450,0,720,60),pixels(emptyFrame.picture,1450,0,720,60),`${page} retains connected controls`);
  }
 }
});
