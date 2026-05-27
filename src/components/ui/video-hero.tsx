"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "motion/react"

export function VideoHero() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const handleCanPlay = () => setLoaded(true)
    v.addEventListener("canplaythrough", handleCanPlay)
    // If already ready
    if (v.readyState >= 3) setLoaded(true)
    return () => v.removeEventListener("canplaythrough", handleCanPlay)
  }, [])

  return (
    <>
      {/* Fixed fullscreen video */}
      <div className="fixed inset-0 z-0 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 1.08 }}
          animate={loaded ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 1.8, ease: "easeOut" }}
          className="absolute inset-0"
        >
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: "brightness(0.45) saturate(1.15)" }}
          >
            <source src="/hero-bg.mp4" type="video/mp4" />
          </video>
        </motion.div>

        {/* Top gradient — fades into darkness at top */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-48"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)",
          }}
        />

        {/* Bottom gradient — deep fade for content readability */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-72"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)",
          }}
        />

        {/* Vignette — darkens edges */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 85% 85% at 50% 45%, transparent 30%, rgba(0,0,0,0.65) 100%)",
          }}
        />

        {/* Subtle grain overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            backgroundSize: "128px 128px",
          }}
        />
      </div>
    </>
  )
}
