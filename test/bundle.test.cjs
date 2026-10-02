const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs'),dgram=require('node:dgram');
const {spawn}=require('node:child_process'),{WebSocketServer}=require('ws');
const {drive}=require('./fixtures.cjs');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=7000){const end=Date.now()+ms;while(!fn()){if(Date.now()>end)throw Error('Timed out waiting for integration condition');await delay(20);}}
test('built backend runs through real SDK WebSocket protocol and loopback telemetry', {timeout:20000},async()=>{
  const root=path.resolve(__dirname,'..'),dir=path.join(root,'com.local.ets2rally.plugin');
  assert.ok(fs.existsSync(path.join(dir,'backend/plugin.cjs')),'Run npm run build first');
  const server=new WebSocketServer({port:0,host:'127.0.0.1'});await new Promise(r=>server.once('listening',r));
  const udp=dgram.createSocket('udp4');await new Promise((r,j)=>{udp.once('error',j);udp.bind(39763,'127.0.0.1',r);});
  let client,draws=[],masks=[],output='',timer,child;
  let state=drive();
  udp.on('message',b=>{if(b.length===8)masks.push(b.readUInt32LE(4));});
  const send=(type,payload)=>client.send(JSON.stringify({type,payload,uuid:Math.random().toString(16)}));
  let connections=0,initialStatus;
  server.on('connection',ws=>{client=ws;connections++;
    ws.on('message',data=>{
      const m=JSON.parse(data);
      if(m.type==='startup'){
        if(connections===1)ws.send(JSON.stringify({type:'ui.message',payload:{action:'status'},uuid:'diagnose'}));
        // No alive or tap after reconnect: cached lifecycle must request restoration itself.
      }
      if(m.type==='response' && m.uuid==='diagnose')initialStatus=m.payload;
      if(m.type==='api-call' && m.payload.api==='getPluginConfig')ws.send(JSON.stringify({uuid:m.uuid,status:'success',payload:{fps:15}}));
      if(m.type==='api-call' && m.payload.api==='getDeviceStatus')ws.send(JSON.stringify({uuid:m.uuid,status:'success',payload:[{serialNumber:'TEST',connected:true}]}));
      if(m.type==='control-command')ws.send(JSON.stringify({uuid:m.uuid,status:'success',payload:true}));
      if(m.type==='draw')ws.send(JSON.stringify({uuid:m.uuid,status:'success',payload:true}));
      if(m.type==='direct-draw'){
        draws.push(m.payload);
        ws.send(JSON.stringify({uuid:m.uuid,status:'success',payload:true}));
      }
    });
  });
  try{
    const runDir=path.join(root,'build/test-run');fs.mkdirSync(runDir,{recursive:true});
    child=spawn(process.execPath,[path.join(dir,'backend/plugin.cjs'),`--port=${server.address().port}`,'--uid=com.local.ets2rally',`--dir=${dir}`],{cwd:runDir,windowsHide:true,env:{...process.env,ETS2_FLEXBAR_TEST_PORT_BASE:"39762"}});
    child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
    await until(()=>initialStatus);
    assert.equal(initialStatus.activeSessions,0);assert.equal(initialStatus.host.hardware[0].connected,true);
    assert.equal(initialStatus.host.configLoaded,true);assert.equal(initialStatus.stats.draws,0);
    send('plugin.alive',{serialNumber:'TEST',keys:[{cid:'com.local.ets2rally.dashboard',uid:7}]});
    await until(()=>draws.length>0);
    const png=Buffer.from(draws.at(-1).data.split(',')[1],'base64');
    assert.equal(png.readUInt32BE(16),2170);assert.equal(png.readUInt32BE(20),60);
    assert.equal(draws[0].serialNumber,'TEST');assert.equal(draws[0].offsetX,0);
    timer=setInterval(()=>udp.send(Buffer.from(JSON.stringify(state)),39762,'127.0.0.1'),50);
    await until(()=>draws.some(d=>d.data!==draws[0].data));
    send('device.touch',{serialNumber:'TEST',state:'down',x:2080,y:20});await delay(70);
    send('device.touch',{serialNumber:'TEST',state:'up',x:2080,y:20});
    await until(()=>masks.includes(1));await delay(300);assert.equal(masks.at(-1),0);
    state.paused=true;await delay(150);const before=masks.length;
    send('device.touch',{serialNumber:'TEST',state:'down',x:2080,y:20});await delay(70);
    send('device.touch',{serialNumber:'TEST',state:'up',x:2080,y:20});await delay(100);
    assert.ok(masks.slice(before).every(m=>m===0),'Paused controls must release');
    const beforeReconnect=draws.length;client.close();await until(()=>connections===2,6000);await until(()=>draws.length>beforeReconnect);
    assert.equal(child.exitCode,null,output);
    assert.ok(!output.includes('TypeError'),output);
  }catch(e){e.message+='\nBackend output:\n'+output;throw e;}
  finally{
    clearInterval(timer);if(child){child.kill();await new Promise(r=>{if(child.exitCode!==null)r();else child.once('exit',r);});}
    for(const ws of server.clients)ws.terminate();await new Promise(r=>server.close(r));udp.close();
  }
});


