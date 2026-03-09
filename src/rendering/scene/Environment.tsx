import { ContactShadows } from '@react-three/drei';

export function Environment() {
  return (
    <>
      <color attach="background" args={['#0f0e17']} />
      <fog attach="fog" args={['#0f0e17', 22, 48]} />

      <hemisphereLight args={['#2a3a7a', '#2a1608', 0.4]} />

      <directionalLight
        position={[5, 8, 5]}
        intensity={1.2}
        color="#fff5e6"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0001}
      />

      <spotLight position={[-6, 5, -6]} intensity={0.8} color="#3a7aff" angle={0.6} penumbra={1} castShadow={false} />
      <pointLight position={[7, 2.5, 3]} intensity={0.5} color="#ff8833" />
      <pointLight position={[0, -1.2, 5]} intensity={0.25} color="#7744bb" />

      <ContactShadows position={[0, -0.01, 0]} opacity={0.5} scale={20} blur={2} far={4} resolution={512} color="#000000" />
    </>
  );
}
