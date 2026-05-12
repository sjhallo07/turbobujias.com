# TurboBujías Pro - Update & Setup Instructions

## Overview
TurboBujías Pro is a high-performance technical diagnostic and e-commerce platform for automotive parts (spark plugs, diesel heaters, industrial systems). Built with a modern full-stack architecture.

## Tech Stack
-   **Frontend**: React 18+, Vite, Tailwind CSS, Redux Toolkit, Framer Motion.
-   **Backend**: Node.js/Express, TypeScript.
-   **Database/Auth**: Firebase (Firestore, Auth) for user state/data.
-   **AI/RAG**: Gemini API for technical diagnostics, integration with Supabase for vector search, OpenRouter for LLM fallback capabilities.

## Setup Instructions

### 1. Environment Configuration
Ensure you have a `.env` file in the root directory (based on `.env.example`):
- `VITE_GEMINI_API_KEY`: API Key for AI features.
- `OPENROUTER_API_KEY`: Fallback AI model provider.
- `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`, etc.: (Populated via `firebase-applet-config.json`).
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`: (If using vector search/partner RAG).

### 2. Installation
```bash
npm install
```

### 3. Running for Development
The app uses a Vite-integrated Express server to handle backend API routes and AI proxies.
```bash
npm run dev
```
*Note: The server starts on port 3000.*

### 4. Build & Production
```bash
npm run build
npm start
```

## Recent Major Updates
-   **AI Model Selection**: Users can now select between Gemini 2.0 Flash, GPT-4o, and Claude 3.5 Sonnet in the chat interface.
-   **Firestore/Redux Stability**: Fixed issues with non-serializable Firestore timestamps in Redux state using a custom `serializeUserDoc` utility.
-   **AI Search & RAG**: Enhanced search capabilities with query expansion and optimized prompting for mechanical diagnostics.
-   **Chat Stability**: Implemented history pruning (max 100 messages) and automatic attachment size management to avoid Firestore 1MB document limit.
-   **Robustness**: Improved error handling for AI API calls (Anthropic, OpenAI/OpenRouter fallback).
