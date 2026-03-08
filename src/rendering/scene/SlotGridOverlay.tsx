/**
 * SlotGridOverlay — one canvas-textured plane that paints a dark recessed
 * rectangle at every character-tile position on the board surface.
 *
 * One draw call.  Automatically repaints when tile count changes (eliminations
 * shrink the grid, so new slot dimensions are computed).  Sits just above the
 * felt (y = BOARD.height/2 + 0.003) and just below the tiles.
 */

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { BOARD } from '@/core/rules/constants';
import { useAdaptiveGrid } from '@/shared/hooks/useAdaptiveGrid';

export function SlotGridOverlay() {
  const { layout } = useAdaptiveGrid();
  const { cols, rows, tileW, tileH, gap, gridW, gridD } = layout;

  const texture = useMemo(() => {
    // px-per-world-unit: scale down for large grids so canvas stays within 2048px
    const PPU = Math.min(96, 2048 / Math.max(gridW, gridD));
    const cW = Math.round(gridW * PPU);
    const cH = Math.round(gridD * PPU);

    const canvas = document.createElement('canvas');
    canvas.width  = Math.max(1, cW);
    canvas.height = Math.max(1, cH);
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const slotW = tileW * PPU;
    const slotH = tileH * PPU;
    const gX    = gap   * PPU;
    const gY    = gap   * PPU;

    // Centre the slot grid inside the canvas
    const totalW = cols * slotW + (cols - 1) * gX;
    const totalH = rows * slotH + (rows - 1) * gY;
    const ox = (canvas.width  - totalW) / 2;
    const oy = (canvas.height - totalH) / 2;

    // Corner radius — proportional to the smaller dimension, capped so it
    // doesn't exceed half the slot side on tiny tiles
    const r = Math.min(slotW * 0.08, slotH * 0.08, 8);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = ox + col * (slotW + gX);
        const y = oy + row * (slotH + gY);

        // ── Outer drop shadow (pressed-in look) ─────────────────────────────
        const grad = ctx.createRadialGradient(
          x + slotW / 2, y + slotH * 0.62, 0,
          x + slotW / 2, y + slotH * 0.62, Math.max(slotW, slotH) * 0.78,
        );
        grad.addColorStop(0,    'rgba(0,0,0,0)');
        grad.addColorStop(0.65, 'rgba(0,0,0,0)');
        grad.addColorStop(1,    'rgba(0,0,0,0.45)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x - 6, y - 6, slotW + 12, slotH + 12, r + 6);
        ctx.fill();

        // ── Dark inset border ────────────────────────────────────────────────
        ctx.strokeStyle = 'rgba(0,0,0,0.62)';
        ctx.lineWidth   = Math.max(1.5, slotW * 0.022);
        ctx.beginPath();
        ctx.roundRect(x, y, slotW, slotH, r);
        ctx.stroke();

        // ── Top-left bevel highlight (gives the "pressed in" depth illusion) ─
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth   = Math.max(1, slotW * 0.014);
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, slotW - 4, slotH - 4, Math.max(1, r - 2));
        ctx.stroke();
      }
    }

    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [cols, rows, tileW, tileH, gap, gridW, gridD]);

  // Release GPU texture when layout changes or component unmounts
  useEffect(() => () => { texture.dispose(); }, [texture]);

  return (
    <mesh
      position={[0, BOARD.height / 2 + 0.003, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[gridW, gridD]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
}
