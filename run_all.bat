@echo off
start cmd /k "cd backend && npm run dev"
start cmd /k "cd frontend && npm run dev"
echo Servers are starting in separate windows...
pause
