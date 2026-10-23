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
function assertDotColors(result,call,litColor){
 const p=call.plan,data=pixels(result.canvas,boardX(call),Math.round(call.y),p.width,p.height);
 for(let column=0;column<p.columns;column++){
  let source=column+p.offset-p.contentOffset;if(p.loopColumns)source=(source+p.loopColumns)%p.loopColumns;
  const character=Math.floor(source/6),glyph=led.GLYPHS[p.text[character]||' '],glyphColumn=source%6;
  for(let row=0;row<p.rows;row++){
   const lit=glyphColumn>=0&&glyphColumn<5&&glyph[row][glyphColumn]==='1',i=(row*p.pitch*p.width+column*p.pitch)*4;
   assert.deepEqual([...data.subarray(i,i+3)],color(lit?litColor(character):call.dim),`${call.label}: character ${character}, dot ${glyphColumn}/${row}`);
  }
 }
}

test('all Airport fuel layouts keep percentages white and color each liquid only below its configured thresholds',()=>{
 const cases=[
  [12,11.99,65,'red','white'],[12,12,11.99,'amber','red'],[12,23.99,24,'amber','white'],[12,24,12,'white','amber'],
  [20,19.99,20,'red','amber'],[20,20,39.99,'amber','amber'],[20,40,39.99,'white','amber'],[50,100,99.99,'white','amber']
 ];
 for(const theme of themes)for(const airportFuelLayout of ['double_large','single_fit','single_scroll'])for(const [lowFuelPercent,fuelPercent,adbluePercent,fuelState,adblueState]of cases){
  const v={...view(),fuelPercent},palette=PALETTES[theme];
  Object.assign(v.p.values,{'truck.fuel.amount':fuelPercent,'truck.adblue':adbluePercent,'adblue.capacity':100});
  const result=recorded(v,settings({theme,textStyle:'airport_led',airportFuelLayout,lowFuelPercent,dashboardLanguage:'en'}));
  for(const [x,percentageX,state]of [[884,941,fuelState],[1200,1253,adblueState]]){
   const call=result.at(x);assert.ok(call);
   if(airportFuelLayout==='double_large'){
    assertDotColors(result,result.at(percentageX),()=>palette.white);assertDotColors(result,call,()=>palette[state]);
   }else{
    const suffixStart=call.label.indexOf(' ')+1;
    assertDotColors(result,call,index=>index<suffixStart?palette.white:palette[state]);
   }
  }
 }
});

test('liquid warning colors follow the complete amount through both marquee modes while the percentage stays white',()=>{
 for(const theme of themes)for(const airportFuelLayout of ['single_fit','single_scroll'])for(const ledScrollMode of ['restart','loop_left']){
  const palette=PALETTES[theme],v={...view(),fuelPercent:5};
  Object.assign(v.p.values,{'truck.fuel.amount':12345.6,'truck.adblue':18000,'adblue.capacity':100000});
  const cfg=settings({theme,textStyle:'airport_led',airportFuelLayout,ledScrollMode,dashboardLanguage:'en'});
  for(const elapsed of [0,2100,7200,15000]){
   const result=recorded({...v,panelElapsedMs:elapsed},cfg,elapsed);
   for(const [x,state]of [[884,'red'],[1200,'amber']]){
    const call=result.at(x);assert.equal(call.plan.scrolling,true);assert.equal(call.plan.truncated,false);
    const suffixStart=call.label.indexOf(' ')+1;
    assertDotColors(result,call,index=>index<suffixStart?palette.white:palette[state]);
   }
  }
 }
});

test('unknown liquid levels remain neutral and warning thresholds do not change standard rendering',()=>{
 for(const theme of themes)for(const airportFuelLayout of ['double_large','single_fit','single_scroll']){
  const palette=PALETTES[theme],cfg=settings({theme,textStyle:'airport_led',airportFuelLayout,dashboardLanguage:'en'});
  for(const missing of ['amount','percentage']){
   const v={...view(),fuelPercent:5};v.p.values['truck.adblue']=5;v.p.values['adblue.capacity']=100;
   if(missing==='amount'){delete v.p.values['truck.fuel.amount'];delete v.p.values['truck.adblue'];}
   else{v.fuelPercent=null;delete v.p.values['adblue.capacity'];}
   const result=recorded(v,cfg);
   for(const x of airportFuelLayout==='double_large'?[884,941,1200,1253]:[884,1200])assertDotColors(result,result.at(x),()=>palette.white);
  }
  const v={...view(),fuelPercent:5};v.p.values['truck.fuel.amount']=30;v.p.values['truck.adblue']=4;
  const before=render(v,{...cfg,textStyle:'standard',lowFuelPercent:1}),after=render(v,{...cfg,textStyle:'standard',lowFuelPercent:50});
  assert.deepEqual(pixels(before,0,0,2170,60),pixels(after,0,0,2170,60),'Airport thresholds never recolor standard mode');
 }
});

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
   assert.equal(call.y,24);assert.ok(call.y+call.plan.height<51,'single readout remains between caption and bar');
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
  for(const [x,label,pitch]of [[884,'52PSI',3],[1029,'94°C',4],[1164,'86°C',4],[1319,'28.2V',4]]){
   const call=engine.at(x,label);assert.ok(call,label);assert.equal(call.pitch,pitch);
   assert.equal(call.y,24);assert.equal(call.y+call.plan.height,24+pitch*7,'dot row remains below caption baseline 17');
   assert.ok(call.plan.width<=call.maxWidth);assert.equal(call.plan.truncated,false);
  }
  assert.ok(engine.plainCalls.filter(c=>['OIL PSI','OIL C','COOLANT C','BATTERY'].includes(c.label)).every(c=>c.y===17));
  const brake=recorded(view('systems_brake'),cfg),temp=brake.at(884,'210°C');
  assert.equal(temp.pitch,4);assert.equal(temp.plan.height,28);assert.equal(temp.y,24);assert.equal(temp.y+temp.plan.height,52);
  const cargo=recorded(view('trailer_status'),cfg),mass=cargo.at(1224,'18.0T');
  assert.ok(mass);assert.equal(mass.pitch,3);assert.equal(mass.y,24);assert.equal(mass.y+mass.plan.height,45);
  assert.equal(mass.y,cargo.at(1054).y,'cargo name and mass share the same dot-board top');
  assert.equal(mass.plan.truncated,false);assert.ok(mass.plan.width<=112);
  assert.ok(![...engine.plainCalls,...cargo.plainCalls].some(c=>['V','T'].includes(c.label)),'units remain part of the LED string');
 }
});

test('Chinese missing cargo mass keeps the original text baseline while actual mass aligns its LED row with cargo',()=>{
 const cfg=settings({textStyle:'airport_led',dashboardLanguage:'zh'}),missing=view('trailer_status');
 delete missing.p.values['job.cargo.mass'];
 const result=recorded(missing,cfg),fallback=result.plainCalls.find(call=>call.label==='暂无'&&call.x===1224);
 assert.ok(fallback);assert.equal(fallback.y,45);assert.equal(fallback.max,112);assert.match(fallback.font,/\b21px\b/);
 assert.equal(result.at(1224),undefined,'unsupported Chinese text is never forced into dot glyphs');
 const standardMissing=recorded(missing,{...cfg,textStyle:'standard'});
 assert.deepEqual(fallback,standardMissing.plainCalls.find(call=>call.label==='暂无'&&call.x===1224));
 const actual=view('trailer_status'),actualResult=recorded(actual,cfg),mass=actualResult.at(1224,'18.0T');
 assert.ok(mass);assert.equal(mass.pitch,3);assert.equal(mass.y,24);assert.equal(mass.y+mass.plan.height,45);assert.equal(mass.plan.truncated,false);
 assert.equal(mass.y,actualResult.at(1054).y,'mass top follows the cargo dot row without moving either column');
 const standardActual=recorded(actual,{...cfg,textStyle:'standard'});
 assert.ok(standardActual.plainCalls.some(call=>call.label==='18.0 T'&&call.x===1224&&call.y===45&&call.max===112));
 const english=recorded(missing,{...cfg,dashboardLanguage:'en'}).at(1224,'N/A');
 assert.ok(english);assert.equal(english.y,24);assert.equal(english.y+english.plan.height,45,'supported English placeholder uses the aligned dot row');
});

test('Chinese missing battery voltage keeps the standard baseline and font instead of the large LED baseline',()=>{
 const v=view('systems_engine');delete v.p.values['truck.battery.voltage'];
 const cfg=settings({textStyle:'airport_led',dashboardLanguage:'zh'}),result=recorded(v,cfg);
 const fallback=result.plainCalls.find(call=>call.x===1319&&call.label==='暂无');
 assert.ok(fallback);assert.equal(fallback.y,45);assert.equal(fallback.max,122);assert.match(fallback.font,/\b21px\b/);
 assert.equal(result.at(1319),undefined);
 const standard=recorded(v,{...cfg,textStyle:'standard'});
 assert.deepEqual(fallback,standard.plainCalls.find(call=>call.x===1319&&call.label==='暂无'));
 for(const page of ['braking','brake']){
  const missing={...view(),page,brakeForce:.5};delete missing.p.values['truck.brake.temperature'];
  const result=recorded(missing,cfg),standard=recorded(missing,{...cfg,textStyle:'standard'});
  const temperature=result.plainCalls.find(call=>call.label==='暂无'&&call.y===45);
  assert.ok(temperature);assert.deepEqual(temperature,standard.plainCalls.find(call=>call.x===temperature.x&&call.label==='暂无'));
 }
});

test('single-row metric boards share y24 across panels and adapt pitch before scrolling extreme numbers',()=>{
 const cfg=settings({textStyle:'airport_led',dashboardLanguage:'en'}),panels=[
  ['systems_engine',[884,1029,1164,1319]],['systems_brake',[884,1030,1335]],
  ['route',[884,1054,1199,1334]],['job_overview',[884,1054,1189]],
  ['job_timing',[884,1029,1174,1329]],['job_distance',[884,1029,1184,1329]],
  ['trailer_status',[884,1054,1224,1354]],['trailer_damage',[884,1029,1174,1329]]
 ];
 for(const [panel,xs]of panels){
  const result=recorded({...view(panel),panelElapsedMs:2100},cfg,2100);
  for(const x of xs){const call=result.at(x);assert.ok(call,`${panel}/${x}`);assert.equal(call.y,24,`${panel}/${x}`);assert.ok(call.y+call.plan.height<=52);}
 }
 const v=view('systems_engine');
 for(const [temperature,pitch,scrolling]of [[94,4,false],[1000,3,false],[-1234,2,false],[123456789012,2,true]]){
  v.p.values['truck.oil.temperature']=temperature;
  const result=recorded({...v,panelElapsedMs:2100},cfg,2100),call=result.at(1029);
  assert.ok(call);assert.equal(call.plan.text,`${temperature}°C`);assert.equal(call.plan.truncated,false);
  assert.equal(call.pitch,pitch);assert.equal(call.y,24);assert.equal(call.plan.height,pitch*7);
  assert.equal(call.plan.scrolling,scrolling);
  assert.ok(!result.plainCalls.some(plain=>plain.x===1029&&plain.y===45),'supported values do not fall back to squeezed normal text');
  if(scrolling)assert.ok(call.plan.offset>0);
 }
});

test('job timing keeps complete 3px dot values and scrolls long times with existing mode and speed',()=>{
 const fields=[[884,'D11 02:00'],[1029,'D80 12:40'],[1174,'1666H 40M']];
 for(const ledScrollMode of ['restart','loop_left'])for(const ledScrollSpeed of [50,100,200]){
  const v=view('job_timing');v.p.values['job.delivery.time']=114520;
  const elapsed=(ledScrollMode==='restart'?900:0)+480,cfg=settings({textStyle:'airport_led',ledScrollMode,ledScrollSpeed,dashboardLanguage:'en'});
  const result=recorded({...v,panelElapsedMs:elapsed},cfg,elapsed);
  for(const [x,label]of fields){
   const call=result.at(x);assert.ok(call);assert.equal(call.plan.text,label);assert.equal(call.pitch,3);assert.equal(call.y,24);
   assert.equal(call.plan.truncated,false);assert.equal(call.plan.scrolling,true);assert.equal(call.plan.offset,4*ledScrollSpeed/100);
  }
  const standard=recorded({...v,panelElapsedMs:elapsed},{...cfg,textStyle:'standard'},elapsed);
  for(const [x,label]of fields)assert.ok(standard.plainCalls.some(call=>call.x===x&&call.y===45&&call.label===label));
  v.p.values['game.time']=214520;
  const late=recorded({...v,panelElapsedMs:elapsed},cfg,elapsed).at(1174);
  assert.equal(late.plan.text,'LATE 1666H 40M');assert.equal(late.pitch,3);assert.equal(late.plan.truncated,false);assert.equal(late.plan.scrolling,true);
 }
 const short=recorded(view('job_timing'),settings({textStyle:'airport_led',dashboardLanguage:'en'})).at(1174);
 assert.equal(short.plan.text,'7H 0M');assert.equal(short.pitch,3);assert.equal(short.plan.scrolling,false);
});

test('long trailer states scroll inside their reserved boards without truncation or normal-font compression',()=>{
 for(const ledScrollMode of ['restart','loop_left']){
  const v=view('trailer_status');v.p.values['truck.trailer.lift_axle.indicator']=1;
  const elapsed=2100,cfg=settings({textStyle:'airport_led',ledScrollMode,dashboardLanguage:'en'});
  const result=recorded({...v,panelElapsedMs:elapsed},cfg,elapsed),trailer=result.at(884),axle=result.at(1354);
  assert.equal(trailer.plan.text,'NOT CONNECTED');assert.equal(trailer.minCells,13);assert.equal(trailer.pitch,2);
  assert.equal(trailer.plan.truncated,false);assert.equal(trailer.plan.scrolling,true);assert.ok(trailer.plan.offset>0);
  assert.equal(axle.plan.text,'LIFTED');assert.equal(axle.minCells,6);assert.equal(axle.pitch,2);assert.equal(axle.scroll,true);
  assert.equal(axle.plan.truncated,false);assert.equal(axle.plan.scrolling,false);
  for(const call of [trailer,axle]){assert.equal(call.y,24);assert.ok(call.plan.width<=call.maxWidth);}
  assert.ok(!result.plainCalls.some(call=>['NOT CONNECTED','LIFTED'].includes(call.label)));
  const standard=recorded({...v,panelElapsedMs:elapsed},{...cfg,textStyle:'standard'},elapsed);
  assert.ok(standard.plainCalls.some(call=>call.label==='NOT CONNECTED'&&call.x===884&&call.y===45&&call.max===152));
  assert.ok(standard.plainCalls.some(call=>call.label==='LIFTED'&&call.x===1354&&call.y===45&&call.max===87));
 }
});

test('engine pressure and temperatures retain complete PSI and Celsius units without changing standard values',()=>{
 const fields=[['truck.oil.pressure',884,1029,'PSI'],['truck.oil.temperature',1029,1164,'°C'],['truck.water.temperature',1164,1319,'°C']];
 for(const dashboardLanguage of ['en','zh'])for(const values of [[53,97,93],[1000,-12,-1234],[null,null,null]]){
  const v=view('systems_engine');fields.forEach(([key],i)=>{if(values[i]===null)delete v.p.values[key];else v.p.values[key]=values[i];});
  const cfg=settings({textStyle:'airport_led',dashboardLanguage}),result=recorded(v,cfg),standard=recorded(v,{...cfg,textStyle:'standard'});
  fields.forEach(([,x,right,unit],i)=>{
   const raw=values[i]===null?'--':String(values[i]),call=result.at(x,raw+unit);assert.ok(call,`${dashboardLanguage}/${raw+unit}`);
   assert.equal(call.plan.text,raw+unit);assert.equal(call.plan.truncated,false);assert.equal(call.plan.scrolling,false);
   assert.ok(call.plan.width<=call.maxWidth);assert.ok(boardX(call)+call.plan.width<right);
   assert.ok(standard.plainCalls.some(c=>c.label===raw&&c.x===x&&c.y===45),'standard keeps its original unitless numeric readout');
  });
 }
});

test('brake temperature includes the Celsius unit in the dot row for both UI languages',()=>{
 for(const dashboardLanguage of ['en','zh'])for(const temperature of [0,210,-12,1000]){
  const v=view('systems_brake');v.p.values['truck.brake.temperature']=temperature;
  const cfg=settings({textStyle:'airport_led',dashboardLanguage}),result=recorded(v,cfg),label=`${temperature}°C`,call=result.at(884,label);
  assert.ok(call,`${dashboardLanguage}/${label}`);assert.equal(call.plan.text,label);assert.equal(call.plan.truncated,false);
  assert.equal(call.minCells,5);assert.equal(call.plan.cells,Math.max(5,label.length));
  assert.equal(call.pitch,temperature===1000?3:4);assert.equal(call.plan.height,temperature===1000?21:28);
  assert.equal(call.y,24);assert.equal(call.y+call.plan.height,24+call.pitch*7);assert.ok(call.plan.width<=118);assert.ok(call.x+call.plan.width<1030);
  assert.ok(!result.plainCalls.some(c=>['°C','C','℃',label].includes(c.label)),'number and Celsius glyphs are drawn as one LED string');
  const standard=recorded(v,{...cfg,textStyle:'standard'});
  assert.ok(standard.plainCalls.some(c=>c.label===String(temperature)&&c.x===884&&c.y===45),'standard temperature keeps its original text and coordinates');
 }
});

test('fuel page uses two legible 5x7 LED rows including litre units in all themes',()=>{
 for(const theme of themes)for(const textMatrix of matrices){
  const result=recorded(view(),settings({theme,textStyle:'airport_led',textMatrix,dashboardLanguage:'en'}));
  for(const [x,label,bottom]of [[941,'65%',30],[884,'390.0L',55],[1253,'65%',30],[1200,'52.0L',55],[1020,'32.5L/100',55],[1335,'1020KM',45]]){
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

test('double-large trip average aligns with the litres and their bars without moving other layout modes',()=>{
 const cfg=settings({textStyle:'airport_led',airportFuelLayout:'double_large',dashboardLanguage:'en'}),result=recorded(view(),cfg);
 for(const x of [884,1020,1200]){
  const call=result.at(x);assert.equal(call.y+call.plan.height,55);
  assert.deepEqual(rgb(result.canvas,x+3,57),color(x===1020?PALETTES.rally.amber:PALETTES.rally.cyan));
 }
 assert.ok(result.plainCalls.some(c=>c.label==='TRIP AVERAGE'&&c.x===1020&&c.y===14));
 const calculating=recorded({...view(),consumptionL100:null},cfg);
 assert.ok(calculating.plainCalls.some(c=>c.label==='CALCULATING'&&c.x===1020&&c.y===55));
 for(const airportFuelLayout of ['single_fit','single_scroll']){
  const single=recorded(view(),{...cfg,airportFuelLayout});
  const call=single.at(1020);assert.equal(call.y+call.plan.height,45);
  assert.deepEqual(rgb(single.canvas,1023,51),color(PALETTES.rally.amber));
 }
 const standard=recorded(view(),{...cfg,textStyle:'standard'});
 assert.ok(standard.plainCalls.some(c=>c.label==='32.5 L/100'&&c.x===1020&&c.y===35));
 assert.deepEqual(rgb(standard.canvas,1023,43),color(PALETTES.rally.amber));
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
   assert.ok(call.plan.width<=call.maxWidth);assert.equal(call.y,34);assert.equal(call.y+call.plan.height,48);
  }
  assert.ok(!result.plainCalls.some(c=>c.label.endsWith('L')&&c.y===55),'long quantities still use dot glyphs');
 }
});

test('fuel boards keep their row tops when long values change dot pitch in all three layouts',()=>{
 for(const airportFuelLayout of ['double_large','single_fit','single_scroll'])for(const litres of [390,10000]){
  const v={...view(),consumptionL100:100.1};
  Object.assign(v.p.values,{'truck.fuel.amount':litres,'truck.adblue':litres,'adblue.capacity':litres/0.65,'truck.fuel.range':123456});
  const cfg=settings({textStyle:'airport_led',airportFuelLayout,dashboardLanguage:'en'}),result=recorded(v,cfg);
  const tops=airportFuelLayout==='double_large'?[[941,9],[1253,9],[884,34],[1020,34],[1200,34],[1335,24]]:[[884,24],[1020,24],[1200,24],[1335,24]];
  for(const [x,top]of tops){
   const call=result.at(x);assert.ok(call,`${airportFuelLayout}/${litres}/${x}`);assert.equal(call.y,top);assert.equal(call.plan.truncated,false);
   assert.ok(call.plan.width<=call.maxWidth);assert.equal(call.align,airportFuelLayout==='double_large'?'right':'left');
  }
  if(airportFuelLayout==='double_large')assert.equal(result.at(1020).pitch,2,'100.1L/100 keeps its full value on the lower row');
  const missing=recorded({...v,consumptionL100:null},cfg);
  assert.ok(missing.plainCalls.some(call=>call.label==='CALCULATING'&&call.x===1020&&call.y===(airportFuelLayout==='double_large'?55:45)),'ordinary calculating caption keeps its existing baseline');
 }
});

test('motion vector and G dot rows align with angles while ordinary text and unit baselines stay unchanged',()=>{
 const cfg=settings({textStyle:'airport_led',dashboardLanguage:'en'});
 for(const values of [[null,null,null],[.12,-1.23,2.34]]){
  const v={...view(),page:'motion',gForce:{current:.27,peak:12.34}};
  for(const key of ['truck.local.velocity.linear','truck.local.acceleration.linear'])
   ['x','y','z'].forEach((axis,i)=>{if(values[i]!=null)v.p.values[`${key}.${axis}`]=values[i];});
  const result=recorded(v,cfg);
  for(const x of [884,1049,1214,1379,1649,1774,2044]){
   const call=result.at(x);assert.ok(call,`${values}/${x}`);assert.equal(call.y,24);assert.ok(call.y+call.plan.height<=45);
  }
  for(const label of ['M/S','M/S²'])assert.ok(result.plainCalls.some(call=>call.label===label&&call.y===56));
  const standard=recorded(v,{...cfg,textStyle:'standard'});
  for(const x of [1379,1649,1774,2044])assert.ok(standard.plainCalls.some(call=>call.x===x&&call.y===43));
 }
 const missing={...view(),page:'motion',gForce:null},zh=recorded(missing,{...cfg,dashboardLanguage:'zh'});
 for(const x of [1649,2044])assert.ok(zh.plainCalls.some(call=>call.x===x&&call.label==='暂无'&&call.y===43));
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
  assert.equal(call.y,24);assert.equal(call.y+call.plan.height,45,'dot row stays below AIR heading and above bar');
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
