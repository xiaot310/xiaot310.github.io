$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$startup = [Environment]::GetFolderPath('Startup')
$pythonw = (Get-Command pythonw.exe).Source
$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut((Join-Path $startup 'Xiaot Workbench.lnk'))
$lnk.TargetPath = $pythonw
$lnk.Arguments = '"' + (Join-Path $root 'workbench\server.py') + '" --no-open'
$lnk.WorkingDirectory = $root
$lnk.WindowStyle = 7
$lnk.Description = 'Start local workbench hidden at logon'
$lnk.Save()
Write-Host "Autostart installed: $($lnk.FullName)"
