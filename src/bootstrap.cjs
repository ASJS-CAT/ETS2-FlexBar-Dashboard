'use strict';
// Keep startup diagnostics usable even when SDK or the native canvas fails to load.
const fs=require('node:fs'),path=require('node:path');
function note(message){
  const line=new Date().toISOString()+' '+message+'\n';
  console.error(line.trim());
  try{const dir=path.resolve(__dirname,'../logs');fs.mkdirSync(dir,{recursive:true});
    fs.appendFileSync(path.join(dir,'startup.log'),line);}catch{}
}
note(`ETS2 Rally 1.0.1 starting; Node ${process.version}; ${process.platform}/${process.arch}`);
try{require('./main.cjs');}
catch(e){note('STARTUP FAILED: '+(e.stack||e.message));process.exitCode=1;}

