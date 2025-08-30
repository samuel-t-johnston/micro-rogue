@echo off
echo ========================================
echo ROGµE - Quick Lint Check
echo ========================================
echo.

echo Running ESLint...
C:\Users\samue\Desktop\coding-experiments\js-rogue\node-v22.18.0-win-x64\npm.cmd run lint

if %errorlevel% equ 0 (
    echo.
    echo ✅ All good! No linting issues found.
) else (
    echo.
    echo ❌ Linting issues found. Run 'dev-workflow.bat' to auto-fix them.
)
