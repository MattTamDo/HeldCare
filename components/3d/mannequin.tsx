"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { Mesh, MeshStandardMaterial } from "three";

import type { BodyRegion } from "@/lib/assessment/types";

/**
 * Procedural mannequin for spatial orientation.
 *
 * Visual orientation only — highlighting a region says "the resident mentioned
 * here", never anything clinical.
 *
 * The figure faces the camera (+z), so its anatomical left sits at world +x —
 * the mirror of where the viewer's own left is. Region positions below follow
 * the resident's anatomy, not the screen.
 */

const BASE_COLOR = "#5b6a7d";
const HIGHLIGHT_COLOR = "#f43f5e";

type PartProps = {
  region?: BodyRegion;
  active?: BodyRegion;
  position: [number, number, number];
  rotation?: [number, number, number];
  children: React.ReactNode;
};

function Part({ region, active, position, rotation, children }: PartProps) {
  const materialRef = useRef<MeshStandardMaterial>(null);
  const isActive = region !== undefined && region === active;

  useFrame(({ clock }) => {
    const material = materialRef.current;
    if (!material) return;
    material.emissiveIntensity = isActive
      ? 0.45 + Math.sin(clock.elapsedTime * 3) * 0.25
      : 0;
  });

  return (
    <mesh position={position} rotation={rotation} castShadow>
      {children}
      <meshStandardMaterial
        ref={materialRef}
        color={isActive ? HIGHLIGHT_COLOR : BASE_COLOR}
        emissive={HIGHLIGHT_COLOR}
        emissiveIntensity={0}
        roughness={0.55}
        metalness={0.05}
      />
    </mesh>
  );
}

/** Slowly orbiting marker ring drawing the eye to the highlighted region. */
function Marker({ position }: { position: [number, number, number] }) {
  const ref = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.z = clock.elapsedTime * 1.2;
    const scale = 1 + Math.sin(clock.elapsedTime * 3) * 0.08;
    ref.current.scale.setScalar(scale);
  });

  return (
    <mesh ref={ref} position={position} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.3, 0.012, 8, 48]} />
      <meshBasicMaterial color={HIGHLIGHT_COLOR} transparent opacity={0.9} />
    </mesh>
  );
}

const MARKER_POSITIONS: Record<BodyRegion, [number, number, number]> = {
  head: [0, 1.58, 0],
  torso: [0, 1.02, 0],
  pelvis: [0, 0.62, 0],
  "left-arm": [0.32, 1.02, 0],
  "right-arm": [-0.32, 1.02, 0],
  "left-leg": [0.13, 0.2, 0],
  "right-leg": [-0.13, 0.2, 0],
};

function Figure({ active }: { active?: BodyRegion }) {
  return (
    // Shifts the figure so its vertical midpoint sits on the orbit target.
    <group position={[0, -0.82, 0]}>
      <Part region="head" active={active} position={[0, 1.58, 0]}>
        <sphereGeometry args={[0.17, 32, 32]} />
      </Part>

      {/* Neck — not a selectable region. */}
      <Part position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.06, 0.07, 0.1, 16]} />
      </Part>

      <Part region="torso" active={active} position={[0, 1.02, 0]}>
        <capsuleGeometry args={[0.21, 0.38, 8, 24]} />
      </Part>

      <Part region="pelvis" active={active} position={[0, 0.64, 0]}>
        <capsuleGeometry args={[0.19, 0.12, 8, 24]} />
      </Part>

      <Part
        region="left-arm"
        active={active}
        position={[0.32, 1.02, 0]}
        rotation={[0, 0, -0.14]}
      >
        <capsuleGeometry args={[0.062, 0.44, 8, 20]} />
      </Part>
      <Part
        region="right-arm"
        active={active}
        position={[-0.32, 1.02, 0]}
        rotation={[0, 0, 0.14]}
      >
        <capsuleGeometry args={[0.062, 0.44, 8, 20]} />
      </Part>

      <Part region="left-leg" active={active} position={[0.12, 0.22, 0]}>
        <capsuleGeometry args={[0.079, 0.5, 8, 20]} />
      </Part>
      <Part region="right-leg" active={active} position={[-0.12, 0.22, 0]}>
        <capsuleGeometry args={[0.079, 0.5, 8, 20]} />
      </Part>

      {active ? <Marker position={MARKER_POSITIONS[active]} /> : null}
    </group>
  );
}

export default function Mannequin({ active }: { active?: BodyRegion }) {
  return (
    <Canvas
      camera={{ position: [0, 0.1, 3.2], fov: 42 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={["#0f141b"]} />
      <hemisphereLight intensity={0.7} groundColor="#0b0e13" />
      <directionalLight position={[2.5, 4, 3]} intensity={1.5} />
      <directionalLight position={[-3, 1.5, -2]} intensity={0.4} />

      <Figure active={active} />

      <OrbitControls
        enablePan={false}
        minDistance={1.6}
        maxDistance={5}
        target={[0, 0, 0]}
      />
    </Canvas>
  );
}
