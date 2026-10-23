const test=require('node:test'),assert=require('node:assert/strict');
const {createCanvas}=require('@napi-rs/canvas');
const {render}=require('../src/render.cjs');
const {Dashboard,settings}=require('../src/model.cjs');
const {SPEED,RECTS}=require('../src/layout.cjs');
const led=require('../src/airport-led.cjs');
const {drive}=require('./fixtures.cjs');

const pixels=(c,x,y,w,h)=>Buffer.from(c.getContext('2d').getImageData(x,y,w,h).data);
const rgb=(c,x,y)=>[...pixels(c,x,y,1,1)].slice(0,3);
function view(panel='systems_engine'){
 const cfg=settings({dashboardLanguage:'en'}),p=drive(),d=new Dashboard();
 let v;for(const t of [0,300,650,1000])v=d.view(p,t,t,cfg);
 return {...v,page:'drive',panel,panelElapsedMs:0,connectionState:'CONNECTED'};
}
function recorded(v,cfg,now=0){
 const calls=[],original=led.draw;let canvas;
 try{
  led.draw=(ctx,label,options)=>{
   const accepted=original(ctx,label,options);
   calls.push({label:String(label),...options,accepted,plan:led.layout(label,options)});return accepted;
  };
  canvas=render(v,cfg,now);
 }finally{led.draw=original;}
 return {canvas,calls,at:x=>calls.find(c=>c.x===x&&c.accepted)};
}

test('numeric background reserves nominal readout capacity instead of filling the whole field',()=>{
 const v=view(),cfg=settings({textStyle:'airport_led',dashboardLanguage:'en'}),result=recorded(v,cfg);
 for(const x of [884,1029,1164]){
  const call=result.at(x);assert.equal(call.minCells,3);assert.equal(call.plan.cells,3);
  assert.equal(call.plan.width,68);assert.ok(call.plan.width<call.maxWidth);
  // The unused third digit has real dim LEDs; the unused remainder of the field does not.
  assert.deepEqual(rgb(result.canvas,x+48,call.y),[40,43,41]);
  assert.deepEqual(rgb(result.canvas,x+72,call.y),[8,11,14]);
 }
 assert.equal(result.at(1319).plan.cells,5,'battery keeps its numeric value and V unit without a spacer');
});

test('nominal digit reservations do not truncate negative temperatures or four-digit readings',()=>{
 const cfg=settings({textStyle:'airport_led',dashboardLanguage:'en'});
 for(const sample of [-12,-1234,1000]){
  const v=view();v.p.values['truck.oil.temperature']=sample;
  const call=recorded(v,cfg).at(1029);
  assert.equal(call.label,String(sample));assert.equal(call.plan.text,String(sample));
  assert.equal(call.plan.cells,Math.max(3,String(sample).length));assert.equal(call.plan.truncated,false);
 }
 const v=view('systems_brake');v.p.values['truck.brake.temperature']=1000;
 const call=recorded(v,cfg).at(884);assert.equal(call.plan.text,'1000°C');assert.equal(call.plan.cells,6);
 assert.equal(call.pitch,3);assert.equal(call.plan.truncated,false);
});

test('status and direct numeric text calls carry their own reservations and bounded average field',()=>{
 const cfg=settings({textStyle:'airport_led',dashboardLanguage:'en'}),brake=recorded(view('systems_brake'),cfg);
 assert.equal(brake.at(1030).minCells,8);assert.equal(brake.at(1030).plan.text,'RELEASED');
 assert.equal(brake.at(1335).plan.cells,3);assert.equal(brake.at(1200).minCells,7);
 const fuelView=view('fuel');fuelView.consumptionL100=32.5;
 const fuel=recorded(fuelView,cfg);
 for(const [x,cells]of [[941,4],[1253,4],[884,7],[1200,6],[1020,9],[1335,6]])assert.equal(fuel.at(x).minCells,cells,`field ${x}`);
 assert.equal(fuel.at(1020).maxWidth,165);assert.equal(fuel.at(1020).plan.text,'32.5L/100');
 const motion=recorded({...view(),page:'motion',gForce:{current:.27,peak:.43}},cfg);
 assert.equal(motion.at(1649).minCells,6);assert.equal(motion.at(2044).minCells,6);
 const shortCity=view('route');shortCity.p.values['job.destination.city']='BERLIN';
 assert.equal(recorded(shortCity,cfg).at(884).plan.cells,6,'short names do not expand to the full field');
});

test('brake states share the same reserved board and pitch instead of resizing as status changes',()=>{
 const cfg=settings({textStyle:'airport_led',dashboardLanguage:'en'}),geometries=[];
 for(const [label,parking,effective]of [['APPLIED',0,.2],['PARKED',1,0],['RELEASED',0,0]]){
  const v=view('systems_brake');v.p.values['truck.brake.parking']=parking;v.p.values['truck.effective.brake']=effective;
  const call=recorded(v,cfg).at(1030);assert.equal(call.label,label);assert.equal(call.plan.text,label);
  assert.equal(call.minCells,8);assert.equal(call.plan.cells,8);assert.equal(call.pitch,3);
  assert.equal(call.maxWidth,141);assert.ok(call.x+call.plan.width<=1200,'larger status stops before the aligned AIR column');
  geometries.push({x:call.x,y:call.y,pitch:call.pitch,width:call.plan.width,height:call.plan.height});
 }
 assert.deepEqual(geometries[0],geometries[1]);assert.deepEqual(geometries[1],geometries[2]);
});

test('speed omits leading zeros in standard, segment and Airport styles',()=>{
 const proto=Object.getPrototypeOf(createCanvas(1,1).getContext('2d')),original=proto.fillText,calls=[];
 try{
  proto.fillText=function(label,x,y,...rest){calls.push({label:String(label),x,y});return original.call(this,label,x,y,...rest);};
  for(const digitStyle of ['rally','din','euro','narrow','tft']){
   calls.length=0;render({...view(),kmh:8},settings({digitStyle}));
   assert.equal(calls.find(call=>call.x===SPEED.numberX&&call.y===SPEED.numberBaseline).label,'8',digitStyle);
  }
 }finally{proto.fillText=original;}
 const airport=recorded({...view(),kmh:8},settings({digitStyle:'airport_led'}));
 assert.ok(airport.calls.some(call=>call.label==='  8'&&call.x<RECTS.gear.left&&call.accepted));
 const segment=render({...view(),kmh:8},settings({digitStyle:'segment'})),data=pixels(segment,145,14,87,35),xs=[];
 for(let y=0;y<35;y++)for(let x=0;x<87;x++){const i=(y*87+x)*4;if(data[i]>150&&data[i+1]>150&&data[i+2]>150)xs.push(x);}
 assert.ok(xs.length>0);assert.ok(Math.max(...xs)-Math.min(...xs)+1<=26,'seven-segment speed has only one visible digit');
});

test('Airport speed keeps three fixed cells with right-aligned values and unlit leading places',()=>{
 for(const digitMatrix of ['5x7']){
  const cfg=settings({digitStyle:'airport_led',digitMatrix}),v=view(),frames=[];
  for(const [kmh,label,blankCells]of [[0,'  0',2],[20,' 20',1],[120,'120',0]]){
   const result=recorded({...v,kmh},cfg),call=result.calls.find(c=>c.x<RECTS.gear.left&&c.label===label&&c.accepted);
   assert.ok(call,`${kmh} renders ${JSON.stringify(label)}`);assert.equal(call.plan.cells,3);assert.equal(call.plan.columns,17);
   const x=Math.round(call.x),y=Math.round(call.y),pitch=call.pitch;
   for(let col=0;col<blankCells*6;col++)for(let row=0;row<call.plan.rows;row++)
    assert.deepEqual(rgb(result.canvas,Math.floor(x+(col+.5)*pitch),Math.floor(y+(row+.5)*pitch)),[40,43,41],`${kmh}: leading place is dim`);
   frames.push({canvas:result.canvas,call,x,y,pitch});
  }
  const [zero,twenty,hundredTwenty]=frames;
  for(const frame of frames.slice(1))for(const key of ['x','y','pitch'])assert.equal(frame[key],zero[key]);
  for(const frame of frames.slice(1))for(const key of ['width','height'])assert.equal(frame.call.plan[key],zero.call.plan[key]);
  for(const frame of frames.slice(1))assert.deepEqual(
   pixels(frame.canvas,frame.x+12*frame.pitch,frame.y,5*frame.pitch,frame.call.plan.height),
   pixels(zero.canvas,zero.x+12*zero.pitch,zero.y,5*zero.pitch,zero.call.plan.height),'units zero stays at the same position');
  assert.deepEqual(pixels(twenty.canvas,twenty.x+6*twenty.pitch,twenty.y,5*twenty.pitch,twenty.call.plan.height),
   pixels(hundredTwenty.canvas,hundredTwenty.x+6*hundredTwenty.pitch,hundredTwenty.y,5*hundredTwenty.pitch,hundredTwenty.call.plan.height),'tens two stays at the same position');
 }
});

test('single gear keeps the same two-cell board and unit position, with a dark tens cell and gap',()=>{
 for(const digitMatrix of ['5x7']){
  const cfg=settings({digitStyle:'airport_led',digitMatrix}),v=view(),single=recorded({...v,gear:2},cfg),double=recorded({...v,gear:12},cfg);
  const a=single.calls.find(c=>c.label===' 2'&&c.accepted),b=double.calls.find(c=>c.label==='12'&&c.accepted);
  assert.ok(a);assert.ok(b);
  for(const key of ['x','y','pitch'])assert.equal(a[key],b[key]);
  assert.equal(a.plan.columns,11);assert.equal(a.plan.width,b.plan.width);assert.equal(a.plan.cells,2);
  const x=Math.round(a.x),y=Math.round(a.y),pitch=a.pitch;
  for(let col=0;col<=5;col++)for(let row=0;row<a.plan.rows;row++)
   assert.deepEqual(rgb(single.canvas,Math.floor(x+(col+.5)*pitch),Math.floor(y+(row+.5)*pitch)),[40,43,41]);
  assert.deepEqual(pixels(single.canvas,x+6*pitch,y,5*pitch,a.plan.height),pixels(double.canvas,x+6*pitch,y,5*pitch,a.plan.height));
 }
});

test('loop-left shifts one LED column left per step, wraps continuously and leaves the board fixed',()=>{
 const label='NEWCASTLE UPON TYNE',opts={pitch:3,maxWidth:126,scroll:true,scrollMode:'loop_left',shape:'square',color:'#ffffff',dim:'#222222'};
 const plan=led.layout(label,opts),period=(label.length*6+12)*120;
 const draw=ms=>{const c=createCanvas(160,28);led.draw(c.getContext('2d'),label,{...opts,x:2,y:2,elapsedMs:ms});return c;};
 const first=draw(0),next=draw(120),wrapped=draw(period),again=draw(period+120),previous=draw(period-120);
 assert.equal(led.layout(label,{...opts,elapsedMs:120}).offset,1);
 assert.deepEqual(pixels(next,2,2,plan.width-3,plan.height),pixels(first,5,2,plan.width-3,plan.height),'lit pattern moves left exactly one column');
 assert.deepEqual(pixels(first,2,2,plan.width-3,plan.height),pixels(previous,5,2,plan.width-3,plan.height),'period boundary also moves left one column');
 assert.deepEqual(pixels(first,0,0,160,28),pixels(wrapped,0,0,160,28));
 assert.deepEqual(pixels(next,0,0,160,28),pixels(again,0,0,160,28));
 for(const picture of [first,next,wrapped,previous]){
  for(let col=0;col<plan.columns;col++)assert.deepEqual(rgb(picture,2+col*3+2,2),[8,11,10],'physical gaps stay in place');
  assert.deepEqual(rgb(picture,2+plan.width,2),[0,0,0],'no dots beyond viewport');
 }
 const short=led.layout('PARIS',{...opts,elapsedMs:1200});assert.equal(short.scrolling,false);assert.equal(short.offset,0);
 const restart=led.layout(label,{...opts,scrollMode:'restart',elapsedMs:850});assert.equal(restart.offset,0);
 assert.ok(led.layout(label,{...opts,scrollMode:'restart',elapsedMs:2100}).offset>0,'default mode retains head pause then leftward scroll');
});

test('runtime view passes loop-left to long destination and ETA without resetting it at carousel epoch',()=>{
 const v=view('route');v.p.values['job.destination.city']='NEWCASTLE UPON TYNE';
 const cfg=settings({textStyle:'airport_led',ledScrollMode:'loop_left',dashboardLanguage:'en'});
 const before=recorded({...v,panelElapsedMs:14999},cfg,14999),after=recorded({...v,panelElapsedMs:0},cfg,15000);
 for(const x of [884,1334]){
  assert.equal(before.at(x).scrollMode,'loop_left');assert.equal(after.at(x).scrollMode,'loop_left');
  assert.equal(after.at(x).elapsedMs,15000);assert.ok(after.at(x).plan.offset>0);
 }
});

test('scroll speed scales leftward travel in both modes while preserving restart pauses and short text',()=>{
 const label='NEWCASTLE UPON TYNE',opts={pitch:3,maxWidth:126,scroll:true};
 for(const scrollMode of ['restart','loop_left','loop_right'])for(const scrollSpeed of [50,100,200]){
  const elapsedMs=(scrollMode==='restart'?900:0)+480;
  const plan=led.layout(label,{...opts,scrollMode,scrollSpeed,elapsedMs});
  assert.equal(plan.offset,4*scrollSpeed/100,`${scrollMode}/${scrollSpeed}`);
  assert.equal(led.layout('PARIS',{...opts,scrollMode,scrollSpeed,elapsedMs}).offset,0);
  assert.equal(led.layout(label,{...opts,scrollMode:'restart',scrollSpeed,elapsedMs:850}).offset,0,'head pause remains 900ms');
 }
 for(const [speed,expectedStep]of [[undefined,120],[null,120],['',120],[' ',120],[NaN,120],[Infinity,120],['bad',120],[false,120],[{},120],[-1,240],[999,60],['150',80]]){
  assert.equal(led.scrollStepMs(120,speed),expectedStep,`${String(speed)} uses a bounded/default speed`);
 }
});

test('numeric and city scrolling consume the same selected speed without changing the carousel clock',()=>{
 const v=view('route');v.p.values['job.destination.city']='NEWCASTLE UPON TYNE';
 for(const ledScrollMode of ['restart','loop_left']){
  const elapsed=ledScrollMode==='restart'?1380:480;
  const cfg=settings({textStyle:'airport_led',ledScrollMode,ledScrollSpeed:200,dashboardLanguage:'en'});
  const result=recorded({...v,panelElapsedMs:elapsed},cfg,elapsed);
  for(const x of [884,1334]){
   assert.equal(result.at(x).scrollSpeed,200);assert.equal(result.at(x).plan.offset,8);
  }
  assert.equal(cfg.cycleSeconds,15);
 }
});

test('Chinese and Cyrillic font fallback scrolls left at the selected speed and leaves short text still',()=>{
 const proto=Object.getPrototypeOf(createCanvas(1,1).getContext('2d')),original=proto.fillText;
 function positions(city,ledScrollMode,ledScrollSpeed,elapsed){
  const v=view('route');v.p.values['job.destination.city']=city;
  const cfg=settings({textStyle:'airport_led',ledScrollMode,ledScrollSpeed,dashboardLanguage:'en'}),xs=[];
  try{
   proto.fillText=function(label,x,...args){if(String(label)===city)xs.push(x);return original.call(this,label,x,...args);};
   render({...v,panelElapsedMs:elapsed},cfg,elapsed);
  }finally{proto.fillText=original;}
  return xs;
 }
 for(const mode of ['restart','loop_left','loop_right']){
  const elapsed=(mode==='restart'?900:0)+90;
  for(const city of ['中华人民共和国上海国际物流中心','Санкт-Петербург Международный аэропорт'])for(const speed of [50,100,200]){
   assert.equal(positions(city,mode,speed,elapsed)[0],884-2*speed/100,`${mode}/${city}/${speed}`);
  }
  assert.deepEqual(positions('北京',mode,200,elapsed),[884]);
 }
});
