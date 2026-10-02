'use strict';
const val=(p,k)=>p?.values?.[k]??null,yes=(p,k)=>val(p,k)===1;
const INPUT_BITS={lights:0,wipers:1,cruise:2,hazard:3,retarder:4,horn:5,engine:6,parking:7,axle:8,diff:9,trailer:10,mirror:11,camera:12,trailer_brake:13};
const LOCAL=new Set(['auto','ack','trailer_info','map_job','brake_info','bind_next']);
const STATIC_IDS=['auto','brake_info','lights','wipers','cruise','hazard','retarder','horn'];
const BINDING_PAGES=[
  ['lights','wipers','cruise','hazard','retarder','horn'],
  ['engine','parking','axle','diff','trailer_brake','trailer'],
  ['camera','mirror']
];
const LABELS={auto:'AUTO',ack:'ACK',lights:'LIGHT',wipers:'WIPER',cruise:'CRUISE',hazard:'HAZARD',retarder:'RET',horn:'HORN',
  engine:'ENGINE',parking:'PARK',axle:'AXLE',diff:'DIFF',trailer:'DETACH',mirror:'MIRROR',camera:'CAMERA',trailer_brake:'T-BRAKE',
  trailer_info:'T-INFO',map_job:'JOB INFO',brake_info:'BRAKE',bind_next:'NEXT SET'};
const CAPABILITIES={
  lights:'stateful',wipers:'stateful',cruise:'stateful',hazard:'stateful',retarder:'stateful',engine:'stateful',parking:'stateful',axle:'stateful',diff:'stateful',
  horn:'momentary',mirror:'momentary',camera:'momentary',trailer_brake:'momentary',
  auto:'conditional_action',ack:'conditional_action',trailer:'conditional_action',trailer_info:'conditional_action',map_job:'conditional_action',brake_info:'conditional_action',bind_next:'conditional_action'
};
const PINNABLE=['hazard','parking','lights','engine','axle','diff','trailer_info','map_job'];
class TelemetryState{
  constructor(packet,kmh,gear){this.packet=packet;this.kmh=kmh;this.gear=gear;}
  lightState(){const low=val(this.packet,'truck.light.beam.low'),high=val(this.packet,'truck.light.beam.high'),parking=val(this.packet,'truck.light.parking');return high===1?(low===1?'LOW + HIGH':'HIGH BEAM'):low===1?'LOW BEAM':parking===1?'POSITION':low===0&&high===0?'OFF':'UNKNOWN';}
  lightState(){const low=val(this.packet,'truck.light.beam.low'),high=val(this.packet,'truck.light.beam.high'),parking=val(this.packet,'truck.light.parking');return high===1?(low===1?'LOW + HIGH':'HIGH BEAM'):low===1?'LOW BEAM':parking===1?'POSITION':low===0&&high===0?'OFF':'UNKNOWN';}
  get reversing(){return this.gear!=null&&this.gear<0;}get stopped(){return this.kmh!=null&&this.kmh<1;}
  get parked(){return this.stopped&&yes(this.packet,'truck.brake.parking');}get trailer(){return yes(this.packet,'trailer.connected');}
  get job(){return typeof val(this.packet,'job.destination.city')==='string'||val(this.packet,'truck.navigation.distance')>0;}
  on(id){
    const any=(...keys)=>{const values=keys.map(k=>val(this.packet,k)).filter(v=>v!==null);return values.length?values.some(v=>v>0):null;};
    switch(id){case'lights':return this.lightState()==='UNKNOWN'?null:['LOW BEAM','HIGH BEAM','LOW + HIGH'].includes(this.lightState());case'wipers':return any('truck.wipers');
    case'cruise':return any('truck.cruise_control');case'hazard':return any('truck.hazard.warning');case'retarder':return any('truck.brake.retarder');
    case'engine':return any('truck.engine.enabled');case'parking':return any('truck.brake.parking');case'axle':return any('truck.lift_axle.indicator','truck.trailer.lift_axle.indicator');
    case'diff':return any('truck.differential_lock');default:return null;}}
}
class DrivingContext{
  constructor(){this.flags={DRIVING:true,STOPPED:false,PARKED:false,REVERSING:false,TRAILER_ATTACHED:false,JOB_ACTIVE:false};this.pending=new Map();}
  update(s,now){
    // Separate enter/leave thresholds keep the controls stable while the truck
    // rolls around the 1 km/h boundary.
    const stopped=this.flags.STOPPED?s.kmh!=null&&s.kmh<3:s.stopped;
    const raw={REVERSING:s.reversing,STOPPED:stopped,PARKED:this.flags.STOPPED&&s.on('parking')===true,TRAILER_ATTACHED:s.trailer,JOB_ACTIVE:s.job};
    for(const [name,target]of Object.entries(raw)){
      if(this.flags[name]===target){this.pending.delete(name);continue;}
      const old=this.pending.get(name);if(!old||old.target!==target)this.pending.set(name,{target,since:now});
      else if(now-old.since>=(name==='STOPPED'?600:name==='REVERSING'?150:250)){this.flags[name]=target;this.pending.delete(name);}
    }
    this.flags.DRIVING=!this.flags.STOPPED&&!this.flags.PARKED&&!this.flags.REVERSING;return {...this.flags};
  }
}
const RULES=[
  {when:'PARKED',priority:100,controls:['engine','parking','trailer','axle','diff','lights','map_job']},
  {when:'REVERSING',priority:90,controls:['camera','mirror','hazard','parking','trailer_info','lights']},
  {when:'STOPPED',priority:80,controls:['engine','parking','trailer','lights','hazard','axle','diff','trailer_info']},
  {when:'TRAILER_ATTACHED',priority:60,controls:['trailer_info','axle','trailer_brake','trailer']},
  {when:'JOB_ACTIVE',priority:30,controls:['map_job']},
  {when:'DRIVING',priority:10,controls:['hazard','parking','lights']}
];
function control(id,s,ctx,binding=false){
  const trailerOnly=['trailer','trailer_info','trailer_brake'];if(!binding&&trailerOnly.includes(id)&&!ctx.TRAILER_ATTACHED)return null;
  const capability=CAPABILITIES[id]||'conditional_action';
  const c={id,label:LABELS[id]||id.toUpperCase(),bit:INPUT_BITS[id],local:LOCAL.has(id),capability,on:capability==='stateful'?s.on(id):null};
  if(id==='lights'){c.state=s.lightState();c.label=c.state==='UNKNOWN'?'LIGHT ?':c.state;}
  if(id==='lights'){c.state=s.lightState();c.label=c.state==='UNKNOWN'?'LIGHT ?':c.state;}
  if(id==='trailer'&&binding)c.label='T-COUPLE';
  if(!binding&&id==='engine'&&s.on('engine'))c.holdMs=800;
  if(!binding&&id==='trailer'){if(!ctx.STOPPED||!s.stopped)return null;c.holdMs=800;}
  return c;
}
const STATIC_LAYOUT=[[1450,90],[1540,90],[1630,90],[1720,90],[1810,90],[1900,90],[1990,90],[2080,90]];
function layout(items,staticMode=false){if(staticMode)return items.map((c,i)=>({...c,x:STATIC_LAYOUT[i][0],w:STATIC_LAYOUT[i][1]}));
  const count=Math.max(1,items.length);return items.map((c,i)=>{const x=Math.round(1450+720*i/count),end=Math.round(1450+720*(i+1)/count);return {...c,x,w:end-x};});}
class QuickControlResolver{
  constructor(){this.current=[];this.previous=[];this.signature='';this.changedAt=0;}
  resolve(s,ctx,cfg,now){
    let ids;
    const binding=cfg.bindingMode===true;
    if(binding)ids=[...BINDING_PAGES[(cfg.bindingPage||0)%BINDING_PAGES.length],'bind_next'];
    else if(cfg.quickControlsMode==='static')ids=STATIC_IDS;
    else if(cfg.quickControlsMode==='static')ids=STATIC_IDS;
    else if(ctx.REVERSING)ids=RULES.find(r=>r.when==='REVERSING').controls;
    else if(cfg.section===2)ids=['map_job','trailer_info','brake_info','auto'];
    else if(cfg.section===1)ids=['engine','parking','lights','hazard','axle','diff','trailer','trailer_brake'];
    else if(cfg.quickControlsMode==='static')ids=STATIC_IDS;
    else{
      const ranked=RULES.filter(r=>ctx[r.when]).sort((a,b)=>b.priority-a.priority).flatMap(r=>r.controls);
      if(cfg.quickControlsMode==='hybrid')ranked.unshift(...cfg.pinnedControls);
      ids=[...new Set(ranked)].filter(id=>control(id,s,ctx)).slice(0,8);
      for(const id of ['hazard','parking','lights'])if(ids.length<3&&!ids.includes(id))ids.push(id);
    }
    if(!binding&&cfg.quickControlsMode!=='static'&&cfg.controlOrder?.length){const preferred=cfg.controlOrder.filter(id=>control(id,s,ctx));ids=[...new Set([...(cfg.quickControlsMode==='hybrid'?cfg.pinnedControls:[]),...preferred,...ids])].slice(0,8);}
    if(!binding&&cfg.quickControlsMode!=='static'&&cfg.controlOrder?.length){const preferred=cfg.controlOrder.filter(id=>control(id,s,ctx));ids=[...new Set([...(cfg.quickControlsMode==='hybrid'?cfg.pinnedControls:[]),...preferred,...ids])].filter(id=>control(id,s,ctx)).slice(0,8);}
    if(!binding&&cfg.quickControlsMode!=='static')ids=ids.filter(id=>!cfg.hiddenControls?.includes(id));
    ids=ids.filter(id=>id!=='ack');if(cfg.ackAvailable&&!binding)ids=['ack',...ids].slice(0,8);
    if(cfg.section===3&&!cfg.ackAvailable&&!binding)ids=[];
    const next=layout(ids.map(id=>control(id,s,ctx,binding)).filter(Boolean),!binding&&cfg.quickControlsMode==='static'),signature=next.map(c=>`${c.id}:${c.holdMs||0}`).join('|');
    if(signature!==this.signature){this.previous=this.current;this.current=next;this.signature=signature;this.changedAt=now;}
    else this.current=next; // refresh telemetry-backed states without changing layout
    return {controls:this.current.map(c=>c.id==='ack'?{...c,warningId:cfg.ackId}:c),previous:this.previous.filter(c=>c.id!=='ack'||cfg.ackAvailable),transition:this.previous.length?Math.min(1,(now-this.changedAt)/200):1,context:ctx,binding,bindingPage:binding?(cfg.bindingPage||0):null,bindingPages:BINDING_PAGES.length};
  }
}
module.exports={INPUT_BITS,STATIC_IDS,BINDING_PAGES,PINNABLE,CAPABILITIES,TelemetryState,DrivingContext,QuickControlResolver,RULES};
