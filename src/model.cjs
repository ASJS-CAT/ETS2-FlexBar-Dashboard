'use strict';
const {GForce}=require('./driving-metrics.cjs');
const MANUAL_PANELS=Object.freeze({job:Object.freeze(['job_overview','job_timing','job_distance']),trailer:Object.freeze(['trailer_status','trailer_damage'])});
const {TelemetryState,DrivingContext,QuickControlResolver,PINNABLE,CAPABILITIES}=require('./quick-controls.cjs');
const DEFAULTS = Object.freeze({ language:'zh',dashboardLanguage:'en',rpmScaleMax:2500,gearFontSize:42,rpmScaleFormat:'full',rpmLabelCount:6,warningRotationSeconds:2,locationRotationSeconds:8,refuelExitSeconds:1.8,paymentSeconds:3,controlOrder:[],hiddenControls:[], fps: 20, units: 'kmh', theme:'rally', manualPageHoldCycles:3, brakePageHoldSeconds:3,
  overspeedMargin: 3, lowFuelPercent: 12, cycleSeconds: 15, cyclePanels:['fuel','route','systems'],digitStyle:'rally',
  airPressureFullPsi:185,quickControlsMode:'dynamic',pinnedControls:['hazard','parking'],diffUpdate: false, bindingMode: false, wakeOnStart: true });
function settings(raw = {}) {
  const number = (k, lo, hi) => raw[k]!==null&&raw[k]!==''&&Number.isFinite(Number(raw[k])) ? Math.min(hi, Math.max(lo, Number(raw[k]))) : DEFAULTS[k];
  const allowed=['fuel','route','systems'];
  const cyclePanels=Array.isArray(raw.cyclePanels)?[...new Set(raw.cyclePanels.filter(v=>allowed.includes(v)))]:[...DEFAULTS.cyclePanels];
  const pinned=Array.isArray(raw.pinnedControls)?[...new Set(raw.pinnedControls.filter(v=>PINNABLE.includes(v)))].slice(0,3):[...DEFAULTS.pinnedControls];
  const quickControlsMode=['static','dynamic','hybrid'].includes(raw.quickControlsMode)?raw.quickControlsMode:DEFAULTS.quickControlsMode;
  const holdCycles=[1,2,3,5].includes(Number(raw.manualPageHoldCycles))?Number(raw.manualPageHoldCycles):DEFAULTS.manualPageHoldCycles;
  const theme=raw.theme==='el'?'el_mint':['rally','el_mint','el_amber'].includes(raw.theme)?raw.theme:'rally';
  const digit=raw.digitStyle==='font'?'rally':['rally','din','euro','narrow','tft','segment'].includes(raw.digitStyle)?raw.digitStyle:'rally';
  return { language:raw.language==='en'?'en':'zh', dashboardLanguage:['follow','zh','en'].includes(raw.dashboardLanguage)?raw.dashboardLanguage:'en', fps: number('fps', 5, 25), units: raw.units === 'mph' ? 'mph' : 'kmh',theme,
    digitStyle:digit,rpmScaleMax:number('rpmScaleMax',0,10000),gearFontSize:number('gearFontSize',24,48),rpmScaleFormat:raw.rpmScaleFormat==='x100'?'x100':'full',rpmLabelCount:[4,5,6].includes(Number(raw.rpmLabelCount))?Number(raw.rpmLabelCount):6,
    warningRotationSeconds:number('warningRotationSeconds',1,30),locationRotationSeconds:number('locationRotationSeconds',2,60),refuelExitSeconds:number('refuelExitSeconds',1,20),paymentSeconds:number('paymentSeconds',1,15),hiddenControls:Array.isArray(raw.hiddenControls)?[...new Set(raw.hiddenControls.filter(id=>id in CAPABILITIES))]:[],controlOrder:Array.isArray(raw.controlOrder)?[...new Set(raw.controlOrder.filter(id=>id in CAPABILITIES&&!['bind_next'].includes(id)))]:[],
    manualPageHoldCycles:holdCycles,brakePageHoldSeconds:number('brakePageHoldSeconds',1,20),airPressureFullPsi:number('airPressureFullPsi',120,250),
    overspeedMargin: number('overspeedMargin', 0, 20), lowFuelPercent: number('lowFuelPercent', 1, 50), cycleSeconds:number('cycleSeconds',3,120),
    cyclePanels:cyclePanels.length?cyclePanels:[...DEFAULTS.cyclePanels],quickControlsMode,pinnedControls:pinned,
    diffUpdate: raw.diffUpdate === true, bindingMode: raw.bindingMode === true, wakeOnStart: raw.wakeOnStart !== false };
}
function decode(buffer) {
  if (buffer.length > 16384) return null;
  try {
    const p = JSON.parse(buffer.toString('utf8'));
    if (p.protocol !== 1 || p.source !== 'ets2-flexbar' || typeof p.connected !== 'boolean' ||
        typeof p.paused !== 'boolean' || typeof p.input !== 'boolean' ||
        !p.values || Array.isArray(p.values) || typeof p.values !== 'object') return null;
    const values = Object.create(null);
    const textKeys=new Set(['job.source.city.alternate','job.destination.city.alternate','job.cargo','job.source.city','job.destination.city','job.source.company','job.destination.company']);
    for (const [k,v] of Object.entries(p.values)) {
      if (typeof v === 'number' && Number.isFinite(v)) values[k] = v;
      else if (textKeys.has(k)&&typeof v==='string'&&v.length<=96) values[k]=v;
    }
    const payments=Array.isArray(p.payments)?p.payments.filter(e=>e&&typeof e.id==='string'&&e.id.length<80&&Number.isFinite(e.amount)&&e.amount>0&&['toll','fine','ferry','train','cancel'].includes(e.type)).slice(-32):[];
    const sessionId=typeof p.sessionId==='string'&&p.sessionId.length<=96?p.sessionId:null;
    const processId=Number.isInteger(p.processId)&&p.processId>0&&p.processId<=0xffffffff?p.processId:null;
    const processStarted=typeof p.processStarted==='string'&&/^\d{1,20}$/.test(p.processStarted)?p.processStarted:null;
    return { ...p, sessionId,processId,processStarted,foreground:typeof p.foreground==='boolean'?p.foreground:null,values,payments };
  } catch { return null; }
}
const value = (p,k) => p?.values?.[k] ?? null;
const yes = (p,k) => value(p,k) === 1;
const PAGES = ['job','trailer','brake'];
const BRAKE_THRESHOLD=0.08;
class TripConsumption{
  constructor(){this.reset();}
  reset(){this.previousFuel=null;this.previousOdo=null;this.fuelUsed=0;this.distance=0;this.output=null;this.seq=null;}
  update(fuel,odo,seq){
    if(seq===this.seq)return this.output;this.seq=seq;
    if(!Number.isFinite(fuel)||!Number.isFinite(odo)){this.previousFuel=null;this.previousOdo=null;return this.output;}
    if(this.previousFuel===null){this.previousFuel=fuel;this.previousOdo=odo;return this.output;}
    const used=this.previousFuel-fuel,travel=odo-this.previousOdo;this.previousFuel=fuel;this.previousOdo=odo;
    // Invalid deltas change the sampling baseline, never erase accumulated trip totals.
    if(used < -0.05||used>5||travel < -0.01||travel>2){this.log?.(used < -0.05?'refueling':travel<-.01?'odometer_rewind':'sample_gap');return this.output;}
    // Freeze at rest. Tiny odometer noise must not turn idling fuel into a huge L/100 km value.
    if(travel<0.001)return this.output;
    this.distance+=travel;this.fuelUsed+=Math.max(0,used);
    if(this.distance<0.3||this.fuelUsed<0.01)return this.output;
    const average=this.fuelUsed/this.distance*100;
    if(average>=1&&average<=200)this.output=this.output===null?average:this.output+(average-this.output)*0.2;
    return this.output;
  }
}
class Dashboard {
  constructor() { this.gForce=new GForce();this.manualPanelOffset=0;this.manualPanelEpoch=0;this.manualRevision=0;this.manual = null; this.until = 0; this.ack = '';this.acknowledged=new Set(); this.tripBase = null;
    this.overspeedActive=false;this.overspeedNoticeUntil=0;this.lastFuel=null;this.lastSeq=null;this.refuelUntil=0;
    this.tollQueue=[];this.paymentIds=new Set();this.lastTollId=null;this.lastViewNow=null;this.brakingUntil=0;this.section=0;this.manualRemainingMs=0;this.manualElapsedMs=0;
    this.context=new DrivingContext();this.quick=new QuickControlResolver();this.consumption=new TripConsumption();this.bindingPage=0;this.adblueFill={last:null,seq:null,until:0}; }
  select(page,now,cfg){if(PAGES.includes(page)){this.manualRevision++;this.manualPanelOffset=0;this.manualPanelEpoch=0;this.lastViewNow=now;this.manualWasVisible=false;this.manual=page;this.manualRemainingMs=cfg.manualPageHoldCycles*cfg.cycleSeconds*1000;this.manualElapsedMs=0;this.until=now+this.manualRemainingMs;}}
  auto() { this.manual = null; this.manualRemainingMs=0;this.manualElapsedMs=0;this.until = 0; }
  acknowledge(id){if(id)this.acknowledged.add(id);}
  nextSection(){this.section=(this.section+1)%4;}
  carouselIndex(now,cfg){return (this.carouselOffset||0)+Math.floor(Math.max(0,now-(this.carouselEpoch||0))/(cfg.cycleSeconds*1000));}
  nextCarouselPage(now,cfg,shown){
    if(!isDefaultCarousel(shown))return false;
    // Use the delivered page, not a clock boundary crossed during the gesture.
    this.carouselOffset=(shown.carouselIndex??this.carouselIndex(now,cfg))+1;
    this.carouselEpoch=now;return true;
  }
  nextInformationPage(now,cfg,shown){
    if(isDefaultCarousel(shown))return isDefaultCarousel(this.lastRendered)&&this.nextCarouselPage(now,cfg,shown);
    if(!isInformationCarousel(shown)||this.lastRendered?.page!==shown.page||this.manual!==shown.page||shown.manualRevision!==this.manualRevision)return false;
    const panels=MANUAL_PANELS[shown.page],index=panels.indexOf(shown.panel);
    if(index<0)return false;
    this.manualPanelOffset=(index+1)%panels.length;this.manualPanelEpoch=this.manualElapsedMs;
    this.manualRemainingMs=cfg.manualPageHoldCycles*cfg.cycleSeconds*1000;this.until=now+this.manualRemainingMs;
    return true;
  }
  nextBinding(){this.bindingPage=(this.bindingPage+1)%3;}
  resetTrip(p) { this.tripBase = value(p,'truck.odometer');this.consumption.reset();this.gForce.reset(); }
  view(p, received, now, cfg) {
    const fresh = p && now - received < 1500 && p.connected;
    if(p?.connected&&!fresh&&this.lastRendered)return {...this.lastRendered,inputReady:false,connectionState:'STALE'};
    if (!p?.connected) return {page:'offline',p:null,alerts:[],mode:'AUTO',overspeed:false,refueling:false,panel:'fuel',section:this.section,inputReady:false,quick:{controls:[],previous:[],transition:1}};
    const speed = value(p,'truck.speed'); const kmh = speed === null ? null : Math.abs(speed) * 3.6;
    const rpm = value(p,'truck.engine.rpm'); const gear = value(p,'truck.displayed.gear');
    const odo = value(p,'truck.odometer');
    if (odo !== null && (this.tripBase === null || odo < this.tripBase)) this.tripBase = odo;
    const fuel = value(p,'truck.fuel.amount'), cap = value(p,'fuel.capacity');
    const fuelPercent = fuel !== null && cap > 0 ? Math.max(0, Math.min(100, fuel / cap * 100)) : null;
    if(p.seq!==this.lastSeq){
      // A single new telemetry increase is sufficient. The exit hold smooths
      // the page between samples; it must not delay entry into the fill page.
      if(!p.paused&&kmh!==null&&kmh<1&&Number.isFinite(fuel)&&Number.isFinite(this.lastFuel)&&fuel-this.lastFuel>0.01)this.refuelUntil=now+cfg.refuelExitSeconds*1000;
      this.lastFuel=fuel;this.lastSeq=p.seq;
    }
    const adblue=value(p,'truck.adblue'),adCap=value(p,'adblue.capacity'),af=this.adblueFill;
    if(p.seq!==af.seq){if(!p.paused&&kmh!==null&&kmh<1&&Number.isFinite(adblue)&&Number.isFinite(af.last)&&adblue-af.last>.01)af.until=now+cfg.refuelExitSeconds*1000;af.last=adblue;af.seq=p.seq;}
    const adblueRefilling=now<af.until,adbluePercent=adblue!==null&&adCap>0?Math.max(0,Math.min(100,adblue/adCap*100)):null;
    for(const e of p.payments||[]){if(!this.paymentIds.has(e.id)){this.paymentIds.add(e.id);this.tollQueue.push({...e,shownMs:0});if(this.paymentIds.size>512)this.paymentIds.delete(this.paymentIds.values().next().value);}}
    const tollId=value(p,'event.toll.id');if(!p.payments?.length&&Number.isFinite(tollId)&&tollId!==this.lastTollId){this.lastTollId=tollId;this.tollQueue.push({id:tollId,amount:value(p,'event.toll.amount'),type:'toll',shownMs:0});}
    const rawDelta=this.lastViewNow===null?0:Math.max(0,now-this.lastViewNow),viewDelta=Math.min(250,rawDelta);this.lastViewNow=now;
    const alerts = [];
    const add = (id,text,critical,priority=100,detail='') => {const item={id,text,critical,priority,detail};alerts.push(item);return item;};
    if (!p.paused) {
      const air=value(p,'truck.brake.air.pressure'),airPct=air==null?null:Math.max(0,Math.min(100,air/cfg.airPressureFullPsi*100));
      if (yes(p,'truck.brake.air.pressure.emergency')) add('air-emergency','AIR EMERGENCY',true,400,air==null?'AIR N/A':`AIR ${air.toFixed(0)} PSI / ${airPct.toFixed(0)}%`);
      else if (yes(p,'truck.brake.air.pressure.warning')) add('air','LOW AIR PRESSURE',true,390,air==null?'AIR N/A':`AIR ${air.toFixed(0)} PSI / ${airPct.toFixed(0)}%`);
      if (yes(p,'truck.water.temperature.warning')) add('water','COOLANT OVERHEAT',true,380,`COOLANT ${value(p,'truck.water.temperature')?.toFixed?.(0)??'N/A'} C`);
      if (yes(p,'truck.engine.enabled') && yes(p,'truck.oil.pressure.warning')) add('oil','LOW OIL PRESSURE',true,370,`OIL ${value(p,'truck.oil.pressure')?.toFixed?.(0)??'N/A'} PSI`);
      if (yes(p,'truck.brake.parking') && kmh > 5) add('parking','PARK BRAKE ON',true,360,`SPEED ${kmh.toFixed(0)} KM/H`);
      if (yes(p,'truck.fuel.warning') || (fuelPercent !== null && fuelPercent < cfg.lowFuelPercent)) add('fuel','LOW FUEL',false,120,`FUEL ${fuelPercent===null?'--':fuelPercent.toFixed(0)}%`);
      if (yes(p,'truck.adblue.warning')) {const ad=value(p,'truck.adblue'),adCap=value(p,'adblue.capacity');add('adblue','LOW ADBLUE',false,110,ad!=null&&adCap>0?`ADBLUE ${(ad/adCap*100).toFixed(0)}%`:'ADBLUE N/A');}
      if (yes(p,'truck.engine.enabled') && yes(p,'truck.battery.voltage.warning')) add('battery','LOW BATTERY',false,130,`BATTERY ${value(p,'truck.battery.voltage')?.toFixed?.(1)??'N/A'} V`);
      const limit = value(p,'truck.navigation.speed.limit');
      const over=limit>0&&kmh>limit*3.6+cfg.overspeedMargin;
      if(over&&!this.overspeedActive){this.overspeedActive=true;this.overspeedNoticeUntil=now+3000;}
      if(!over){this.overspeedActive=false;this.overspeedNoticeUntil=0;}
      if(over&&now<this.overspeedNoticeUntil){const shown=limit*3.6/(cfg.units==='mph'?1.609344:1),item=add('speed','OVERSPEED',false,250,`LIMIT ${shown.toFixed(0)} ${cfg.units==='mph'?'MPH':'KM/H'}`);item.limit=shown;}
    }
    alerts.sort((a,b)=>b.priority-a.priority);
    if(!p.paused)for(const id of this.acknowledged)if(!alerts.some(a=>a.id===id))this.acknowledged.delete(id);
    for(const a of alerts)a.acknowledged=this.acknowledged.has(a.id);
    const refueling=now<this.refuelUntil,filling=refueling||adblueRefilling;
    // Filling either reservoir exposes both live amounts. Keep resource faults
    // in alerts without ACKing them; they become visible again after filling.
    const pendingAlerts=alerts.filter(a=>!a.acknowledged&&!(filling&&['fuel','adblue'].includes(a.id)));
    const alertId = alerts.map(a=>a.id).join('|');
    if (!alertId) this.ack = '';
    const urgent = alerts.some(a=>a.critical);
    if(this.manual&&this.manualRemainingMs<=0)this.auto();
    let page = (this.section===3?'motion':this.manual) || (gear !== null && gear < 0 ? 'reverse' : 'drive');
    const alertVisible=pendingAlerts.length>0&&alertId!==this.ack;
    if (alertVisible) page = 'alert';
    while(this.tollQueue[0]?.shownMs>=cfg.paymentSeconds*1000)this.tollQueue.shift();
    let tollNotice=this.tollQueue[0]||null;
    const brake=value(p,'truck.input.brake'),brakeActive=brake!=null&&brake>BRAKE_THRESHOLD;
    if(brakeActive)this.brakingUntil=now+cfg.brakePageHoldSeconds*1000;
    const braking=brakeActive||now<this.brakingUntil;
    if(!alertVisible&&(refueling||adblueRefilling))page='refueling';
    else if(!alertVisible&&braking)page='braking';
    else if(!alertVisible&&tollNotice){if(!p.paused)tollNotice.shownMs+=viewDelta;page='notice';}
    if (p.paused) page = 'paused';
    const manualVisible=this.manual&&page===this.manual&&!p.paused;
    if(manualVisible&&this.manualWasVisible){this.manualRemainingMs=Math.max(0,this.manualRemainingMs-rawDelta);this.manualElapsedMs+=rawDelta;this.until=now+this.manualRemainingMs;}
    this.manualWasVisible=!!manualVisible;
    const cycleMs=cfg.cycleSeconds*1000,carouselIndex=this.carouselIndex(now,cfg),basePanel=cfg.cyclePanels[carouselIndex%cfg.cyclePanels.length];
    const drivePanel=basePanel==='systems'?(Math.floor(carouselIndex/cfg.cyclePanels.length)%2?'systems_brake':'systems_engine'):basePanel;
    const manualIndex=this.manualPanelOffset+Math.floor(Math.max(0,this.manualElapsedMs-this.manualPanelEpoch)/cycleMs);
    const panel=page==='refueling'?'fuel':(page==='drive'||page==='reverse')?drivePanel:
      MANUAL_PANELS[page]?MANUAL_PANELS[page][manualIndex%MANUAL_PANELS[page].length]:page==='brake'||page==='braking'?'braking':'fuel';
    const selectable=pendingAlerts.some(a=>a.critical)?pendingAlerts.filter(a=>a.critical):pendingAlerts;
    const activeAlert=selectable[Math.floor(now/(cfg.warningRotationSeconds*1000))%selectable.length]||null;
    const telemetry=new TelemetryState(p,kmh,gear),context=this.context.update(telemetry,now),quick=this.quick.resolve(telemetry,context,{...cfg,bindingPage:this.bindingPage,section:this.section,ackAvailable:page==='alert'&&!!activeAlert,ackId:activeAlert?.id},now);
    const consumptionL100=p.paused?this.consumption.output:this.consumption.update(fuel,odo,p.seq);
    return this.lastRendered={ now,page, p, kmh, rpm, gear, fuelPercent, alerts, alertId, urgent,carouselIndex,manualRevision:this.manualRevision,gForce:this.gForce.update(p),
      mode: this.manual ? 'MANUAL' : 'AUTO', trip: odo === null ? null : Math.max(0, odo - this.tripBase),
      inputReady: fresh && p.input && (!p.paused || cfg.bindingMode),overspeed:this.overspeedActive,
      adblue,adbluePercent,adblueRefilling,acknowledgedWarnings:alerts.filter(a=>a.acknowledged),refueling,braking,brakeActive,brakeForce:brake,panel,context,quick,section:this.section,manualRemainingMs:this.manualRemainingMs,consumptionL100,warningQueue:alerts,activeAlert,warningIndex:activeAlert?alerts.indexOf(activeAlert)+1:0,tollNotice };
  }
}
function isDefaultCarousel(v){return !!v&&['drive','reverse'].includes(v.page)&&(!v.connectionState||v.connectionState==='CONNECTED');}
function isInformationCarousel(v){return isDefaultCarousel(v)||!!(v&&MANUAL_PANELS[v.page]&&(!v.connectionState||v.connectionState==='CONNECTED'));}
module.exports = { DEFAULTS, settings, decode, value, yes, Dashboard, PAGES,TripConsumption,BRAKE_THRESHOLD,isDefaultCarousel,isInformationCarousel,MANUAL_PANELS };
