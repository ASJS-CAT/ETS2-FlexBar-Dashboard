'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const {auditGitPrivacy,entryExists,pluginLogs}=require('./audit-git-privacy.cjs');
const read=p=>fs.readFileSync(path.join(root,p),'utf8'),json=p=>JSON.parse(read(p));
const failures=[];const check=(ok,why)=>{if(!ok)failures.push(why);};
check(!entryExists(path.join(root,pluginLogs)),'Forbidden public export directory: '+pluginLogs+' (including empty or ignored directories)');
const pkg=json('package.json'),lock=json('package-lock.json'),manifest=json('com.local.ets2rally.plugin/manifest.json');
check([pkg.version,lock.version,lock.packages[''].version,manifest.version].every(v=>v===pkg.version)&&/^\d+\.\d+\.\d+$/.test(pkg.version),'Version mismatch');
check(manifest.repo==='https://github.com/ASJS-CAT/ETS2-FlexBar-Dashboard','Repository mismatch');
check(pkg.license==='PolyForm-Noncommercial-1.0.0','Project license mismatch');
check(read('src/bootstrap.cjs').includes(' '+pkg.version+' starting;')&&read('src/runtime.cjs').includes("version:'"+pkg.version+"'"),'Runtime version mismatch');
const ignore=new Set(['node_modules','build','release-candidate','.git','.cache']);
const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){
 if(ignore.has(e.name))continue;
 const p=path.join(dir,e.name),rel=path.relative(root,p).replaceAll('\\','/');
 if(/^com\.local\.ets2rally\.plugin\/(backend|resources)(\/|$)/.test(rel))continue;
 if(e.isDirectory())walk(p);else files.push(rel);
}}
walk(root);
for(const rel of files){
 check(!/\.(dng|jpe?g|log|jsonl|dmp|dll|exe|obj|pdb|flexplugin|ttf|otf|ttc)$/i.test(rel),'Forbidden source artifact: '+rel);
 if(/\.(cjs|cpp|ps1|json|vue|md|yml|txt|h)$/.test(rel)){
  const content=read(rel);
  check(!/[A-Z]:[\\/]Users[\\/]/i.test(content),'Personal absolute path: '+rel);
  check(!/(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(content),'Credential pattern: '+rel);
 }
}
for(const name of ['rally','mint','amber','offline','paused','driving','overspeed','braking','job-info','trailer-info','refueling']){
 const b=fs.readFileSync(path.join(root,`docs/assets/dashboard-${name}.png`));
 check(b.subarray(1,4).toString()==='PNG'&&b.readUInt32BE(16)===2170&&b.readUInt32BE(20)===60,'Invalid framebuffer: '+name);
}
check(!/dynamickey/i.test(read('src/runtime.cjs')),'Unexpected Dynamic Key runtime');
const inventory=files.sort().map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')}));
fs.mkdirSync(path.join(root,'build'),{recursive:true});
fs.writeFileSync(path.join(root,'build/source-inventory.json'),JSON.stringify(inventory,null,2)+'\n');
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log(`PASS static source checks: ${files.length} source/documentation files; not source privacy approval.`);
const gitDirAt=process.argv.indexOf('--git-dir');
if(gitDirAt>=0&&(!process.argv[gitDirAt+1]||process.argv[gitDirAt+1].startsWith('--')))throw Error('Missing --git-dir value');
const privacy=auditGitPrivacy({root,gitDir:gitDirAt<0?undefined:process.argv[gitDirAt+1]});
fs.writeFileSync(path.join(root,'build/git-privacy-report.json'),JSON.stringify(privacy,null,2)+'\n');
for(const f of privacy.findings)console.error(`${f.rule}: ${f.file}${f.line?':'+f.line:''}`);
if(!privacy.pass)process.exitCode=1;
console.log(`${privacy.pass?'PASS':'FAIL'} source privacy: actual Git index, ${privacy.trackedFiles} files; ${privacy.findings.length} findings. See build/git-privacy-report.json.`);
const legal=require('./legal-materials.cjs').auditLegalMaterials(root,{checkResources:!process.argv.includes('--source-only')});
for(const failure of legal.failures)console.error(failure);
if(!legal.pass)process.exitCode=1;
console.log(`${legal.pass?'PASS':'FAIL'} practical-compliance legal materials; ${legal.materialCount} required records.`);
for(const note of legal.advisories)console.log(`ADVISORY ${note.id} (nonblocking): ${note.summary}`);
if(process.argv.includes('--source-only'))console.log('Source-only verification is NOT release/package approval.');
