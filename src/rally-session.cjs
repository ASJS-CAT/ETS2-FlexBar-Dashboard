'use strict';
const {Dashboard,value}=require('./model.cjs');

// The game session outlives every FlexDesigner view and transport connection.
class RallySession {
  constructor(log=()=>{}) {
    this.log=log;this.dash=new Dashboard();this.packet=null;this.received=-Infinity;
    this.id=null;this.state='WAITING';this.processAlive=null;this.foreground=null;
    this.now=0;this.lastTick=null;this.elapsedDrivingMs=0;this.cached=null;
    this.lastTelemetryTimestamp=null;this.reason='startup';this.everConnected=false;this.hasTelemetry=false;
    this.dash.consumption.log=(reason)=>this.log('trip.baseline',{reason});
  }
  transition(state,reason){
    if(state===this.state)return;
    const from=this.state;this.state=state;this.reason=reason;
    this.log('session.state',{from,to:state,reason,sessionId:this.id,processAlive:this.processAlive,foreground:this.foreground,hasTelemetry:this.hasTelemetry,telemetryConnected:!!this.packet?.connected,lastTelemetryTimestamp:this.lastTelemetryTimestamp,uiMode:this.cached?.page??null});
  }
  accept(packet,now,cfg){
    // Advance the old state before adopting a fresh packet: a 60 s silence
    // must not become 60 s of page timers or driving time on the next frame.
    this.advance(now,cfg);
    const id=typeof packet.sessionId==='string'&&packet.sessionId?packet.sessionId:null;
    if(packet.connected&&((id&&this.id&&id!==this.id)||(this.everConnected&&this.state==='DISCONNECTED'))){
      const reason=id&&this.id&&id!==this.id?'bridge_session_changed':'sdk_reconnected_after_confirmed_disconnect';
      this.log('session.reset',{reason,oldSessionId:this.id,newSessionId:id});
      this.log('trip.reset',{reason,fuelUsed:this.dash.consumption.fuelUsed,distance:this.dash.consumption.distance});
      this.dash=new Dashboard();this.dash.consumption.log=(r)=>this.log('trip.baseline',{reason:r});
      this.cached=null;this.elapsedDrivingMs=0;this.now=0;this.hasTelemetry=false;
    }
    if(packet.connected)this.everConnected=true;
    if(id)this.id=id;
    if(packet.connected&&['truck.speed','truck.engine.rpm','truck.odometer'].some(k=>Number.isFinite(value(packet,k))))this.hasTelemetry=true;
    this.packet=packet;this.received=now;this.lastTelemetryTimestamp=new Date().toISOString();
    this.processAlive=Number.isInteger(packet.processId)?true:this.processAlive;
    if(typeof packet.foreground==='boolean')this.setForeground(packet.foreground,'bridge_foreground');
    this.advance(now,cfg);
  }
  setForeground(foreground,reason){
    if(this.foreground===foreground)return false;
    this.foreground=foreground;this.log('game.focus',{foreground,reason,sessionId:this.id});return true;
  }
  processExited(reason){
    this.processAlive=false;
    if(this.packet)this.packet={...this.packet,connected:false,input:false};
    this.transition('DISCONNECTED',reason);
  }
  advance(now,cfg){
    const p=this.packet,age=now-this.received;
    const next=!p?'WAITING':!p.connected?'DISCONNECTED':age>=1500?'STALE':p.paused?'PAUSED':!this.hasTelemetry?'WAITING':'CONNECTED';
    const active=next==='CONNECTED',delta=this.lastTick===null?0:Math.max(0,now-this.lastTick);
    if(active&&this.state==='CONNECTED'){
      this.now+=delta;
      if(Math.abs(value(p,'truck.speed')||0)*3.6>=1)this.elapsedDrivingMs+=delta;
    }
    this.lastTick=now;
    this.transition(next,next==='STALE'?'telemetry_silent':next==='DISCONNECTED'?(this.processAlive===false?this.reason:'sdk_closed'):next==='PAUSED'?'sdk_paused':'telemetry_packet');
    const oldPage=this.cached?.page;
    if(active){this.cached=this.dash.view(p,this.now,this.now,cfg);}
    else if(!this.cached||next==='WAITING'||next==='DISCONNECTED'||(next==='PAUSED'&&cfg.bindingMode)){
      this.cached=this.dash.view(next==='PAUSED'?p:null,this.now,this.now,cfg);
    }
    if(oldPage!==this.cached?.page)this.log('session.ui',{from:oldPage??null,to:this.cached?.page,reason:this.reason,sessionId:this.id});
    return this.view(cfg);
  }
  view(cfg){
    const base=this.cached||this.dash.view(null,0,0,cfg);
    const frozen=['STALE','PAUSED'].includes(this.state);
    const paused=this.state==='PAUSED'||(this.state==='STALE'&&this.packet?.paused);
    return {...base,page:paused?'paused':base.page,p:paused?{...(base.p||this.packet),paused:true}:frozen&&base.p?{...base.p,paused:true}:base.p,
      connectionState:this.state,foreground:this.foreground,
      inputReady:this.state==='CONNECTED'?!!this.packet?.input:
        this.state==='PAUSED'&&cfg.bindingMode&&!!this.packet?.input};
  }
  refreshLocal(cfg){
    if(this.cached?.p&&['CONNECTED','PAUSED','STALE'].includes(this.state))
      this.cached=this.dash.view(this.cached.p,this.now,this.now,cfg);
  }
  resetTrip(){this.log('trip.reset',{reason:'user_explicit_reset',sessionId:this.id});this.dash.resetTrip(this.packet);this.elapsedDrivingMs=0;}
  status(){return {sessionId:this.id,state:this.state,reason:this.reason,processId:this.packet?.processId??null,processAlive:this.processAlive,
    foreground:this.foreground,hasTelemetry:this.hasTelemetry,telemetryConnected:!!this.packet?.connected,lastTelemetryTimestamp:this.lastTelemetryTimestamp,
    lastActivePage:this.cached?.page??null,lastRallyPage:this.dash.manual||'auto',section:this.dash.section,
    trip:{fuelConsumed:this.dash.consumption.fuelUsed,distanceTravelled:this.dash.consumption.distance,
      elapsedDrivingMs:this.elapsedDrivingMs,averageConsumption:this.dash.consumption.output}};}
}
module.exports={RallySession};
