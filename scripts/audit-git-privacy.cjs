'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {reviewedSources}=require('./legal-materials.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const pluginLogs='com.local.ets2rally.plugin/logs';
function entryExists(file){try{fs.lstatSync(file);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
// Native realpath expands Windows 8.3 names and junctions; path.relative also
// handles Windows separators/case without treating POSIX paths as case-insensitive.
const sameDirectory=(a,b)=>path.relative(fs.realpathSync.native(a),fs.realpathSync.native(b))==='';
function auditGitPrivacy({root,gitDir}={}){
 root=path.resolve(root||path.join(__dirname,'..'));
 const findings=[],files=[],keywordReferences=[];
 const fail=(file,rule,line)=>findings.push({file,rule,...(line?{line}:{})});
 if(entryExists(path.join(root,pluginLogs)))fail(pluginLogs,'forbidden-directory-present-even-if-ignored-or-empty');
 const repository=path.resolve(gitDir||path.join(root,'.git'));
 const args=['--git-dir',repository,'--work-tree',root];
 // An inherited index or object-store override must not change what is audited.
 const env={...process.env};
 for(const key of Object.keys(env))if(/^GIT_(?:DIR|WORK_TREE|INDEX_FILE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|NAMESPACE)$/i.test(key))delete env[key];
 const git=(...cmd)=>execFileSync('git',[...args,...cmd],{cwd:root,env,encoding:null,stdio:['pipe','pipe','pipe'],maxBuffer:64*1024*1024});
 let entries=[];
 try{
  // Require a repository at the supplied root; never discover one in a parent.
  if(!fs.statSync(repository).isDirectory())throw Error('missing repository directory');
  if(git('rev-parse','--is-bare-repository').toString().trim()!=='false')throw Error('bare repository');
  if(!sameDirectory(git('rev-parse','--absolute-git-dir').toString().trim(),repository))throw Error('wrong git directory');
  const top=git('rev-parse','--show-toplevel').toString().trim();
  if(!sameDirectory(top,root))throw Error('wrong repository root');
  entries=git('ls-files','--stage','-z').toString('utf8').split('\0').filter(Boolean);
  if(!entries.length)fail('.','empty-git-index');
 }catch{fail('.','git-index-unavailable-initialize-and-stage-source-first');}
 for(const record of entries){
  const match=record.match(/^(\d+) ([a-f\d]+) (\d+)\t([\s\S]+)$/);
  if(!match){fail('.','invalid-index-entry');continue;}
  const [,mode,oid,stage,file]=match;
  if(stage!=='0'||!['100644','100755'].includes(mode)){fail(file,'unmerged-symlink-or-submodule-entry');continue;}
  const content=git('cat-file','blob',oid);
  files.push({file,gitBlob:oid,sha256:hash(content),bytes:content.length});
  if(/(?:^|\/)(?:node_modules|build|work|logs?|release-candidate|\.cache)(?:\/|$)/i.test(file))fail(file,'generated-or-log-path-tracked');
  if(/(?:^|\/)(?:\.env(?:\..*)?|\.npmrc|\.netrc|credentials(?:\.[^/]*)?|id_(?:rsa|ed25519))(?:$|\/)/i.test(file))fail(file,'credential-or-environment-file-tracked');
  if(/\.(?:dll|exe|node|so|dylib|a|lib|obj|o|pdb|exp|bin|zip|7z|rar|tar|tgz|gz|flexplugin|dmp|log|jsonl|dng|jpe?g|ttf|otf|ttc)$/i.test(file))fail(file,'binary-archive-log-or-private-capture-tracked');
  // Approved documentation PNGs are intentional source assets, not executable binaries.
  if(Object.hasOwn(reviewedSources,file)){
   if(hash(content)!==reviewedSources[file])fail(file,'reviewed-source-archive-hash-mismatch');
   continue;
  }
  if(/^docs\/assets\/[^/]+\.png$/.test(file)&&content.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))continue;
  let text;
  try{text=new TextDecoder('utf-8',{fatal:true}).decode(content);if(content.includes(0))throw Error('NUL');}
  catch{fail(file,'unexpected-binary-or-non-utf8-content');continue;}
  if(content.subarray(0,2).toString()==='MZ'||content.subarray(0,4).equals(Buffer.from([127,69,76,70])))fail(file,'executable-signature');
  const lines=text.split(/\r?\n/);
  for(let i=0;i<lines.length;i++){
   const line=lines[i];
   if(/(?:[A-Z]:[\\/]+Users[\\/]+|\/(?:Users|home)\/)/i.test(line))fail(file,'personal-absolute-path',i+1);
   if(/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[A-Z0-9]{16}|sk-[A-Za-z0-9_-]{24,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(line))fail(file,'credential-signature',i+1);
   if(/\b(?:password|passwd|secret|(?:(?:access|auth|api)[_-]?)?token|api[_-]?key)\b["']?\s*[:=]\s*["'][^"'\s]{8,}["']/i.test(line))fail(file,'literal-secret-assignment-needs-review',i+1);
   const terms=[...new Set(line.match(/\b(?:credentials?|tokens?|logs?|binaries)\b|\.env/gi)||[])];
   if(terms.length)keywordReferences.push({file,line:i+1,terms});
  }
 }
 const report={scope:'actual Git index blobs; working-tree plugin logs entry must be absent',pass:findings.length===0,trackedFiles:files.length,indexInventorySha256:hash(Buffer.from(JSON.stringify(files))),findings,keywordReferences,files};
 return report;
}
function option(name){const i=process.argv.indexOf(name);if(i<0)return undefined;if(!process.argv[i+1]||process.argv[i+1].startsWith('--'))throw Error('Missing '+name+' value');return process.argv[i+1];}
if(require.main===module){
 const report=auditGitPrivacy({root:option('--root'),gitDir:option('--git-dir')});
 const output=option('--report');if(output)fs.writeFileSync(path.resolve(output),JSON.stringify(report,null,2)+'\n');
 for(const f of report.findings)console.error(`${f.rule}: ${f.file}${f.line?':'+f.line:''}`);
 console.log(`${report.pass?'PASS':'FAIL'} Git-index source privacy: ${report.trackedFiles} tracked files; ${report.findings.length} blocking findings; ${report.keywordReferences.length} keyword references recorded (words alone are not credentials).`);
 if(!report.pass)process.exitCode=1;
}
module.exports={auditGitPrivacy,entryExists,pluginLogs};
