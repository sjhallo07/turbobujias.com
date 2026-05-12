
import { getSupabase } from '../lib/supabase';
import { Product } from '../data';

export async function ingestProducts(products: Product[]) {
  const supabase = getSupabase();
  if (!supabase) return { error: 'Supabase not initialized' };

  try {
    const { data, error } = await supabase
      .from('products')
      .insert(products);

    if (error) {
      console.error('Ingestion error:', error);
      return { error: error.message };
    }

    return { data };
  } catch (err: any) {
    console.error('Data ingestion critical error:', err);
    return { error: err.message || 'Network error fetching from Supabase' };
  }
}

export async function seedCrossReferenceData() {
  const crossReferenceProducts: Product[] = [
    {
      id: 'rc12yc-cross',
      name: 'Champion Copper Plus RC12YC',
      brand: 'Champion',
      category: 'Spark Plug',
      price: 3.50,
      image: 'https://images.unsplash.com/photo-1621905235277-f2742407637f?auto=format&fit=crop&q=80&w=800',
      description: 'Cross-reference for popular mower spark plug.',
      specs: { 'Material': 'Copper', 'Thread': '14mm' },
      stock: 100,
      upc: '037551000018',
      oemNumbers: ['RC12YC', 'NGK-BPR5ES']
    },
    {
      id: 'bpr6es-cross',
      name: 'NGK Standard BPR6ES',
      brand: 'NGK',
      category: 'Spark Plug',
      price: 4.50,
      image: 'https://images.unsplash.com/photo-1621905235277-f2742407637f?auto=format&fit=crop&q=80&w=800',
      description: 'Standard resistor spark plug.',
      specs: { 'Material': 'Nickel', 'Thread': '14mm' },
      stock: 80,
      upc: '087295171310',
      oemNumbers: ['BPR6ES', 'DENSO-W20EPRU']
    }
  ];

  return await ingestProducts(crossReferenceProducts);
}
