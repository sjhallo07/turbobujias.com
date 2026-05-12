# Deployment and Setup Guide

This guide explains how to set up the **Gemini API** and **Supabase** for the TurboBujias Intelligence System.

## 1. Environment Variables
You must configure the following variables in the **Settings > Secrets** menu of your environment:

```env
# Gemini API Key for Agentic Reasoning
GEMINI_API_KEY=your_gemini_api_key_here

# Supabase Credentials for Vector Memory and Inventory
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 2. Supabase Setup (Database & Vector)
To support the RAG (Retrieval-Augmented Generation) system, run the following SQL in your Supabase SQL Editor:

```sql
-- Enable the pgvector extension to work with embeddings
create extension if not exists vector;

-- Agent memory table for recursive learning
create table agent_memory (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  response text not null,
  embedding vector(768), -- Optimized for text-embedding-004
  agent_type text,
  validated boolean default false,
  created_at timestamp with time zone default now()
);

-- Index for fast similarity search
create index on agent_memory using ivfflat (embedding) with (lists = 100);
```

## 3. Gemini API Implementation
The "Agente Investigador" uses the **Gemini 2.0 Flash** model to perform external research and **text-embedding-004** for embedding generation.
- **Model (Reasoning)**: `gemini-2.0-flash`
- **Model (Embeddings)**: `text-embedding-004`
- **Capabilities**: Search grounding, technical specification retrieval.

## 4. RAG Agentic Implementation Status
| Component | Status | Tech |
|-----------|--------|------|
| **Embedding Logic** | ⏳ Pending | Gemini Text Embeddings |
| **Vector Retrieval** | ⏳ Pending | Supabase pgvector |
| **Researcher Agent** | ⚠️ Placeholder | Gemini API |
| **Logistics Agent** | ⚠️ Placeholder | Supabase Client |
| **Auditor Agent** | ⏳ Pending | Recursive Prompting |

## 5. Deactivation/Migration
If you wish to move this production environment to a custom server:
1. Export the project via **Settings > Export to GitHub**.
2. Run `npm install`.
3. Set up a Docker container using the provided `Dockerfile` patterns.
