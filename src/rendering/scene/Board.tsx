import { useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { BOARD } from '@/core/rules/constants';

interface BoardProps { width?: number; depth?: number; }

function useFeltTexture(): THREE.CanvasTexture | null {
  const [tex, setTex] = useState<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    const SIZE = 512;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#0b0d2a'; ctx.fillRect(0, 0, SIZE, SIZE);
    const cell = 20;
    ctx.strokeStyle = 'rgba(100,120,255,0.025)'; ctx.lineWidth = 0.7;
    for (let i = -SIZE; i < SIZE * 2; i += cell) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + SIZE, SIZE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - SIZE, SIZE); ctx.stroke();
    }
    for (let y = 0; y < SIZE; y += cell) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(SIZE, y); ctx.stroke(); }
    for (let i = 0; i < 700; i++) { ctx.fillStyle = `rgba(160,180,255,${Math.random() * 0.045})`; ctx.fillRect(Math.random() * SIZE, Math.random() * SIZE, 1, 1); }
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 4); t.colorSpace = THREE.SRGBColorSpace;
    setTex(t);
    return () => { t.dispose(); };
  }, []);
  return tex;
}

function useWoodTexture(): THREE.CanvasTexture | null {
  const [tex, setTex] = useState<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const bg = ctx.createLinearGradient(0, 0, 0, 128);
    bg.addColorStop(0, '#4a2610'); bg.addColorStop(0.4, '#3c1e0b'); bg.addColorStop(0.7, '#4e2c12'); bg.addColorStop(1, '#3c1e0b');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 128);
    for (let i = 0; i < 36; i++) {
      const x = (i / 36) * 512 + (Math.random() - 0.5) * 14;
      ctx.strokeStyle = `rgba(0,0,0,${Math.random() * 0.15 + 0.02})`;
      ctx.lineWidth = Math.random() * 1.8 + 0.4;
      ctx.beginPath(); ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + (Math.random() - 0.5) * 10, 40, x + (Math.random() - 0.5) * 10, 90, x + (Math.random() - 0.5) * 8, 128);
      ctx.stroke();
    }
    const shine = ctx.createLinearGradient(0, 0, 0, 26);
    shine.addColorStop(0, 'rgba(255,195,110,0.16)'); shine.addColorStop(1, 'rgba(255,195,110,0)');
    ctx.fillStyle = shine; ctx.fillRect(0, 0, 512, 26);
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 1); t.colorSpace = THREE.SRGBColorSpace;
    setTex(t);
    return () => { t.dispose(); };
  }, []);
  return tex;
}

const useMaterials = (feltTex: THREE.Texture | null, woodTex: THREE.Texture | null) => {
  return useMemo(() => ({
    rim: new THREE.MeshPhysicalMaterial({ color: '#3c1e0b', map: woodTex ?? undefined, roughness: 0.55, metalness: 0.05, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
    body: new THREE.MeshPhysicalMaterial({ color: BOARD.color, roughness: 0.75, metalness: 0.0, clearcoat: 0.1, clearcoatRoughness: 0.6 }),
    felt: new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: feltTex ?? undefined, roughness: 0.85, metalness: 0.0, sheen: 0.5, sheenRoughness: 0.7, sheenColor: new THREE.Color('#1a2040') }),
    gold: new THREE.MeshPhysicalMaterial({ color: '#c49230', emissive: '#E8A444', emissiveIntensity: 0.2, roughness: 0.25, metalness: 0.88, clearcoat: 0.5, clearcoatRoughness: 0.2 }),
  }), [feltTex, woodTex]);
};

function GoldInlay({ w, d, material }: { w: number; d: number; material: THREE.Material }) {
  const fw = w - 0.32, fd = d - 0.32, STRIP = 0.045, Y = BOARD.height / 2 + 0.003;
  return (
    <>
      <mesh position={[0, Y, -fd / 2 + STRIP / 2]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[fw, STRIP]} /><primitive object={material} attach="material" /></mesh>
      <mesh position={[0, Y, fd / 2 - STRIP / 2]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[fw, STRIP]} /><primitive object={material} attach="material" /></mesh>
      <mesh position={[-fw / 2 + STRIP / 2, Y, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[STRIP, fd]} /><primitive object={material} attach="material" /></mesh>
      <mesh position={[fw / 2 - STRIP / 2, Y, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[STRIP, fd]} /><primitive object={material} attach="material" /></mesh>
    </>
  );
}

export function Board({ width = BOARD.width, depth = BOARD.depth }: BoardProps) {
  const w = Math.max(BOARD.width, width + 2.0);
  const d = Math.max(BOARD.depth, depth + 2.0);
  const feltTex = useFeltTexture();
  const woodTex = useWoodTexture();
  const materials = useMaterials(feltTex, woodTex);

  return (
    <group>
      {/* Outer walnut rim */}
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <boxGeometry args={[w + 0.44, BOARD.height + 0.18, d + 0.44]} />
        <primitive object={materials.rim} attach="material" />
      </mesh>

      {/* Main inner board body */}
      <mesh position={[0, 0, 0]} receiveShadow>
        <boxGeometry args={[w, BOARD.height, d]} />
        <primitive object={materials.body} attach="material" />
      </mesh>

      {/* Navy felt surface */}
      {feltTex && (
        <mesh position={[0, BOARD.height / 2 - 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[w - 0.26, d - 0.26]} />
          <primitive object={materials.felt} attach="material" />
        </mesh>
      )}

      {/* Gold inlay border */}
      <GoldInlay w={w} d={d} material={materials.gold} />
    </group>
  );
}
