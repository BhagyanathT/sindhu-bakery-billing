@echo off
set /p repo_url="Enter your GitHub Repository URL (e.g., https://github.com/username/repo.git): "

if "%repo_url%"=="" (
    echo Error: Repository URL cannot be empty.
    pause
    exit /b
)

echo Initializing Git repository...
git init

echo Adding files...
git add .

echo Creating initial commit...
git commit -m "Initial commit - Billing software project setup"

echo Renaming branch to main...
git branch -M main

echo Adding remote origin...
git remote add origin %repo_url%

echo Pushing to GitHub...
git push -u origin main

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo An error occurred. Please make sure:
    echo 1. You have Git installed.
    echo 2. You have created the repository on GitHub.
    echo 3. You have the correct permissions/SSH key set up.
) else (
    echo.
    echo Successfully pushed to GitHub!
)

pause
