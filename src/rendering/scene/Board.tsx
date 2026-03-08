import { useState, useEffect } from 'react';
import * as THREE from 'three';
import { BOARD } from '@/core/rules/constants';

interface BoardProps {
  /** Dynamic width from the adaptive grid (defaults to BOARD.width) */
  width?: number;
  depth?: number;
}

/** Procedural felt texture — deep navy baize, subtle woven grid. */
function useFeltTexture(): THREE.CanvasTexture | null {
  const [tex, setTex] = useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    const SIZE = 512;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d')!;

    // Deep midnight navy — not grass
    ctx.fillStyle = '#0b0d2a';
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Diagonal bias-weave lines (blue-tinted threads)
    const cell = 20;
    ctx.strokeStyle = 'rgba(100,120,255,0.025)';
    ctx.lineWidth = 0.7;
    for (let i = -SIZE; i < SIZE * 2; i += cell) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + SIZE, SIZE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - SIZE, SIZE); ctx.stroke();
    }
    // Horizontal cross lines
    for (let y = 0; y < SIZE; y += cell) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(SIZE, y); ctx.stroke();
    }

    // Sparse fiber glints (cooler tint)
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = `rgba(160,180,255,${Math.random() * 0.045})`;
      ctx.fillRect(Math.random() * SIZE, Math.random() * SIZE, 1, 1);
    }

    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(5, 4);
    t.colorSpace = THREE.SRGBColorSpace;

    setTex(t);
    return () => { t.dispose(); };
  }, []);

  return tex;
}

/** Procedural walnut wood texture for the board outer rim. */
function useWoodTexture(): THREE.CanvasTexture | null {
  const [tex, setTex] = useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Warm walnut base gradient
    const bg = ctx.createLinearGradient(0, 0, 0, 128);
    bg.addColorStop(0,   '#4a2610');
    bg.addColorStop(0.4, '#3c1e0b');
    bg.addColorStop(0.7, '#4e2c12');
    bg.addColorStop(1,   '#3c1e0b');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 128);

    // Grain lines — slightly wavy vertical strokes
    for (let i = 0; i < 36; i++) {
      const x = (i / 36) * 512 + (Math.random() - 0.5) * 14;
      ctx.strokeStyle = `rgba(0,0,0,${Math.random() * 0.15 + 0.02})`;
      ctx.lineWidth = Math.random() * 1.8 + 0.4;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(
        x + (Math.random() - 0.5) * 10, 40,
        x + (Math.random() - 0.5) * 10, 90,
        x + (Math.random() - 0.5) * 8,  128,
      );
      ctx.stroke();
    }

    // Top-edge shine (catches the key light)
    const shine = ctx.createLinearGradient(0, 0, 0, 26);
    shine.addColorStop(0, 'rgba(255,195,110,0.16)');
    shine.addColorStop(1, 'rgba(255,195,110,0)');
    ctx.fillStyle = shine;
    ctx.fillRect(0, 0, 512, 26);

    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(10, 1);
    t.colorSpace = THREE.SRGBColorSpace;

    setTex(t);
    return () => { t.dispose(); };
  }, []);

  return tex;
}

/** Four thin gold inlay strips — one along each edge of the felt surface. */
function GoldInlay({ w, d }: { w: number; d: number }) {
  const fw = w - 0.32;  // felt width
  const fd = d - 0.32;  // felt depth
  const STRIP = 0.045;  // inlay strip width
  const Y = BOARD.height / 2 + 0.003;
  const matProps = {
    color: '#c49230' as const,
    emissive: '#E8A444' as const,
    emissiveIntensity: 0.2,
    roughness: 0.25,
    metalness: 0.88,
  };

  return (
    <>
      {/* Top */}
      <mesh position={[0, Y, -fd / 2 + STRIP / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[fw, STRIP]} />
        <meshStandardMaterial {...matProps} />
      </mesh>
      {/* Bottom */}
      <mesh position={[0, Y, fd / 2 - STRIP / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[fw, STRIP]} />
        <meshStandardMaterial {...matProps} />
      </mesh>
      {/* Left */}
      <mesh position={[-fw / 2 + STRIP / 2, Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[STRIP, fd]} />
        <meshStandardMaterial {...matProps} />
      </mesh>
      {/* Right */}
      <mesh position={[fw / 2 - STRIP / 2, Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[STRIP, fd]} />
        <meshStandardMaterial {...matProps} />
      </mesh>
    </>
  );
}

export function Board({ width = BOARD.width, depth = BOARD.depth }: BoardProps) {
  const w = Math.max(BOARD.width, width + 2.0);
  const d = Math.max(BOARD.depth, depth + 2.0);

  const feltTex = useFeltTexture();
  const woodTex = useWoodTexture();

  return (
    <group>
      {/* Outer walnut rim — wider than before so it wraps around the felt visibly */}
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <boxGeometry args={[w + 0.44, BOARD.height + 0.18, d + 0.44]} />
        <meshStandardMaterial
          color="#ffffff"
          map={woodTex ?? undefined}
          roughness={0.65}
          metalness={0.02}
        />
      </mesh>

      {/* Main inner board body */}
      <mesh position={[0, 0, 0]} receiveShadow>
        <boxGeometry args={[w, BOARD.height, d]} />
        <meshStandardMaterial color={BOARD.color} roughness={0.82} />
      </mesh>

      {/* Navy felt surface — recessed 5mm below board top so the rim wraps it */}
      {feltTex && (
        <mesh
          position={[0, BOARD.height / 2 - 0.004, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[w - 0.26, d - 0.26]} />
          <meshStandardMaterial color="#ffffff" map={feltTex} roughness={0.97} />
        </mesh>
      )}

      {/* Gold inlay border sits above the recessed felt, reads as embedded trim */}
      <GoldInlay w={w} d={d} />
    </group>
  );
}
