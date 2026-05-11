import { getSupabase } from '../lib/supabase';
import { PRODUCTS, Product } from '../data';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

class VectorDbService {
  private async getEmbedding(text: string): Promise<number[] | null> {
    try {
      const result = await ai.models.embedContent({
        model: 'gemini-embedding-2-preview',
        contents: [{ text }],
      });
      return result.embeddings?.[0]?.values || null;
    } catch (err) {
      // Embedding fails in some proxy environments, gracefully return null
      return null;
    }
  }

  /**
   * Syncs the local PRODUCTS to Supabase vector storage.
   * This should be called by an admin or as part of a migration.
   */
  async syncProducts() {
    const supabase = getSupabase();
    if (!supabase) {
      console.error('Supabase client not initialized. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in Settings > Secrets.');
      return { success: false, message: 'Supabase credentials missing' };
    }

    console.log(`Starting sync of ${PRODUCTS.length} products to Supabase...`);
    let syncedCount = 0;
    let errorCount = 0;

    for (const product of PRODUCTS) {
      try {
        // Create a rich text representation for embedding
        const searchString = `${product.brand} ${product.name} ${product.category} ${product.oeReference || ''} ${product.description || ''}`;
        const embedding = await this.getEmbedding(searchString);

        if (!embedding) {
          console.warn(`Failed to generate embedding for ${product.id}`);
          errorCount++;
          continue;
        }

        const { error } = await supabase
          .from('products')
          .upsert({
            id: product.id,
            brand: product.brand,
            name: product.name,
            category: product.category,
            description: product.description,
            oe_reference: product.oeReference,
            specs: product.specs,
            embedding: embedding
          });

        if (error) {
          console.error(`Supabase Upsert Error for ${product.id}:`, error);
          errorCount++;
        } else {
          syncedCount++;
        }
      } catch (err) {
        console.error(`Sync error for ${product.id}:`, err);
        errorCount++;
      }
    }

    console.log(`Sync Complete: ${syncedCount} synced, ${errorCount} errors.`);
    return { success: true, syncedCount, errorCount };
  }
}

export const vectorDbService = new VectorDbService();
