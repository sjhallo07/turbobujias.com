import { Product } from '../data';

export async function ingestProducts(products: Product[]) {
  console.warn('Supabase ingestion disabled. Products not ingested:', products);
  return { error: 'Supabase functionality disabled' };
}

export async function seedCrossReferenceData() {
  console.warn('Supabase cross-reference seeding disabled.');
  return { error: 'Supabase functionality disabled' };
}
