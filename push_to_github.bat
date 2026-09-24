@echo off
title Push KPI Bot to GitHub
cd /d "%~dp0"
echo ===========================================
echo Pushing KPI Bot to https://github.com/kolyabuben/kpi-bot.git
echo ===========================================
git branch -M main
git push -u origin main
echo.
echo ===========================================
if %ERRORLEVEL% equ 0 (
    echo SUCCESS! Code pushed to GitHub!
) else (
    echo Failed to push. Please check your GitHub login.
)
echo ===========================================
pause
