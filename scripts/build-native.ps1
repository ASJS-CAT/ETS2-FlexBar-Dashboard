param([switch]$Test)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
if (!(Test-Path $vswhere)) { throw 'Install Visual Studio Build Tools with Desktop development with C++.' }
$vsRoot = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (!$vsRoot) { throw 'Visual C++ x64 build tools were not found.' }
$vcvars = Join-Path $vsRoot 'VC/Auxiliary/Build/vcvars64.bat'
$buildDir = Join-Path $projectRoot 'build'
New-Item -ItemType Directory -Force $buildDir | Out-Null
# This batch invokes the compiler only; it performs no filesystem deletion or moving.
$batch = '@echo off' + "`r`n" + 'call "' + $vcvars + '" >nul' + "`r`n" +
 'if errorlevel 1 exit /b 1' + "`r`n" +
 'cl /nologo /std:c++17 /EHsc /W4 /WX /O2 /MT /LD /I"' + (Join-Path $projectRoot 'vendor/scs/include') + '" "' +
 (Join-Path $projectRoot 'native/bridge.cpp') + '" /Fo"' + (Join-Path $buildDir 'bridge.obj') + '" /link ws2_32.lib user32.lib /OUT:"' +
 (Join-Path $buildDir 'ets2-flexbar.dll') + '" /IMPLIB:"' + (Join-Path $buildDir 'ets2-flexbar.lib') + '" /EXPORT:scs_telemetry_init /EXPORT:scs_telemetry_shutdown /EXPORT:scs_input_init /EXPORT:scs_input_shutdown' + "`r`n"
$batchPath = Join-Path $buildDir 'compile.cmd'
Set-Content -LiteralPath $batchPath -Value $batch -Encoding ascii
& $env:ComSpec /d /c $batchPath
if ($LASTEXITCODE -ne 0) { throw 'Native compilation failed.' }
Write-Host 'Built build/ets2-flexbar.dll (Windows x64).'
if ($Test) {
  # Compile the same bridge against isolated test ports. Never send fixture
  # telemetry or test inputs to the user's installed live dashboard.
  $testDllBatch = $batch.Replace('/I"', '/DEFB_TELEMETRY_PORT=39762 /DEFB_COMMAND_PORT=39763 /I"').Replace('bridge.obj','bridge-test.obj').Replace('ets2-flexbar.dll','ets2-flexbar-test.dll').Replace('ets2-flexbar.lib','ets2-flexbar-test.lib')
  $testDllPath = Join-Path $buildDir 'compile-test-dll.cmd'
  Set-Content -LiteralPath $testDllPath -Value $testDllBatch -Encoding ascii
  & $env:ComSpec /d /c $testDllPath
  if ($LASTEXITCODE -ne 0) { throw 'Isolated test DLL compilation failed.' }
  $testBatch = '@echo off' + "`r`n" + 'call "' + $vcvars + '" >nul' + "`r`n" +
    'cl /nologo /std:c++17 /EHsc /W4 /WX /wd4191 /MT /I"' + (Join-Path $projectRoot 'vendor/scs/include') + '" "' +
    (Join-Path $projectRoot 'test/native-host.cpp') + '" /Fo"' + (Join-Path $buildDir 'native-host.obj') + '" /Fe"' +
    (Join-Path $buildDir 'native-host.exe') + '" /link ws2_32.lib user32.lib' + "`r`n"
  $testPath = Join-Path $buildDir 'compile-test.cmd'
  Set-Content -LiteralPath $testPath -Value $testBatch -Encoding ascii
  & $env:ComSpec /d /c $testPath
  if ($LASTEXITCODE -ne 0) { throw 'Native test compilation failed.' }
  & (Join-Path $buildDir 'native-host.exe') (Join-Path $buildDir 'ets2-flexbar-test.dll')
  if ($LASTEXITCODE -ne 0) { throw 'Native SDK integration tests failed.' }
}
