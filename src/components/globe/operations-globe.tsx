"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const RADIUS = 1;

/**
 * Um ponto luminoso na esfera.
 *
 * Cada ponto é uma conversa real em andamento nesta loja. Sem conversa, a
 * esfera gira sozinha: é o estado honesto de quem ainda não conectou o
 * WhatsApp ou não recebeu mensagem hoje.
 */
export type PontoOperacao = {
  id: string;
  /** Conversa que ainda precisa de resposta. */
  urgente?: boolean;
};

/* ------------------------------------------------------------------
   Utilidades
   ------------------------------------------------------------------ */

/**
 * Gerador com semente (mulberry32). A nuvem precisa parecer aleatória sem
 * mudar a cada render: mesma semente, mesma esfera.
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

/**
 * Posição estável a partir de um texto.
 *
 * O mesmo identificador cai sempre no mesmo lugar da esfera, então a
 * conversa não fica pulando de posição a cada quadro.
 */
function posicaoPorId(id: string, radius = RADIUS) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const a = ((h >>> 0) % 10000) / 10000;
  const b = (((h >>> 8) >>> 0) % 10000) / 10000;

  const phi = Math.acos(1 - 2 * a);
  const theta = 2 * Math.PI * b;
  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

/* ------------------------------------------------------------------
   Nuvem de pontos
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
    vec3 pos = position;

    // Respiração: a casca infla e desinfla de leve, em ondas que percorrem
    // a esfera. Dá vida sem parecer que o globo está tremendo.
    float onda = sin(pos.y * 5.0 + uTime * 0.8) * 0.5 + sin(pos.x * 4.0 - uTime * 0.6) * 0.5;
    pos *= 1.0 + onda * 0.004;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    vec3 n = normalize(normalMatrix * normalize(pos));
    vec3 viewDir = normalize(-mvPosition.xyz);
    float facing = dot(n, viewDir);

    // Silhueta acende, face oposta apaga. É esse contraste que faz a nuvem
    // ler como esfera em vez de disco.
    float rim = 1.0 - abs(facing);
    float front = smoothstep(-0.05, 0.55, facing);
    float cintila = 0.8 + 0.2 * sin(uTime * 1.6 + aSeed * 6.2831);

    vFade = mix(0.24, 1.0, pow(rim, 1.6)) * mix(0.07, 1.0, front) * cintila;
    vSeed = aSeed;

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
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = dot(c, c);
    if (d > 0.25) discard;

    float alpha = smoothstep(0.25, 0.0, d) * vFade;
    float calor = clamp(vFade * 1.15 + step(0.9, vSeed) * 0.5, 0.0, 1.0);
    gl_FragColor = vec4(mix(uColorDeep, uColorHot, calor), alpha);
  }
`;

function ParticleSphere({ count }: { count: number }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { gl } = useThree();

  const { positions, scales, seeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const seeds = new Float32Array(count);
    const golden = Math.PI * (1 + Math.sqrt(5));
    const random = seededRandom(20260908);

    for (let i = 0; i < count; i++) {
      // Fibonacci: pontos igualmente distribuídos na superfície.
      const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
      const theta = golden * (i + 0.5);
      const shell = RADIUS * (0.988 + random() * 0.024);

      positions[i * 3] = shell * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = shell * Math.cos(phi);
      positions[i * 3 + 2] = shell * Math.sin(phi) * Math.sin(theta);

      scales[i] = 0.5 + random() * 1.0;
      seeds[i] = random();
    }

    return { positions, scales, seeds };
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: 0.036 },
      uPixelRatio: { value: gl.getPixelRatio() },
      uColorDeep: { value: new THREE.Color("#9e0a20") },
      uColorHot: { value: new THREE.Color("#ff5f72") },
    }),
    [gl],
  );

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aScale"
          args={[scales, 1]}
          count={count}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aSeed"
          args={[seeds, 1]}
          count={count}
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
   Atmosfera: um halo suave logo além da casca
   ------------------------------------------------------------------ */

const glowVertex = /* glsl */ `
  varying float vIntensity;
  void main() {
    vec3 n = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 viewDir = normalize(-mv.xyz);
    // Expoente alto concentra o brilho na borda. Valor baixo espalharia luz
    // pelo miolo e a nuvem deixaria de ler como pontos.
    vIntensity = pow(1.0 - abs(dot(n, viewDir)), 5.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const glowFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vIntensity;
  void main() {
    gl_FragColor = vec4(uColor, vIntensity * 0.42);
  }
`;

function Atmosphere() {
  const uniforms = useMemo(
    () => ({ uColor: { value: new THREE.Color("#ff2d4d") } }),
    [],
  );
  return (
    <mesh scale={1.09}>
      <sphereGeometry args={[RADIUS, 42, 42]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={glowVertex}
        fragmentShader={glowFragment}
        transparent
        depthWrite={false}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/* ------------------------------------------------------------------
   Conversas em andamento
   ------------------------------------------------------------------ */

function NoConversa({
  ponto,
  index,
}: {
  ponto: PontoOperacao;
  index: number;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);

  const position = useMemo(() => posicaoPorId(ponto.id, RADIUS * 1.01), [ponto.id]);
  const cor = ponto.urgente ? "#ffb020" : "#ff3355";

  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), position.clone().normalize());
    return q;
  }, [position]);

  useFrame((state) => {
    const t = (state.clock.elapsedTime * 0.5 + index * 0.37) % 1;
    if (ringRef.current) {
      ringRef.current.scale.setScalar(0.014 + t * 0.055);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.55;
    }
    if (coreRef.current) {
      const pulso = 0.85 + Math.sin(state.clock.elapsedTime * 2.2 + index) * 0.15;
      coreRef.current.scale.setScalar(0.0105 * pulso);
    }
  });

  return (
    <group position={position} quaternion={quaternion}>
      {/* A escala fica na malha, não só na animação: assim o ponto nunca
          aparece do tamanho da geometria crua num quadro perdido. */}
      <mesh ref={coreRef} scale={0.0105}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial
          color={cor}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={ringRef} scale={0.018}>
        <ringGeometry args={[0.66, 1, 32]} />
        <meshBasicMaterial
          color={cor}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------
   Cena
   ------------------------------------------------------------------ */

function Scene({ count, pontos }: { count: number; pontos: PontoOperacao[] }) {
  const group = useRef<THREE.Group>(null);
  const alvo = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    if (!group.current) return;
    // Passo limitado: se a aba ficou em segundo plano, o delta acumulado
    // daria um salto feio ao voltar.
    const passo = Math.min(delta, 0.05);
    group.current.rotation.y += passo * 0.075;

    alvo.current.x += (state.pointer.x * 0.14 - alvo.current.x) * 0.045;
    alvo.current.y += (state.pointer.y * 0.1 - alvo.current.y) * 0.045;
    group.current.rotation.x = -0.2 + alvo.current.y;
    group.current.position.x = alvo.current.x * 0.07;
  });

  return (
    <group ref={group} rotation={[-0.2, 0, 0.12]}>
      <Atmosphere />
      <ParticleSphere count={count} />
      {pontos.map((ponto, i) => (
        <NoConversa key={ponto.id} ponto={ponto} index={i} />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------
   Componente exportado
   ------------------------------------------------------------------ */

export default function OperationsGlobe({
  quality = "alta",
  pontos = [],
}: {
  quality?: "alta" | "baixa";
  pontos?: PontoOperacao[];
}) {
  const count = quality === "alta" ? 11000 : 5000;

  return (
    <div className="relative h-full w-full">
      {/* Luz de fundo em gradiente puro. Um blur grande aqui custaria caro e
          acinzentaria a cor. */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,23,65,0.18)_0%,rgba(196,5,41,0.08)_38%,transparent_70%)]" />

      <Canvas
        camera={{ position: [0, 0, 3.4], fov: 42 }}
        dpr={[1, 1.6]}
        gl={{ antialias: true, powerPreference: "high-performance", alpha: true }}
        style={{ background: "transparent" }}
      >
        <Scene count={count} pontos={pontos} />
      </Canvas>
    </div>
  );
}
