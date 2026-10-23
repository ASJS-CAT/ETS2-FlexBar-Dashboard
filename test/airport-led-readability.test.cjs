const test=require('node:test'),assert=require('node:assert/strict');
const {createCanvas}=require('@napi-rs/canvas');
const {render}=require('../src/render.cjs');
const {Dashboard,settings}=require('../src/model.cjs');
const {PALETTES}=require('../src/themes.cjs');
const led=require('../src/airport-led.cjs');
const {drive}=require('./fixtures.cjs');

const themes=['rally','el_mint','el_amber'],matrices=['5x7'];
const pixels=(c,x,y,w,h)=>Buffer.from(c.getContext('2d').getImageData(x,y,w,h).data);
const rgb=(c,x,y)=>[...pixels(c,x,y,1,1)].slice(0,3);
const color=hex=>hex.match(/[a-f\d]{2}/gi).map(n=>parseInt(n,16));
function view(panel='fuel'){
 const cfg=settings({dashboardLanguage:'en'}),p=drive(),d=new Dashboard();
 let v;for(const t of [0,300,650,1000])v=d.view(p,t,t,cfg);
 return {...v,page:'drive',panel,panelElapsedMs:0,consumptionL100:32.5,connectionState:'CONNECTED'};
}
function recorded(v,cfg,now=0){
 const dotCalls=[],plainCalls=[],originalDraw=led.draw;
 const proto=Object.getPrototypeOf(createCanvas(1,1).getContext('2d')),originalText=proto.fillText;
 let canvas;
 try{
  led.draw=(ctx,label,options)=>{
   const accepted=originalDraw(ctx,label,options);
   if(accepted)dotCalls.push({label:String(label),...options,plan:led.layout(label,options)});
   return accepted;
  };
  proto.fillText=function(label,x,y,max){plainCalls.push({label:String(label),x,y,max,font:this.font});return originalText.call(this,label,x,y,max);};
  canvas=render(v,cfg,now);
 }finally{led.draw=originalDraw;proto.fillText=originalText;}
 return {canvas,dotCalls,plainCalls,at:(x,label)=>dotCalls.find(c=>c.x===x&&(label===undefined||c.label===label))};
}

const boardX=call=>Math.round(call.x+(call.align==='right'?call.maxWidth-call.plan.width:0));
const readout=(result,label,left,right)=>result.dotCalls.find(c=>c.label.trim()===label&&boardX(c)>=left&&boardX(c)+c.plan.width<=right);
const geometry=call=>({x:boardX(call),y:call.y,pitch:call.pitch,width:call.plan.width,height:call.plan.height,cells:call.plan.cells});

test('double-large fuel values remain right-aligned on fixed dim boards as their length changes',()=>{
 const cfg=settings({textStyle:'airport_led',airportFuelLayout:'double_large',dashboardLanguage:'en'}),samples=[];
 for(const [percentage,litres,adblue,average,range]of [[9,1,1,1,0],[65,390,52,32.5,1020],[100,999,80,99.9,9999]]){
  const v={...view(),fuelPercent:percentage,consumptionL100:average};
  Object.assign(v.p.values,{'truck.fuel.amount':litres,'truck.adblue':adblue,'adblue.capacity':80,'truck.fuel.range':range});
  const result=recorded(v,cfg),fields=[];
  for(const [label,left,right]of [
   [`${percentage}%`,941,1011],[`${litres.toFixed(1)}L`,884,1010],
   [`${Math.round(adblue/80*100)}%`,1253,1323],[`${adblue.toFixed(1)}L`,1200,1322],
   [`${average.toFixed(1)}L/100`,1020,1185],[`${range}KM`,1335,1440]
  ]){
   const call=readout(result,label,left,right);assert.ok(call,label);assert.equal(call.pitch,3);
   assert.equal(call.plan.truncated,false);assert.equal(call.plan.text.trim(),label);
   assert.equal(call.align,'right');assert.equal(call.plan.contentOffset,(call.plan.cells-label.length)*6,'leading empty cells right-align the complete value');
   const blankCells=call.plan.cells-label.length;
   for(let row=0;row<7;row++)for(let column=0;column<blankCells*6;column++)
    assert.deepEqual(rgb(result.canvas,boardX(call)+column*call.pitch,Math.round(call.y)+row*call.pitch),color(call.dim),'leading cells remain unlit');
   fields.push(geometry(call));
  }
  samples.push(fields);
 }
 assert.deepEqual(samples[0],samples[1]);assert.deepEqual(samples[1],samples[2]);
});

test('single-fit fuel rows retain complete values and units while adapting pitch then scrolling overflow',()=>{
 const cfg=settings({textStyle:'airport_led',airportFuelLayout:'single_fit',dashboardLanguage:'en'});
 for(const [percentage,litres,pitch,scrolling]of [[6,1,3,false],[65,390,2,false],[100,10000,2,true]]){
  const v={...view(),fuelPercent:percentage};
  Object.assign(v.p.values,{'truck.fuel.amount':litres,'truck.adblue':litres,'adblue.capacity':litres*100/percentage});
  const result=recorded(v,cfg),label=`${percentage}% ${litres.toFixed(1)}L`;
  for(const [left,right,expectedPitch]of [[884,1010,pitch],[1200,1322,2]]){
   const call=readout(result,label,left,right);assert.ok(call,label);assert.equal(call.pitch,expectedPitch);assert.equal(call.plan.scrolling,scrolling);
   assert.equal(call.plan.text.trim(),label);assert.equal(call.plan.truncated,false);assert.equal(call.plan.rows,7);
   assert.ok(call.y>=18&&call.y+call.plan.height<57,'single readout remains between caption and bar');
  }
 }
});

test('single-scroll fuel rows use large dots and the selected marquee mode inside their original columns',()=>{
 const v={...view(),fuelPercent:65};
 for(const theme of themes)for(const ledScrollMode of ['restart','loop_left']){
  const cfg=settings({theme,textStyle:'airport_led',airportFuelLayout:'single_scroll',ledScrollMode,dashboardLanguage:'en'});
  const first=recorded(v,cfg,0),later=recorded({...v,panelElapsedMs:2100},cfg,2100);
  for(const [label,left,right]of [['65% 390.0L',884,1010],['65% 52.0L',1200,1322]]){
   const start=readout(first,label,left,right),moved=readout(later,label,left,right);
   assert.ok(start,label);assert.ok(moved,label);assert.equal(start.pitch,3);assert.equal(moved.pitch,3);
   assert.equal(start.plan.scrolling,true);assert.equal(start.plan.truncated,false);assert.equal(start.plan.text,label);
   assert.equal(start.scrollMode,ledScrollMode);assert.deepEqual(geometry(start),geometry(moved));
   assert.ok(moved.plan.offset>0,'both modes move text from right to left');
   assert.notDeepEqual(pixels(first.canvas,start.x,start.y,start.plan.width,start.plan.height),pixels(later.canvas,moved.x,moved.y,moved.plan.width,moved.plan.height));
  }
  assert.deepEqual(pixels(first.canvas,0,0,875,60),pixels(later.canvas,0,0,875,60));
  assert.deepEqual(pixels(first.canvas,1450,0,720,60),pixels(later.canvas,1450,0,720,60));
 }
});

test('selected engine and brake values use larger LED rows while captions keep their original position',()=>{
 for(const textMatrix of matrices){
  const cfg=settings({textStyle:'airport_led',textMatrix,dashboardLanguage:'en'}),engine=recorded(view('systems_engine'),cfg);
  for(const [x,label]of [[884,'52'],[1029,'94'],[1164,'86'],[1319,'28.2V']]){
   const call=engine.at(x,label);assert.ok(call,label);assert.equal(call.pitch,4);
   assert.equal(call.y+call.plan.height,51);assert.ok(call.y>=19,'dot row remains below caption baseline 17');
   assert.ok(call.plan.width<=call.maxWidth);assert.equal(call.plan.truncated,false);
  }
  assert.ok(engine.plainCalls.filter(c=>['OIL PSI','OIL C','COOLANT C','BATTERY'].includes(c.label)).every(c=>c.y===17));
  const brake=recorded(view('systems_brake'),cfg),temp=brake.at(884,'210°C');
  assert.equal(temp.pitch,4);assert.equal(temp.plan.height,28);assert.equal(temp.y+temp.plan.height,51);
  const cargo=recorded(view('trailer_status'),cfg),mass=cargo.at(1224,'18.0T');
  assert.ok(mass);assert.equal(mass.pitch,3);assert.equal(mass.y+mass.plan.height,51);
  assert.equal(mass.plan.truncated,false);assert.ok(mass.plan.width<=112);
  assert.ok(![...engine.plainCalls,...cargo.plainCalls].some(c=>['V','T'].includes(c.label)),'units remain part of the LED string');
 }
});

test('brake temperature includes the Celsius unit in the dot row for both UI languages',()=>{
 for(const dashboardLanguage of ['en','zh'])for(const temperature of [0,210,-12,1000]){
  const v=view('systems_brake');v.p.values['truck.brake.temperature']=temperature;
  const cfg=settings({textStyle:'airport_led',dashboardLanguage}),result=recorded(v,cfg),label=`${temperature}°C`,call=result.at(884,label);
  assert.ok(call,`${dashboardLanguage}/${label}`);assert.equal(call.plan.text,label);assert.equal(call.plan.truncated,false);
  assert.equal(call.minCells,5);assert.equal(call.plan.cells,Math.max(5,label.length));
  assert.equal(call.pitch,temperature===1000?3:4);assert.equal(call.plan.height,temperature===1000?21:28);
  assert.equal(call.y+call.plan.height,51);assert.ok(call.plan.width<=118);assert.ok(call.x+call.plan.width<1030);
  assert.ok(!result.plainCalls.some(c=>['°C','C','℃',label].includes(c.label)),'number and Celsius glyphs are drawn as one LED string');
  const standard=recorded(v,{...cfg,textStyle:'standard'});
  assert.ok(standard.plainCalls.some(c=>c.label===String(temperature)&&c.x===884&&c.y===45),'standard temperature keeps its original text and coordinates');
 }
});

test('fuel page uses two legible 5x7 LED rows including litre units in all themes',()=>{
 for(const theme of themes)for(const textMatrix of matrices){
  const result=recorded(view(),settings({theme,textStyle:'airport_led',textMatrix,dashboardLanguage:'en'}));
  for(const [x,label,bottom]of [[941,'65%',30],[884,'390.0L',55],[1253,'65%',30],[1200,'52.0L',55],[1020,'32.5L/100',40],[1335,'1020KM',45]]){
   const call=result.at(x,label);assert.ok(call,`${theme}/${textMatrix}/${label}`);
   assert.equal(call.pitch,3);assert.equal(call.y+call.plan.height,bottom);assert.equal(call.plan.truncated,false);
   assert.equal(call.plan.text,label);assert.ok(call.plan.width<=call.maxWidth);
  }
  assert.ok(result.at(941).y+result.at(941).plan.height<=result.at(884).y,'fuel rows do not intersect');
  assert.ok(result.at(1253).y+result.at(1253).plan.height<=result.at(1200).y,'AdBlue rows do not intersect');
  assert.deepEqual(rgb(result.canvas,890,57),color(PALETTES[theme].cyan));
  assert.deepEqual(rgb(result.canvas,1205,57),color(PALETTES[theme].cyan));
  assert.ok(!result.plainCalls.some(c=>['L','KM','L/100'].includes(c.label)),'units are not split into tiny footnotes');
  assert.equal(result.canvas.width,2170);assert.equal(result.canvas.height,60);
 }
});

test('refilling captions and indicators stay clear of larger readouts and their bars',()=>{
 for(const dashboardLanguage of ['en','zh'])for(const textMatrix of matrices){
  const v={...view(),page:'refueling',refueling:true,adblueRefilling:true,fuelPercent:100};
  v.p.values['truck.adblue']=80;
  const result=recorded(v,settings({dashboardLanguage,textStyle:'airport_led',textMatrix}));
  const fuelTitle=result.plainCalls.find(c=>c.x===884&&c.y===14),adblueTitle=result.plainCalls.find(c=>c.x===1200&&c.y===14);
  assert.equal(fuelTitle.max,52);assert.equal(adblueTitle.max,48);
  assert.ok(fuelTitle.x+fuelTitle.max<result.at(941).x);assert.ok(adblueTitle.x+adblueTitle.max<result.at(1253).x);
  for(const x of [884,1200])assert.ok(result.at(x).y+result.at(x).plan.height<57,'bottom value ends before bar');
  const range=result.at(1335);assert.ok(range.y>=21);assert.equal(range.y+range.plan.height,45);
  assert.ok(result.plainCalls.some(c=>c.x===1405&&c.y===54),'fill status stays below range');
  assert.deepEqual(rgb(result.canvas,890,59),color(PALETTES.rally.cyan));
 }
});

test('larger litre values reduce dot pitch instead of dropping digits or units',()=>{
 for(const textMatrix of matrices){
  const v=view();v.p.values['truck.fuel.amount']=10000;v.p.values['truck.adblue']=1000;
  const result=recorded(v,settings({textStyle:'airport_led',textMatrix,dashboardLanguage:'en'}));
  for(const [x,label]of [[884,'10000.0L'],[1200,'1000.0L']]){
   const call=result.at(x,label);assert.ok(call);assert.equal(call.pitch,2);
   assert.equal(call.plan.text,label);assert.equal(call.plan.truncated,false);assert.equal(call.plan.cells,label.length);
   assert.ok(call.plan.width<=call.maxWidth);assert.equal(call.y+call.plan.height,55);
  }
  assert.ok(!result.plainCalls.some(c=>c.label.endsWith('L')&&c.y===55),'long quantities still use dot glyphs');
 }
});

test('standard text retains original fuel labels, readout coordinates and bar pixels',()=>{
 const v=view();
 for(const theme of themes){
  const cfg=settings({theme,dashboardLanguage:'en'}),standard=recorded(v,cfg);
  for(const airportFuelLayout of ['double_large','single_fit','single_scroll']){
   const inactiveOptions=render(v,{...cfg,airportFuelLayout,textMatrix:'5x8',digitMatrix:'5x8',ledScrollMode:'loop_left'},0);
   assert.deepEqual(pixels(standard.canvas,0,0,2170,60),pixels(inactiveOptions,0,0,2170,60));
  }
  assert.equal(standard.dotCalls.length,0);
  for(const [label,x,y]of [['65%',884,35],['390.0 L',941,35],['32.5 L/100',1020,35],['65%',1200,35],['52.0 L',1257,35],['1020 KM',1335,39]])
   assert.ok(standard.plainCalls.some(c=>c.label===label&&c.x===x&&c.y===y),`${theme}/${label}`);
  assert.deepEqual(rgb(standard.canvas,890,43),color(PALETTES[theme].cyan));
  assert.deepEqual(rgb(standard.canvas,1205,43),color(PALETTES[theme].cyan));
 }
});

test('standard trip-average text retains its original unbounded width even for long values',()=>{
 const v={...view(),consumptionL100:999999999999.9},label='999999999999.9 L/100';
 for(const theme of themes){
  const result=recorded(v,settings({theme,textStyle:'standard',airportFuelLayout:'single_scroll',dashboardLanguage:'en'}));
  const call=result.plainCalls.find(c=>c.label===label&&c.x===1020&&c.y===35);
  assert.ok(call);assert.equal(call.max,Infinity,'Airport field width must not squeeze the standard font');
  assert.match(call.font,/\b17px\b/);
  const ctx=createCanvas(1,1).getContext('2d');ctx.font=call.font;
  assert.ok(ctx.measureText(label).width>165,'fixture exercises a value that would be compressed by the LED width limit');
 }
});

test('switching Airport on then off restores every standard font and calibrated panel pixel-for-pixel',()=>{
 const panels=['fuel','systems_engine','systems_brake','trailer_status','route','braking'];
 for(const theme of themes)for(const digitStyle of ['rally','din','euro','narrow','tft','segment'])for(const panel of panels){
  const cfg=settings({theme,digitStyle,textStyle:'standard',dashboardLanguage:'en'}),v={...view(panel),panelElapsedMs:2100};
  if(panel==='braking'){v.page='braking';v.brakeForce=.5;}
  v.p.values['job.destination.city']='NEWCASTLE UPON TYNE INTERNATIONAL';
  const before=render(v,cfg,2100);
  Object.assign(cfg,{digitStyle:'airport_led',textStyle:'airport_led',airportFuelLayout:'single_scroll',ledScrollMode:'loop_left'});
  const enabled=render(v,cfg,2100);
  assert.notDeepEqual(pixels(before,0,0,2170,60),pixels(enabled,0,0,2170,60),'Airport mode actually renders before switching back');
  Object.assign(cfg,{digitStyle,textStyle:'standard'});
  const restored=render(v,cfg,2100);
  assert.deepEqual(pixels(restored,0,0,2170,60),pixels(before,0,0,2170,60),`${theme}/${digitStyle}/${panel}: retained LED settings stay inactive`);
 }
});

test('larger BRAKE status preserves the AIR boundary and increases unsupported Chinese fallback consistently',()=>{
 for(const [parking,effective]of [[0,.2],[1,0],[0,0]]){
  const v=view('systems_brake');v.p.values['truck.brake.parking']=parking;v.p.values['truck.effective.brake']=effective;
  const en=recorded(v,settings({textStyle:'airport_led',dashboardLanguage:'en'})),call=en.at(1030);
  assert.equal(call.pitch,3);assert.equal(call.plan.cells,8);assert.equal(call.plan.width,141);assert.equal(call.y+call.plan.height,45);
  assert.ok(call.x+call.plan.width<en.at(1200).x,'BRAKE ends before the aligned AIR readout');
  const cfg=settings({textStyle:'airport_led',dashboardLanguage:'zh'}),zh=recorded(v,cfg),fallback=zh.plainCalls.find(c=>c.x===1030&&c.y===45);
  assert.ok(fallback);assert.match(fallback.font,/\b24px\b/);assert.equal(fallback.max,141);
  assert.equal(zh.at(1030),undefined,'Chinese state is rendered intact in the existing font');
  const standard=recorded(v,{...cfg,textStyle:'standard'}),old=standard.plainCalls.find(c=>c.x===1044&&c.y===45);
  assert.match(old.font,/\b21px\b/);assert.equal(old.max,132);
 }
});

test('Airport BRAKE has a balanced 10px offset while other columns retain the fuel-page alignment',()=>{
 const columns=[884,1030,1200,1335],fuelColumns=[884,1020,1200,1335],brakeTitles=['BRAKE TEMP C','BRAKE','AIR PSI','PARK BRAKE'],fuelTitles=['FUEL','TRIP AVERAGE','ADBLUE','RANGE'];
 for(const theme of themes)for(const airportFuelLayout of ['double_large','single_fit','single_scroll']){
  const cfg=settings({theme,textStyle:'airport_led',airportFuelLayout,dashboardLanguage:'en'}),v=view('systems_brake');
  v.p.values['truck.brake.air.pressure']=185;v.p.values['truck.brake.temperature']=210;
  const brake=recorded(v,cfg),fuel=recorded(view(),cfg);
  const brakeStarts=brakeTitles.map(label=>brake.plainCalls.find(c=>c.label===label&&c.y===17)?.x);
  const fuelStarts=fuelTitles.map(label=>fuel.plainCalls.find(c=>c.label===label&&c.y===14)?.x);
  assert.deepEqual(brakeStarts,columns);assert.deepEqual(fuelStarts,fuelColumns,`${theme}/${airportFuelLayout}`);
  assert.equal(brakeStarts[1]-fuelStarts[1],10,'BRAKE has the requested visual offset from TRIP AVERAGE');
  for(const [index,x]of columns.entries()){
   const call=brake.at(x);assert.ok(call);assert.equal(call.plan.truncated,false);
   assert.ok(boardX(call)+call.plan.width<(columns[index+1]||1450),`column ${index+1} readout remains within its own space`);
  }
  const temperature=brake.at(884),status=brake.at(1030),air=brake.at(1200);
  const leftGap=status.x-(temperature.x+temperature.plan.width),rightGap=air.x-(status.x+status.plan.width);
  assert.ok(Math.abs(leftGap-rightGap)<=1,`BRAKE gaps are visually balanced: ${leftGap}px / ${rightGap}px`);
  assert.deepEqual(rgb(brake.canvas,1324,51),color(PALETTES[theme].cyan),'full air bar occupies its 125px field');
  assert.notDeepEqual(rgb(brake.canvas,1325,51),color(PALETTES[theme].cyan),'air bar ends before PARK');
  const standard=recorded(v,{...cfg,textStyle:'standard'});
  assert.deepEqual(brakeTitles.map(label=>standard.plainCalls.find(c=>c.label===label&&c.y===17)?.x),[884,1044,1194,1354],
   'standard font keeps its original calibrated columns');
 }
});

test('system air-pressure and percentage share one large complete LED row without changing standard layout',()=>{
 for(const textMatrix of matrices)for(const pressure of [118,185,1000]){
  const v=view('systems_brake');v.p.values['truck.brake.air.pressure']=pressure;
  const percentage=Math.min(100,Math.round(pressure/185*100)),cfg=settings({textStyle:'airport_led',textMatrix,dashboardLanguage:'en'}),result=recorded(v,cfg);
  const value=result.at(1200,String(pressure)),percent=result.at(1257,`${percentage}%`);
  assert.ok(value);assert.ok(percent);assert.equal(value.pitch,pressure===1000?2:3);assert.equal(percent.pitch,3);
  assert.equal(value.minCells,3);assert.equal(percent.minCells,4);assert.equal(percent.align,'right');
  for(const [call,label]of [[value,String(pressure)],[percent,`${percentage}%`]]){
   assert.equal(call.y+call.plan.height,45);assert.ok(call.y>=21);assert.equal(call.plan.truncated,false);
   assert.equal(call.plan.text,label);assert.equal(call.plan.scrolling,false);assert.ok(call.plan.width<=call.maxWidth);
  }
  assert.equal(value.maxWidth,51);assert.equal(percent.maxWidth,69);
  assert.ok(boardX(value)+value.plan.width<=1251);assert.equal(boardX(percent),1257);
  assert.ok(boardX(percent)+percent.plan.width<result.at(1335).x,'complete 100% row stops before PARK');
  if(pressure===185){
   assert.equal(value.plan.width,51);assert.equal(percent.plan.width,69);
   assert.equal(boardX(percent)-boardX(value)-value.plan.width,6,'separate digit groups have one narrow gap');
  }
  assert.ok(result.plainCalls.some(c=>c.label==='AIR PSI'&&c.x===1200&&c.y===17),'pressure unit stays in the aligned heading');
  assert.deepEqual(rgb(result.canvas,1206,51),color(PALETTES.rally.cyan));
  const standard=recorded(v,{...cfg,textStyle:'standard'});
  assert.ok(standard.plainCalls.some(c=>c.label===`${pressure}  ${percentage}%`&&c.x===1194&&c.y===39&&c.max===155));
  assert.equal(standard.dotCalls.length,0);
  assert.deepEqual(rgb(standard.canvas,1200,45),color(PALETTES.rally.cyan));
 }
});

test('missing air pressure displays one N/A group without inventing a percentage or moving PARK',()=>{
 const v=view('systems_brake');delete v.p.values['truck.brake.air.pressure'];
 const cfg=settings({textStyle:'airport_led',dashboardLanguage:'en'}),result=recorded(v,cfg);
 const pressureCalls=result.dotCalls.filter(call=>call.x>=1200&&call.x<1335);
 assert.equal(pressureCalls.length,1);assert.equal(pressureCalls[0].x,1200);assert.equal(pressureCalls[0].plan.text,'N/A');
 assert.equal(pressureCalls[0].plan.truncated,false);assert.equal(result.at(1257),undefined);assert.ok(result.at(1335));
 const present=view('systems_brake');present.p.values['truck.brake.air.pressure']=185;
 assert.deepEqual(pixels(result.canvas,1335,0,115,60),pixels(recorded(present,cfg).canvas,1335,0,115,60),'AIR state never paints into PARK');
 const standard=recorded(v,{...cfg,textStyle:'standard'});
 assert.ok(standard.plainCalls.some(call=>call.label==='N/A'&&call.x===1194&&call.y===39&&call.max===155));
});

test('braking overlay air-pressure row retains percentage and PSI together at larger dot pitch',()=>{
 for(const page of ['braking','brake'])for(const textMatrix of matrices)for(const pressure of [118,185]){
  const v={...view(),page,brakeForce:.5};v.p.values['truck.brake.air.pressure']=pressure;
  const percentage=Math.round(pressure/185*100),cfg=settings({textStyle:'airport_led',textMatrix,dashboardLanguage:'en'}),result=recorded(v,cfg);
  const label=`${percentage}%/${pressure}PSI`,call=result.at(1065,label);
  assert.ok(call);assert.equal(call.pitch,3);assert.equal(call.minCells,10);
  assert.equal(call.plan.text,label);assert.equal(call.plan.truncated,false);assert.ok(call.plan.width<=215);
  assert.equal(call.y+call.plan.height,43);assert.ok(call.y>=19,'dot row stays below AIR heading');
  assert.deepEqual(rgb(result.canvas,1070,48),color(PALETTES.rally.cyan));
  assert.ok(!result.plainCalls.some(c=>c.label==='PSI'),'PSI is part of the complete LED string');
  const standard=recorded(v,{...cfg,textStyle:'standard'});
  assert.ok(standard.plainCalls.some(c=>c.label===`${percentage}% / ${pressure} PSI`&&c.x===1065&&c.y===39));
  assert.deepEqual(rgb(standard.canvas,1070,46),color(PALETTES.rally.cyan));
 }
});

test('all themes share identical 5x7 glyph geometry and lit/dim masks, changing colors only',()=>{
 const samples=[];
 for(const theme of themes){
  const result=recorded(view(),settings({theme,textStyle:'airport_led',textMatrix:'5x7',dashboardLanguage:'en'}));
  const call=result.at(884,'390.0L');assert.ok(call);
  assert.equal(call.plan.rows,7);
  const lit=color(call.color),dim=color(call.dim),mask=[];
  for(let row=0;row<call.plan.rows;row++)for(let col=0;col<call.plan.columns;col++){
   const dot=rgb(result.canvas,boardX(call)+col*call.pitch,call.y+row*call.pitch);
   if(dot.every((v,i)=>v===lit[i]))mask.push(1);
   else{assert.deepEqual(dot,dim,`${theme}: each physical dot is lit or dim`);mask.push(0);}
  }
  samples.push({geometry:{x:call.x,y:call.y,pitch:call.pitch,width:call.plan.width,height:call.plan.height,columns:call.plan.columns,rows:call.plan.rows},mask,color:call.color});
 }
 assert.deepEqual(samples[0].geometry,samples[1].geometry);assert.deepEqual(samples[1].geometry,samples[2].geometry);
 assert.deepEqual(samples[0].mask,samples[1].mask);assert.deepEqual(samples[1].mask,samples[2].mask);
 assert.equal(new Set(samples.map(s=>s.color)).size,3,'each theme retains its own color');
 assert.ok(samples[0].mask.includes(0)&&samples[0].mask.includes(1),'both lit and unlit LEDs exist');
});
