"use client"

import dynamic from "next/dynamic"

// Client-only: owns a WebGL2 canvas, must not be server-rendered.
const Singularity = dynamic(() => import("@/apps/singularity/Singularity"), {
  ssr: false,
})

export default function SingularityPage() {
  return <Singularity />
}
