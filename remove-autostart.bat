@echo off
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Join-Path ([Environment]::GetFolderPath('Startup')) 'Xiaot Workbench.lnk'; if (Test-Path $p) { Remove-Item $p -Force; Write-Host '已移除登录自动启动。' } else { Write-Host '没有找到自动启动快捷方式。' }"
pause
