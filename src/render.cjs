'use strict';
const {createCanvas}=require('@napi-rs/canvas');
const {LAYOUT,SPEED,RECTS,rpmScale}=require('./layout.cjs');
const {drawCenteredInk}=require('./typography.cjs');
const {FONT_FAMILY}=require('./fonts.cjs');
const {WIDTH,HEIGHT,CONTROLS}=require('./interaction.cjs');
const {value,yes}=require('./model.cjs');
const {pedalState}=require('./driving-metrics.cjs');
const {themePageLabel,PALETTES,rpmColor,sevenSegment,sevenSegmentWidth,sevenSegmentInkBounds}=require('./themes.cjs');

const {displayTranslator,dashboardLanguage}=require('./i18n.cjs');
function render(v,cfg,now=v.now||0){
  const translate=displayTranslator(dashboardLanguage(cfg));
  const el=cfg.theme==='el_mint'||cfg.theme==='el_amber',C=PALETTES[cfg.theme]||PALETTES.rally;
  const canvas=createCanvas(WIDTH,HEIGHT),c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
  const box=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
  const text=(s,x,y,size=16,color=C.white,weight='normal',max=Infinity,raw=false)=>{
    if(!raw)s=translate(s);c.font=`${weight} ${size}px ${FONT_FAMILY}`;c.fillStyle=color;c.textBaseline='alphabetic';c.fillText(String(s),Math.round(x),Math.round(y),max);
  };
  const fontFamilies={rally:'Consolas, monospace',din:'"Bahnschrift Condensed", "Arial Narrow", sans-serif',euro:'Eurostile, Microgramma, Arial, sans-serif',narrow:'"Roboto Condensed", "Arial Narrow", sans-serif',tft:'"Segoe UI", Bahnschrift, sans-serif'};
  const numberText=(s,x,y,size,color,max=Infinity)=>{c.font=`bold ${size}px ${fontFamilies[cfg.digitStyle]||fontFamilies.rally}`;c.fillStyle=color;c.textBaseline='alphabetic';c.fillText(String(s),x,y,max);};
  const centered=(s,cx,y,size,color,weight='bold',family=FONT_FAMILY)=>{s=translate(s);c.font=`${weight} ${size}px ${family}`;const m=c.measureText(String(s)),visual=m.actualBoundingBoxLeft+m.actualBoundingBoxRight;c.fillStyle=color;c.textBaseline='alphabetic';c.fillText(String(s),Math.round(cx+(m.actualBoundingBoxLeft-m.actualBoundingBoxRight)/2),Math.round(y));return visual;};
  const fmt=(n,d=0)=>typeof n==='number'&&Number.isFinite(n)?n.toFixed(d):'--';
  const clockTime=minutes=>typeof minutes==='number'&&Number.isFinite(minutes)?`D${Math.floor(minutes/1440)+1} ${String(Math.floor(minutes/60)%24).padStart(2,'0')}:${String(Math.floor(minutes)%60).padStart(2,'0')}`:'N/A';
  const duration=minutes=>typeof minutes==='number'&&Number.isFinite(minutes)?`${Math.max(0,Math.floor(minutes/60))}H ${Math.max(0,Math.floor(minutes%60))}M`:'N/A';
  const bar=(x,y,w,p,color)=>{box(x,y,w,3,C.line);if(typeof p==='number')box(x,y,w*Math.max(0,Math.min(1,p)),3,color);};
  const metric=(label,val,x,w,color=C.white,raw=false)=>{text(label,x+9,17,10,C.muted);text(val,x+9,45,21,color,'bold',w-18,raw&&val!=='N/A');};
  const edge=(x,color,reverse=false,width=18)=>{
    const m=/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color),clear=m?`rgba(${parseInt(m[1],16)},${parseInt(m[2],16)},${parseInt(m[3],16)},0)`:'rgba(0,0,0,0)';
    const g=c.createLinearGradient(reverse?x+width:x,0,reverse?x:x+width,0);g.addColorStop(0,color);g.addColorStop(.18,color);g.addColorStop(1,clear);
    c.fillStyle=g;c.fillRect(x,3,width,54);
  };
  // Every temporary panel owns its accent; never offset it from a neighbouring region.
  const panelEdge=(rect,color,background=null)=>{
    if(background)box(rect.left,rect.top,rect.width,rect.height,background);
    box(rect.left,rect.indicatorTop,rect.indicatorWidth,rect.indicatorHeight,color);
    return rect.contentLeft;
  };
  const messageRect=RECTS.message,mx=offset=>messageRect.left+offset;
  function pump(x,y,color){
    c.strokeStyle=color;c.lineWidth=2;c.strokeRect(x,y,13,20);c.strokeRect(x+3,y+3,7,5);c.beginPath();c.moveTo(x+13,y+4);c.lineTo(x+18,y+8);c.lineTo(x+18,y+18);c.stroke();
  }
  function icon(id,x,y,color){
    x=Math.round(x);y=Math.round(y);
    c.save();c.strokeStyle=color;c.fillStyle=color;c.lineWidth=2;c.lineCap='round';c.lineJoin='round';
    if(id==='lights'){
      c.beginPath();c.ellipse(x-5,y,8,11,0,Math.PI/2,Math.PI*1.5);c.stroke();
      for(let n=-1;n<=1;n++){c.beginPath();c.moveTo(x+4,y+n*7-2);c.lineTo(x+16,y+n*7-5);c.stroke();}
    }else if(id==='wipers'){
      c.beginPath();c.arc(x,y+5,15,Math.PI*1.12,Math.PI*1.88);c.stroke();c.beginPath();c.moveTo(x-9,y+5);c.lineTo(x+10,y-9);c.stroke();
    }else if(id==='cruise'){
      c.beginPath();c.arc(x,y,13,Math.PI,Math.PI*2);c.stroke();c.beginPath();c.moveTo(x,y);c.lineTo(x+8,y-8);c.stroke();
    }else if(id==='hazard'){
      c.beginPath();c.moveTo(x,y-13);c.lineTo(x+15,y+12);c.lineTo(x-15,y+12);c.closePath();c.stroke();text('!',x-3,y+8,18,color,'bold');
    }else if(id==='retarder'){text('R',x-10,y+10,27,color,'bold');box(x+10,y-9,3,19,color);
    }else if(id==='horn'){
      c.beginPath();c.moveTo(x-14,y-5);c.lineTo(x-7,y-5);c.lineTo(x+2,y-13);c.lineTo(x+2,y+13);c.lineTo(x-7,y+5);c.lineTo(x-14,y+5);c.closePath();c.stroke();
      c.beginPath();c.arc(x+2,y,9,-0.8,0.8);c.stroke();
    }else if(id==='next'||id==='page'){
      c.beginPath();c.moveTo(x-12,y-9);c.lineTo(x,y);c.lineTo(x-12,y+9);c.moveTo(x,y-9);c.lineTo(x+12,y);c.lineTo(x,y+9);c.stroke();
    }else if(id==='auto'){c.beginPath();c.arc(x,y,13,0,Math.PI*2);c.stroke();text('A',x-6,y+7,18,color,'bold');
    }else if(id==='ack'){c.beginPath();c.moveTo(x-12,y);c.lineTo(x-3,y+9);c.lineTo(x+13,y-10);c.stroke();}
    else if(id==='engine'){c.beginPath();c.arc(x,y,12,-Math.PI*.3,Math.PI*1.3);c.stroke();c.beginPath();c.moveTo(x,y-15);c.lineTo(x,y);c.stroke();}
    else if(id==='parking'){c.beginPath();c.arc(x,y,14,0,Math.PI*2);c.stroke();text('P',x-6,y+7,18,color,'bold');}
    else if(id==='axle'){c.beginPath();c.moveTo(x-15,y-7);c.lineTo(x+15,y-7);c.moveTo(x-15,y+7);c.lineTo(x+15,y+7);c.stroke();for(const dx of[-11,11]){c.beginPath();c.arc(x+dx,y,5,0,Math.PI*2);c.stroke();}}
    else if(id==='diff'){c.beginPath();c.moveTo(x-16,y);c.lineTo(x-6,y);c.moveTo(x+6,y);c.lineTo(x+16,y);c.arc(x,y,6,0,Math.PI*2);c.stroke();}
    else if(id==='trailer'||id==='trailer_info'){c.strokeRect(x-16,y-10,25,16);c.beginPath();c.moveTo(x+9,y+6);c.lineTo(x+16,y+6);c.stroke();for(const dx of[-10,5]){c.beginPath();c.arc(x+dx,y+9,3,0,Math.PI*2);c.stroke();}}
    else if(id==='mirror'){c.beginPath();c.moveTo(x-13,y-11);c.quadraticCurveTo(x+15,y-9,x+10,y+11);c.lineTo(x-13,y+8);c.closePath();c.stroke();}
    else if(id==='camera'){c.strokeRect(x-15,y-9,30,18);c.beginPath();c.arc(x,y,6,0,Math.PI*2);c.stroke();}
    else if(id==='trailer_brake'){text('TB',x-12,y+7,16,color,'bold');}
    else if(id==='brake_info'){c.beginPath();c.arc(x,y,13,0,Math.PI*2);c.stroke();text('B',x-6,y+7,18,color,'bold');}
    else if(id==='map_job'){c.beginPath();c.moveTo(x-14,y+10);c.lineTo(x-5,y-8);c.lineTo(x+3,y+3);c.lineTo(x+14,y-11);c.stroke();}
    else if(id==='bind_next'){c.beginPath();c.moveTo(x-12,y-9);c.lineTo(x,y);c.lineTo(x-12,y+9);c.moveTo(x,y-9);c.lineTo(x+12,y);c.lineTo(x,y+9);c.stroke();}
    c.restore();
  }

  box(0,0,WIDTH,HEIGHT,C.bg);box(0,0,WIDTH,2,C.cyan);
  if(el)for(const [x,w]of [RECTS.speed,RECTS.gear,RECTS.rpm,v.page==='motion'?{left:RECTS.data.left,width:WIDTH-RECTS.data.left}:RECTS.data].map(r=>[r.left+3,r.width-6])){box(x,3,w,54,C.panel);for(let y=5;y<57;y+=4)box(x,y,w,1,C.bg);}
  [RECTS.speed.left,RECTS.speed.right,RECTS.message.left,RECTS.data.left,...(v.page==='motion'?[]:[RECTS.message.right])].forEach(x=>box(x,5,1,50,C.line));
  text(v.quick?.binding?`BIND / ${v.quick.bindingPage+1}`:themePageLabel(cfg.theme,v.section||0),7,21,13,C.cyan,'bold');if(!v.quick?.binding)text('›',100,22,13,C.muted,'bold');
  text(v.acknowledgedWarnings?.length?'ACK / ACTIVE':v.mode||'AUTO',7,41,10,v.acknowledgedWarnings?.length?C.amber:C.muted);text((v.connectionState&&v.connectionState!=='CONNECTED'?v.connectionState:v.foreground===false?'BACKGROUND':v.page||'offline').toUpperCase(),10,55,9,C.muted);

  const location=k=>{const names=[value(v.p,k),value(v.p,k+'.alternate')].filter(n=>typeof n==='string'&&n);return names.length?names[Math.floor(now/(cfg.locationRotationSeconds*1000))%names.length]:'N/A';};
  const p=v.p,moving=!!p&&v.page!=='paused';
  const speedLayout=SPEED;
  const speed=v.kmh==null?null:v.kmh/(cfg.units==='mph'?1.609344:1),speedLabel=moving?fmt(speed).padStart(3,'0'):'---';
  if(cfg.digitStyle==='segment'){const w=el?21:22,total=sevenSegmentWidth(speedLabel,w,4,el);sevenSegment(c,speedLabel,SPEED.numberCenter-total/2,SPEED.numberTop,w,SPEED.numberHeight,el?C.white:'#d8e5e8',el,el);}
  else numberText(speedLabel,SPEED.numberX,SPEED.numberBaseline,42,el?C.white:'#d8e5e8',SPEED.numberWidth);
  // Preserve both 140 x 3 px tracks: input stays visible on the top row,
  // lower two rows show effective throttle / actual deceleration (full = 1 g).
  // Deceleration is a motion measurement, not an aggregate braking force.
  const pedalsLive=moving&&!p.paused&&(!v.connectionState||v.connectionState==='CONNECTED');
  const pedal=pedalState(p);
  for(const [name,y,inputColor,effectiveColor]of[['throttle',5,C.green,'#57e6f2'],['brake',11,C.red,'#ffc34a']]){
    const input=pedalsLive?value(p,`truck.input.${name}`):null;
    const effective=pedalsLive?pedal[name]:null;
    bar(SPEED.pedalX,y,SPEED.pedalWidth,Number.isFinite(input)?input:null,inputColor);
    if(Number.isFinite(effective))box(SPEED.pedalX,y+1,SPEED.pedalWidth*effective,2,effectiveColor);

  }
  text(cfg.units==='mph'?'MPH':'KM/H',SPEED.infoX,SPEED.unitBaseline,12,C.cyan,'bold',SPEED.infoWidth);
  const cruise=value(p,'truck.cruise_control');if(moving&&cruise>0){const set=cruise*3.6/(cfg.units==='mph'?1.609344:1);text(`[${fmt(set)}]`,SPEED.infoX,SPEED.cruiseBaseline,20,C.green,'bold',SPEED.infoWidth);}
  const rawLimit=value(p,'truck.navigation.speed.limit'),displayLimit=rawLimit>0?rawLimit*3.6/(cfg.units==='mph'?1.609344:1):null;
  c.lineWidth=3;c.strokeStyle=displayLimit==null?C.line:C.red;c.fillStyle='#e7eee9';c.beginPath();c.arc(speedLayout.signX,33,20,0,Math.PI*2);c.fill();c.stroke();
  const limitLabel=displayLimit==null?'--':fmt(displayLimit),limitSize=limitLabel.length>=3?16:20;centered(limitLabel,speedLayout.signX,40,limitSize,'#121719','bold','Arial, sans-serif');
  if(v.overspeed){edge(RECTS.speed.left,C.red,false,SPEED.overspeedWidth);edge(RECTS.speed.right-SPEED.overspeedWidth,C.red,true,SPEED.overspeedWidth);}

  const gear=v.gear==null?'—':v.gear<0?`R${Math.abs(v.gear)}`:v.gear===0?'N':String(v.gear);
  const gearRect={...RECTS.gear,left:RECTS.gear.left+8,width:RECTS.gear.width-16};
  if(cfg.digitStyle==='segment'&&moving&&/^\d+$/.test(gear)){
    const w=el?25:28,h=cfg.gearFontSize,ink=sevenSegmentInkBounds(gear,w,h,el);
    c.save();c.beginPath();c.rect(RECTS.gear.left,2,RECTS.gear.width,58);c.clip();
    sevenSegment(c,gear,gearRect.left+gearRect.width/2-(ink.left+ink.right)/2,gearRect.top+gearRect.height/2-(ink.top+ink.bottom)/2,w,h,C.white,el,el);c.restore();
  }else drawCenteredInk(c,moving?gear:'—',gearRect,`bold ${cfg.gearFontSize}px ${fontFamilies[cfg.digitStyle]||fontFamilies.rally}`,v.gear<0?C.amber:C.green);

  if(v.page==='offline'||v.page==='paused'){
    const contentLeft=panelEdge(messageRect,C.amber);
    text(v.page==='offline'?'WAITING FOR ETS2':'SIMULATION PAUSED',contentLeft,29,22,C.amber,'bold');
    text(v.page==='offline'?'SDK NOT CONNECTED':cfg.bindingMode?'BIND MODE ENABLED':'TELEMETRY FROZEN',contentLeft,49,12,C.muted);
    metric('LINK',v.page==='offline'?'NO DATA':'CONNECTED',890,260,C.amber);metric('INPUT SDK',p?.input?'READY':'WAITING',1160,280,C.muted);
  }else if(v.page==='alert'){
    const a=v.activeAlert||v.alerts[0],critical=!!a?.critical;const contentLeft=panelEdge(messageRect,critical?C.red:C.amber,critical?'#40131a':'#332812');
    drawCenteredInk(c,translate(a?.text||'CHECK TRUCK'),{...messageRect,left:contentLeft,width:570,align:'left'},`bold 29px ${FONT_FAMILY}`,critical?C.red:C.amber);
    drawCenteredInk(c,translate(a?.detail||'CHECK VEHICLE STATUS'),{...messageRect,left:mx(595),width:a?.id==='speed'?295:380,align:'left'},`bold 18px ${FONT_FAMILY}`,C.white);
    if(v.alerts.length>1)text(`${v.warningIndex}/${v.alerts.length}`,mx(535),54,9,C.muted,'bold');
    if(a?.id==='speed'&&typeof a.limit==='number'){c.fillStyle='#f4f4ef';c.strokeStyle=C.red;c.lineWidth=4;c.beginPath();c.arc(messageRect.right-45,31,26,0,Math.PI*2);c.fill();c.stroke();centered(fmt(a.limit),messageRect.right-45,40,a.limit>=100?19:24,'#111416','bold','Arial, sans-serif');}
  }else if(v.page==='braking'||v.page==='brake'){
    const pressure=value(p,'truck.brake.air.pressure'),airPct=pressure==null?null:Math.max(0,Math.min(1,pressure/cfg.airPressureFullPsi)),force=v.brakeForce;
    const contentLeft=panelEdge(messageRect,C.amber,'#231d12');drawCenteredInk(c,translate(v.page==='braking'?'BRAKING':'BRAKE MONITOR'),{...messageRect,left:contentLeft,width:265,align:'left'},`bold 27px ${FONT_FAMILY}`,C.amber);
    text('FORCE',mx(300),16,9,C.muted);text(force==null?'N/A':`${fmt(force*100)}%`,mx(300),39,19,C.white,'bold');bar(mx(300),46,175,force,C.red);
    metric('TEMP',value(p,'truck.brake.temperature')==null?'N/A':`${fmt(value(p,'truck.brake.temperature'))} C`,mx(490),145,C.amber);
    text('AIR',mx(640),16,9,C.muted);text(pressure==null?'N/A':`${fmt(airPct*100)}% / ${fmt(pressure)} PSI`,mx(640),39,17,C.cyan,'bold',215);bar(mx(640),46,205,airPct,C.cyan);
    metric('RETARDER',value(p,'truck.brake.retarder')==null?'N/A':fmt(value(p,'truck.brake.retarder')),messageRect.right-150,140,C.white);
  }else if(v.page==='notice'){
    const contentLeft=panelEdge(messageRect,C.cyan,'#102a28');text(({toll:'TOLL PAID',fine:'FINE',ferry:'FERRY PAID',train:'TRAIN PAID',cancel:'JOB PENALTY'})[v.tollNotice?.type]||'PAYMENT',contentLeft,31,24,C.cyan,'bold');text('PAYMENT',contentLeft,50,11,C.white);
    drawCenteredInk(c,`− € ${fmt(v.tollNotice?.amount)}`,{...messageRect,left:messageRect.right-330,width:260,align:'left'},'bold 25px Arial, sans-serif',C.white);
  }else{
    const scale=rpmScale(p,cfg),ratio=Math.max(0,Math.min(1,(v.rpm||0)/scale.max));
    text(cfg.rpmScaleFormat==='x100'?'RPM ×100':el?'RPM / LED':'ENGINE RPM',LAYOUT.rpmStart+10,15,10,C.muted);text(fmt(v.rpm),800,17,15,C.white,'bold');
    for(const [i,led] of scale.leds.entries()){
      const color=rpmColor(i/24),lit=(v.rpm||0)>0&&led.rpm<=(v.rpm||0);
      if(el){c.beginPath();c.arc(led.x,31,6,0,Math.PI*2);c.fillStyle=lit?color:'#193027';c.fill();}
      else box(led.x-6,24,13,13,lit?color:'#202b31');
    }
    for(const label of scale.labels)centered(label.text,label.x,54,11,C.muted,'normal',FONT_FAMILY);
    if(v.page==='motion'){
      const angle=k=>{const n=value(p,'truck.world.placement.'+k);return n===null?'N/A':`${fmt(n*360,1)}°`;};
      for(const [i,k]of ['heading','pitch','roll'].entries())metric(k.toUpperCase(),angle(k),875+i*165,165,C.cyan);
      const vector=(key,x,title,unit)=>{text(title,x+9,17,11,C.muted);const parts=['x','y','z'].map(k=>value(p,key+'.'+k));text(parts.map(n=>fmt(n,2)).join(' / '),x+9,43,21,C.white,'bold',255);text(unit,x+9,56,10,C.muted);};
      vector('truck.local.velocity.linear',1370,'VELOCITY X / Y / Z','M/S');vector('truck.local.acceleration.linear',1765,'ACCEL X / Y / Z','M/S²');
      text('G NOW',1649,17,10,C.muted);text(v.gForce?.current==null?'N/A':`${fmt(v.gForce.current,2)} G`,1649,43,21,C.cyan,'bold',105);
      text('G PEAK',2044,17,10,C.muted);text(v.gForce?.peak==null?'N/A':`${fmt(v.gForce.peak,2)} G`,2044,43,21,C.amber,'bold',116);
    }else if(v.panel==='route'){
      const distance=value(p,'truck.navigation.distance'),eta=value(p,'truck.navigation.time'),city=location('job.destination.city'),game=value(p,'game.time');
      metric('DESTINATION',typeof city==='string'&&city?city:'N/A',875,170,C.amber,true);metric('DISTANCE',distance==null?'N/A':`${fmt(distance/1000,1)} KM`,1045,145,C.cyan);
      metric('DRIVE TIME',eta==null?'N/A':duration(eta/60),1190,135);metric('ARRIVAL ETA',eta==null||game==null?'N/A':clockTime(game+eta/60),1325,125,C.cyan);
    }else if(v.panel==='job_overview'){
      metric('CARGO',value(p,'job.cargo')||'N/A',875,170,C.amber,true);metric('FROM',location('job.source.city')||'N/A',1045,135,C.white,true);
      metric('TO',location('job.destination.city')||'N/A',1180,135,C.cyan,true);const income=value(p,'job.income');metric('REWARD',income==null?'N/A':`€ ${fmt(income)}`,1315,135,C.green);
    }else if(v.panel==='job_timing'){
      const game=value(p,'game.time'),deadline=value(p,'job.delivery.time'),remaining=game==null||deadline==null?null:deadline-game,damage=value(p,'job.cargo.damage');
      metric('GAME TIME',clockTime(game),875,145,C.cyan);metric('DEADLINE',clockTime(deadline),1020,145,C.amber);
      metric('TIME LEFT',remaining==null?'N/A':remaining<0?`LATE ${duration(-remaining)}`:duration(remaining),1165,155,remaining<0?C.red:C.white);
      metric('CARGO DAMAGE',damage==null?'N/A':`${fmt(damage*100,1)}%`,1320,130,damage>0?C.amber:C.green);
    }else if(v.panel==='job_distance'){
      const planned=value(p,'job.planned.distance.km'),remaining=value(p,'truck.navigation.distance');
      metric('PLANNED',planned==null?'N/A':`${fmt(planned,0)} KM`,875,145,C.cyan);metric('REMAINING',remaining==null?'N/A':`${fmt(remaining/1000,1)} KM`,1020,155,C.amber);
      metric('PICKUP',value(p,'job.source.company')||'N/A',1175,145,C.white,true);metric('DELIVERY',value(p,'job.destination.company')||'N/A',1320,130,C.green,true);
    }else if(v.panel==='trailer_status'){
      const attached=yes(p,'trailer.connected'),mass=value(p,'job.cargo.mass'),axle=value(p,'truck.trailer.lift_axle.indicator');
      metric('TRAILER',attached?'CONNECTED':'NOT CONNECTED',875,170,attached?C.green:C.muted);metric('CARGO',value(p,'job.cargo')||'N/A',1045,170,C.amber,true);
      metric('CARGO MASS',mass==null?'N/A':`${fmt(mass/1000,1)} T`,1215,130,C.cyan);metric('TRAILER AXLE',axle==null?'N/A':axle>0?'LIFTED':'DOWN',1345,105,axle>0?C.amber:C.white);
    }else if(v.panel==='trailer_damage'){
      const cargo=value(p,'trailer.cargo.damage')??value(p,'job.cargo.damage'),body=value(p,'trailer.wear.body'),chassis=value(p,'trailer.wear.chassis'),wheels=value(p,'trailer.wear.wheels');
      metric('CARGO DAMAGE',cargo==null?'N/A':`${fmt(cargo*100,1)}%`,875,145,cargo>0?C.amber:C.green);metric('BODY WEAR',body==null?'N/A':`${fmt(body*100,1)}%`,1020,145);
      metric('CHASSIS WEAR',chassis==null?'N/A':`${fmt(chassis*100,1)}%`,1165,155);metric('WHEEL WEAR',wheels==null?'N/A':`${fmt(wheels*100,1)}%`,1320,130);
    }else if(v.panel==='systems_engine'||v.panel==='systems'){
      metric('OIL PSI',fmt(value(p,'truck.oil.pressure')),875,145,C.cyan);metric('OIL C',fmt(value(p,'truck.oil.temperature')),1020,135);
      metric('COOLANT C',fmt(value(p,'truck.water.temperature')),1155,155);metric('BATTERY',value(p,'truck.battery.voltage')==null?'N/A':`${fmt(value(p,'truck.battery.voltage'),1)} V`,1310,140,C.cyan);
    }else if(v.panel==='systems_brake'){
      const pressure=value(p,'truck.brake.air.pressure'),airPct=pressure==null?null:Math.max(0,Math.min(1,pressure/cfg.airPressureFullPsi)),effective=value(p,'truck.effective.brake');
      metric('BRAKE TEMP C',fmt(value(p,'truck.brake.temperature')),875,160,C.amber);metric('BRAKE',yes(p,'truck.brake.parking')?'PARKED':effective==null?'N/A':effective>.05?'APPLIED':'RELEASED',1035,150,C.cyan);
      text('AIR PSI',1194,17,10,C.muted);text(pressure==null?'N/A':`${fmt(pressure)}  ${fmt(airPct*100)}%`,1194,39,18,C.white,'bold',155);bar(1194,45,145,airPct,pressure!=null&&yes(p,'truck.brake.air.pressure.warning')?C.red:C.cyan);
      const parkingBrake=value(p,'truck.brake.parking');
      metric('PARK BRAKE',parkingBrake==null?'N/A':parkingBrake?'ON':'OFF',1345,105,parkingBrake?C.amber:C.cyan);
    }else{
      const ad=value(p,'truck.adblue'),adCap=value(p,'adblue.capacity'),adPct=ad!=null&&adCap>0?ad/adCap:null;
      const l100=v.consumptionL100;
      if(v.page==='refueling')panelEdge(RECTS.data,C.green);
      const fuel=value(p,'truck.fuel.amount');text(v.refueling?'REFUELING':'FUEL',RECTS.data.contentLeft,14,9,v.refueling?C.green:C.muted,'bold');text(`${fmt(v.fuelPercent)}%`,884,35,20,C.cyan,'bold',50);text(fuel==null?'N/A':`${fmt(fuel,1)} L`,941,35,14,C.cyan,'bold',64);bar(RECTS.data.contentLeft,43,122,v.fuelPercent==null?null:v.fuelPercent/100,C.cyan);
      text('TRIP AVERAGE',1020,14,9,C.muted);text(l100==null?'CALCULATING':`${fmt(l100,1)} L/100`,1020,35,l100==null?11:17,C.white,'bold');bar(1020,43,165,l100==null?null:l100/60,C.amber);
      text(v.adblueRefilling?'ADBLUE REFILLING':'ADBLUE',1200,14,9,v.adblueRefilling?C.green:C.muted,'bold',122);text(adPct==null?'--':`${fmt(adPct*100)}%`,1200,35,18,C.white,'bold',50);text(ad==null?'N/A':`${fmt(ad,1)} L`,1257,35,14,C.cyan,'bold',64);bar(1200,43,120,adPct,C.cyan);
      text('RANGE',1335,14,9,C.muted);text(`${fmt(value(p,'truck.fuel.range'))} KM`,1335,39,16,C.white,'bold',105);
      if(v.refueling){pump(1418,16,C.green);text('FILL',1405,54,8,C.green,'bold');}
    }
  }

  if(v.page!=='motion'&&v.context?.REVERSING)box(1450,2,720,3,C.red);
  const fallback=CONTROLS.map(b=>({...b,capability:b.id==='horn'?'momentary':'conditional_action',on:null}));
  const drawControls=(controls,alpha)=>{c.save();c.globalAlpha=alpha;
    for(const b of controls){
      const enabled=b.local||b.bit===undefined||v.inputReady,on=b.capability==='stateful'&&b.on===true,pressed=v.pressed?.id===b.id;
      box(b.x+2,5,b.w-4,51,on?(el?'#163524':'#1b3037'):pressed?'#263b45':C.panel);box(b.x+2,54,b.w-4,2,on?C.cyan:pressed?C.amber:C.line);
      icon(b.id,b.x+b.w/2,25,enabled?(on?C.cyan:pressed?C.amber:C.white):'#52606a');
      c.save();c.beginPath();c.rect(b.x+3,38,b.w-6,15);c.clip();centered(b.label,b.x+b.w/2,50,11,enabled?C.muted:'#46515a');c.restore();
      if(b.id==='lights'&&yes(p,'truck.light.beam.high')){box(b.x+7,9,8,3,C.cyan);box(b.x+7,14,8,3,C.cyan);}
      if(v.hold?.id===b.id)box(b.x+2,55,(b.w-4)*v.hold.value,2,v.hold.value>=1?C.green:C.amber);
    }c.restore();};
  const q=v.quick,transition=q?.transition??1;if(v.page!=='motion'&&q?.previous?.length&&transition<1)drawControls(q.previous,1-transition);
  if(v.page!=='motion')drawControls(q?q.controls:fallback,transition);

  if(v.page==='offline'){text('CONNECTION DIAGNOSTICS',1490,28,19,C.cyan,'bold');text('FlexDesigner settings / Check connection',1490,48,14,C.muted);}
  if(p&&yes(p,'truck.light.lblinker'))edge(0,'#66ff55',false,52);
  if(p&&yes(p,'truck.light.rblinker'))edge(WIDTH-52,'#66ff55',true,52);
  return canvas;
}
module.exports={render};
