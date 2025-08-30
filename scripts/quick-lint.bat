@echo off
echo ========================================
echo ROGµE - Quick Lint Check
echo ========================================
echo.

echo Running ESLint...
%NPM_PATH% run lint

if %errorlevel% equ 0 (
    echo.
    echo ✅ All good! No linting issues found.
) else (
    echo.
    echo ❌ Linting issues found. Run 'dev-workflow.bat' to auto-fix them.
)
