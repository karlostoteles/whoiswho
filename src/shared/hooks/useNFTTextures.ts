import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { useGameCharacters, useGameMode } from '@/core/store/selectors';
import type { NFTCharacter } from '@/core/data/nftCharacterAdapter';
import ImageCache from '@/shared/services/ImageCache';

/**
 * Loads NFT images as Three.js textures.
 *
 * OPTIMIZED: Uses unified ImageCache to prevent duplicate loading.
 * Images loaded here are shared with React UI and other consumers.
 *
 * Only active in NFT mode. Falls back gracefully if image fails to load.
 * Returns a Map<characterId, CanvasTexture> for NFT characters with loaded images.
 */
export function useNFTTextures(): Map<string, THREE.Texture> {
  const characters = useGameCharacters();
  const mode = useGameMode();
  const [textures, setTextures] = useState<Map<string, THREE.Texture>>(new Map());

  useEffect(() => {
    if (mode !== 'nft') {
      setTextures(new Map());
      return;
    }

    let cancelled = false;

    const nftChars = characters.filter(
      (c): c is NFTCharacter => 'source' in c && (c as any).source === 'nft'
    );

    if (nftChars.length === 0) {
      setTextures(new Map());
      return;
    }

    // Load via unified cache (deduplicated with other consumers)
    const loadTextures = async () => {
      for (const char of nftChars) {
        if (cancelled) break;

        // Check cache first
        const existingTexture = ImageCache.getTexture(char.id);
        if (existingTexture) {
          setTextures(prev => {
            const next = new Map(prev);
            next.set(char.id, existingTexture);
            return next;
          });
          continue;
        }

        // Load via unified cache
        const image = await ImageCache.load(char.id, char.imageUrl);
        if (image && !cancelled) {
          const texture = ImageCache.getTexture(char.id);
          if (texture) {
            setTextures(prev => {
              const next = new Map(prev);
              next.set(char.id, texture);
              return next;
            });
          }
        }
      }
    };

    loadTextures();

    return () => {
      cancelled = true;
    };
  }, [characters, mode]);

  return textures;
}
