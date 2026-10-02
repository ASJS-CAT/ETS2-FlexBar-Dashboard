'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {auditLegalMaterials,syncLegalMaterials}=require('../scripts/legal-materials.cjs');
const project=path.resolve(__dirname,'..');
function fixture(t){
 const base=path.resolve(os.tmpdir()),root=fs.mkdtempSync(path.join(base,'ets2-legal-test-'));
 t.after(()=>{assert.equal(path.dirname(path.resolve(root)),base);assert.ok(path.basename(root).startsWith('ets2-legal-test-'));fs.rmSync(root,{recursive:true,force:true});});
 const m=JSON.parse(fs.readFileSync(path.join(project,'docs/legal-audit/materials.json')));
 const names=new Set(['docs/legal-audit/materials.json','docs/legal-audit/canvas-provenance.json','release-gates.json','LICENSE','THIRD_PARTY_NOTICES.md','SOURCE_AVAILABILITY.md',m.canvas.file,...m.materials.map(x=>x.source)]);
 for(const name of names){const p=path.join(root,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.copyFileSync(path.join(project,name),p);}
 fs.mkdirSync(path.join(root,'com.local.ets2rally.plugin/resources'),{recursive:true});
 syncLegalMaterials(root);return {root,m};
}
test('complete practical materials pass; source acquisition is intact despite nonblocking B001/H001',t=>{
 const {root}=fixture(t),r=auditLegalMaterials(root);
 assert.equal(r.pass,true,r.failures.join('\n'));assert.deepEqual(r.advisories.map(x=>x.id),['B001','H001']);
});
test('missing copied license and damaged MPL source still block release',t=>{
 const {root,m}=fixture(t);
 const p=path.join(root,'com.local.ets2rally.plugin/resources',m.materials.find(x=>x.target.startsWith('third-party-licenses/')).target);
 fs.unlinkSync(p);
 fs.appendFileSync(path.join(root,'docs/legal-audit/sources/cssparser-color-0.3.0.crate'),'tamper');
 const r=auditLegalMaterials(root);assert.equal(r.pass,false);
 assert.ok(r.failures.some(x=>x.includes('Missing required legal material')));
 assert.ok(r.failures.some(x=>x.includes('cssparser-color-0.3.0.crate')));
});
test('explicit prohibited distribution finding blocks; absent exact source link also blocks',t=>{
 const {root}=fixture(t),p=path.join(root,'release-gates.json');
 const gates=JSON.parse(fs.readFileSync(p));gates.blockers.push({id:'TEST','kind':'prohibited-distribution',status:'open',summary:'confirmed license prohibition'});fs.writeFileSync(p,JSON.stringify(gates));
 const source=path.join(root,'SOURCE_AVAILABILITY.md');fs.writeFileSync(source,'MPL sources are somewhere on the internet.');
 const r=auditLegalMaterials(root,{checkResources:false});assert.equal(r.pass,false);
 assert.ok(r.failures.some(x=>x.startsWith('BLOCKER TEST')));assert.ok(r.failures.some(x=>x.includes('Missing exact source URL/hash')));
});
