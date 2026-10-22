'use strict';
// Original bitmap glyphs. Each cell always draws its unlit LEDs too.
// No font dependency, blur, shadow, scaling, or changes to dashboard geometry.
const ROWS={
 '0':['01110','10001','10011','10101','11001','10001','01110'],
 '1':['00100','01100','00100','00100','00100','00100','01110'],
 '2':['01110','10001','00001','00010','00100','01000','11111'],
 '3':['11110','00001','00001','01110','00001','00001','11110'],
 '4':['00010','00110','01010','10010','11111','00010','00010'],
 '5':['11111','10000','10000','11110','00001','00001','11110'],
 '6':['00110','01000','10000','11110','10001','10001','01110'],
 '7':['11111','00001','00010','00100','01000','01000','01000'],
 '8':['01110','10001','10001','01110','10001','10001','01110'],
 '9':['01110','10001','10001','01111','00001','00010','01100'],
 A:['01110','10001','10001','11111','10001','10001','10001'],
 B:['11110','10001','10001','11110','10001','10001','11110'],
 C:['01111','10000','10000','10000','10000','10000','01111'],
 D:['11110','10001','10001','10001','10001','10001','11110'],
 E:['11111','10000','10000','11110','10000','10000','11111'],
 F:['11111','10000','10000','11110','10000','10000','10000'],
 G:['01111','10000','10000','10111','10001','10001','01111'],
 H:['10001','10001','10001','11111','10001','10001','10001'],
 I:['01110','00100','00100','00100','00100','00100','01110'],
 J:['00111','00010','00010','00010','00010','10010','01100'],
 K:['10001','10010','10100','11000','10100','10010','10001'],
 L:['10000','10000','10000','10000','10000','10000','11111'],
 M:['10001','11011','10101','10101','10001','10001','10001'],
 N:['10001','11001','11001','10101','10011','10011','10001'],
 O:['01110','10001','10001','10001','10001','10001','01110'],
 P:['11110','10001','10001','11110','10000','10000','10000'],
 Q:['01110','10001','10001','10001','10101','10010','01101'],
 R:['11110','10001','10001','11110','10100','10010','10001'],
 S:['01111','10000','10000','01110','00001','00001','11110'],
 T:['11111','00100','00100','00100','00100','00100','00100'],
 U:['10001','10001','10001','10001','10001','10001','01110'],
 V:['10001','10001','10001','10001','10001','01010','00100'],
 W:['10001','10001','10001','10101','10101','11011','10001'],
 X:['10001','10001','01010','00100','01010','10001','10001'],
 Y:['10001','10001','01010','00100','00100','00100','00100'],
 Z:['11111','00001','00010','00100','01000','10000','11111'],
 '/':['00001','00001','00010','00100','01000','10000','10000'],
 '-':['00000','00000','00000','11111','00000','00000','00000'],
 ':':['00000','00100','00100','00000','00100','00100','00000'],
 '.':['00000','00000','00000','00000','00000','00100','00100'],
 '%':['11001','11010','00010','00100','01000','01011','10011'],
 '+':['00000','00100','00100','11111','00100','00100','00000'],
 '[':['01110','01000','01000','01000','01000','01000','01110'],
 ']':['01110','00010','00010','00010','00010','00010','01110'],
 '°':['01100','10010','10010','01100','00000','00000','00000'],
 ' ':['00000','00000','00000','00000','00000','00000','00000']
};
const GLYPHS=Object.freeze(Object.fromEntries(Object.entries(ROWS).map(([k,v])=>[k,Object.freeze(v)])));
const normalize=s=>String(s).replace(/[—−–]/g,'-').replace(/[a-z]/g,ch=>ch.toUpperCase());
const width=(count,pitch)=>count?((count*6)-1)*pitch:0;
// All themes share the same 5 x 7 glyphs. Legacy 5 x 8 settings normalize here too.
const rowCount=()=>7;
// A tiny deterministic marquee: one LED column per step, with a readable pause at each end.
// It uses the existing page clock; there is no extra timer, frame queue or scrolling service.
function scrollOffset(elapsedMs,maxOffset,stepMs=120){
 if(maxOffset<=0)return 0;
 const hold=900,travel=maxOffset*stepMs,phase=Math.max(0,elapsedMs||0)%(travel+hold*2);
 return Math.min(maxOffset,Math.max(0,Math.floor((phase-hold)/stepMs)));
}
function layout(label,{pitch=2,matrix='5x7',maxWidth=Infinity,truncate=false,pad=false,minCells=0,align='left',scroll=false,scrollMode='restart',elapsedMs=0}={}){
 matrix='5x7';
 const text=normalize(label);
 if(!Number.isInteger(pitch)||pitch<2||pitch>7||!text||[...text].some(ch=>!GLYPHS[ch]))return null;
 const capacity=Number.isFinite(maxWidth)?Math.max(0,Math.floor((maxWidth+pitch)/(6*pitch))):text.length;
 if(!capacity||text.length>capacity&&!scroll&&(!truncate||capacity<4))return null;
 const scrolling=scroll&&text.length>capacity;
 const shown=text.length>capacity&&!scrolling?text.slice(0,capacity-3)+'...':text;
 const cells=pad||scrolling?capacity:Math.min(capacity,Math.max(shown.length,Math.floor(minCells)||0)),columns=cells*6-1,rows=rowCount(matrix);
 const loopColumns=scrolling&&scrollMode==='loop_right'?text.length*6+12:0;
 return {text:shown,cells,columns,rows,matrix,pitch,align:align==='right'?'right':'left',contentOffset:align==='right'&&!scrolling?(cells-shown.length)*6:0,width:width(cells,pitch),height:pitch*rows,truncated:shown!==text,
  offset:loopColumns?-(Math.floor(Math.max(0,elapsedMs||0)/120)%loopColumns):scrolling?scrollOffset(elapsedMs,text.length*6-1-columns):0,loopColumns,scrolling};
}
function draw(c,label,{x,y,color='#ffd783',dim='#252a27',background='#080b0a',shape='round',...options}){
 const plan=layout(label,options);if(!plan)return false;
 c.save();c.shadowBlur=0;c.shadowColor='transparent';
 if(plan.align==='right'&&Number.isFinite(options.maxWidth))x+=options.maxWidth-plan.width;
 x=Math.round(x);y=Math.round(y);
 c.fillStyle=background;c.fillRect(x,y,plan.width,plan.height);
 const glyphs=GLYPHS;
 // Physical LEDs stay in place. Scrolling changes their lit pattern, never the dark backplate.
 for(let col=0;col<plan.columns;col++){
  const unwrapped=col+plan.offset-plan.contentOffset,source=plan.loopColumns?((unwrapped%plan.loopColumns)+plan.loopColumns)%plan.loopColumns:unwrapped;
  const letter=glyphs[plan.text[Math.floor(source/6)]||' '],glyphColumn=source%6;
  for(let row=0;row<plan.rows;row++){
   c.fillStyle=glyphColumn<5&&letter[row][glyphColumn]==='1'?color:dim;
   const px=x+col*plan.pitch,py=y+row*plan.pitch;
   // Small readouts use crisp square pixels; large speed/gear digits use round LEDs.
   if(plan.pitch===2||shape==='square')c.fillRect(px,py,plan.pitch-1,plan.pitch-1);
   else{c.beginPath();c.arc(px+plan.pitch/2,py+plan.pitch/2,(plan.pitch-1)/2,0,Math.PI*2);c.fill();}
  }
 }
 c.restore();return true;
}
module.exports={GLYPHS,rowCount,scrollOffset,layout,draw};
