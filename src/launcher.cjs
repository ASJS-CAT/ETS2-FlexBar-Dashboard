'use strict';
const {createCanvas}=require('@napi-rs/canvas');
const {FONT_FAMILY}=require('./fonts.cjs');
const {PALETTES}=require('./themes.cjs');
const {createTranslator}=require('./i18n.cjs');
function renderLauncher(cfg={},options={}){
  const c=createCanvas(2170,60),ctx=c.getContext('2d'),theme=PALETTES[cfg.theme]||PALETTES.rally,t=createTranslator(cfg.language||'en');
  ctx.fillStyle=theme.bg;ctx.fillRect(0,0,2170,60);
  ctx.fillStyle=theme.cyan;ctx.fillRect(0,0,2170,2);ctx.fillRect(33,16,4,30);
  ctx.font=`bold 25px ${FONT_FAMILY}`;ctx.fillText('ETS2 FLEXBAR',55,40);
  const prompt=options.bilingual
    ? `${createTranslator('zh')('launcher.open')} / ${createTranslator('en')('launcher.open')}`
    : t('launcher.open');
  ctx.font=`bold 22px ${FONT_FAMILY}`;ctx.fillText(prompt,850,39);
  ctx.font=`14px ${FONT_FAMILY}`;ctx.fillStyle=theme.muted;ctx.fillText('DIRECTDRAW',1980,38);
  return c;
}
module.exports={renderLauncher};
