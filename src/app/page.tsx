import { GameHub } from "@/components/ui/game-hub"
import { VideoHero } from "@/components/ui/video-hero"

export default function Home() {
  return (
    <div className="relative min-h-screen w-full bg-black">
      {/* Fullscreen video background */}
      <VideoHero />

      {/* Game hub content — overlaid on top of video */}
      <GameHub />
    </div>
  )
}
