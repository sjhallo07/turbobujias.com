import { GoogleGenAI } from "@google/genai";
import { PRODUCTS, Product } from "../data";
import { ragService } from "./ragService";
import { ingestProducts } from "./dataIngestionService";
import { expandSearchQuery } from "../utils/searchUtils";

const ai = new GoogleGenAI({ apiKey: (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '' });

export interface ScoredProduct extends Product {
  searchScore: number;
  matchType: 'exact' | 'semantic' | 'rag';
}

// Simple vector index to mimic FAISS behavior in-memory
class SimpleVectorIndex {
  private index: { id: string; embedding: number[] }[] = [];

  add(id: string, embedding: number[]) {
    this.index.push({ id, embedding });
  }

  search(queryEmbedding: number[]) {
    return this.index.map(item => ({
      id: item.id,
      score: this.cosineSimilarity(queryEmbedding, item.embedding)
    }));
  }

  private cosineSimilarity(v1: number[], v2: number[]) {
    let dot = 0;
    let n1 = 0;
    let n2 = 0;
    for (let i = 0; i < v1.length; i++) {
      dot += v1[i] * v2[i];
      n1 += v1[i] * v1[i];
      n2 += v2[i] * v2[i];
    }
    const magnitude = Math.sqrt(n1) * Math.sqrt(n2);
    return magnitude === 0 ? 0 : dot / magnitude;
  }
}

class AISearchService {
  private vectorIndex = new SimpleVectorIndex();
  private embeddingsCache: Record<string, number[]> = {};
  private initialized = false;

  async init() {
    if (this.initialized) return;
    
    // For this catalog, we generate them (or could pre-bake them)
    console.log('Initializing AI Semantic Index...');
    
    for (const product of PRODUCTS) {
      const textToEmbed = `${product.name} ${product.brand} ${product.category} ${product.description} ${Object.entries(product.specs).map(([k, v]) => `${k}: ${v}`).join(' ')}`;
      const embedding = await this.getEmbedding(textToEmbed);
      if (embedding) {
        this.vectorIndex.add(product.id, embedding);
        this.embeddingsCache[product.id] = embedding;
      }
    }
    
    this.initialized = true;
  }

  private async getEmbedding(text: string): Promise<number[] | null> {
    try {
      const result = await ai.models.embedContent({
        model: 'text-embedding-004',
        contents: [{ text }],
      });
      
      const embedding = result.embeddings?.[0]?.values;
      return embedding || null;
    } catch (err) {
      // Embedding fails in some proxy environments, gracefully return null
      return null;
    }
  }

  async search(query: string): Promise<ScoredProduct[]> {
    if (!query) return [];
    
    const normalizedQuery = query.toLowerCase().trim();
    const expandedQueries = expandSearchQuery(normalizedQuery);
    
    // 1. EXACT MATCHES (UPC, EAN, OEM, ID)
    const exactMatches: ScoredProduct[] = [];
    PRODUCTS.forEach(p => {
      let maxScore = 0;
      
      expandedQueries.forEach(q => {
        let score = 0;
        if (p.id.toLowerCase() === q) score = 1.0;
        if (p.upc === q) score = 1.0;
        if (p.ean === q) score = 1.0;
        if (p.oemNumbers?.some(oem => oem.toLowerCase() === q)) score = 1.0;
        if (p.oeReference?.toLowerCase() === q) score = 1.0;
        
        if (score > maxScore) maxScore = score;
      });

      if (maxScore > 0) {
        exactMatches.push({ ...p, searchScore: maxScore, matchType: 'exact' });
      }
    });

    // 1.5. Cross-reference scraping & ingestion
    // Try to fetch the external site for cross-references
    try {
      const proxyRes = await fetch(`/api/crossref/${encodeURIComponent(normalizedQuery)}`);
      if (proxyRes.ok) {
        const html = await proxyRes.text();
        const matchLinks = html.match(/href="\/convert\/([^\/]+)\/([^"]+)"/g);
        if (matchLinks) {
          const uniquePaths = new Set<string>();
          matchLinks.forEach(link => {
             const clean = link.replace('href="', '').replace('"', '');
             uniquePaths.add(clean);
          });
          
          const newProducts: Product[] = [];
          Array.from(uniquePaths).forEach((linkPath, idx) => {
            const parts = linkPath.split('/');
            if (parts.length >= 4) {
              const brand = decodeURIComponent(parts[2]).replace('_PN', '').replace('_STK', '');
              const name = decodeURIComponent(parts[3]);
              if (name.toLowerCase() !== normalizedQuery) {
                const id = `cross-${brand.toLowerCase()}-${name.toLowerCase()}`;
                
                // Add to exactMatches locally
                if (!exactMatches.some(p => p.id === id)) {
                  const newProductBase = {
                    id,
                    name: name.trim(),
                    brand: brand.trim(),
                    category: 'Spark Plug' as const,
                    price: 0,
                    image: '',
                    description: `Cross Reference Match for ${query.toUpperCase()}`,
                    specs: { source: 'sp-crossreference.com' },
                    stock: 0,
                  };
                  exactMatches.push({
                    ...newProductBase,
                    searchScore: 0.9,
                    matchType: 'semantic'
                  });
                  newProducts.push(newProductBase);
                }
              }
            }
          });
          if (newProducts.length > 0) {
             ingestProducts(newProducts).catch(err => console.warn('Failed to ingest cross reference products', err));
          }
        }
      }
    } catch (err) {
      console.warn('Cross reference scrape failed:', err);
    }
    
    // 2. RAG SEARCH & HYBRID RESULTS
    try {
      const [ragResults, localResults] = await Promise.all([
        ragService.searchProducts(normalizedQuery, 5),
        this.searchLocal(normalizedQuery)
      ]);

      const combinedResults = new Map<string, ScoredProduct>();

      // Add exact matches first
      exactMatches.forEach(p => combinedResults.set(p.id, p));

      // Add RAG results (Supabase)
      ragResults.forEach(res => {
        const id = res.item.id;
        if (!combinedResults.has(id)) {
          combinedResults.set(id, {
            ...res.item,
            searchScore: res.score,
            matchType: 'rag'
          });
        }
      });

      // Add Local results if they are high enough and not already present
      localResults.forEach(p => {
        if (!combinedResults.has(p.id) || (combinedResults.get(p.id)?.searchScore || 0) < p.searchScore) {
          combinedResults.set(p.id, {
            ...p,
            matchType: p.matchType || 'semantic'
          } as ScoredProduct);
        }
      });

      return Array.from(combinedResults.values())
        .sort((a, b) => b.searchScore - a.searchScore);

    } catch (err) {
      console.error('Search enhancement error:', err);
      return exactMatches;
    }
  }

  private async searchLocal(query: string): Promise<ScoredProduct[]> {
    if (!this.initialized) await this.init();
    
    const queryEmbedding = await this.getEmbedding(query);
    if (!queryEmbedding) {
      return PRODUCTS
        .map(p => ({
          ...p,
          searchScore: this.fuzzyScore(p, query),
          matchType: 'semantic' as const
        }))
        .filter(p => p.searchScore > 0.1);
    }

    const vectorResults = this.vectorIndex.search(queryEmbedding);
    
    return vectorResults
      .map(res => {
        const product = PRODUCTS.find(p => p.id === res.id)!;
        return {
          ...product,
          searchScore: res.score,
          matchType: 'semantic' as const
        };
      })
      .filter(p => p.searchScore > 0.5);
  }

  private fuzzyScore(p: Product, query: string): number {
    let score = 0;
    if (p.name.toLowerCase().includes(query)) score += 0.5;
    if (p.brand.toLowerCase().includes(query)) score += 0.3;
    if (p.description.toLowerCase().includes(query)) score += 0.2;
    return score;
  }
}

export const aiSearch = new AISearchService();
