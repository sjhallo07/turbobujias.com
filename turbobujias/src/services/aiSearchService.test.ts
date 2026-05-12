import { describe, it, expect, vi } from 'vitest';
import { aiSearch } from './aiSearchService';
import { PRODUCTS } from '../data';

describe('aiSearchService', () => {
  it('should find item by exact UPC', async () => {
    // Act
    const results = await aiSearch.search('087295137590');
    
    // Assert
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('bkr6eix-11');
    expect(results[0].matchType).toBe('exact');
  });

  it('should find item by exact OEM Number', async () => {
    const results = await aiSearch.search('SP-514');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('xp5325');
  });

  it('should return empty array for empty query', async () => {
    const results = await aiSearch.search('');
    expect(results).toEqual([]);
  });
});
