'use strict';
const {plugin,logger}=require('@eniac/flexdesigner');
const {startRuntime}=require('./runtime.cjs');
const {diagnostics}=require('./diagnostics.cjs');
let diagnostic;
const runtime=startRuntime(plugin,logger,{portBase:process.env.ETS2_FLEXBAR_TEST_PORT_BASE?Number(process.env.ETS2_FLEXBAR_TEST_PORT_BASE):29762,
  onPortConflict:()=>{logger.error('Another dashboard instance owns the telemetry port; stopping this instance.');process.exit(0);},
  refreshDiagnostics:()=>diagnostic.refresh(),getDiagnostics:()=>diagnostic.state,
  onDeviceStatus:devices=>diagnostic.wakeDevices(devices)});
diagnostic=diagnostics(plugin,runtime.configure);
// SDK 1.0.9 schedules an unbound start callback on both close and error.
// Keep the official transport and protocol, but own a single reconnect timer.
const transport=plugin.transport, originalStart=transport.start.bind(transport);
let retry=null, ending=false;
transport.start=function(){
  if(ending || transport.ws?.readyState===0 || transport.ws?.readyState===1)return;
  originalStart();
  transport.ws.prependListener('message',diagnostic.observe);
  transport.ws.on('open',()=>{diagnostic.state.websocketOpen=true;runtime.connected();diagnostic.wake();});
  transport.ws.removeAllListeners('close');transport.ws.removeAllListeners('error');
  const reconnect=e=>{
    if(e)logger.warn(e.message);
    runtime.disconnected();
    diagnostic.disconnected();
    if(!ending && !retry)retry=setTimeout(()=>{retry=null;transport.start();},2000);
  };
  transport.ws.on('close',()=>reconnect());transport.ws.on('error',reconnect);
};
plugin.start();
function stop(){ending=true;clearTimeout(retry);runtime.stop();transport.ws?.close();setTimeout(()=>process.exit(0),100).unref();}
process.once('SIGINT',stop);process.once('SIGTERM',stop);
