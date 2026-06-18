"use client"

import dynamic from "next/dynamic"

// Client-only: owns a canvas + animation loop, must not be server-rendered.
const ThreeBody = dynamic(() => import("@/apps/three-body/ThreeBody"), {
  ssr: false,
})

export default function ThreeBodyPage() {
  return <ThreeBody />
}
