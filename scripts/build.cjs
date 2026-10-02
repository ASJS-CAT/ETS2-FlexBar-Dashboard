'use strict';
const fs=require('node:fs'),path=require('node:path');
const {rollup}=require('rollup');
const {nodeResolve}=require('@rollup/plugin-node-resolve');
const commonjs=require('@rollup/plugin-commonjs');
const json=require('@rollup/plugin-json');
async function main(){
  const root=path.resolve(__dirname,'..'); process.chdir(root);
  require('./ui-i18n.cjs').syncUiI18n(root);
  // Cover is available in the manifest before any activation event or telemetry.
  const manifestPath='com.local.ets2rally.plugin/manifest.json',manifest=JSON.parse(fs.readFileSync(manifestPath));
  const cover=require('../src/launcher.cjs').renderLauncher({}, {bilingual:true}).toDataURL('image/png');
  Object.assign(manifest.keyLibrary.children[0].style,{width:2170,showImage:true,showIcon:false,showTitle:false,image:cover});
  fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  const backend='com.local.ets2rally.plugin/backend';fs.mkdirSync(backend,{recursive:true});
  const bundle=await rollup({input:'src/plugin.cjs',external:['@napi-rs/canvas',/^node:/],
    plugins:[nodeResolve({preferBuiltins:true}),commonjs(),json(),{
      name:'cjs-import-meta',resolveImportMeta(property){
        if(property==='url')return "require('node:url').pathToFileURL(__filename).href";
      }
    }]});
  await bundle.write({file:`${backend}/main.cjs`,format:'cjs',inlineDynamicImports:true});
  await bundle.close();
  fs.copyFileSync('src/bootstrap.cjs',`${backend}/plugin.cjs`);
  // Bundle Windows x64 canvas explicitly so importing the plugin does not need npm.
  for(const name of ['@napi-rs/canvas','@napi-rs/canvas-win32-x64-msvc']){
    const target=path.join(backend,'node_modules',name);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.cpSync(path.join('node_modules',name),target,{recursive:true});
  }
  fs.writeFileSync(`${backend}/package.json`,JSON.stringify({name:'ets2-rally-backend',version:JSON.parse(fs.readFileSync('package.json')).version,private:true,type:'commonjs'}));
  const notices=['@eniac/flexdesigner','@napi-rs/canvas'];
  for(const name of notices){
    const dir=path.join('node_modules',name);
    for(const file of fs.readdirSync(dir).filter(n=>/^licen[cs]e/i.test(n)))fs.copyFileSync(path.join(dir,file),path.join('com.local.ets2rally.plugin/resources',name.replace('/','-').replace('@','')+'-'+file));
  }
  // Preserve notices from bundled transitive dependencies (extra development
  // notices are harmless and make source redistribution easier).
  const licenseDir='com.local.ets2rally.plugin/resources/third-party-licenses';
  fs.mkdirSync(licenseDir,{recursive:true});
  function collect(dir){
    for(const e of fs.readdirSync(dir,{withFileTypes:true})){
      if(e.name==='.bin')continue;
      const p=path.join(dir,e.name);
      if(e.isDirectory())collect(p);
      else if(/^licen[cs]e(?:[.\-]|$)/i.test(e.name)){
        const name=path.relative('node_modules',p).replace(/[\\/]/g,'__');
        fs.copyFileSync(p,path.join(licenseDir,name));
      }
    }
  }
  collect('node_modules');
  for(const file of ['LICENSE','THIRD_PARTY_NOTICES.md'])if(fs.existsSync(file))fs.copyFileSync(file,path.join('com.local.ets2rally.plugin/resources',file));
  fs.copyFileSync('vendor/scs/sdk_license.txt','com.local.ets2rally.plugin/resources/SCS-SDK-LICENSE.txt');
  // Ship recipient-facing notices, full license texts and required MPL sources.
  // Detailed historical research stays in docs/legal-audit, not the plugin UI.
  require('./legal-materials.cjs').syncLegalMaterials(root);
  console.log('Built self-contained Windows x64 FlexDesigner plugin backend.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
