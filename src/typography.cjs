'use strict';
// Centre visible glyph ink, not the font's em box or nominal baseline.
function inkPlacement(metrics,rect){
  const inkWidth=metrics.actualBoundingBoxLeft+metrics.actualBoundingBoxRight;
  const scaleX=Math.min(1,rect.width/Math.max(1,inkWidth));
  return {scaleX,x:rect.align==='left'?rect.left+metrics.actualBoundingBoxLeft*scaleX:rect.left+rect.width/2+(metrics.actualBoundingBoxLeft-metrics.actualBoundingBoxRight)*scaleX/2,
    y:rect.top+rect.height/2+(metrics.actualBoundingBoxAscent-metrics.actualBoundingBoxDescent)/2};
}
function drawCenteredInk(c,label,rect,font,color){
  c.save();c.font=font;c.textBaseline='alphabetic';c.fillStyle=color;
  const p=inkPlacement(c.measureText(String(label)),rect);
  c.translate(Math.round(p.x),Math.round(p.y));c.scale(p.scaleX,1);c.fillText(String(label),0,0);c.restore();
}
module.exports={inkPlacement,drawCenteredInk};
