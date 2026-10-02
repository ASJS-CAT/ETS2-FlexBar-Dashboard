'use strict';
const read=(p,k)=>Number.isFinite(p?.values?.[k])?p.values[k]:null;
const ratio=n=>n===null?null:Math.max(0,Math.min(1,n));
function decelerationG(p){
  const velocity=['x','y','z'].map(a=>read(p,'truck.local.velocity.linear.'+a));
  const acceleration=['x','y','z'].map(a=>read(p,'truck.local.acceleration.linear.'+a));
  if([...velocity,...acceleration].some(n=>n===null))return null;
  const speed=Math.hypot(...velocity);
  if(speed<0.5)return 0; // Direction is unstable at rest; avoid stationary noise.
  // Projection onto actual travel direction handles reversing and excludes
  // lateral cornering acceleration. No gear/retarder/motor assumptions.
  return Math.max(0,-velocity.reduce((sum,v,i)=>sum+v*acceleration[i],0)/speed/9.80665);
}
function pedalState(p){
  return {throttle:ratio(read(p,'truck.effective.throttle')),brake:ratio(decelerationG(p))};
}
// SDK vehicle-space linear acceleration expressed in standard-gravity units.
// This is not a calibrated accelerometer/proper-g measurement. Do not invent
// gravity subtraction, smooth away peaks, or infer braking force from it.
class GForce {
  constructor(){this.reset();}
  reset(){this.current=null;this.peak=null;}
  update(p){
    if(p?.paused)return {current:this.current,peak:this.peak};
    const axes=['x','y','z'].map(a=>read(p,'truck.local.acceleration.linear.'+a));
    this.current=axes.every(n=>n!==null)?Math.hypot(...axes)/9.80665:null;
    if(this.current!==null)this.peak=Math.max(this.peak??0,this.current);
    return {current:this.current,peak:this.peak};
  }
}
module.exports={pedalState,decelerationG,GForce};
