'use strict';
const fs=require('node:fs'),path=require('node:path');
// FlexDesigner loads standalone Vue files. Embed the shared translator/catalog
// at build time so the host needs no extra module loader or network request.
function syncUiI18n(root=path.resolve(__dirname,'..')){
  const catalog=JSON.parse(fs.readFileSync(path.join(root,'src/i18n.json'),'utf8'));
  const helper=require('../src/i18n.cjs').createTranslator.toString();
  const generated=`// BEGIN GENERATED I18N\nconst dictionary=${JSON.stringify(catalog)};\n${helper}\n// END GENERATED I18N`;
  for(const file of ['global_config.vue','com.local.ets2rally.dashboard.vue']){
    const p=path.join(root,'com.local.ets2rally.plugin/ui',file),source=fs.readFileSync(p,'utf8');
    fs.writeFileSync(p,source.replace(/\/\/ BEGIN GENERATED I18N[\s\S]*?\/\/ END GENERATED I18N/,()=>generated));
  }
}
module.exports={syncUiI18n};
if(require.main===module)syncUiI18n();
