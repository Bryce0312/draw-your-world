@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Please install Node.js 22.13 or newer from https://nodejs.org/
  pause
  exit /b 1
)
node "%~dp0scripts\launcher.mjs" start --demo
if errorlevel 1 pause
