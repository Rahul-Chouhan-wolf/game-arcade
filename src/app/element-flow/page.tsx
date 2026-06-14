"use client"

import dynamic from "next/dynamic"

// Client-only: the app owns a WebGL2 canvas and must not be server-rendered.
const ElementFlow = dynamic(() => import("@/apps/element-flow/ElementFlow"), {
  ssr: false,
})

export default function ElementFlowPage() {
  return <ElementFlow />
}
