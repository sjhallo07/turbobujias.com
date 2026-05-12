import { getSupabase } from '../lib/supabase';
import { GoogleGenAI } from "@google/genai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { collection, addDoc, query, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

const ai = new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_GEMINI_API_KEY || '' });

// Using generic Document interface to store chunks
export interface ManualChunk {
  id?: string;
  source: string;
  content: string;
  embedding?: number[];
  metadata: any;
}

class DocumentService {
  private async getEmbedding(text: string): Promise<number[] | null> {
    try {
      // Need server side proxy or directly use genai
      // It's possible we run into CORS using GoogleGenAI directly in browser if unsupported,
      // but assuming it's supported here based on other code using it in vectorDb.
      const result = await ai.models.embedContent({
        model: 'gemini-embedding-2-preview',
        contents: [{ text }],
      });
      return result.embeddings?.[0]?.values || null;
    } catch (err) {
      console.warn("Embedding generation failed", err);
      // Fallback or retry
      return null;
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Upload and Parse document through API
  async parseDocument(file: File): Promise<string | null> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/documents/parse", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      console.error("Failed to parse document");
      return null;
    }

    const data = await res.json();
    return data.text;
  }

  // Split, Embed, Save to DB
  async processAndUploadManual(file: File, sourceName: string): Promise<boolean> {
    console.log(`Processing manual: ${sourceName}`);
    const text = await this.parseDocument(file);
    if (!text) return false;

    // Split text with Langchain
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const outputDocs = await splitter.createDocuments([text]);
    console.log(`Created ${outputDocs.length} chunks from ${sourceName}. Saving to DB...`);

    const supabase = getSupabase();
    
    // We will save to Firestore as a local manual DB since Supabase might not have 'manual_chunks' table created by user yet.
    // AND we can save to Supabase if table exists. We'll do both or just Firestore for guaranteed unstructured insert.
    try {
      const chunksCollection = collection(db, 'manuals');
      
      for (const doc of outputDocs) {
        const embedding = await this.getEmbedding(doc.pageContent);
        
        // Save to Firebase (No native pgvector, so we store embedding as array for local filtering)
        await addDoc(chunksCollection, {
          source: sourceName,
          content: doc.pageContent,
          embedding: embedding || [],
          metadata: doc.metadata,
          timestamp: new Date().toISOString()
        });
        
        // Attempt Supabase insert if user created 'manuals' table there
        if (supabase) {
          try {
            await supabase.from('manual_chunks').insert({
              source: sourceName,
              content: doc.pageContent,
              embedding: embedding || []
            });
          } catch (err) {
            // soft fail
          }
        }
      }
      return true;
    } catch (err) {
      console.error("Error saving manual chunks:", err);
      return false;
    }
  }

  // Search local manuals
  async searchManuals(queryStr: string, topK: number = 3): Promise<ManualChunk[]> {
    const queryEmbedding = await this.getEmbedding(queryStr);
    if (!queryEmbedding) return [];

    let results: { chunk: ManualChunk, score: number }[] = [];

    // Try Supabase first if vector match is available
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase.rpc('match_manuals', {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: topK
      });
      if (!error && data && data.length > 0) {
        return data as ManualChunk[];
      }
    }

    // Fallback: Read all from Firestore and do in-memory cosine similarity
    try {
      const chunksRef = collection(db, 'manuals');
      const snap = await getDocs(chunksRef);
      
      snap.forEach(doc => {
        const data = doc.data();
        if (data.embedding && data.embedding.length > 0) {
          const score = this.cosineSimilarity(queryEmbedding, data.embedding);
          results.push({ chunk: data as ManualChunk, score });
        }
      });

      // Sort and slice
      results.sort((a, b) => b.score - a.score);
      return results.slice(0, topK).map(r => r.chunk);
    } catch (err) {
      console.error("Error searching manuals in Firestore:", err);
      return [];
    }
  }
}

export const documentService = new DocumentService();
