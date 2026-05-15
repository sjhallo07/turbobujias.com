import { db } from '../lib/firebase';
import { collection, getDocs, query, where, or } from 'firebase/firestore';
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
   * Search for relevant products in Firestore using client-side vector similarity.
   */
  async searchProducts(queryText: string, limit: number = 5): Promise<ScoredResult<Product>[]> {
    try {
      const queryEmbedding = await this.getEmbedding(queryText);
      const productsCollection = collection(db, 'products');
      let results: ScoredResult<Product>[] = [];

      // 1. Fetch products and calculate similarity client-side
      const snapshot = await getDocs(productsCollection);
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.embedding && data.embedding.length > 0 && queryEmbedding) {
          const score = this.cosineSimilarity(queryEmbedding, data.embedding);
          if (score > 0.5) {
            results.push({ item: data as Product, score });
          }
        }
      });

      // 2. Fallback: Keyword search if few/no results
      if (results.length < limit) {
        const q = query(productsCollection, or(
            where('name', '==', queryText), // Limited simple keyword fallback
            where('brand', '==', queryText)
        ));
        const snapshot = await getDocs(q);
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (!results.some(r => r.item.id === data.id)) {
                results.push({ item: data as Product, score: 0.8 });
            }
        });
      }
      
      // 3. Cross-reference fallback
      if (results.length < limit) {
        const crossRefs = await this.fetchCrossReferences(queryText);
        crossRefs.forEach(product => {
          if (!results.some(r => r.item.id === product.id)) {
            results.push({ item: product, score: 0.7 });
          }
        });
      }

      return results.sort((a, b) => b.score - a.score).slice(0, limit);
    } catch (err) {
      console.error('Firestore Product RAG Error:', err);
      return [];
    }
  }

  /**
   * Search for relevant partners in Firestore using client-side vector similarity.
   */
  async searchPartners(queryText: string, limit: number = 3): Promise<ScoredResult<Partner>[]> {
    try {
      const queryEmbedding = await this.getEmbedding(queryText);
      const partnersCollection = collection(db, 'partners');
      let results: ScoredResult<Partner>[] = [];

      const snapshot = await getDocs(partnersCollection);
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.embedding && data.embedding.length > 0 && queryEmbedding) {
          const score = this.cosineSimilarity(queryEmbedding, data.embedding);
          if (score > 0.3) {
            results.push({ item: data as Partner, score });
          }
        }
      });

      if (results.length === 0) {
        // Fallback: simple fetch if no similarity
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.name.toLowerCase().includes(queryText.toLowerCase())) {
                results.push({ item: data as Partner, score: 1.0 });
            }
        });
      }

      return results.sort((a, b) => b.score - a.score).slice(0, limit);
    } catch (err) {
      console.error('Firestore Partner RAG Error:', err);
      return [];
    }
  }
}

export const ragService = new RagService();
