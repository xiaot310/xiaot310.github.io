@echo off
rem 停止由 server.py / start-hidden.vbs 启动的本地工作台。
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*workbench*server.py*' } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force } catch {} }"
echo 本地工作台已停止。
timeout /t 2 /nobreak >nul
