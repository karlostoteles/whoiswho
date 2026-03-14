import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateAllCollectionCharacters, clearCollectionCache } from './collectionService';

// Mock the data import
vi.mock('@/core/data/schizodio.json', () => ({
  default: {
    characters: [
      { id: 10, name: 'Ten', bitmap: ['0'], image_url: 'url10' },
      { id: 2, name: 'Two', bitmap: ['0'], image_url: 'url2' },
      { id: 50, name: 'Fifty', bitmap: ['0'], image_url: 'url50' },
    ],
    question_schema: {}
  }
}));

// Mock nftService
vi.mock('@/services/starknet/nftService', () => ({
  resolveUrl: (url: string) => `resolved_${url}`,
}));

describe('collectionService', () => {
  beforeEach(() => {
    clearCollectionCache();
  });

  it('generates characters sorted by ID', async () => {
    const chars = await generateAllCollectionCharacters();
    
    expect(chars).toHaveLength(3);
    expect(chars[0].id).toBe('nft_2');
    expect(chars[1].id).toBe('nft_10');
    expect(chars[2].id).toBe('nft_50');
  });

  it('memoizes the result', async () => {
    const chars1 = await generateAllCollectionCharacters();
    const chars2 = await generateAllCollectionCharacters();
    
    expect(chars1).toBe(chars2);
  });
});
