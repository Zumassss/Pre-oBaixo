"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { stores, type Store } from "@/lib/mock/stores";

const RADIUS = 1;
const PARTICLE_COUNT = 14000;

/* ------------------------------------------------------------------
   Geometria de apoio
   ------------------------------------------------------------------ */

/**
 * Gerador pseudoaleatório com semente (mulberry32).
 *
 * A nuvem precisa parecer aleatória, mas não pode mudar a cada render — além
 * de violar a pureza exigida pelo React, uma esfera diferente a cada
 * renderização causaria um salto visual. Mesma semente, mesma esfera.
 */
function seededRandom(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Converte coordenada geográfica em ponto na esfera. */
function latLonToVector3(lat: number, lon: number, radius = RADIUS) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

/* ------------------------------------------------------------------
   Nuvem de partículas — o corpo do globo
   ------------------------------------------------------------------ */

const sphereVertex = /* glsl */ `
  attribute float aScale;
  attribute float aSeed;
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  varying float vFade;
  varying float vSeed;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    // A própria posição é a normal (esfera centrada na origem).
    vec3 n = normalize(normalMatrix * normalize(position));
    vec3 viewDir = normalize(-mvPosition.xyz);
    float facing = dot(n, viewDir);

    // Silhueta acende, face oposta apaga quase por completo. É esse contraste
    // que faz a nuvem ler como esfera em vez de disco chapado.
    float rim = 1.0 - abs(facing);
    float front = smoothstep(-0.05, 0.55, facing);
    float twinkle = 0.78 + 0.22 * sin(uTime * 1.7 + aSeed * 6.2831);

    vFade = mix(0.30, 1.0, pow(rim, 1.5)) * mix(0.16, 1.0, front) * twinkle;
    vSeed = aSeed;

    // Tamanho em unidades de mundo, convertido para pixels do framebuffer.
    // uPixelRatio mantem o ponto com o mesmo peso visual em telas retina.
    gl_PointSize = uSize * uPixelRatio * aScale * (260.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const sphereFragment = /* glsl */ `
  uniform vec3 uColorDeep;
  uniform vec3 uColorHot;
  varying float vFade;
  varying float vSeed;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;

    float alpha = smoothstep(0.5, 0.04, d) * vFade;
    // Uma minoria de partículas queima mais quente, criando cintilação.
    float heat = clamp(vFade * 1.15 + step(0.90, vSeed) * 0.5, 0.0, 1.0);
    vec3 color = mix(uColorDeep, uColorHot, heat);

    gl_FragColor = vec4(color, alpha);
  }
`;

function ParticleSphere() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const { positions, scales, seeds } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const scales = new Float32Array(PARTICLE_COUNT);
    const seeds = new Float32Array(PARTICLE_COUNT);
    const golden = Math.PI * (1 + Math.sqrt(5));
    const random = seededRandom(20260907);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Distribuição de Fibonacci: pontos igualmente espalhados na superfície.
      const phi = Math.acos(1 - (2 * (i + 0.5)) / PARTICLE_COUNT);
      const theta = golden * (i + 0.5);

      // Espessura mínima na casca para a nuvem não parecer uma casca perfeita.
      const shell = RADIUS * (0.985 + random() * 0.03);

      positions[i * 3] = shell * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = shell * Math.cos(phi);
      positions[i * 3 + 2] = shell * Math.sin(phi) * Math.sin(theta);

      scales[i] = 0.55 + random() * 0.9;
      seeds[i] = random();
    }

    return { positions, scales, seeds };
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      // Unidades de mundo: rende pontos de ~3px na distância de câmera usada.
      uSize: { value: 0.038 },
      uPixelRatio: { value: 1 },
      uColorDeep: { value: new THREE.Color("#a8091f") },
      uColorHot: { value: new THREE.Color("#ff5568") },
    }),
    [],
  );

  useFrame((state) => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    materialRef.current.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={PARTICLE_COUNT}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aScale"
          args={[scales, 1]}
          count={PARTICLE_COUNT}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aSeed"
          args={[seeds, 1]}
          count={PARTICLE_COUNT}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={sphereVertex}
        fragmentShader={sphereFragment}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ------------------------------------------------------------------
   Arcos entre a matriz e as unidades
   ------------------------------------------------------------------ */

type ArcData = {
  curve: THREE.QuadraticBezierCurve3;
  geometry: THREE.BufferGeometry;
  offset: number;
  speed: number;
};

function Arcs({ arcs }: { arcs: ArcData[] }) {
  const pulseRefs = useRef<(THREE.Mesh | null)[]>([]);
  const lines = useMemo(
    () => arcs.map((arc) => new THREE.Line(arc.geometry, arcMaterial)),
    [arcs],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    arcs.forEach((arc, i) => {
      const mesh = pulseRefs.current[i];
      if (!mesh) return;
      const progress = (t * arc.speed + arc.offset) % 1;
      const point = arc.curve.getPoint(progress);
      mesh.position.copy(point);
      // Some ao chegar e ao sair, para o pulso ter começo e fim.
      const fade = Math.sin(progress * Math.PI);
      mesh.scale.setScalar(0.005 + fade * 0.008);
      (mesh.material as THREE.MeshBasicMaterial).opacity = fade * 0.9;
    });
  });

  return (
    <group>
      {arcs.map((_, i) => (
        <group key={i}>
          <primitive object={lines[i]} />
          <mesh
            ref={(el) => {
              pulseRefs.current[i] = el;
            }}
            scale={0.008}
          >
            <sphereGeometry args={[1, 10, 10]} />
            <meshBasicMaterial
              color="#ff8397"
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const arcMaterial = new THREE.LineBasicMaterial({
  color: new THREE.Color("#ff2b4d"),
  transparent: true,
  opacity: 0.34,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

/* ------------------------------------------------------------------
   Unidades: ponto luminoso + anel pulsante
   ------------------------------------------------------------------ */

function StoreNode({
  store,
  position,
  index,
  onHover,
}: {
  store: Store;
  position: THREE.Vector3;
  index: number;
  onHover: (store: Store | null, screen: { x: number; y: number } | null) => void;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const offline = store.status === "offline";
  const color = offline ? "#5c5c68" : store.status === "atencao" ? "#ffb020" : "#ff3355";

  // Orienta o anel para ficar rente à superfície da esfera.
  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), position.clone().normalize());
    return q;
  }, [position]);

  useFrame((state) => {
    if (offline) return;
    const t = (state.clock.elapsedTime * 0.55 + index * 0.37) % 1;
    if (ringRef.current) {
      ringRef.current.scale.setScalar(0.015 + t * 0.06);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity =
        (1 - t) * 0.6;
    }
    if (coreRef.current) {
      const pulse = 0.8 + Math.sin(state.clock.elapsedTime * 2.4 + index) * 0.2;
      coreRef.current.scale.setScalar(0.011 * pulse);
    }
  });

  const handleOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onHover(store, { x: event.clientX, y: event.clientY });
  };

  return (
    <group position={position} quaternion={quaternion}>
      {/* A escala vive na malha, não só na animação: unidades offline não
          entram no laço de quadro e ficariam do tamanho do globo. */}
      <mesh
        ref={coreRef}
        scale={0.011}
        onPointerOver={handleOver}
        onPointerOut={() => onHover(null, null)}
      >
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial
          color={color}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Área de captura do ponteiro, maior que o ponto visível */}
      <mesh
        visible={false}
        onPointerOver={handleOver}
        onPointerOut={() => onHover(null, null)}
      >
        <sphereGeometry args={[0.055, 8, 8]} />
      </mesh>
      {!offline && (
        <mesh ref={ringRef} scale={0.02}>
          <ringGeometry args={[0.62, 1, 40]} />
          <meshBasicMaterial
            color={color}
            transparent
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------
   Cena
   ------------------------------------------------------------------ */

function Scene({
  onHover,
}: {
  onHover: (store: Store | null, screen: { x: number; y: number } | null) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0 });

  const nodes = useMemo(
    () =>
      stores.map((store) => ({
        store,
        position: latLonToVector3(store.lat, store.lon, RADIUS * 1.008),
      })),
    [],
  );

  const arcs = useMemo<ArcData[]>(() => {
    const hub = nodes[0].position;
    return nodes.slice(1).map((node, i) => {
      const mid = hub
        .clone()
        .add(node.position)
        .multiplyScalar(0.5)
        .normalize()
        .multiplyScalar(RADIUS * (1.22 + hub.distanceTo(node.position) * 0.14));

      const curve = new THREE.QuadraticBezierCurve3(hub, mid, node.position);
      const points = curve.getPoints(60);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);

      return {
        curve,
        geometry,
        offset: i * 0.17,
        speed: 0.16 + (i % 3) * 0.035,
      };
    });
  }, [nodes]);

  useFrame((state, delta) => {
    if (!group.current) return;
    // Rotação contínua, lenta o bastante para não cansar.
    group.current.rotation.y += delta * 0.085;

    // Paralaxe sutil seguindo o ponteiro.
    pointer.current.x += (state.pointer.x * 0.16 - pointer.current.x) * 0.04;
    pointer.current.y += (state.pointer.y * 0.12 - pointer.current.y) * 0.04;
    group.current.rotation.x = -0.22 + pointer.current.y;
    group.current.position.x = pointer.current.x * 0.08;
  });

  return (
    <group ref={group} rotation={[-0.22, 0, 0.14]}>
      <ParticleSphere />
      <Arcs arcs={arcs} />
      {nodes.map((node, i) => (
        <StoreNode
          key={node.store.id}
          store={node.store}
          position={node.position}
          index={i}
          onHover={onHover}
        />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------
   Componente exportado
   ------------------------------------------------------------------ */

export default function OperationsGlobe() {
  const [hovered, setHovered] = useState<{
    store: Store;
    screen: { x: number; y: number };
  } | null>(null);

  return (
    <div className="relative h-full w-full">
      {/* Brilho de fundo — o globo parece emitir luz sobre o painel.
          Gradiente puro, sem filtro de desfoque: a borda já é suave, e um
          blur grande dentro de um painel com backdrop-filter fica caro e
          acinzenta a cor. */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,23,65,0.20)_0%,rgba(196,5,41,0.09)_38%,rgba(120,4,26,0.03)_58%,transparent_72%)]" />

      <Canvas
        camera={{ position: [0, 0, 3.4], fov: 42 }}
        dpr={[1, 1.8]}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          alpha: true,
        }}
        style={{ background: "transparent" }}
      >
        <Scene
          onHover={(store, screen) =>
            setHovered(store && screen ? { store, screen } : null)
          }
        />
      </Canvas>

      {hovered && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-[calc(100%+14px)]"
          style={{ left: hovered.screen.x, top: hovered.screen.y }}
        >
          <div className="panel px-3 py-2">
            <p className="text-[12px] font-semibold text-fg">
              {hovered.store.name}
            </p>
            <p className="tnum mt-0.5 font-mono text-[10.5px] text-fg-faint">
              {hovered.store.conversas} conversas · {hovered.store.pedidos} pedidos
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
