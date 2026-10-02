const test=require('node:test'),assert=require('node:assert/strict');
const {render}=require('../src/render.cjs'),{settings,Dashboard}=require('../src/model.cjs'),{RECTS}=require('../src/layout.cjs'),{drive}=require('./fixtures.cjs');
function brightBounds(canvas,rect){const data=canvas.getContext('2d').getImageData(0,0,2170,60).data;let left=Infinity,right=-1,top=Infinity,bottom=-1;for(let y=2;y<60;y++)for(let x=rect.left;x<rect.left+rect.width;x++){const i=(y*2170+x)*4,r=data[i],g=data[i+1],b=data[i+2];if(Math.max(r,g)>190&&Math.max(r,g)-Math.min(r,g,b)>40){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}assert.ok(right>=left);return {cx:(left+right+1)/2,cy:(top+bottom+1)/2};}
test('visible gear ink is horizontally and vertically centred for every style and gear form',()=>{
 for(const digitStyle of ['rally','din','euro','narrow','tft','segment'])for(const gear of [1,2,7,12,0,-1,-2]){
 const cfg=settings({digitStyle}),p=drive();p.values['truck.displayed.gear']=gear;const v=new Dashboard().view(p,0,0,cfg),canvas=render(v,cfg);
 // Seven segment numeric gears use white, so find bright ink independently from the dark inactive segments.
 let bounds;if(digitStyle==='segment'&&gear>0){const ctx=canvas.getContext('2d'),data=ctx.getImageData(340,2,85,58).data;let xs=[],ys=[];for(let y=0;y<58;y++)for(let x=0;x<85;x++){const i=(y*85+x)*4;if(data[i]>180&&data[i+1]>180&&data[i+2]>180){xs.push(x+340);ys.push(y+2);}}bounds={cx:(Math.min(...xs)+Math.max(...xs)+1)/2,cy:(Math.min(...ys)+Math.max(...ys)+1)/2};}
 else bounds=brightBounds(canvas,RECTS.gear);
 assert.ok(Math.abs(bounds.cx-(RECTS.gear.left+RECTS.gear.width/2))<=1.5,`${digitStyle} ${gear} horizontal ${bounds.cx}`);assert.ok(Math.abs(bounds.cy-31)<=1.5,`${digitStyle} ${gear} vertical ${bounds.cy}`);
 }
});
test('overspeed and critical warning titles have centred visible ink',()=>{
 for(const kind of ['speed','air']){const cfg=settings(),p=drive();if(kind==='speed')p.values['truck.speed']=30;else p.values['truck.brake.air.pressure.emergency']=1;const v=new Dashboard().view(p,0,0,cfg),b=brightBounds(render(v,cfg),{left:RECTS.message.contentLeft,width:570});assert.ok(Math.abs(b.cy-31)<=1,`${kind} centre ${b.cy}`);}
});
