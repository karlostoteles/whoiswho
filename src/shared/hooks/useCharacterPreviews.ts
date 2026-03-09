import { useMemo, useEffect, useState } from 'react';
import { useGameCharacters } from '@/core/store/selectors';
import { renderPortrait } from '@/rendering/canvas/PortraitRenderer';
import ImageCache from '@/shared/services/ImageCache';

/**
 * Generates portrait preview URLs for all characters.
 *
 * OPTIMIZED: Uses unified ImageCache to prevent duplicate loading.
 * Images loaded here are shared with Three.js textures.
 *
 * Used in UI panels (character select, guess panel) where we need
 * thumbnails rather than Three.js textures.
 */
export function useCharacterPreviews(): Map<string, string> {
  const characters = useGameCharacters();
  const [version, setVersion] = useState(0);

  // Subscribe to cache updates - trigger re-render when images load
  useEffect(() => {
    const checkInterval = setInterval(() => {
      // Check if any new images have been loaded
      const stats = ImageCache.getStats();
      if (stats.cached > 0) {
        setVersion(v => v + 1);
      }
    }, 500);

    return () => clearInterval(checkInterval);
  }, []);

  return useMemo(() => {
    const map = new Map<string, string>();
    // For large collections (>50 tokens), skip expensive canvas generation.
    const skipCanvas = characters.length > 50;

    for (const char of characters) {
      // Priority 1: Check unified cache for data URL
      const cachedUrl = ImageCache.getUrl(char.id);
      if (cachedUrl) {
        map.set(char.id, cachedUrl);
        continue;
      }

      // Priority 2: Use imageUrl directly for NFT characters
      const imageUrl = (char as any).imageUrl as string | undefined;
      if (imageUrl) {
        map.set(char.id, imageUrl);
        // Trigger async load for future cache hits
        ImageCache.load(char.id, imageUrl);
        continue;
      }

      if (skipCanvas) continue; // Large collection — colour swatch used instead

      // Priority 3: Fall back to procedural canvas portrait (small collections only)
      const texture = renderPortrait(char);
      if (texture.image instanceof HTMLCanvasElement) {
        const small = document.createElement('canvas');
        small.width = 128;
        small.height = 128;
        const ctx = small.getContext('2d')!;
        ctx.drawImage(texture.image, 0, 0, 128, 128);
        const dataUrl = small.toDataURL();
        map.set(char.id, dataUrl);

        // Also cache for future use
        ImageCache.setProcedural(char.id, texture.image);
      }
      texture.dispose();
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characters, version]);
}

/**
 * Hook for a single character preview - more efficient for individual use
 */
export function useCharacterPreview(charId: string): string | null {
  const characters = useGameCharacters();
  const char = characters.find(c => c.id === charId);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!char) {
      setPreviewUrl(null);
      return;
    }

    // Check cache first
    const cached = ImageCache.getUrl(charId);
    if (cached) {
      setPreviewUrl(cached);
      return;
    }

    // Use direct URL if available
    const imageUrl = (char as any).imageUrl as string | undefined;
    if (imageUrl) {
      setPreviewUrl(imageUrl);
      // Trigger async load
      ImageCache.load(charId, imageUrl).then(() => {
        const url = ImageCache.getUrl(charId);
        if (url) setPreviewUrl(url);
      });
      return;
    }

    // Generate procedural
    const texture = renderPortrait(char);
    if (texture.image instanceof HTMLCanvasElement) {
      const small = document.createElement('canvas');
      small.width = 128;
      small.height = 128;
      const ctx = small.getContext('2d')!;
      ctx.drawImage(texture.image, 0, 0, 128, 128);
      setPreviewUrl(small.toDataURL());
      ImageCache.setProcedural(charId, texture.image);
    }
    texture.dispose();
  }, [charId, char]);

  return previewUrl;
}
