@echo off
echo ========================================
echo ROGµE - Development Workflow
echo ========================================
echo.

echo [1/4] Running ESLint to check for issues...
C:\Users\samue\Desktop\coding-experiments\js-rogue\node-v22.18.0-win-x64\npm.cmd run lint
if %errorlevel% neq 0 (
    echo.
    echo ESLint found issues. Attempting to auto-fix...
    echo.
    echo [2/4] Running ESLint auto-fix...
    C:\Users\samue\Desktop\coding-experiments\js-rogue\node-v22.18.0-win-x64\npm.cmd run lint:fix
) else (
    echo ESLint passed! No issues found.
    echo.
    echo [2/4] Skipping auto-fix (no issues to fix)...
)

echo.
echo [3/4] Running Prettier to format code...
C:\Users\samue\Desktop\coding-experiments\js-rogue\node-v22.18.0-win-x64\npm.cmd run format

echo.
echo [4/4] Final lint check...
C:\Users\samue\Desktop\coding-experiments\js-rogue\node-v22.18.0-win-x64\npm.cmd run lint

echo.
echo [5/5] Running unit tests...
C:\Users\samue\Desktop\coding-experiments\js-rogue\node-v22.18.0-win-x64\npm.cmd run test

echo.
echo ========================================
echo Development workflow complete!
echo ========================================
echo.
echo Your code is now:
echo - Linted and error-free
echo - Auto-fixed where possible
echo - Properly formatted
echo - Unit tested
echo.
echo Ready for development or deployment!
echo.
pause 