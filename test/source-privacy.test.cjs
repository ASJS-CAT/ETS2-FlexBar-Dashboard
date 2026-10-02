'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {auditGitPrivacy,pluginLogs}=require('../scripts/audit-git-privacy.cjs');
function fixture(t){
 const base=path.resolve(os.tmpdir()),root=fs.mkdtempSync(path.join(base,'ets2-privacy-test-'));
 const git=(...args)=>execFileSync('git',args,{cwd:root,stdio:'pipe'});
 git('init');
 t.after(()=>{assert.equal(path.dirname(path.resolve(root)),base);assert.ok(path.basename(root).startsWith('ets2-privacy-test-'));fs.rmSync(root,{recursive:true,force:true});});
 const put=(name,text)=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
 put('.gitignore',pluginLogs+'/\nnode_modules/\nbuild/\nwork/\n');
 put('README.md','Test source\n');git('add','.');
 return {root,git,put,scan:()=>auditGitPrivacy({root})};
}
test('privacy reads staged blobs, not sanitized working copies or ignored dependencies',t=>{
 const f=fixture(t);
 f.put('sample.txt',['C:','Users','private','sample'].join(String.fromCharCode(92)));f.git('add','sample.txt');
 f.put('sample.txt','clean unstaged replacement');
 let r=f.scan();assert.equal(r.pass,false);assert.ok(r.findings.some(x=>x.rule==='personal-absolute-path'));
 f.git('add','sample.txt');f.put('node_modules/ignored.txt','/home'+'/private');
 r=f.scan();assert.equal(r.pass,true);assert.ok(!r.files.some(x=>x.file.startsWith('node_modules/')));
});
test('even empty and ignored plugin logs directory blocks source privacy',t=>{
 const f=fixture(t);assert.equal(f.scan().pass,true);
 fs.mkdirSync(path.join(f.root,pluginLogs),{recursive:true});
 let r=f.scan();assert.equal(r.pass,false);assert.ok(r.findings.some(x=>x.rule==='forbidden-directory-present-even-if-ignored-or-empty'));
 f.put(pluginLogs+'/.audit.json','{}');f.git('add','.');
 r=f.scan();assert.equal(r.pass,false);assert.ok(!r.files.some(x=>x.file.startsWith(pluginLogs+'/')));
});
test('tracked home paths, secrets, environment files and binary artifacts fail without reporting secret values',t=>{
 const f=fixture(t);
 const secret='gh'+'p_'+'a'.repeat(36);
 f.put('mac.txt','/Users'+'/someone/project');f.put('linux.txt','/home'+'/someone/project');
 f.put('settings.txt',secret);f.put('.env','VALUE=test');
 f.put('literal.txt',['token','=',JSON.stringify('test-'+'123456789')].join(' '));
 f.put('artifact.dll',Buffer.from([77,90,0,1]));f.put('logs/.audit.json','{}');f.git('add','.');
 const r=f.scan();assert.equal(r.pass,false);
 for(const file of ['mac.txt','linux.txt','settings.txt','literal.txt','.env','artifact.dll','logs/.audit.json'])assert.ok(r.findings.some(x=>x.file===file),file);
 assert.ok(!JSON.stringify(r).includes(secret));
});
test('keyword-only references are retained for review rather than treated as credentials',t=>{
 const f=fixture(t);f.put('policy.md','Do not include credentials, tokens, .env, logs or binaries.');f.git('add','.');
 const r=f.scan();assert.equal(r.pass,true);assert.ok(r.keywordReferences.some(x=>x.file==='policy.md'));
});
test('an empty Git index cannot produce source privacy PASS',t=>{
 const f=fixture(t);f.git('rm','--cached','-r','.');
 const r=f.scan();assert.equal(r.pass,false);assert.ok(r.findings.some(x=>x.rule==='empty-git-index'));
});

test('only the exact reviewed MPL source archive is allowed, not a changed or renamed binary',t=>{
 const f=fixture(t),name='docs/legal-audit/sources/cssparser-color-0.3.0.crate';
 const bytes=fs.readFileSync(path.join(__dirname,'..',name));
 f.put(name,bytes);f.git('add','.');assert.equal(f.scan().pass,true);
 f.put(name,Buffer.concat([bytes,Buffer.from('changed')]));f.git('add','.');
 assert.ok(f.scan().findings.some(x=>x.rule==='reviewed-source-archive-hash-mismatch'));
 f.put(name,bytes);f.put('unreviewed.crate',bytes);f.git('add','.');
 assert.ok(f.scan().findings.some(x=>x.file==='unreviewed.crate'&&x.rule==='unexpected-binary-or-non-utf8-content'));
});

test('a child directory cannot inherit its parent repository',t=>{
 const f=fixture(t),child=path.join(f.root,'child');fs.mkdirSync(child);
 const r=auditGitPrivacy({root:child});
 assert.equal(r.pass,false);assert.equal(r.trackedFiles,0);
 assert.ok(r.findings.some(x=>x.rule==='git-index-unavailable-initialize-and-stage-source-first'));
});

test('repository aliases resolve to the same staged index',t=>{
 const f=fixture(t),alias=path.join(f.root,'alias');
 fs.symlinkSync(f.root,alias,process.platform==='win32'?'junction':'dir');
 try{
  const expected=f.scan(),actual=auditGitPrivacy({root:alias});
  assert.equal(actual.pass,true);assert.deepEqual(actual.files,expected.files);
 }finally{fs.unlinkSync(alias);}
});

test('inherited Git index and work-tree overrides cannot hide staged private content',t=>{
 const f=fixture(t),other=fixture(t);
 f.put('private.txt','/home'+'/fixture/private');f.git('add','private.txt');
 const names=['GIT_DIR','GIT_WORK_TREE','GIT_INDEX_FILE'];
 const saved=Object.fromEntries(names.map(k=>[k,process.env[k]]));
 try{
  process.env.GIT_DIR=path.join(other.root,'.git');process.env.GIT_WORK_TREE=other.root;
  process.env.GIT_INDEX_FILE=path.join(other.root,'.git/index');
  const r=f.scan();assert.equal(r.pass,false);
  assert.ok(r.findings.some(x=>x.file==='private.txt'&&x.rule==='personal-absolute-path'));
 }finally{for(const k of names)if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}
});
