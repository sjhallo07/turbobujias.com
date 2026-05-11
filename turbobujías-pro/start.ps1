# Quick Start Script for PowerShell
Write-Host "🚀 TurboBujías Pro - Starting development environment..." -ForegroundColor Cyan

if (Get-Command npm -ErrorAction SilentlyContinue) {
    Write-Host "📦 Installing/Updating dependencies..." -ForegroundColor Green
    npm install
    
    Write-Host "✨ Starting development server..." -ForegroundColor Yellow
    npm run dev
} else {
    Write-Host "❌ Error: npm is not installed. Please install Node.js." -ForegroundColor Red
    pause
}
