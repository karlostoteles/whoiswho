import { useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useGameCharacters } from '@/core/store/selectors';
import { renderPortrait, renderCardBack } from '@/rendering/canvas/PortraitRenderer';
import { getTileLOD } from '@/core/rules/constants';

/**
 * Returns a texture map for all game characters.
 *
 * LOD-aware strategy:
 *  minimal (tileW < 0.15) → no textures; CharacterGrid renders coloured planes via InstancedMesh
 *  flat    (tileW < 1.0)  → low-res procedural placeholder → throttled real NFT images
 *  full    (tileW ≥ 1.0)  → high-res procedural portrait → async real NFT image upgrade
 */
export function useCharacterTextures(tileW: number = 1.4): Map<string, THREE.Texture> {
  const characters = useGameCharacters();
  const lod = getTileLOD(tileW);
  const isMinimal = lod === 'minimal';
  const isLargeBoard = characters.length > 100;

  const [textures, setTextures] = useState<Map<string, THREE.Texture>>(new Map());

  // 1. Build initial textures (Instant Placeholders for large boards)
  useEffect(() => {
    if (isMinimal) {
      setTextures(new Map());
      return;
    }

    if (isLargeBoard) {
      // Create ONE shared low-res placeholder to avoid 1000 canvas creations
      const placeholder = renderPortrait({
        id: 'placeholder', name: 'Loading...',
        traits: { gender: 'male' } as any
      }, undefined, true);

      const map = new Map<string, THREE.Texture>();
      for (const char of characters) {
        map.set(char.id, placeholder);
      }
      setTextures(map);

      return () => {
        placeholder.dispose();
      };
    }

    // Small boards: generate individual procedural textures immediately
    const map = new Map<string, THREE.Texture>();
    for (const char of characters) {
      map.set(char.id, renderPortrait(char, undefined, false));
    }
    setTextures(map);

    return () => {
      for (const texture of map.values()) {
        texture.dispose();
      }
    };
  }, [isMinimal, characters, isLargeBoard]);

  // 2. Async: Upgrade to real NFT images with THROTTLING
  useEffect(() => {
    if (lod === 'minimal') return;

    let cancelled = false;
    const BATCH_SIZE = 12;
    const DELAY = 150;

    const loadBatches = async () => {
      for (let i = 0; i < characters.length; i += BATCH_SIZE) {
        if (cancelled) break;
        const batch = characters.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async (char) => {
            let imageUrl = (char as any).imageUrl as string | undefined;
            if (!imageUrl && char.id.startsWith('nft_')) {
              const tokenId = char.id.replace('nft_', '');
              imageUrl = `https://v1assets.schizod.io/images/revealed/${tokenId}.png`;
            }
            if (!imageUrl) return;

            try {
              const img = await loadImage(imageUrl);
              if (cancelled) return;

              const texture = renderPortrait(char, img, isLargeBoard);
              setTextures((prev) => {
                const old = prev.get(char.id);
                // Only dispose if it's NOT the shared placeholder
                if (old && (old as any).isPlaceholder !== true) {
                  // old.dispose(); // risky with shared textures, let's just swap
                }
                const next = new Map(prev);
                next.set(char.id, texture);
                return next;
              });
            } catch (err) {
              // Fail silently
            }
          })
        );

        await new Promise(r => setTimeout(r, DELAY));
      }
    };

    loadBatches();

    return () => {
      cancelled = true;
    };
  }, [characters, lod, isLargeBoard]);

  return textures;
}

/** Helper to load image with promise */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
  });
}

export function useCardBackTexture(): THREE.CanvasTexture {
  return useMemo(() => renderCardBack(), []);
}
