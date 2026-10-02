'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const resourceDir='com.local.ets2rally.plugin/resources';
const documents=['LICENSE','THIRD_PARTY_NOTICES.md','SOURCE_AVAILABILITY.md'];
const blockerKinds=new Set(['prohibited-distribution','missing-required-license-text','missing-required-source-access','unknown-or-unauthorized-proprietary-component']);
// Only these two reviewed public source archives are allowed by the privacy scanner.
// Hashes apply to Git-index blobs as well as the files copied into the installer.
const reviewedSources=Object.freeze({
 'docs/legal-audit/sources/cssparser-0.35.0.crate':'4e901edd733a1472f944a45116df3f846f54d37e67e68640ac8bb69689aca2aa',
 'docs/legal-audit/sources/cssparser-color-0.3.0.crate':'6eeef9ae8c0e112edd89eb6406b3156ffa99c7e037b3baef1dbdf4158d35c324'
});
function load(root){return JSON.parse(fs.readFileSync(path.join(root,'docs/legal-audit/materials.json'),'utf8'));}
function inside(root,relative){
 const absolute=path.resolve(root,relative);
 if(path.isAbsolute(relative)||!absolute.startsWith(path.resolve(root)+path.sep))throw Error('Unsafe legal-material path');
 return absolute;
}
function auditLegalMaterials(root,{checkResources=true}={}){
 const failures=[],m=load(root);
 const verify=(relative,expected)=>{
  const p=inside(root,relative);
  if(!fs.existsSync(p)){failures.push('Missing required legal material: '+relative);return;}
  if(hash(fs.readFileSync(p))!==expected)failures.push('Legal material hash mismatch: '+relative);
 };
 verify('LICENSE',m.projectLicenseSha256);
 for(const item of m.materials){
  verify(item.source,item.sha256);
  if(checkResources)verify(resourceDir+'/'+item.target,item.sha256);
 }
 for(const [p,h] of Object.entries(reviewedSources))verify(p,h);
 for(const doc of documents){
  const file=inside(root,doc);
  if(!fs.existsSync(file)){failures.push('Missing release document: '+doc);continue;}
  if(checkResources)verify(resourceDir+'/'+doc,hash(fs.readFileSync(file)));
 }
 const sourceFile=inside(root,'SOURCE_AVAILABILITY.md');
 if(fs.existsSync(sourceFile)){
  const text=fs.readFileSync(sourceFile,'utf8');
  for(const [p,h] of Object.entries(reviewedSources)){
   const n=path.basename(p),crate=n.slice(0,n.lastIndexOf('-'));
   if(!text.includes('https://static.crates.io/crates/'+crate+'/'+n)||!text.includes(h))failures.push('Missing exact source URL/hash: '+n);
  }
 }
 if(checkResources)verify(m.canvas.file,m.canvas.sha256);
 const provenance=inside(root,'docs/legal-audit/canvas-provenance.json');
 if(!fs.existsSync(provenance))failures.push('Missing official Canvas asset evidence');
 else {
  const p=JSON.parse(fs.readFileSync(provenance,'utf8'));
  if(p.binary.sha256!==m.canvas.sha256||p.upstreamReleaseAsset.digest!=='sha256:'+m.canvas.sha256)failures.push('Canvas official asset evidence mismatch');
 }
 const gates=JSON.parse(fs.readFileSync(inside(root,'release-gates.json'),'utf8'));
 if(gates.policy!=='practical-compliance-v1')failures.push('Unrecognized release policy');
 for(const b of gates.blockers){
  if(!blockerKinds.has(b.kind))failures.push('Unrecognized blocker category: '+b.id);
  if(b.status!=='resolved')failures.push('BLOCKER '+b.id+': '+b.summary);
 }
 return {pass:failures.length===0,failures,materialCount:m.materials.length,advisories:gates.advisories||[]};
}
function syncLegalMaterials(root){
 const check=auditLegalMaterials(root,{checkResources:false});
 if(!check.pass)throw Error(check.failures.join('\n'));
 for(const item of load(root).materials){
  const to=inside(root,resourceDir+'/'+item.target);fs.mkdirSync(path.dirname(to),{recursive:true});
  fs.copyFileSync(inside(root,item.source),to);
 }
 for(const doc of documents)fs.copyFileSync(inside(root,doc),inside(root,resourceDir+'/'+doc));
 return check.materialCount;
}
if(require.main===module){
 const root=path.resolve(__dirname,'..');
 if(process.argv.includes('--sync'))console.log('Synced legal materials: '+syncLegalMaterials(root));
 const result=auditLegalMaterials(root);for(const f of result.failures)console.error(f);
 console.log(`${result.pass?'PASS':'FAIL'} practical compliance: ${result.materialCount} required texts/source materials; ${result.advisories.length} nonblocking advisories.`);
 if(!result.pass)process.exitCode=1;
}
module.exports={auditLegalMaterials,syncLegalMaterials,reviewedSources};
