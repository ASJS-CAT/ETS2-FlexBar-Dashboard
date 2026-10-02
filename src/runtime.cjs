'use strict';
const dgram=require('node:dgram');
const {performance}=require('node:perf_hooks');
const {settings,decode,isDefaultCarousel,isInformationCarousel}=require('./model.cjs');
const {LAYOUT}=require('./layout.cjs');
const {RallySession}=require('./rally-session.cjs');
const {probeGameProcess}=require('./game-process.cjs');
const {Touch,Inputs,PAGE_SELECTOR,hit}=require('./interaction.cjs');
const {render}=require('./render.cjs');
const CID='com.local.ets2rally.dashboard';
const sameCarousel=(a,b)=>isInformationCarousel(a)&&isInformationCarousel(b)&&(a.page===b.page||isDefaultCarousel(a)&&isDefaultCarousel(b));
function startRuntime(plugin,logger,options={}) {
  const telemetryPort=options.portBase||29762,commandPort=telemetryPort+1;
  if(!Number.isInteger(telemetryPort)||telemetryPort<1024||telemetryPort>65534)throw Error('Invalid telemetry port');
  const clock=options.clock||(()=>performance.now());
  const socket=options.socket||dgram.createSocket('udp4');
  const sessions=new Map(), savedViews=new Map(), inputs=new Inputs(), transitions=[];
  let hostConnected=true,probePending=false,nextProbe=0;
  const log=(event,detail={})=>{const entry={at:new Date().toISOString(),event,...detail};transitions.push(entry);if(transitions.length>80)transitions.shift();logger.info?.('Rally lifecycle',entry);};
  const rally=new RallySession(log);
  let cfg=settings(), packet=null, received=-Infinity, ready=false, stopped=false, error='', timer;
  const stats={alive:0,activated:0,received:0,draws:0,drawErrors:0,touchEvents:0,touchActions:0,udpDatagrams:0,udpRejectedSource:0,udpRejectedPacket:0};
  const report=e=>{ error=String(e?.message||e).split(', payload:')[0]; logger.error(error); };
  function invalidate(reason){
    for(const s of sessions.values()){s.revision=(s.revision||0)+1;s.next=0;s.lastImage=null;s.lastDraw=-Infinity;s.dirty=true;}
    log('view.invalidate',{reason,state:rally.state});tick();
  }
  function configure(raw) { const entering=!cfg.bindingMode&&raw?.bindingMode===true;cfg=settings(raw);inputs.clear();if(entering)rally.dash.bindingPage=0;rally.refreshLocal(cfg);invalidate('configuration_updated');return cfg; }
  function session(serial,key,reason='view_activated') {
    let s=savedViews.get(serial);
    if(!s){s={key,touch:new Touch(),busy:false,next:0,lastImage:null,lastDraw:-Infinity,view:null,pressed:null};
      Object.defineProperty(s,'dash',{get:()=>rally.dash});savedViews.set(serial,s);}
    s.revision=(s.revision||0)+1;s.dirty=true;s.deviceDisconnected=false;s.key=key;s.touch=new Touch();s.pressed=null;s.presented=null;s.ackDashboard=null;s.next=0;s.lastImage=null;s.lastDraw=-Infinity;
    sessions.set(serial,s);log('view.activate',{serial,uid:key.uid,...rally.status(),reason});
    tick();return s;
  }
  function unmount(serial,reason){
    const s=sessions.get(serial);if(!s)return;
    s.touch=new Touch();s.pressed=null;sessions.delete(serial);inputs.clear();
    log('view.deactivate',{serial,uid:s.key.uid,...rally.status(),reason});
  }
  function restore(reason){
    if(!hostConnected)return;
    for(const [serial,s]of savedViews)if(!s.deviceDisconnected)session(serial,s.key,reason);
  }
  function foreground(value,reason){
    if(rally.setForeground(value,reason)&&value)restore('game_foreground_return');
    inputs.clear();
  }
  plugin.on('system.actwin',payload=>{
    const owner=payload?.newWin?.owner;
    log('host.focus',{processId:owner?.processId??null,fields:Object.keys(payload||{})});
    if(owner&&Number.isInteger(rally.packet?.processId))foreground(owner.processId===rally.packet.processId,'system.actwin');
  });
  plugin.on('plugin.alive',({serialNumber,keys=[]})=>{
    stats.alive++;logger.info?.('Instrument keys alive', {serialNumber,keys:keys.map(k=>({cid:k.cid,uid:k.uid}))});
    const key=keys.find(k=>k.cid===CID); if(key) session(serialNumber,key,'plugin.alive');else log('view.registration_retained',{serial:serialNumber,reason:'alive_without_matching_key'});
    // Do not block page lifecycle on a configuration RPC.
    Promise.resolve(plugin.getConfig()).then(configure).catch(report);
  });
  // The Direct Draw activation key is also documented as arriving through
  // plugin.data. Starting only on alive misses hosts that activate this way.
  plugin.on('plugin.data',({serialNumber,data})=>{
    if(data?.key?.cid!==CID)return;
    stats.activated++;session(serialNumber,data.key);
    logger.info?.('Direct Draw activated', {serialNumber});
  });
  plugin.on('plugin.dead',({serialNumber,keys=[]})=>{
    const s=sessions.get(serialNumber);
    if(s && keys.some(k=>k.uid===s.key.uid)) {unmount(serialNumber,'plugin.dead');}
  });
  plugin.on('device.status',devices=>{
    for(const d of Array.isArray(devices)?devices:[]){const s=savedViews.get(d.serialNumber);if(!s)continue;
      if(d.status==='disconnected'){s.deviceDisconnected=true;s.touch=new Touch();inputs.clear();log('device.transport',{serial:d.serialNumber,state:'disconnected',keysRetained:true});}
      else if(d.status==='connected'){s.deviceDisconnected=false;session(d.serialNumber,s.key,'device_reconnected');}}
    options.onDeviceStatus?.(devices);
  });
  // FlexDesigner sends the settings object directly; older adapters wrap it.
  plugin.on('plugin.config.updated',p=>configure(p?.config??p));
  plugin.on('device.touch',e=>{
    stats.touchEvents++;
    const s=sessions.get(e.serialNumber); if(!s||s.deviceDisconnected||!hostConnected) return;
    const now=clock(),v=rally.advance(now,cfg);
    let controls=[PAGE_SELECTOR,...(v.quick?.controls||[])];
    const shownCarousel=s.presented?.view;
    if(sameCarousel(v,shownCarousel))controls.push({id:'carousel_next',local:true,x:LAYOUT.dataStart,w:LAYOUT.controlsStart-LAYOUT.dataStart});
    if(e.state==='down')s.carouselDown=sameCarousel(v,shownCarousel)?{view:shownCarousel,dashboard:rally.dash}:null;
    if(e.state==='down'){
      // Rotation can advance on this very event, before that warning is drawn.
      // Bind ACK to the last successfully delivered Direct Draw frame instead.
      const shown=s.presented?.view,button=hit(e.x,e.y,shown?.quick?.controls||[]);
      s.ackDashboard=null;
      controls=controls.filter(c=>c.id!=='ack');
      if(shown?.page==='alert'&&button?.id==='ack'){
        controls=[{...button}];s.ackDashboard=s.presented.dashboard;
      }
      if(shown?.page==='alert')log('warning.touch',{serial:e.serialNumber,x:e.x,y:e.y,hit:hit(e.x,e.y,controls)?.id??null,displayedWarning:shown.activeAlert?.id??null});
    }
    const held=s.touch.down?.button,action=s.touch.event(e,now,controls);s.next=0;
    if(!action){
      if(held?.id==='ack'&&!s.touch.down)log('warning.ack_cancelled',{serial:e.serialNumber,warningId:held.warningId,reason:'gesture_cancelled',state:e.state});
      return;
    }
    if(action.feedback){Promise.resolve(plugin.sendControlCommand?.(e.serialNumber,'haptic.click')).catch(err=>logger.warn?.(err.message));return;}
    if(action.cancelled)return;
    stats.touchActions++;
    if(action.id==='section_next') {if(action.long)rally.resetTrip();else s.dash.nextSection();}
    else if(action.id==='carousel_next'){
      if(s.carouselDown?.dashboard!==rally.dash||!sameCarousel(v,s.carouselDown.view))return;
      s.dash.nextInformationPage(rally.now,cfg,s.carouselDown.view);s.carouselDown=null;
    }
    else if(action.id==='bind_next')s.dash.nextBinding();
    else if(action.id==='auto') s.dash.auto();
    else if(action.id==='ack') {
      const pending=v.alerts?.some(a=>a.id===action.warningId&&!a.acknowledged);
      if(s.ackDashboard!==rally.dash||v.page!=='alert'||!pending){
        log('warning.ack_cancelled',{serial:e.serialNumber,warningId:action.warningId,reason:'warning_no_longer_pending'});return;
      }
      s.dash.acknowledge(action.warningId);
      log('warning.ack',{serial:e.serialNumber,warningId:action.warningId,remaining:v.alerts.filter(a=>!a.acknowledged&&a.id!==action.warningId).map(a=>a.id)});
    }
    else if(action.id==='map_job')s.dash.select('job',rally.now,cfg);
    else if(action.id==='trailer_info')s.dash.select('trailer',rally.now,cfg);
    else if(action.id==='brake_info')s.dash.select('brake',rally.now,cfg);
    else if(v.inputReady) inputs.pulse(action.bit,now);
    // This is a short interaction acknowledgement only. Persistent ON/OFF
    // styling is always recalculated from telemetry in TelemetryState.
    rally.refreshLocal(cfg);s.pressed={id:action.id,until:now+180};
  });
  plugin.on('ui.message',p=>{
    if(p.action==='preferences')return cfg;
    const status=()=>({error,connected:rally.state==='CONNECTED'||rally.state==='PAUSED',
      rally:rally.status(),lifecycle:{hostConnected,views:[...savedViews].map(([serial,s])=>({serial,uid:s.key.uid,active:sessions.has(serial),uiMode:s.view?.page,section:rally.dash.section})),transitions},
      paused:packet?.paused, input:packet?.input, activeSessions:sessions.size,config:cfg,udpBound:ready,
      host:options.getDiagnostics?.()||null,fonts:require('./fonts.cjs').fontDiagnostics,telemetryText:Object.fromEntries(Object.entries(packet?.values||{}).filter(([k,v])=>typeof v==='string')),lights:Object.fromEntries(Object.entries(packet?.values||{}).filter(([k])=>k.startsWith('truck.light.'))),
      stats:{...stats},rpm:{sdkLimit:packet?.values?.['rpm.limit']??null,dialMax:cfg.rpmScaleMax||packet?.values?.['rpm.limit']||2500},version:'1.0.1',lastPacketAgeMs:Number.isFinite(received)?Math.round(clock()-received):null});
    if(p.action==='status')return options.refreshDiagnostics?options.refreshDiagnostics().then(status):status();
    return {error:'Unknown action'};
  });
  socket.on('message',(b,rinfo)=>{
    stats.udpDatagrams++;
    if(rinfo.address!=='127.0.0.1'||rinfo.port!==commandPort){stats.udpRejectedSource++;return;}
    const decoded=decode(b);if(!decoded){stats.udpRejectedPacket++;return;}
    const oldForeground=rally.foreground,oldState=rally.state,oldIdentity=rally.id;packet=decoded;received=clock();stats.received++;
    rally.accept(packet,received,cfg);
    if(packet.foreground===true&&oldForeground!==true)restore('bridge_foreground_return');
    if(oldState!==rally.state||oldIdentity!==rally.id)invalidate('telemetry_state_changed');
  });
  socket.on('error',e=>{
    ready=false;inputs.clear();report(e);
    // A host restart can leave an earlier process holding the telemetry port.
    // Never let a second, telemetry-less instance keep painting OFFLINE frames.
    if(e.code==='EADDRINUSE'){stop();options.onPortConflict?.();}
  });
  socket.bind(telemetryPort,'127.0.0.1',()=>{ready=true;logger.info?.(`Telemetry listener ready: 127.0.0.1:${telemetryPort}`);});
  function tick() {
    if(stopped)return;
    const now=clock();rally.advance(now,cfg);
    if(rally.state==='STALE'&&!probePending&&now>=nextProbe){
      probePending=true;nextProbe=now+2000;const identity=rally.packet;
      Promise.resolve().then(()=>(options.probeProcess||probeGameProcess)(identity)).then(alive=>{
        if(stopped||rally.packet!==identity)return;
        if(alive===false){rally.processExited('os_process_exited_or_replaced');packet=rally.packet;inputs.clear();rally.advance(clock(),cfg);invalidate('confirmed_process_exit');}
        else if(alive===true)rally.processAlive=true;
        else if(rally.processAlive!==null){rally.processAlive=null;log('process.unknown',{reason:'identity_probe_unavailable'});}
      }).catch(e=>log('process.unknown',{reason:e.message})).finally(()=>{probePending=false;});
    }
    const enabled=hostConnected && [...sessions.values()].some(s=>!s.deviceDisconnected) && (rally.hasTelemetry||(cfg.bindingMode&&packet?.paused)) && packet?.input && packet.connected && now-received<1500 && (!packet.paused||cfg.bindingMode);
    if(ready)socket.send(inputs.packet(now,enabled),commandPort,'127.0.0.1',e=>{if(e)report(e);});
    for(const [serial,s] of sessions) {
      if(!hostConnected||s.deviceDisconnected||s.busy||now<s.next)continue;
      s.next=now+1000/cfg.fps;
      const previousPage=s.view?.page;s.view=rally.view(cfg);
      if(previousPage!==s.view.page)log('ui.mode',{serial,from:previousPage??null,to:s.view.page,reason:rally.reason,sessionId:rally.id});
      s.view.hold=s.touch.progress(now);
      s.view.pressed=s.touch.down?.button?.id==='ack'?{id:'ack'}:s.pressed&&now<s.pressed.until?s.pressed:null;
      try {
        const image=render(s.view,cfg,now).toDataURL('image/png');
        // An RPC acknowledgement can precede the hardware page becoming ready.
        // Resend a full frame every second even when telemetry is unchanged.
        const force=now-s.lastDraw>=1000;
        if(image===s.lastImage&&!force)continue;
        s.busy=true;s.dirty=false;const revision=s.revision,drawnView=s.view,drawnDashboard=rally.dash;
        // At most one outstanding draw per device: no growing USB/WebSocket queue.
        // The host entry is an explicit launcher, independent of dashboard status.
        const drawDirect=()=>{
          if(stopped||!hostConnected||s.deviceDisconnected||sessions.get(serial)!==s||s.revision!==revision)return;
          return Promise.resolve(plugin.directDraw(serial,s.key,image,force?false:cfg.diffUpdate,0))
            .then(()=>{stats.draws++;if(!stopped&&hostConnected&&!s.deviceDisconnected&&sessions.get(serial)===s&&s.revision===revision)s.presented={view:drawnView,dashboard:drawnDashboard};});
        };
        // The manifest supplies the bilingual launcher before activation.
        // Never send ordinary key draws here: they replace the host's DirectDraw
        // touch surface while its framebuffer continues to look correct.
        Promise.resolve(drawDirect())
          .then(()=>{if(s.revision===revision){s.lastImage=image;s.lastDraw=clock();}})
          .catch(e=>{stats.drawErrors++;report(e);})
          .finally(()=>{s.busy=false;if((s.dirty||s.revision!==revision)&&sessions.get(serial)===s){s.next=0;tick();}});

      } catch(e) {s.busy=false;stats.drawErrors++;report(e);}
    }
  }
  // 25 ms scheduler supports all selected frame rates; controls refresh within the watchdog interval.
  timer=setInterval(tick,25);
  function disconnected(){hostConnected=false;for(const serial of [...sessions.keys()])unmount(serial,'host_transport_closed');log('plugin.transport',{state:'disconnected'});}
  function connected(){hostConnected=true;log('plugin.transport',{state:'connected'});restore('host_transport_reconnected');}
  function stop() {
    if(stopped)return;stopped=true;clearInterval(timer);inputs.clear();sessions.clear();
    if(ready)socket.send(inputs.packet(clock(),false),commandPort,'127.0.0.1',()=>socket.close());
    else {try{socket.close();}catch{}}
  }
  return {stop,tick,sessions,savedViews,rally,configure,disconnected,connected};
}
module.exports={startRuntime,CID};

