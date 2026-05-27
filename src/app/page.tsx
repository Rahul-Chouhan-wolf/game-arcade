import { VideoHero } from "@/components/ui/video-hero"
import { HomeContent } from "@/components/ui/home-content"

export default function Home() {
  return (
    <div className="relative w-full bg-black">
      {/* Fixed fullscreen video background */}
      <VideoHero />

      {/* Scrollable content — hero + game hub */}
      <HomeContent />
    </div>
  )
}
