"use client";

import dynamic from "next/dynamic";

/** Enquanto o WebGL carrega — e onde ele não existe — a esfera é CSS puro. */
function GlobeFallback() {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div className="relative aspect-square w-[62%] max-w-[420px]">
        <div className="absolute inset-0 aura-brand opacity-50 blur-2xl" />
        <div
          className="absolute inset-0 animate-spin-slow rounded-full opacity-70"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, transparent 58%, rgba(255,23,65,0.35) 70%, transparent 74%)",
            maskImage:
              "radial-gradient(circle, transparent 55%, #000 60%, #000 78%, transparent 82%)",
          }}
        />
        <div
          className="absolute inset-0 rounded-full"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,60,90,0.75) 1px, transparent 1.4px)",
            backgroundSize: "9px 9px",
            maskImage:
              "radial-gradient(circle, #000 38%, rgba(0,0,0,0.75) 62%, transparent 78%)",
          }}
        />
      </div>
    </div>
  );
}

const OperationsGlobe = dynamic(() => import("./operations-globe"), {
  ssr: false,
  loading: () => <GlobeFallback />,
});

export function GlobeMount() {
  return <OperationsGlobe />;
}
