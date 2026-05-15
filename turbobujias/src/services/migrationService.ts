export async function syncInventoryFromSupabaseToFirebase(force: boolean = false) {
  console.warn('Supabase sync disabled.');
  return { success: false, message: 'Supabase sync disabled', count: 0 };
}
