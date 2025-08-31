@echo off
echo ========================================
echo ROGµE - Unit Tests
echo ========================================
echo.

echo Running Jest tests...
npm run test

if %errorlevel% equ 0 (
    echo.
    echo ✅ All tests passed!
) else (
    echo.
    echo ❌ Some tests failed. Check the output above.
)

echo.
pause 