@echo off
git init
git add README.md
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/BhagyanathT/sindhu-bakery-billing.git
git push -u origin main
pause
