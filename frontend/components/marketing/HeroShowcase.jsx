"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Canvas, useFrame } from "@react-three/fiber";
import { useTexture, Float, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

const DASHBOARD_SRC = "/product/dashboard.png";
const ROADMAP_SRC = "/product/roadmap.png";
const DASHBOARD_RATIO = 3400 / 1842;
const ROADMAP_RATIO = 3392 / 1850;

function useScreenTexture(url) {
  const base = useTexture(url);
  return useMemo(() => {
    const tex = base.clone();
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  }, [base]);
}

function Screen({ url, ratio, width, position, rotation }) {
  const texture = useScreenTexture(url);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, width / ratio]} />
      <meshBasicMaterial map={texture} toneMapped={false} transparent />
    </mesh>
  );
}

function Rig({ children }) {
  const group = useRef(null);

  useFrame((state) => {
    if (!group.current) return;
    const targetY = state.pointer.x * 0.22;
    const targetX = -state.pointer.y * 0.12;
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, targetY, 0.045);
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetX, 0.045);
  });

  return <group ref={group}>{children}</group>;
}

function Scene() {
  return (
    <>
      <Rig>
        <Float speed={1.1} rotationIntensity={0.1} floatIntensity={0.45}>
          <Screen
            url={ROADMAP_SRC}
            ratio={ROADMAP_RATIO}
            width={4.8}
            position={[-1.85, 1.35, -1.4]}
            rotation={[0, 0.24, -0.055]}
          />
        </Float>
        <Float speed={1.4} rotationIntensity={0.08} floatIntensity={0.55}>
          <Screen
            url={DASHBOARD_SRC}
            ratio={DASHBOARD_RATIO}
            width={6.3}
            position={[0.7, -0.55, 0.7]}
            rotation={[0, -0.13, 0.02]}
          />
        </Float>
      </Rig>
      <ContactShadows position={[0, -2.3, 0]} opacity={0.28} scale={14} blur={2.6} far={3} />
    </>
  );
}

function StaticFallback() {
  return (
    <div className="relative mx-auto h-full w-full max-w-4xl">
      <div className="absolute left-[6%] top-[6%] w-[62%] -rotate-2 overflow-hidden rounded-xl border border-outline-variant shadow-[0_20px_50px_-20px_rgba(0,80,203,0.25)]">
        <Image src={ROADMAP_SRC} alt="" width={1200} height={651} className="h-auto w-full" />
      </div>
      <div className="absolute bottom-[4%] right-[4%] w-[62%] rotate-1 overflow-hidden rounded-xl border border-outline-variant shadow-[0_25px_60px_-20px_rgba(0,80,203,0.3)]">
        <Image src={DASHBOARD_SRC} alt="DISHA AI dashboard" width={1200} height={650} className="h-auto w-full" priority />
      </div>
    </div>
  );
}

function detectReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function detectWebgl() {
  if (typeof document === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function HeroShowcase() {
  const [reducedMotion, setReducedMotion] = useState(detectReducedMotion);
  const [webglOk] = useState(detectWebgl);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = (e) => setReducedMotion(e.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (reducedMotion || !webglOk) {
    return (
      <div className="relative h-[380px] w-full sm:h-[460px] lg:h-[600px]">
        <StaticFallback />
      </div>
    );
  }

  return (
    <div className="relative h-[420px] w-full sm:h-[520px] lg:h-[680px]">
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 0, 7.2], fov: 30 }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}
