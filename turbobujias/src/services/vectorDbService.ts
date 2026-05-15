import { db } from '../lib/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { PRODUCTS } from '../data';
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
      return null;
    }
  }

  /**
   * Syncs the local PRODUCTS to Firestore.
   */
  async syncProducts() {
    console.log(`Starting sync of ${PRODUCTS.length} products to Firestore...`);
    let syncedCount = 0;
    let errorCount = 0;
    const productsCollection = collection(db, 'products');

    for (const product of PRODUCTS) {
      try {
        const searchString = `${product.brand} ${product.name} ${product.category} ${product.oeReference || ''} ${product.description || ''}`;
        const embedding = await this.getEmbedding(searchString);

        if (!embedding) {
          console.warn(`Failed to generate embedding for ${product.id}`);
          errorCount++;
          continue;
        }

        await setDoc(doc(productsCollection, product.id), {
          id: product.id,
          brand: product.brand,
          name: product.name,
          category: product.category,
          description: product.description,
          oe_reference: product.oeReference,
          specs: product.specs,
          embedding: embedding
        }, { merge: true });

        syncedCount++;
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
