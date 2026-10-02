'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
execFileSync(process.execPath,[path.join(__dirname,'audit-release.cjs')],{cwd:root,stdio:'inherit'});
const version=require('../package.json').version,out=path.join(root,'release-candidate',version);
const inputs=['com.local.ets2rally.flexplugin','build/ets2-flexbar.dll','LICENSE','THIRD_PARTY_NOTICES.md','vendor/scs/sdk_license.txt'];
for(const file of inputs)if(!fs.existsSync(path.join(root,file)))throw Error('Missing RC input: '+file);
fs.mkdirSync(out,{recursive:true});
const sums=[];
for(const file of inputs){const name=path.basename(file),b=fs.readFileSync(path.join(root,file));fs.writeFileSync(path.join(out,name),b);sums.push(crypto.createHash('sha256').update(b).digest('hex')+'  '+name);}
fs.cpSync(path.join(root,'docs/licenses'),path.join(out,'licenses'),{recursive:true});
fs.writeFileSync(path.join(out,'SHA256SUMS.txt'),sums.join('\n')+'\n');
fs.writeFileSync(path.join(out,'RELEASE_NOTES.md'),'# ETS2 FlexBar Dashboard '+version+' Release Candidate\n\nDirectDraw; Windows x64. Follow docs/QUICKSTART.md in the repository. The game bridge DLL goes in the actual game root at bin/win_x64/plugins/ets2-flexbar.dll. This is a test candidate, not publishing authorization.\n\nDirectDraw 测试候选包，按仓库新手指南安装，未经实机验收不得发布。\n');
fs.writeFileSync(path.join(out,'FINAL_VALIDATION.md'),'# Validation status\n\nPackage produced by the official CLI after the source/release gate. Import into FlexDesigner and all physical FlexBar + ETS2 checklist items remain manual unless separately recorded with evidence. No public upload has been performed.\n\n此文件不声称完成实机验证。\n');
console.log(out);
