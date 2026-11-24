@echo off
rem 一键启动本地工作台（后台 Python，不弹终端），然后打开工作台页面。
start "" wscript.exe "%~dp0workbench\start-hidden.vbs"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8765/workbench/"
