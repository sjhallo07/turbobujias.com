import { db } from '../lib/firebase';
import { getSupabase } from '../lib/supabase';
import { collection, getDocs, setDoc, doc, serverTimestamp } from 'firebase/firestore';

export async function syncInventoryFromSupabaseToFirebase(force: boolean = false) {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase not initialized, cannot sync.");
  }

  // 1. Fetch from Supabase
  let supaData;
  try {
    supaData = await supabase
      .from('products')
      .select('*');
  } catch (err: any) {
    console.error("Critical Supabase Fetch Error:", err);
    throw new Error(`Critical failure connecting to Supabase: ${err.message || 'Network error'}. Verify your Supabase URL and network connectivity.`);
  }

  const { data: supaProducts, error } = supaData;

  if (error) {
    console.error("Supabase API Error:", error);
    throw new Error(`Supabase API responded with error: ${error.message} (${error.code || 'n/a'}).`);
  }

  if (!supaProducts) {
    throw new Error(`No data returned from Supabase products table.`);
  }

  // 2. Check if Firebase has data if not forced
  const firebaseProductsRef = collection(db, 'products');
  if (!force) {
    const firebaseDocs = await getDocs(firebaseProductsRef);
    if (firebaseDocs.size > 0) {
      return { success: true, message: `Skipped: Firebase already has ${firebaseDocs.size} products.`, count: 0 };
    }
  }

  // 3. Sync to Firebase (Upsert by ID)
  console.log(`Syncing ${supaProducts.length} products to Firebase...`);
  let syncedCount = 0;
  
  for (const product of supaProducts) {
    try {
      // Use the product ID from Supabase if available to avoid duplicates
      // If no ID exists, fallback to a generated one, but ideally Supabase products have IDs
      const productId = product.id || product.sku || Math.random().toString(36).substr(2, 9);
      
      // Filter out Supabase-specific metadata if any, or just pass everything
      const { created_at, ...cleanProduct } = product;

      await setDoc(doc(db, 'products', productId), {
        ...cleanProduct,
        updatedAt: serverTimestamp()
      }, { merge: true });
      syncedCount++;
    } catch (err) {
      console.warn(`Failed to sync product ${product.id}:`, err);
    }
  }

  return { 
    success: true, 
    message: `Successfully synced ${syncedCount} products from Supabase.`,
    count: syncedCount 
  };
}
