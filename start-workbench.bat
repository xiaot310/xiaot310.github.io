@echo off
rem =====================================================================
rem  Yiting Workbench - local research workbench launcher
rem  Starts workbench\server.py with Python 3 (standard library only).
rem  Usage:  start-workbench.bat
rem          start-workbench.bat --no-open
rem          start-workbench.bat --port 8766
rem =====================================================================
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if errorlevel 1 goto try_python
py -3 "workbench\server.py" %*
goto finished

:try_python
where python >nul 2>nul
if errorlevel 1 goto no_python
python "workbench\server.py" %*
goto finished

:no_python
echo.
echo [ERROR] Python 3 was not found in PATH.
echo Install Python 3.8+ from https://www.python.org/downloads/ and try again.
echo During installation, tick "Add python.exe to PATH".
echo.
pause
exit /b 1

:finished
if errorlevel 1 (
  echo.
  echo [ERROR] The workbench server stopped with an error. See the message above.
  echo Common fixes: close the process using port 8765, or run with --port 8766.
  echo.
  pause
)
endlocal
