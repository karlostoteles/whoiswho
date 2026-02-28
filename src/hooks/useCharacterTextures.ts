import { useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useGameCharacters } from '../store/selectors';
import { renderPortrait, renderCardBack } from '../canvas/PortraitRenderer';

/**
 * Returns a texture map for all game characters.
 *
 * Strategy:
 * 1. Immediately provide procedural canvas textures so the board renders
 *    without any delay.
 * 2. For NFT characters with a real imageUrl, asynchronously load the
 *    actual artwork and swap it in once loaded.
 *
 * This means the board starts with procedural art (instant) and upgrades
 * to real SCHIZODIO art as each image arrives from IPFS/HTTP.
 */
export function useCharacterTextures(): Map<string, THREE.Texture> {
  const characters = useGameCharacters();

  // Build initial procedural textures synchronously
  const initialTextures = useMemo(() => {
    const map = new Map<string, THREE.Texture>();
    for (const char of characters) {
      map.set(char.id, renderPortrait(char));
    }
    return map;
  }, [characters]);

  const [textures, setTextures] = useState<Map<string, THREE.Texture>>(initialTextures);

  // Sync procedural textures when characters change
  useEffect(() => {
    setTextures(initialTextures);
  }, [initialTextures]);

  // Async: replace procedural textures with real NFT images
  useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader();

    for (const char of characters) {
      const imageUrl = (char as any).imageUrl as string | undefined;
      if (!imageUrl) continue;

      loader.load(
        imageUrl,
        (texture) => {
          if (cancelled) return;
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.needsUpdate = true;
          setTextures((prev) => {
            const next = new Map(prev);
            next.set(char.id, texture);
            return next;
          });
        },
        undefined,
        () => {
          // Image failed to load — keep the procedural canvas texture
        },
      );
    }

    return () => {
      cancelled = true;
    };
  }, [characters]);

  return textures;
}

export function useCardBackTexture(): THREE.CanvasTexture {
  return useMemo(() => renderCardBack(), []);
}
