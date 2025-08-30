@echo off
echo ========================================
echo ROGµE - Environment Variables
echo ========================================
echo.
echo Update the variables in this script before running.
echo.
set nodepath=
set npmpath=

echo Setting node path...
setx NODE_PATH "%nodepath%"

echo Setting npm path...
setx NPM_PATH "%npmpath%"

echo Finished!
pause 