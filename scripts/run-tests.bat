@echo off
echo ========================================
echo ROGµE - Unit Tests
echo ========================================
echo.

echo Running Jest tests...
REM ..\..\node-v22.18.0-win-x64\npm.cmd run test
%NPM_PATH% run test

if %errorlevel% equ 0 (
    echo.
    echo ✅ All tests passed!
) else (
    echo.
    echo ❌ Some tests failed. Check the output above.
)

echo.
pause 