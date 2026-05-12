import { getSupabase } from '../lib/supabase';
import { Product } from '../data';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface ScoredResult<T> {
  item: T;
  score: number;
}

export interface Partner {
  internalId: string;
  name: string;
  image: string;
  type: 'brand' | 'store' | 'workshop';
  location: string;
  description: string;
  isPromoted: boolean;
  socials: {
    instagram?: string;
    whatsapp?: string;
    web?: string;
  };
}

class RagService {
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

  private async getEmbedding(text: string): Promise<number[] | null> {
    try {
      const result = await ai.models.embedContent({
        model: 'gemini-embedding-2-preview',
        contents: [{ text }],
      });
      return result.embeddings?.[0]?.values || null;
    } catch (err) {
      return null;
    }
  }

  private async fetchCrossReferences(query: string): Promise<Product[]> {
    try {
      const proxyRes = await fetch(`/api/crossref/${encodeURIComponent(query)}`);
      if (!proxyRes.ok) return [];
      
      const html = await proxyRes.text();
      const matchLinks = html.match(/href="\/convert\/([^\/]+)\/([^"]+)"/g);
      if (!matchLinks) return [];
      
      const products: Product[] = [];
      const uniquePaths = new Set(matchLinks.map(link => link.replace('href="', '').replace('"', '')));
      
      uniquePaths.forEach(linkPath => {
        const parts = linkPath.split('/');
        if (parts.length >= 4) {
          const brand = decodeURIComponent(parts[2]).replace('_PN', '').replace('_STK', '');
          const name = decodeURIComponent(parts[3]);
          if (name.toLowerCase() !== query.toLowerCase()) {
            products.push({
              id: `cross-${brand.toLowerCase()}-${name.toLowerCase()}`,
              name: name.trim(),
              brand: brand.trim(),
              category: 'Spark Plug',
              price: 0,
              image: '',
              description: `Cross Reference Match for ${query.toUpperCase()}`,
              specs: { source: 'sp-crossreference.com' },
              stock: 0,
            } as Product);
          }
        }
      });
      return products;
    } catch (err) {
      console.warn('Cross reference scrape failed:', err);
      return [];
    }
  }

  /**
   * Search for relevant products in Supabase using Vector Similarity if available,
   * otherwise fallback to keyword search + TFJS USE Cosine Similarity.
   */
  async searchProducts(query: string, limit: number = 5): Promise<ScoredResult<Product>[]> {
    const supabase = getSupabase();
    if (!supabase) return [];

    try {
      // 1. Try vector RPC if pgvector is set up
      const embedding = await this.getEmbedding(query);
      let results: ScoredResult<Product>[] = [];

      if (embedding) {
        const { data: vectorData, error: vectorError } = await supabase.rpc('match_products', {
          query_embedding: embedding,
          match_threshold: 0.5,
          match_count: limit,
        });

        if (!vectorError && vectorData && vectorData.length > 0) {
          results = vectorData.map((item: any) => ({
            item: item as Product,
            score: item.similarity
          }));
        }
      }

      // 2. Fallback: Keyword match
      if (results.length === 0) {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .or(`name.ilike.%${query}%,brand.ilike.%${query}%,category.ilike.%${query}%`)
          .limit(limit); 

        if (!error && data && data.length > 0) {
          results = data.map(item => ({ item: item as Product, score: 0.8 }));
        }
      }
      
      // 3. Cross-reference fallback
      if (results.length < limit) {
        const crossRefs = await this.fetchCrossReferences(query);
        crossRefs.forEach(product => {
          if (!results.some(r => r.item.id === product.id)) {
            results.push({ item: product, score: 0.7 });
          }
        });
      }

      return results.sort((a, b) => b.score - a.score).slice(0, limit);
    } catch (err) {
      console.error('Supabase Product RAG Error:', err);
      return [];
    }
  }

  /**
   * Search for relevant partners in Supabase.
   */
  async searchPartners(query: string, limit: number = 3): Promise<ScoredResult<Partner>[]> {
    const supabase = getSupabase();
    if (!supabase) return [];

    try {
      const embedding = await this.getEmbedding(query);

      if (embedding) {
        // Option 1: Vector Search (Requires pgvector and 'match_partners' RPC in Supabase)
        const { data: vectorData, error: vectorError } = await supabase.rpc('match_partners', {
          query_embedding: embedding,
          match_threshold: 0.3,
          match_count: limit,
        });

        if (!vectorError && vectorData && vectorData.length > 0) {
          return vectorData.map((item: any) => ({
            item: item as Partner,
            score: item.similarity
          }));
        }
      }

      // Option 2: Full Text Search (Fallback)
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .or(`name.ilike.%${query}%,location.ilike.%${query}%,description.ilike.%${query}%,type.ilike.%${query}%`)
        .limit(limit);

      if (error) throw error;

      return (data || []).map(item => ({
        item: item as Partner,
        score: 1.0
      }));
    } catch (err) {
      console.error('Supabase Partner RAG Error:', err);
      return [];
    }
  }
}

export const ragService = new RagService();
