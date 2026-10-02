'use strict';
const PALETTES={
  rally:{displayName:'RALLY',bg:'#080b0e',panel:'#111820',line:'#29343e',white:'#f1f5f7',muted:'#8799a8',cyan:'#57e6f2',green:'#9aff65',amber:'#ffc34a',red:'#ff505a'},
  el_mint:{displayName:'MINT',bg:'#06100d',panel:'#0b1e17',line:'#234537',white:'#baffc8',muted:'#69947c',cyan:'#8df8b5',green:'#9aff65',amber:'#ffcf62',red:'#ff505a'},
  el_amber:{displayName:'AMBER',bg:'#100b04',panel:'#211506',line:'#4d3518',white:'#ffd783',muted:'#9f7740',cyan:'#ffc45e',green:'#ffcf68',amber:'#ffb83e',red:'#ff594c'}
};
// Percentages are relative to this truck's SDK rpm.limit, not fixed car RPMs.
function rpmColor(position){
  if(position<0.55)return '#82ed63';
  if(position>=0.85)return '#ff4545';
  const t=Math.max(0,Math.min(1,(position-0.55)/0.30));
  const from=[255,228,91],to=[255,139,42];
  return '#'+from.map((v,i)=>Math.round(v+(to[i]-v)*t).toString(16).padStart(2,'0')).join('');
}
const DIGITS={0:'abcdef',1:'bc',2:'abged',3:'abgcd',4:'fgbc',5:'afgcd',6:'afgecd',7:'abc',8:'abcdefg',9:'abfgcd','-':'g'};
const digitWidth=(d,w,compact)=>compact&&d==='1'?Math.round(w*.56):compact&&['4','7'].includes(d)?Math.round(w*.82):w;
const segmentRects=(dw,h)=>{const t=3,half=(h-t)/2;return {a:[t,0,dw-2*t,t],g:[t,half,dw-2*t,t],d:[t,h-t,dw-2*t,t],f:[0,t,t,half-t],b:[dw-t,t,t,half-t],e:[0,half+t,t,half-t],c:[dw-t,half+t,t,half-t]};};
function sevenSegmentInkBounds(label,w,h,compact=false){let offset=0,left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;for(const d of String(label)){const dw=digitWidth(d,w,compact),shapes=segmentRects(dw,h);for(const id of DIGITS[d]||''){const [x,y,rw,rh]=shapes[id];left=Math.min(left,offset+x);right=Math.max(right,offset+x+rw);top=Math.min(top,y);bottom=Math.max(bottom,y+rh);}offset+=dw+4;}return {left,top,right,bottom};}
function sevenSegmentWidth(label,w=25,gap=4,compact=false){return [...String(label)].reduce((sum,d,i)=>sum+(compact&&d==='1'?Math.round(w*.56):compact&&['4','7'].includes(d)?Math.round(w*.82):w)+(i?gap:0),0);}
function sevenSegment(c,label,x,y,w=25,h=35,color='#baffc8',glow=true,compact=false){
  const t=3,half=(h-t)/2;
  c.save();
  for(const digit of String(label)){
    const dw=digitWidth(digit,w,compact);
    const shapes=segmentRects(dw,h);
    const lit=DIGITS[digit]||'';
    for(const [id,r]of Object.entries(shapes)){
      c.fillStyle=lit.includes(id)?color:'#173528';
      c.shadowColor=lit.includes(id)&&glow?color:'transparent';c.shadowBlur=lit.includes(id)&&glow?3:0;
      c.fillRect(x+r[0],y+r[1],r[2],r[3]);
    }
    x+=dw+4;
  }
  c.restore();
}
function themePageLabel(theme,section=0){return `${(PALETTES[theme]||PALETTES.rally).displayName} / ${String(section+1).padStart(2,'0')}`;}
module.exports={themePageLabel,PALETTES,rpmColor,sevenSegment,sevenSegmentWidth,sevenSegmentInkBounds};
