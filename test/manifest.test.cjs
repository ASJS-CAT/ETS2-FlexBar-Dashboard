const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
test('every declared plugin UI has the exact filename FlexDesigner resolves',()=>{
  const root=path.resolve(__dirname,'../com.local.ets2rally.plugin');
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
  assert.ok(fs.existsSync(path.join(root,'ui',manifest.configPage+'.vue')));
  for(const key of manifest.keyLibrary.children){
    assert.match(key.cid,new RegExp('^'+manifest.uuid.replaceAll('.','\\.')+'\\.'));
    assert.ok(fs.existsSync(path.join(root,'ui',key.cid+'.vue')),`missing UI for ${key.cid}`);
  }
  assert.ok(manifest.local['zh-CN'],'FlexDesigner locale key must use the documented zh-CN spelling');
});
test('key library title and tip use documented host localization with English fallback entries',()=>{
 const manifest=require('../com.local.ets2rally.plugin/manifest.json');
 const key=manifest.keyLibrary.children[0];
 for(const token of [manifest.keyLibrary.title,key.title,key.tip]){
  assert.match(token,/^\$[A-Za-z]+$/);
  const id=token.slice(1);
  for(const locale of ['en','de','fr','ja','zh-CN','zh-HK','ko'])assert.ok(manifest.local[locale][id],`${locale}/${id}`);
  assert.match(manifest.local.en[id],/[A-Za-z]/);
 }
 assert.match(manifest.local['zh-CN'].DashboardTip,/点击进入/);
 assert.match(manifest.local.en.DashboardTip,/Tap to open/);
});
