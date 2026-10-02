param([Parameter(Mandatory=$true)][string]$GameRoot)
$ErrorActionPreference = 'Stop'
if (Get-Process eurotrucks2 -ErrorAction SilentlyContinue) { throw '请先完全退出欧卡 2。' }
$projectRoot = Split-Path $PSScriptRoot -Parent
$resolvedGame = (Resolve-Path -LiteralPath $GameRoot).Path
$gameExe = Join-Path $resolvedGame 'bin/win_x64/eurotrucks2.exe'
if (!(Test-Path -LiteralPath $gameExe -PathType Leaf)) { throw 'GameRoot 必须是含 bin/win_x64/eurotrucks2.exe 的欧卡 2 安装目录。' }
$sourceDll = Join-Path $projectRoot 'ets2-flexbar.dll'
if (!(Test-Path -LiteralPath $sourceDll)) { $sourceDll = Join-Path $projectRoot 'build/ets2-flexbar.dll' }
if (!(Test-Path -LiteralPath $sourceDll)) { throw '找不到已编译的 DLL。请先运行 build-native.ps1。' }
$pluginsDir = [IO.Path]::GetFullPath((Join-Path $resolvedGame 'bin/win_x64/plugins'))
if (!$pluginsDir.StartsWith($resolvedGame.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw '目标路径校验失败。' }
New-Item -ItemType Directory -Force -Path $pluginsDir | Out-Null
$targetDll = Join-Path $pluginsDir 'ets2-flexbar.dll'
if (Test-Path -LiteralPath $targetDll) {
  $backup = $targetDll + '.' + [Guid]::NewGuid().ToString('N') + '.backup'
  Copy-Item -LiteralPath $targetDll -Destination $backup
  Write-Host "旧版本已备份到 $backup"
}
Copy-Item -LiteralPath $sourceDll -Destination $targetDll -Force
if ((Get-FileHash -LiteralPath $sourceDll).Hash -ne (Get-FileHash -LiteralPath $targetDll).Hash) { throw '复制后的文件校验失败。' }
Write-Host "已安装到 $targetDll"
Write-Host '启动游戏后接受 SDK 提示，并按 README 绑定 Flexbar Rally 输入。'
