'use strict';
const LAYOUT=Object.freeze({width:2170,height:60,selectorEnd:110,gearStart:340,rpmStart:425,dataStart:875,controlsStart:1450});
const SPEED=Object.freeze({numberX:145,numberCenter:188,numberWidth:86,numberTop:14,numberBaseline:49,numberHeight:35,infoX:235,infoWidth:47,cruiseBaseline:33,unitBaseline:53,pedalX:141,pedalWidth:140,signX:307,signY:33,overspeedWidth:12});
function panelRect(left,right,padding=15){return Object.freeze({left,right,width:right-left,top:2,height:58,indicatorWidth:6,indicatorTop:7,indicatorHeight:46,contentLeft:left+6+padding});}
function regions(layout=LAYOUT){return Object.freeze({speed:panelRect(layout.selectorEnd,layout.gearStart),gear:panelRect(layout.gearStart,layout.rpmStart),rpm:panelRect(layout.rpmStart,layout.dataStart),message:panelRect(layout.rpmStart,layout.controlsStart),data:panelRect(layout.dataStart,layout.controlsStart,3)});}
const RECTS=regions();
function rpmScale(packet,cfg){
 const raw=packet?.values?.['rpm.limit'],max=cfg.rpmScaleMax>0?cfg.rpmScaleMax:Number.isFinite(raw)&&raw>0?raw:2500;
 const first=LAYOUT.rpmStart+20,last=first+24*17,x=rpm=>(first-17)+Math.max(0,Math.min(1,rpm/max))*(last-first+17);
 return {max,source:cfg.rpmScaleMax>0?'configured-dial':'sdk',x,leds:Array.from({length:25},(_,i)=>({x:x(max*(i+1)/25),rpm:max*(i+1)/25})),labels:Array.from({length:cfg.rpmLabelCount},(_,i)=>{const rpm=max*i/(cfg.rpmLabelCount-1);return {rpm,x:x(rpm),text:cfg.rpmScaleFormat==='x100'?Number((rpm/100).toFixed(1)):Math.round(rpm)};})};
}
module.exports={LAYOUT,SPEED,RECTS,regions,rpmScale};
