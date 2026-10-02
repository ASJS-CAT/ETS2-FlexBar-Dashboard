'use strict';
// Observe message metadata only. Never retain images, input values or page content.
function diagnostics(plugin,configure) {
  const transport=plugin.transport;
  const state={websocketOpen:false,hardware:null,hardwareError:'',configLoaded:false,configError:'',wakeAttempted:0,wakeSucceeded:0,wakeError:'',events:{},lastEvent:null};
  let pending,configured={wakeOnStart:true};const woken=new Set();
  function observe(raw) {
    try {
      const m=JSON.parse(String(raw));
      if(transport.pendingCalls[m.uuid])return;
      const type=String(m.type||'(missing)').slice(0,80);
      if(Object.keys(state.events).length<32 || Object.hasOwn(state.events,type))state.events[type]=(state.events[type]||0)+1;
      if(type==='ui.message'||type==='device.touch')return;
      const p=m.payload, keys=p?.keys || (p?.data?.key?[p.data.key]:[]);
      state.lastEvent={type,payloadFields:p&&typeof p==='object'?Object.keys(p).slice(0,20):[],
        keys:Array.isArray(keys)?keys.slice(0,20).map(k=>({cid:k?.cid,pluginID:k?.pluginID,keyType:k?.cfg?.keyType,uid:k?.uid})):[]};
    } catch { /* The official transport reports malformed messages. */ }
  }
  function refresh() {
    state.websocketOpen=transport.ws?.readyState===1;
    if(!state.websocketOpen)return Promise.resolve();
    if(pending)return pending;
    pending=Promise.allSettled([
      transport.call('api-call',{api:'getDeviceStatus',args:null},1500).then(value=>{
        state.hardware=Array.isArray(value)?value.map(d=>({serialNumber:d.serialNumber,connected:d.connected,connecting:d.connecting,status:d.status,fwVersion:d.fwVersion})):null;
        state.hardwareError=Array.isArray(value)?'':'Unexpected device status response';
      }).catch(e=>{state.hardware=null;state.hardwareError=e.message;}),
      transport.call('api-call',{api:'getPluginConfig',pluginID:plugin.uuid},1500).then(value=>{
        configured=configure(value)||value||configured;state.configLoaded=true;state.configError='';
      }).catch(e=>{state.configLoaded=false;state.configError=e.message;})
    ]).finally(()=>{pending=null;});
    return pending;
  }
  async function wakeDevices(devices=state.hardware) {
    if(configured.wakeOnStart===false)return;
    for(const d of Array.isArray(devices)?devices:[]){
      const serial=d?.serialNumber;if(!serial||woken.has(serial))continue;
      woken.add(serial);state.wakeAttempted++;
      try{await plugin.sendControlCommand(serial,'sys.wake');state.wakeSucceeded++;state.wakeError='';}
      catch(e){woken.delete(serial);state.wakeError=e.message;}
    }
  }
  async function wake(){await refresh();await wakeDevices();}
  function disconnected(){woken.clear();state.websocketOpen=false;}
  return {state,observe,refresh,wake,wakeDevices,disconnected};
}
module.exports={diagnostics};
