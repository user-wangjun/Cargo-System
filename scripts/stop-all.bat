@echo off
setlocal
cd /d %~dp0\..
powershell -ExecutionPolicy Bypass -File ".\scripts\stop-all.ps1"
endlocal
