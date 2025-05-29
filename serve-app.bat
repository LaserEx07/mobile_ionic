@echo off
echo Starting local server for Alerto app...

REM Check if www directory exists
if not exist "www" (
    echo Building app first...
    call npm run build
)

REM Start a simple HTTP server
echo Starting server on http://localhost:8080
echo Open this URL in your mobile browser to test the app
echo.
echo Press Ctrl+C to stop the server
echo.

REM Use Python to serve the www directory
cd www
python -m http.server 8080 2>nul || python3 -m http.server 8080 2>nul || (
    echo Python not found. Installing http-server...
    npm install -g http-server
    npx http-server -p 8080
)
