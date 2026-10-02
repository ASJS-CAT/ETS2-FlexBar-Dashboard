const test=require('node:test'),assert=require('node:assert/strict');
const {render}=require('../src/render.cjs'),{Dashboard,settings}=require('../src/model.cjs'),{LAYOUT,RECTS,regions}=require('../src/layout.cjs'),{PALETTES}=require('../src/themes.cjs'),{drive}=require('./fixtures.cjs');
const rgb=hex=>hex.match(/[a-f0-9]{2}/ig).map(v=>parseInt(v,16));const pixel=(c,x,y)=>[...c.getContext('2d').getImageData(x,y,1,1).data].slice(0,3);
test('speed accents touch both speed boundaries and retain their 12 pixel gradients',()=>{
 const cfg=settings(),p=drive(),d=new Dashboard();p.values['truck.speed']=30;const v=d.view(p,0,0,cfg),c=render(v,cfg);
 for(const x of [RECTS.speed.left,RECTS.speed.right-1])assert.deepEqual(pixel(c,x,8),rgb(PALETTES.rally.red));
 const normal=render({...v,overspeed:false},cfg);for(const x of [RECTS.speed.left+11,RECTS.speed.right-12])assert.notDeepEqual(pixel(c,x,8),pixel(normal,x,8));
});
test('all temporary panels use their own left border as accent anchor',()=>{
 const cfg=settings(),p=drive(),d=new Dashboard(),base=d.view(p,0,0,cfg);
 for(const [page,critical,color]of [['alert',false,'amber'],['alert',true,'red'],['notice',false,'cyan'],['braking',false,'amber'],['brake',false,'amber'],['paused',false,'amber'],['offline',false,'amber'],['refueling',false,'green']]){
 const v={...base,page,activeAlert:{text:'TEST',critical},tollNotice:{amount:24},refueling:page==='refueling'},rect=page==='refueling'?RECTS.data:RECTS.message;
 const c=render(v,cfg);assert.deepEqual(pixel(c,rect.left,30),rgb(PALETTES.rally[color]),page);assert.equal(rect.contentLeft>=rect.left+rect.indicatorWidth,true);
 }
 const moved=regions({...LAYOUT,selectorEnd:120,gearStart:350,rpmStart:450});assert.equal(moved.speed.left,120);assert.equal(moved.speed.right,350);assert.equal(moved.message.left,450);assert.equal(moved.message.contentLeft-moved.message.left,RECTS.message.contentLeft-RECTS.message.left);
});
test('motion page removes obsolete controls divider and reverse decoration across themes',()=>{
 for(const theme of ['rally','el_mint','el_amber']){const cfg=settings({theme}),p=drive(),d=new Dashboard();d.section=3;const v=d.view(p,0,0,cfg);v.context.REVERSING=true;const c=render(v,cfg);
 for(const y of [6,20,46])assert.deepEqual(pixel(c,LAYOUT.controlsStart,y),pixel(c,LAYOUT.controlsStart-1,y),`${theme} at ${y}`);
 }
});
