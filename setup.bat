@echo off
title Customer Support Agent Setup
echo =================================================================
echo    INTELlIGENT CUSTOMER SUPPORT AGENT - INTEGRATED SETUP SCRIPT
echo =================================================================
echo.

:: Verify Python installation
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in your system's environmental variable PATH.
    echo Please install Python 3.9 or higher (tick 'Add Python to PATH' in installer) and run this again.
    echo.
    pause
    exit /b 1
)

:: Step 1: Create Venv if missing
echo [1/4] Checking Python virtual environment...
if not exist venv (
    echo [STATUS] Creating virtual environment (venv)...
    python -m venv venv
    if %errorlevel% neq 0 (
        echo [ERROR] Could not create virtual environment. Verify python installation permissions.
        pause
        exit /b 1
    )
    echo [STATUS] Virtual environment successfully created!
) else (
    echo [STATUS] Virtual environment 'venv' already detected.
)
echo.

:: Step 2: Install dependencies
echo [2/4] Activating venv and installing packages...
call venv\Scripts\activate.bat
echo [STATUS] Upgrading pip...
python -m pip install --upgrade pip >nul
echo [STATUS] Installing required LangGraph, FastAPI, and Gemini packages...
pip install -r backend\requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Dependencies installation failed. Verify your internet connection.
    pause
    exit /b 1
)
echo [STATUS] Packages successfully installed!
echo.

:: Step 3: Copy Environment Template
echo [3/4] Checking environment configurations...
if not exist .env (
    echo [STATUS] Creating new configuration file from .env.template...
    copy .env.template .env >nul
    echo [STATUS] Created [.env] configuration.
    echo          Please add your Gemini API Key directly inside the dashboard settings panel!
) else (
    echo [STATUS] Configuration file [.env] already exists.
)
echo.

:: Step 4: Boot Uvicorn Server
echo [4/4] Starting FastAPI backend server...
echo.
echo =================================================================
echo   SUCCESS: Customer Support Agent stack is ready!
echo   Local Dashboard:   http://127.0.0.1:8000
echo.
echo   Press CTRL+C inside this terminal window to stop the server.
echo =================================================================
echo.
cd backend
python -m uvicorn app:app --host 127.0.0.1 --port 8000
