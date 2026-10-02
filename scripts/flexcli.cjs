'use strict';
// FlexCLI 1.0.7 mixes JSON 'assert' and 'with' syntax. Normalize only the
// deprecated assertion syntax in the installed tool, preserving its commands.
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.dirname(require.resolve('@eniac/flexcli/package.json'));
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){
  const p=path.join(dir,e.name);if(e.isDirectory())walk(p);
  else if(p.endsWith('.js')){const original=fs.readFileSync(p,'utf8');const fixed=original.replace(/assert\s*\{\s*type:\s*'json'\s*\}/g,"with { type: 'json' }");if(fixed!==original)fs.writeFileSync(p,fixed);}
}}
walk(path.join(root,'src'));
import(pathToFileURL(path.join(root,'src/index.js')).href).catch(e=>{console.error(e);process.exitCode=1;});
