@echo off
echo ========================================
echo ROGµE - Unit Tests
echo ========================================
echo.

echo Running Jest tests...
C:\Users\samue\Desktop\coding-experiments\js-rogue\node-v22.18.0-win-x64\npm.cmd run test

if %errorlevel% equ 0 (
    echo.
    echo ✅ All tests passed!
) else (
    echo.
    echo ❌ Some tests failed. Check the output above.
)

echo.
pause 