'use strict';
const {execFile}=require('node:child_process');
// Read-only identity check. Errors and access denial are UNKNOWN, never exit.
function probeGameProcess(packet){
  const pid=packet?.processId,started=packet?.processStarted;
  if(process.platform!=='win32'||!Number.isInteger(pid)||pid<=0||typeof started!=='string'||!/^\d{1,20}$/.test(started))return Promise.resolve(null);
  const script=`$ErrorActionPreference='Stop'; try { $p=Get-Process -Id ${pid} -ErrorAction Stop; $p.StartTime.ToUniversalTime().ToFileTimeUtc().ToString() } catch [Microsoft.PowerShell.Commands.ProcessCommandException] { 'EXITED' }`;
  return new Promise(resolve=>execFile('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',script],
    {windowsHide:true,timeout:4000,maxBuffer:4096},(error,stdout)=>{
      if(error)return resolve(null);
      const result=stdout.trim();resolve(result==='EXITED'?false:/^\d+$/.test(result)?result===started:null);
    }));
}
module.exports={probeGameProcess};
