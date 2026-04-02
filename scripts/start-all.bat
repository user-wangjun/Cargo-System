@echo off
setlocal
cd /d %~dp0\..
powershell -ExecutionPolicy Bypass -File ".\scripts\start-all.ps1"
endlocal
