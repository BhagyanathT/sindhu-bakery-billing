@echo off
echo.
echo === Pushing all project files to GitHub ===
echo.
git add .
git commit -m "Add backend and frontend code"
git push origin main
echo.
echo Done! If you see no errors, your code is now on GitHub.
pause
