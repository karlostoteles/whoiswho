import { describe, it, expect } from 'vitest';
import { 
  hashString, 
  buildTraitsFromBitmap, 
  deriveFreeTraits,
  nftToCharacter
} from './nftCharacterAdapter';

describe('nftCharacterAdapter', () => {
  describe('hashString', () => {
    it('generates a deterministic positive integer', () => {
      const h1 = hashString('123');
      const h2 = hashString('123');
      const h3 = hashString('124');

      expect(h1).toBeGreaterThanOrEqual(0);
      expect(h1).toBe(h2);
      expect(h1).not.toBe(h3);
    });
  });

  describe('buildTraitsFromBitmap', () => {
    const mockSchema = {
      '0': 'accessories_backwoods_blunt',
      '7': 'background_a_roads',
      '96': 'body_boy_who_cried_wolf',
      '125': 'clothing_gold_skull_shirt',
      '200': 'eyes_four_spots',
      '225': 'hair_black_jellycut',
      '303': 'mouth_happy',
      '351': 'sidekick_alf',
    };

    it('correctly identifies bits and maps to nft_* traits', () => {
      // Bit 0, 7, 96, 200, 351
      // Bit 0: 1n
      // Bit 7: 128n (1 << 7)
      // Bit 96 is in the first chunk (0-127)
      // Bit 200 is in the second chunk (128-255) offset 72
      // Bit 351 is in the third chunk (256-383) offset 95

      const chunk0 = (1n | (1n << 7n) | (1n << 96n)).toString();
      const chunk1 = (1n << 72n).toString();
      const chunk2 = (1n << 95n).toString();

      const bitmap = [chunk0, chunk1, chunk2];
      const traits = buildTraitsFromBitmap(bitmap, mockSchema);

      expect(traits.nft_has_accessories).toBe(true);
      expect(traits.nft_background).toBe('a_roads');
      expect(traits.nft_body).toBe('boy_who_cried_wolf');
      expect(traits.nft_eyes).toBe('four_spots');
      expect(traits.nft_has_sidekick).toBe(true);
      expect(traits.nft_sidekick).toBe('alf');
      
      // Traits not in bitmap should be absent
      expect(traits.nft_hair).toBeUndefined();
      expect(traits.nft_mouth).toBeUndefined();
    });
  });

  describe('deriveFreeTraits', () => {
    it('populates free traits with fallbacks', () => {
      const nftTraits = {
        nft_hair: 'jellycut',
        nft_eyes: 'stoned_red',
        nft_has_accessories: true,
      };
      
      const traits = deriveFreeTraits(nftTraits, 42);

      expect(traits.nft_hair).toBe('jellycut');
      // Should have mapped 'jellycut' to a valid hair_style if possible, 
      // or at least returned a deterministic fallback.
      expect(traits.hair_style).toBeDefined();
      expect(['short', 'long', 'curly', 'bald', 'mohawk', 'ponytail']).toContain(traits.hair_style);
      
      expect(traits.has_earrings).toBe(true); // from nft_has_accessories
    });

    it('uses deterministic fallbacks when nft traits are missing', () => {
      const traits = deriveFreeTraits({}, 123);
      expect(traits.hair_color).toBeDefined();
      expect(traits.skin_tone).toBeDefined();
      expect(traits.gender).toBeDefined();
    });
  });

  describe('nftToCharacter', () => {
    it('converts a full NFT object to a Character', () => {
      const mockNft = {
        tokenId: '69',
        name: 'Schizo #69',
        imageUrl: 'https://example.com/69.png',
        attributes: [
          { trait_type: 'Hair', value: 'Pompadour' },
          { trait_type: 'Eyes', value: 'Milady Blue' },
          { trait_type: 'Accessories', value: 'No Accessories' },
        ],
      };

      const char = nftToCharacter(mockNft as any);

      expect(char.id).toBe('nft_69');
      expect(char.name).toBe('Schizo #69');
      expect(char.tokenId).toBe('69');
      expect(char.traits.nft_hair).toBe('pompadour');
      expect(char.traits.nft_eyes).toBe('milady blue');
      expect(char.traits.nft_has_accessories).toBe(false);
    });
  });
});
