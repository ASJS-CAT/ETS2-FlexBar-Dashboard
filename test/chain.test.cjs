const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs'),{spawn}=require('node:child_process');
const {WebSocketServer}=require('ws');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(f){for(let i=0;i<250;i++){if(f())return;await delay(20);}throw Error('Full-chain test timed out');}
const root=path.resolve(__dirname,'..'),host=path.join(root,'build/native-host.exe');
test('real DLL -> UDP -> built official SDK backend -> touch -> real Input SDK callback',
  {skip:!fs.existsSync(host),timeout:18000},async()=>{
  const server=new WebSocketServer({port:0,host:'127.0.0.1'});await new Promise(r=>server.once('listening',r));
  let ws,draws=[],hostOutput='',backendOutput='',bridge,backend;
  server.on('connection',client=>{ws=client;ws.on('message',b=>{
    const m=JSON.parse(b);
    if(m.type==='startup')ws.send(JSON.stringify({type:'plugin.alive',uuid:'chain-alive',payload:{serialNumber:'CHAIN',keys:[{cid:'com.local.ets2rally.dashboard',uid:8}]}}));
    if(m.type==='api-call')ws.send(JSON.stringify({uuid:m.uuid,status:'success',payload:m.payload.api==='getPluginConfig'?{quickControlsMode:'static'}:{}}));
    if(m.type==='draw')ws.send(JSON.stringify({uuid:m.uuid,status:'success',payload:true}));
    if(m.type==='direct-draw'){draws.push(m.payload);ws.send(JSON.stringify({uuid:m.uuid,status:'success',payload:true}));}
  });});
  try{
    bridge=spawn(host,[path.join(root,'build/ets2-flexbar-test.dll'),'--stream'],{windowsHide:true,env:{...process.env,ETS2_FLEXBAR_TEST_PORT_BASE:"39762"}});
    bridge.stdout.on('data',b=>hostOutput+=b);bridge.stderr.on('data',b=>hostOutput+=b);
    await until(()=>hostOutput.includes('READY'));
    const dir=path.join(root,'com.local.ets2rally.plugin');
    backend=spawn(process.execPath,[path.join(dir,'backend/plugin.cjs'),`--port=${server.address().port}`,'--uid=com.local.ets2rally',`--dir=${dir}`],{windowsHide:true,env:{...process.env,ETS2_FLEXBAR_TEST_PORT_BASE:"39762"}});
    backend.stdout.on('data',b=>backendOutput+=b);backend.stderr.on('data',b=>backendOutput+=b);
    await until(()=>draws.length>0);await delay(200);
    ws.send(JSON.stringify({type:'device.touch',uuid:'chain-down',payload:{serialNumber:'CHAIN',x:1650,y:20,state:'down'}}));await delay(70);
    ws.send(JSON.stringify({type:'device.touch',uuid:'chain-up',payload:{serialNumber:'CHAIN',x:1650,y:20,state:'up'}}));
    await until(()=>hostOutput.includes('INPUT 1'));
    await until(()=>hostOutput.includes('INPUT 0'));
    assert.equal(backend.exitCode,null,backendOutput);
  }catch(e){e.message+='\n'+hostOutput+'\n'+backendOutput;throw e;}
  finally{
    for(const p of [backend,bridge])if(p){p.kill();await new Promise(r=>{if(p.exitCode!==null)r();else p.once('exit',r);});}
    for(const client of server.clients)client.terminate();await new Promise(r=>server.close(r));
  }
});

