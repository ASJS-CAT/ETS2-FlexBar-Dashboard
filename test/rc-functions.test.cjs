const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {EventEmitter}=require('node:events');
const {createCanvas}=require('@napi-rs/canvas');
const {settings,Dashboard}=require('../src/model.cjs'),{drive}=require('./fixtures.cjs');
const {render}=require('../src/render.cjs'),{renderLauncher}=require('../src/launcher.cjs');
const {dictionary,createTranslator}=require('../src/i18n.cjs');
const {startRuntime,CID}=require('../src/runtime.cjs');
const flush=()=>new Promise(r=>setImmediate(r));
function capture(draw){
 const proto=Object.getPrototypeOf(createCanvas(1,1).getContext('2d')),original=proto.fillText,labels=[];
 proto.fillText=function(s,...args){labels.push(String(s));return original.call(this,s,...args);};
 try{draw();return labels;}finally{proto.fillText=original;}
}
test('launcher renders before activation, without a game/session, and is embedded in the manifest',()=>{
 const texts=capture(()=>{const c=renderLauncher({language:'en'});assert.equal(c.width,2170);assert.equal(c.height,60);});
 assert.ok(texts.includes('TAP TO OPEN DASHBOARD'));assert.ok(!texts.some(s=>/OFFLINE|WAITING|CONNECTED/.test(s)));
 assert.ok(capture(()=>renderLauncher({language:'zh'})).includes('点击进入仪表盘'));
 const key=require('../com.local.ets2rally.plugin/manifest.json').keyLibrary.children[0];
 assert.equal(key.config.keyType,'directDraw');assert.equal(key.style.image,renderLauncher({}, {bilingual:true}).toDataURL());
});
test('built-in cover is bilingual; launcher render helper supports each language',()=>{
 const bilingual=capture(()=>renderLauncher({}, {bilingual:true}));
 assert.ok(bilingual.includes('点击进入仪表盘 / TAP TO OPEN DASHBOARD'));
 for(const language of ['en','zh']){
  const labels=capture(()=>renderLauncher({language}));
  assert.ok(labels.includes(dictionary[language]['launcher.open']));
  assert.ok(!labels.includes(dictionary[language==='en'?'zh':'en']['launcher.open']));
 }
});
test('Chinese and English dashboard text uses the dictionary, including warning and control labels',()=>{
 for(const language of ['zh','en']){
  const cfg=settings({language,dashboardLanguage:'follow'}),d=new Dashboard(),p=drive(),t=createTranslator(language);
  let text=capture(()=>render(d.view(null,0,0,cfg),cfg));assert.ok(text.includes(t('status.waiting_game')));
  text=capture(()=>render(d.view(p,0,0,cfg),cfg));assert.ok(text.includes(t('metric.trip_average')));assert.ok(text.includes(t('control.hazard')));
  p.values['truck.brake.air.pressure.warning']=1;p.seq++;
  text=capture(()=>render(d.view(p,0,0,cfg),cfg));assert.ok(text.includes(t('warning.air')));assert.ok(text.includes(t('control.ack')));
 }
 assert.equal(createTranslator('zh',{en:{example:'English fallback'},zh:{}})('example'),'English fallback');
 assert.equal(createTranslator('xx')('status.connected'),'CONNECTED');
});
function loadSettings(){
 const source=fs.readFileSync(require.resolve('../com.local.ets2rally.plugin/ui/global_config.vue'),'utf8');
 const script=source.match(/<script>([\s\S]*?)<\/script>/)[1];
 const component=vm.runInNewContext(script.replace('export default','result ='),{result:null});
 return {source,component};
}
test('settings labels, choices, feedback and saved languages remain reactive and persist on reload',async()=>{
 const {source,component}=loadSettings();let saved;
 const ctx={modelValue:{config:{}},$fd:{setConfig:async cfg=>saved=JSON.parse(JSON.stringify(cfg)),showSnackbarMessage:(_type,s)=>ctx.message=s}};
 for(const [key,fn]of Object.entries(component.methods))ctx[key]=fn.bind(ctx);
 component.created.call(ctx);
 for(const language of ['zh','en']){
  ctx.modelValue.config.language=language;ctx.modelValue.config.dashboardLanguage='follow';
  assert.equal(ctx.t('settings.save_settings'),dictionary[language]['settings.save_settings']);
  assert.equal(component.computed.controlIds.call(ctx).find(c=>c.value==='hazard').title,dictionary[language]['settings.hazard_lights']);
  await ctx.save();assert.equal(ctx.message,dictionary[language]['settings.settings_saved']);
  const reload=settings(saved);assert.equal(reload.language,language);assert.equal(reload.dashboardLanguage,'follow');
 }
 for(const match of source.split('<script>')[0].matchAll(/t\('([^']+)'\)/g))for(const lang of ['en','zh'])assert.ok(dictionary[lang][match[1]],match[1]);
 const embedded=vm.runInNewContext(source.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/export default[\s\S]*/, '')+';dictionary');
 assert.equal(JSON.stringify(embedded),JSON.stringify(dictionary),'generated UI catalog matches source');
});
function harness(cfg={}){
 const handlers={},socket=new EventEmitter();let now=0,seq=0;
 socket.bind=(_p,_h,cb)=>cb();socket.send=(_b,_p,_h,cb)=>cb?.();socket.close=()=>{};
 const plugin={on:(e,f)=>handlers[e]=f,getConfig:()=>new Promise(()=>{}),directDraw:async()=>{}};
 const runtime=startRuntime(plugin,{info:()=>{},error:assert.fail},{clock:()=>now,socket});runtime.configure(cfg);
 const p=drive();return {runtime,p,handlers,
  receive(t){now=t;p.seq=++seq;socket.emit('message',Buffer.from(JSON.stringify(p)),{address:'127.0.0.1',port:29763});},
  async mount(){handlers['plugin.alive']({serialNumber:'A',keys:[{cid:CID,uid:10}]});this.receive(0);await this.paint();},
  async paint(){runtime.sessions.get('A').next=0;runtime.tick();await flush();},
  touch(state,t,x=1050){now=t;handlers['device.touch']({serialNumber:'A',state,x,y:25});}
 };
}

test('host settings updates apply the real flat payload immediately and survive a fresh runtime',async()=>{
 const saved={language:'zh',dashboardLanguage:'zh',cycleSeconds:9,theme:'el_mint'};
 const h=harness();try{
  await h.mount();
  h.handlers['plugin.config.updated'](saved);await h.paint();
  const cfg=h.handlers['ui.message']({action:'preferences'});
  assert.equal(cfg.dashboardLanguage,'zh');assert.equal(cfg.cycleSeconds,9);
  assert.ok(capture(()=>render(h.runtime.rally.view(cfg),cfg)).includes(dictionary.zh['metric.trip_average']));
  h.handlers['plugin.config.updated']({...saved,dashboardLanguage:'en'});await h.paint();
  const en=h.handlers['ui.message']({action:'preferences'});
  assert.equal(en.dashboardLanguage,'en');
  assert.ok(capture(()=>render(h.runtime.rally.view(en),en)).includes(dictionary.en['metric.trip_average']));
  h.handlers['plugin.config.updated']({config:saved});
  assert.equal(h.handlers['ui.message']({action:'preferences'}).dashboardLanguage,'zh');
 }finally{h.runtime.stop();}
 const restarted=harness(saved);try{assert.equal(restarted.handlers['ui.message']({action:'preferences'}).dashboardLanguage,'zh');}finally{restarted.runtime.stop();}
});
test('carousel tap moves one selected page forward, wraps, and resets the full timer',async()=>{
 const h=harness({cycleSeconds:3,cyclePanels:['route','fuel']});try{
  await h.mount();h.receive(2900);await h.paint();assert.equal(h.runtime.rally.cached.panel,'route');
  h.touch('down',2900);h.touch('up',2950);assert.equal(h.runtime.rally.cached.panel,'fuel');
  h.touch('up',2990);assert.equal(h.runtime.rally.dash.carouselOffset,1,'duplicate up cannot advance twice');
  for(const t of [3100,4100,5100,5900])h.receive(t);
  assert.equal(h.runtime.rally.cached.panel,'fuel','old absolute timer cannot cut the new page short');
  h.receive(5950);assert.equal(h.runtime.rally.cached.panel,'route');
 }finally{h.runtime.stop();}
});
test('tap at an automatic timer boundary advances from the delivered page exactly once',async()=>{
 const h=harness({cycleSeconds:3});try{
  await h.mount();h.receive(2900);await h.paint();h.touch('down',2990);h.touch('up',3050);
  assert.equal(h.runtime.rally.cached.panel,'route');assert.equal(h.runtime.rally.dash.carouselOffset,1);
 }finally{h.runtime.stop();}
});
test('warning, brake, refilling, payment, JOB, T-INFO, motion and pause never accept a carousel tap',async()=>{
 for(const page of ['alert','braking','refueling','notice','job','trailer','motion','paused']){
  const h=harness();try{
   await h.mount();const d=h.runtime.rally.dash;
   if(page==='alert')h.p.values['truck.brake.air.pressure.warning']=1;
   if(page==='braking')h.p.values['truck.input.brake']=.5;
   if(page==='refueling')d.refuelUntil=10000;
   if(page==='notice')h.p.payments=[{id:'test',type:'toll',amount:100}];
   if(['job','trailer'].includes(page))d.select(page,h.runtime.rally.now,settings());
   if(page==='motion')d.section=3;
   if(page==='paused')h.p.paused=true;
   h.receive(100);await h.paint();assert.equal(h.runtime.sessions.get('A').presented.view.page,page);
   h.touch('down',110);h.touch('up',160);assert.equal(d.carouselEpoch,undefined,page);
  }finally{h.runtime.stop();}
 }
});
test('an overlay appearing during the gesture cancels a pending carousel tap',async()=>{
 const h=harness();try{
  await h.mount();h.touch('down',100);h.p.values['truck.brake.air.pressure.warning']=1;h.receive(120);h.touch('up',150);
  assert.equal(h.runtime.rally.dash.carouselEpoch,undefined);
 }finally{h.runtime.stop();}
});

for(const [page,panels]of [['job',['job_overview','job_timing','job_distance']],['trailer',['trailer_status','trailer_damage']]]){
 test(`${page} tap advances its own panels exactly once and restarts page and hold timers`,async()=>{
  const h=harness({cycleSeconds:3,manualPageHoldCycles:3});try{
   await h.mount();const d=h.runtime.rally.dash;d.select(page,0,settings({cycleSeconds:3,manualPageHoldCycles:3}));
   for(const t of [100,800,1500,2200,2900])h.receive(t);await h.paint();assert.equal(h.runtime.rally.cached.panel,panels[0]);
   h.touch('down',2900);h.touch('up',2950);assert.equal(h.runtime.rally.cached.panel,panels[1]);
   assert.equal(d.manualRemainingMs,9000);h.touch('up',2990);assert.equal(d.manualPanelOffset,1);
   for(const t of [3100,4100,5100,5900])h.receive(t);assert.equal(h.runtime.rally.cached.panel,panels[1]);
   h.receive(5950);assert.equal(h.runtime.rally.cached.panel,panels[2%panels.length]);
   for(let i=0;i<panels.length;i++){
    await h.paint();const index=panels.indexOf(h.runtime.sessions.get('A').presented.view.panel),t=6000+i*300;
    h.touch('down',t);h.touch('up',t+50);assert.equal(h.runtime.rally.cached.panel,panels[(index+1)%panels.length]);
   }
   assert.equal(d.carouselEpoch,undefined,'manual taps never advance default carousel');
  }finally{h.runtime.stop();}
 });
 test(`${page} gesture is cancelled by a warning or by leaving the manual page`,async()=>{
  for(const interrupt of ['warning','auto']){
   const h=harness();try{
    await h.mount();const d=h.runtime.rally.dash;d.select(page,0,settings());h.receive(100);await h.paint();h.touch('down',110);
    if(interrupt==='warning')h.p.values['truck.brake.air.pressure.warning']=1;else d.auto();
    h.receive(120);h.touch('up',160);assert.equal(d.manualPanelOffset,0);assert.equal(d.carouselEpoch,undefined);
   }finally{h.runtime.stop();}
  }
 });
}

test('motion page adds localized current and peak G while retaining XYZ text',()=>{
 const p=drive(),d=new Dashboard();d.section=3;
 for(const axis of ['x','y','z']){p.values['truck.local.acceleration.linear.'+axis]=axis==='z'?9.80665:0;p.values['truck.local.velocity.linear.'+axis]=axis==='z'?-20:0;}
 for(const lang of ['en','zh']){
  const cfg=settings({dashboardLanguage:lang}),labels=capture(()=>render(d.view(p,0,0,cfg),cfg));
  assert.ok(labels.includes(lang==='zh'?'实时 G':'G NOW'));assert.ok(labels.includes(lang==='zh'?'峰值 G':'G PEAK'));
  assert.equal(labels.filter(s=>s==='1.00 G').length,2);assert.ok(labels.includes('0.00 / 0.00 / 9.81'));
 }
});

test('system carousel parking indicator follows telemetry including off and unavailable states',()=>{
 for(const lang of ['en','zh']){
  const cfg=settings({dashboardLanguage:lang,cyclePanels:['systems'],cycleSeconds:3});
  const p=drive(),d=new Dashboard();p.values['truck.speed']=0;
  for(const state of [0,1,0,null]){
   if(state===null)delete p.values['truck.brake.parking'];else p.values['truck.brake.parking']=state;
   const v=d.view(p,3000,3000,cfg);assert.equal(v.panel,'systems_brake');
   const labels=capture(()=>render(v,cfg));assert.ok(labels.includes(lang==='zh'?'驻车制动':'PARK BRAKE'));
   const expected=state===null?dictionary[lang]['status.unavailable']:dictionary[lang][state?'status.on':'status.off'];
   const index=labels.indexOf(lang==='zh'?'驻车制动':'PARK BRAKE');assert.equal(labels[index+1],expected);
   assert.ok(!labels.includes('BRAKE LIGHT')&&!labels.includes('刹车灯')&&!labels.includes('ODO KM')&&!labels.includes('ENGINE WEAR'));
  }
 }
});
test('theme names and page numbers render independently; live theme switch retains session/page/trip',async()=>{
 for(const [theme,section,label]of [['rally',0,'RALLY / 01'],['el_mint',2,'MINT / 03'],['el_amber',3,'AMBER / 04']]){
  const d=new Dashboard();d.section=section;const cfg=settings({theme});
  assert.ok(capture(()=>render(d.view(drive(),0,0,cfg),cfg)).includes(label));
 }
 const h=harness({theme:'el_mint'});try{
  await h.mount();const dash=h.runtime.rally.dash;dash.section=1;dash.consumption.output=31;
  h.runtime.configure({theme:'el_amber'});await h.paint();
  assert.equal(h.runtime.rally.dash,dash);assert.equal(dash.section,1);assert.equal(dash.consumption.output,31);
  assert.ok(capture(()=>render(h.runtime.rally.view(settings()),settings({theme:'el_amber'}))).includes('AMBER / 02'));
 }finally{h.runtime.stop();}
});
