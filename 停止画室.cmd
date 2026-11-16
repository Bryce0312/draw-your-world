@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
node "%~dp0scripts\launcher.mjs" stop
if errorlevel 1 pause
