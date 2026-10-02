'use strict';
// Documentation composes the production framebuffer; it never redraws its UI.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createCanvas}=require('@napi-rs/canvas');
const {Dashboard,settings,DEFAULTS,MANUAL_PANELS}=require('../src/model.cjs');
const {render}=require('../src/render.cjs');
const {renderLauncher}=require('../src/launcher.cjs');
const {FONT_FAMILY}=require('../src/fonts.cjs');
const {drive}=require('../test/fixtures.cjs');
const {LAYOUT}=require('../src/layout.cjs');
const Q=require('../src/quick-controls.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/assets');
fs.mkdirSync(out,{recursive:true});
function fixture(name,theme='rally'){
 const cfg=settings({theme,language:'en',dashboardLanguage:'en'}),p=drive(),d=new Dashboard();
 p.values['trailer.connected']=1;p.values['truck.effective.throttle']=.47;
 if(name==='offline')p.connected=false;
 if(name==='paused')p.paused=true;
 if(name==='overspeed')p.values['truck.speed']=30;
 if(name==='braking')p.values['truck.input.brake']=.63;
 if(name==='refueling')Object.assign(p.values,{'truck.speed':0,'truck.displayed.gear':0,'truck.engine.rpm':0,'truck.engine.enabled':0,'truck.brake.parking':1});
 for(const t of [0,300,650,1000])d.view(p,t,t,cfg);
 if(name==='job-info')d.select('job',1000,cfg);
 if(name==='trailer-info')d.select('trailer',1000,cfg);
 if(name==='refueling'){p.seq++;p.values['truck.fuel.amount']+=1;p.values['truck.adblue']+=.3;d.view(p,1050,1050,cfg);p.seq++;p.values['truck.fuel.amount']+=1;p.values['truck.adblue']+=.3;}
 return {cfg,packet:p,view:d.view(p,1100,1100,cfg)};
}
const manifest={version:require('../package.json').version,source:'src/render.cjs',dimensions:[2170,60],fixtures:[]},images={};
for(const name of ['rally','mint','amber','offline','paused','driving','overspeed','braking','job-info','trailer-info','refueling']){
 const f=fixture(name,name==='mint'?'el_mint':name==='amber'?'el_amber':'rally');
 const canvas=render(f.view,f.cfg),file=`dashboard-${name}.png`,bytes=canvas.toBuffer('image/png');
 if(canvas.width!==2170||canvas.height!==60)throw Error('Production framebuffer dimensions changed');
 fs.writeFileSync(path.join(out,file),bytes);images[name]=canvas;
 manifest.fixtures.push({file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),page:f.view.page,panel:f.view.panel,theme:f.cfg.theme,packet:f.packet});
}
const expect={offline:'offline',paused:'paused',overspeed:'alert',braking:'braking','job-info':'job','trailer-info':'trailer',refueling:'refueling'};
for(const [name,page]of Object.entries(expect))if(manifest.fixtures.find(f=>f.file===`dashboard-${name}.png`).page!==page)throw Error(`Fixture ${name} did not enter ${page}`);
fs.writeFileSync(path.join(out,'fixtures.json'),JSON.stringify(manifest,null,2)+'\n');
function board(title,height){const canvas=createCanvas(2290,height),c=canvas.getContext('2d');c.fillStyle='#101820';c.fillRect(0,0,canvas.width,height);c.fillStyle='#eff8fa';c.font=`bold 36px ${FONT_FAMILY}`;c.fillText(title,60,65);return {canvas,c};}
function label(c,s,x,y,size=22,color='#a6bbc8'){c.font=`${size}px ${FONT_FAMILY}`;c.fillStyle=color;c.fillText(s,x,y);}
function save(name,b){fs.writeFileSync(path.join(out,name),b.canvas.toBuffer('image/png'));}
for(const zh of [false,true]){
 const lang=zh?'zh-cn':'en',b=board(zh?'ETS2 FlexBar Dashboard / 界面导览':'ETS2 FlexBar Dashboard / Interface guide',720),c=b.c;
 label(c,zh?'生产 Renderer · 2170 × 60 · 原始比例 · 示例遥测数据':'Production renderer · 2170 × 60 · Native scale · Demonstration telemetry',60,105);
 c.drawImage(images.driving,60,155);
 const starts=[0,110,340,425,875,1450],ends=[110,340,425,875,1450,2170];
 const labels=zh?['主题 / 页码','车速 / 踏板','档位','RPM / LED','信息轮询','快捷控制']:['Theme / page','Speed / pedals','Gear','RPM / LEDs','Information carousel','Quick Controls'];
 starts.forEach((x,i)=>{
  const center=60+(x+ends[i])/2;
  c.strokeStyle='#48e7f0';c.beginPath();c.moveTo(center,225);c.lineTo(center,240+i%2*40);c.stroke();
  c.save();c.textAlign='center';label(c,labels[i],center,270+i%2*40,17);c.restore();
 });
 label(c,zh?'轻点左侧页码：01 → 04；长按：重置行程与峰值 G':'Tap the left page indicator: 01 → 04; hold: reset trip and peak G',60,360);
 label(c,zh?'轻点当前信息轮询：下一项；告警 / 制动 / 加注覆盖层不会误翻页':'Tap the visible information carousel: next item; warning / brake / refuel overlays block page taps',60,400);
 label(c,zh?'真实遥测决定按钮持续高亮；发动机关闭与挂车分离需要长按':'Telemetry determines persistent highlights; engine stop and trailer detach require a hold',60,440);
 c.drawImage(images.overspeed,60,490);label(c,zh?'超速提示 3 秒，随后保留速度栏红色提示。ACK 不会修复车辆故障。':'Overspeed banner lasts 3 seconds, followed by red speed indicators. ACK does not repair the truck.',60,595);
 save(`overview-${lang}.png`,b);
 const q=board(zh?'开始使用 / DirectDraw 入口':'Getting started / DirectDraw launcher',620);
 label(q.c,zh?'1  安装 .flexplugin 与游戏桥接 DLL，添加插件到 FlexBar 页面':'1  Install the .flexplugin and game bridge DLL; add the plugin to a FlexBar page',60,125);
 q.c.drawImage(renderLauncher({language:zh?'zh':'en'}),60,160);
 label(q.c,zh?'2  轻点入口一次，进入 DirectDraw 仪表盘':'2  Tap the launcher once to enter the DirectDraw dashboard',60,265);
 q.c.drawImage(images.offline,60,300);
 label(q.c,zh?'3  启动 ETS2 并加载驾驶存档，等待遥测；在游戏内绑定 Flexbar Rally 输入':'3  Start ETS2 and load a driving save; wait for telemetry and bind Flexbar Rally inputs in game',60,405);
 q.c.drawImage(images.driving,60,440);
 label(q.c,zh?'入口图与离线画面含义不同。详见 QUICKSTART.zh-CN.md。':'The launcher and offline screen have different meanings. See QUICKSTART.md.',60,560);
 save(`quickstart-${lang}.png`,q);
}
const cover=board('ETS2 FlexBar Dashboard',610);label(cover.c,'DirectDraw · Live SCS telemetry · Context-aware controls · English / 简体中文',60,115);
for(const [i,name]of ['rally','mint','amber'].entries()){label(cover.c,name.toUpperCase(),60,175+i*125);cover.c.drawImage(images[name],60,195+i*125);}
label(cover.c,'Unofficial community project · Production renderer / demonstration data',60,585,18);save('flexgate-cover.png',cover);
// Machine-readable documentation inputs come directly from production modules.
const scenarios=[];
for(const name of ['DRIVING','STOPPED','PARKED','REVERSING','TRAILER_ATTACHED']){
 const p=drive(),d=new Dashboard(),cfg=settings({dashboardLanguage:'en'});
 if(['STOPPED','PARKED'].includes(name))p.values['truck.speed']=0;
 if(name==='PARKED')p.values['truck.brake.parking']=1;
 if(name==='REVERSING'){p.values['truck.displayed.gear']=-1;p.values['truck.speed']=-1;}
 if(name==='TRAILER_ATTACHED')p.values['trailer.connected']=1;
 let v;for(const t of [0,300,650,1000,1400])v=d.view(p,t,t,cfg);
 scenarios.push({name,context:v.context,controls:v.quick.controls});
}
const catalog=new Map();
for(let section=0;section<4;section++)for(let bindingPage=0;bindingPage<3;bindingPage++)for(const mode of ['static','dynamic']){
 const p=drive();p.values['trailer.connected']=1;p.values['truck.speed']=0;
 const s=new Q.TelemetryState(p,0,0),ctx={DRIVING:false,STOPPED:true,PARKED:true,REVERSING:false,TRAILER_ATTACHED:true,JOB_ACTIVE:true};
 for(const bindingMode of [false,true])for(const ackAvailable of [false,true]){
  const r=new Q.QuickControlResolver().resolve(s,ctx,{...settings(),section,bindingPage,bindingMode,quickControlsMode:mode,ackAvailable},1000);
  for(const ctl of r.controls)if(!catalog.has(ctl.id))catalog.set(ctl.id,ctl);
 }
}
fs.writeFileSync(path.join(root,'docs/ui-structure.json'),JSON.stringify({layout:LAYOUT,manualPanels:MANUAL_PANELS,defaults:DEFAULTS,rules:Q.RULES,static:Q.STATIC_IDS,binding:Q.BINDING_PAGES,inputs:Q.INPUT_BITS,capabilities:Q.CAPABILITIES,scenarios,controls:[...catalog.values()]},null,2)+'\n');
console.log(`Generated ${manifest.fixtures.length} native dashboard images, 5 explanatory images and production UI metadata.`);
module.exports={fixture};
