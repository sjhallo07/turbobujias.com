# Project: turbobujias.com

## Project Overview
This project is a React-based web application, likely serving as a storefront or information portal for automotive spark plugs (bujías) and related diagnostic services. It leverages modern web technologies including:

- **Frontend:** React 19, Vite, Tailwind CSS, Motion (framer-motion-like).
- **Backend/Services:** Express server (`server.ts`), Firebase, Supabase.
- **AI/LLM Integrations:** Extensive use of AI libraries including Google Generative AI (`@google/genai`), LangChain, OpenAI, and Anthropic.
- **Tools:** TypeScript, Vitest (testing), Lucide React (icons).

## Building and Running
The project is managed with npm.

- **Development:** `npm run dev` (Starts the application using `tsx server.ts`).
- **Build:** `npm run build` (Uses Vite to build for production).
- **Preview:** `npm run preview` (Previews the production build).
- **Testing:** `npm run test` (Runs tests with Vitest).

## Development Conventions
- **Language:** TypeScript.
- **Framework:** React with Redux Toolkit for state management.
- **Styling:** Tailwind CSS is used for styling.
- **Architecture:** The application utilizes a component-based architecture in `src/components`, with separate directories for `services`, `lib` (utility/config), `store` (Redux), and `utils`.
- **Deployment:** The project is configured for deployment on Cloudflare Pages/Workers, utilizing `wrangler.jsonc`.

## Notes
- **Environment Variables:** The application requires a `GEMINI_API_KEY` set in `.env.local`.
- **Lazy Loading:** Critical components are implemented with `React.lazy` and `React.Suspense` to improve loading performance.
