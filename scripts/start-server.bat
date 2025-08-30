@echo off
echo Starting ROGµE development server...
echo.
echo Server will be available at: http://localhost:8000
echo Press Ctrl+C to stop the server
echo.
python -m http.server 8000 --directory ..\
pause 