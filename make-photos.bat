@echo off
rem Packs the player photos into js\photos.local.js, so they show when index.html is double-clicked.
rem Run again after adding or changing photos.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\make-photos.ps1"
pause
