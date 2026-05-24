import { ShaderBackground } from "@/components/ui/shader-background"
import { GameHub } from "@/components/ui/game-hub"

export default function Home() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#080808]">
      {/* Three.js shader — sits at the very back */}
      <ShaderBackground />

      {/* Subtle dot-grid overlay — adds depth without fighting the shader */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage:
            "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)",
        }}
      />

      {/* Vignette — darkens edges so the shader doesn't bleed into content */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 100% 90% at 50% 50%, transparent 35%, rgba(0,0,0,0.72) 100%)",
        }}
      />

      {/* Content */}
      <GameHub />
    </div>
  )
}
