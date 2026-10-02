'use strict';
const {GlobalFonts}=require('@napi-rs/canvas');
const path=require('node:path'),fs=require('node:fs');
const loaded=[];
for(const [file,alias] of [['arial.ttf','Rally Latin'],['msyh.ttc','Rally CJK'],['msyhbd.ttc','Rally CJK Bold']]){
  if(!process.env.WINDIR)continue;
  const location=path.join(process.env.WINDIR,'Fonts',file);
  try{if(fs.existsSync(location)&&GlobalFonts.registerFromPath(location,alias))loaded.push(alias);}catch{}
}
const FONT_FAMILY='"Rally Latin", "Rally CJK", "Microsoft YaHei", "Yu Gothic", Arial, sans-serif';
module.exports={FONT_FAMILY,fontDiagnostics:{loaded,cjkAvailable:loaded.includes('Rally CJK')}};
