@echo off
echo ========================================
echo ROGµE - Environment Variables
echo ========================================
echo.
echo Update the variables in this script before running.
echo Run with admin privileges to ensure the variables are set correctly.
echo.
set nodepath=C:\path\to\node-v22.18.0-win-x64
set npmpath=C:\path\to\node-v22.18.0-win-x64\npm.cmd

echo Setting node path...
echo %nodepath%
setx NODE_PATH "%nodepath%" /M

echo Setting npm path...
echo %npmpath%
setx NPM_PATH "%npmpath%" /M

echo Finished!
pause 