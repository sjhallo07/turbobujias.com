#!/bin/bash
# Quick Start Script for Git Bash / Linux / macOS
echo "🚀 TurboBujías Pro - Starting development environment..."

if ! command -v npm &> /dev/null
then
    echo "❌ Error: npm is not installed. Please install Node.js."
    exit 1
fi

echo "📦 Installing/Updating dependencies..."
npm install

echo "✨ Starting development server..."
npm run dev
