import { ShaderBackground } from "@/components/ui/shader-background"
import { GameHub } from "@/components/ui/game-hub"

export default function Home() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black">
      <ShaderBackground />
      <GameHub />
    </div>
  )
}
