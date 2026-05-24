"use client"

import { motion } from "motion/react"
import { Play } from "lucide-react"
import Link from "next/link"
import React from "react"

// ── Types ─────────────────────────────────────────────────────────────────────

type TileState = "correct" | "present" | "absent" | "empty"

interface Game {
  id:                 string
  name:               string
  tagline:            string
  description:        string
  tags:               string[]
  accent:             string
  href?:              string
  learnHref?:         string
  isLive?:            boolean
  isNew?:             boolean
  comingSoon?:        boolean
  preview?:           TileState[][]
  dotPreview?:        boolean
  goPreview?:         boolean
  hexPreview?:        boolean
  orbitalPreview?:    boolean
  neonDriftPreview?:  boolean
  cryptogramPreview?: boolean
}

// ── Game registry ─────────────────────────────────────────────────────────────

const GAMES: Game[] = [
  {
    id: "lexle",
    name: "Lexle",
    tagline: "Guess the hidden word in 6 tries",
    description: "",
    tags: ["Word", "5 Letters", "Solo"],
    accent: "#4ade80",
    href: "/lexle",
    learnHref: "/learn/lexle",
    isLive: true,
    preview: [
      ["correct",  "absent",   "present", "absent",  "correct" ],
      ["absent",   "correct",  "absent",  "present", "absent"  ],
      ["correct",  "correct",  "correct", "correct", "correct" ],
    ],
  },
  {
    id: "orbital",
    name: "Orbital",
    tagline: "Master gravity. Navigate the cosmos.",
    description: "",
    tags: ["Space", "Physics", "Puzzle"],
    accent: "#818cf8",
    href: "/orbital",
    isLive: true,
    isNew: true,
    orbitalPreview: true,
  },
  {
    id: "boxle",
    name: "Boxle",
    tagline: "Claim boxes, outsmart your rival",
    description: "",
    tags: ["Strategy", "2 Players", "Local"],
    accent: "#c084fc",
    href: "/boxle",
    learnHref: "/learn/boxle",
    isLive: true,
    dotPreview: true,
  },
  {
    id: "neon-drift",
    name: "Neon Drift",
    tagline: "Drift through neon highways. Don't crash.",
    description: "",
    tags: ["Racing", "Endless", "Arcade"],
    accent: "#f472b6",
    href: "/neon-drift",
    isLive: true,
    isNew: true,
    neonDriftPreview: true,
  },
  {
    id: "go",
    name: "Go",
    tagline: "Ancient strategy, modern arena",
    description: "",
    tags: ["Strategy", "2 Players", "Board"],
    accent: "#fbbf24",
    href: "/go",
    learnHref: "/learn",
    isLive: true,
    goPreview: true,
  },
  {
    id: "hexle",
    name: "Hexle",
    tagline: "Connect your sides before they do",
    description: "",
    tags: ["Strategy", "2 Players", "Hex"],
    accent: "#22d3ee",
    href: "/hexle",
    learnHref: "/learn/hexle",
    isLive: true,
    hexPreview: true,
  },
  {
    id: "cryptogram",
    name: "Cryptogram",
    tagline: "Decrypt the message. Break the cipher.",
    description: "",
    tags: ["Puzzle", "Cipher", "Solo"],
    accent: "#2dd4bf",
    href: "/cryptogram",
    isLive: true,
    isNew: true,
    cryptogramPreview: true,
  },
]

// ── Tile colours ──────────────────────────────────────────────────────────────

const TILE_BG: Record<TileState, string> = {
  correct: "#538d4e",
  present: "#b59f3b",
  absent:  "#3a3a3c",
  empty:   "transparent",
}

// ── Lexle tile preview ────────────────────────────────────────────────────────

function MiniBoard({ rows, accent }: { rows: TileState[][]; accent: string }) {
  return (
    <div className="flex flex-col gap-1">
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-1">
          {row.map((state, ci) => (
            <motion.div
              key={ci}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + ri * 0.1 + ci * 0.04, duration: 0.25, ease: "backOut" }}
              style={{
                width: 18, height: 18, borderRadius: 3,
                background: TILE_BG[state],
                border: `1.5px solid ${state === "empty" ? "#565758" : TILE_BG[state]}`,
                boxShadow: state !== "empty" && state !== "absent" ? `0 0 6px ${accent}55` : undefined,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Dots-and-boxes preview ────────────────────────────────────────────────────

const DOT_MINI = 14
const DOT_R    = 2.5
type MLine = { isH: boolean; r: number; c: number; player: 1 | 2 }
type MBox  = { r: number; c: number; player: 1 | 2 }
const MINI_N = 4
const MINI_LINES: MLine[] = [
  { isH: true,  r:0, c:0, player:1 }, { isH: true,  r:0, c:1, player:1 },
  { isH: true,  r:1, c:0, player:1 }, { isH: false, r:0, c:1, player:1 },
  { isH: false, r:0, c:0, player:1 },
  { isH: true,  r:0, c:2, player:2 }, { isH: false, r:0, c:3, player:2 },
  { isH: true,  r:1, c:2, player:2 }, { isH: false, r:0, c:2, player:2 },
  { isH: true,  r:2, c:0, player:2 }, { isH: false, r:1, c:0, player:2 },
  { isH: true,  r:3, c:1, player:2 }, { isH: false, r:2, c:2, player:2 },
]
const MINI_BOXES: MBox[] = [
  { r:0, c:0, player:1 }, { r:0, c:1, player:1 }, { r:0, c:2, player:2 },
]

function BoxMiniBoard() {
  const size = (MINI_N - 1) * DOT_MINI
  const x = (c: number) => 4 + c * DOT_MINI
  const y = (r: number) => 4 + r * DOT_MINI
  const P_COLOR = { 1: "#538d4e", 2: "#c77dff" } as const
  const P_BG    = { 1: "#538d4e40", 2: "#c77dff40" } as const
  return (
    <svg viewBox={`0 0 ${size + 8} ${size + 8}`} width={size + 8} height={size + 8}>
      {MINI_BOXES.map((b, i) => (
        <motion.rect key={i}
          initial={{ opacity:0, scale:0.4 }} animate={{ opacity:1, scale:1 }}
          transition={{ delay: 0.4 + i*0.08, duration:0.3, ease:"backOut" }}
          style={{ transformOrigin:`${x(b.c)+DOT_MINI/2}px ${y(b.r)+DOT_MINI/2}px` }}
          x={x(b.c)+1} y={y(b.r)+1} width={DOT_MINI-2} height={DOT_MINI-2} rx={2}
          fill={P_BG[b.player]} />
      ))}
      {MINI_LINES.map((l, i) => (
        <motion.line key={i}
          initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.2+i*0.04 }}
          x1={x(l.c)} y1={y(l.r)}
          x2={l.isH ? x(l.c+1) : x(l.c)} y2={l.isH ? y(l.r) : y(l.r+1)}
          stroke={P_COLOR[l.player]} strokeWidth={1.5} strokeLinecap="round" />
      ))}
      {Array.from({ length:MINI_N }, (_,r) =>
        Array.from({ length:MINI_N }, (_,c) => (
          <circle key={`${r}-${c}`} cx={x(c)} cy={y(r)} r={DOT_R} fill="#818384" />
        ))
      )}
    </svg>
  )
}

// ── Go mini board ─────────────────────────────────────────────────────────────

const GO_SIZE=5, GO_CELL=12, GO_PAD=8
type GoMiniStone = { r:number; c:number; player:1|2 }
const GO_STONES: GoMiniStone[] = [
  {r:1,c:1,player:1},{r:1,c:3,player:1},{r:2,c:2,player:1},{r:3,c:1,player:1},
  {r:0,c:2,player:2},{r:2,c:0,player:2},{r:2,c:4,player:2},{r:3,c:3,player:2},{r:4,c:2,player:2},
]

function GoMiniBoard() {
  const total = 2*GO_PAD + (GO_SIZE-1)*GO_CELL
  const x = (c:number) => GO_PAD+c*GO_CELL
  const y = (r:number) => GO_PAD+r*GO_CELL
  return (
    <svg viewBox={`0 0 ${total} ${total}`} width={total} height={total}>
      <rect x={0} y={0} width={total} height={total} rx={4} fill="#1c1408" />
      {Array.from({length:GO_SIZE},(_,i)=>(
        <g key={i}>
          <line x1={x(0)} y1={y(i)} x2={x(GO_SIZE-1)} y2={y(i)} stroke="#5c3d1e" strokeWidth={0.8} />
          <line x1={x(i)} y1={y(0)} x2={x(i)} y2={y(GO_SIZE-1)} stroke="#5c3d1e" strokeWidth={0.8} />
        </g>
      ))}
      {GO_STONES.map((s,i)=>(
        <motion.circle key={i}
          initial={{scale:0,opacity:0}} animate={{scale:1,opacity:1}}
          transition={{delay:0.3+i*0.07,type:"spring",damping:14,stiffness:260}}
          style={{transformOrigin:`${x(s.c)}px ${y(s.r)}px`}}
          cx={x(s.c)} cy={y(s.r)} r={GO_CELL*0.42}
          fill={s.player===1?"#1a1a1a":"#e8e8e8"} stroke={s.player===1?"#000":"#b0b0b0"} strokeWidth={0.5} />
      ))}
    </svg>
  )
}

// ── Hexle mini board ──────────────────────────────────────────────────────────

const HEX_R=10, HEX_PAD=14, HEX_N=5
type HexMiniStone = { r:number; c:number; player:1|2 }
const HEX_STONES: HexMiniStone[] = [
  {r:0,c:0,player:1},{r:1,c:0,player:1},{r:1,c:1,player:1},{r:2,c:1,player:1},{r:2,c:2,player:1},
  {r:0,c:2,player:2},{r:0,c:3,player:2},{r:1,c:3,player:2},{r:3,c:1,player:2},{r:3,c:2,player:2},
]

function HexMiniBoard() {
  const R=HEX_R, pad=HEX_PAD, n=HEX_N
  const w = Math.sqrt(3)*R
  const svgW = pad+(n-1)*1.5*w+w/2+pad
  const svgH = pad+(n-1)*1.5*R+R+pad
  const hex = (cx:number,cy:number) => Array.from({length:6},(_,i)=>{
    const a=(Math.PI/3)*i-Math.PI/6
    return `${cx+R*Math.cos(a)},${cy+R*Math.sin(a)}`
  }).join(" ")
  const cx = (r:number,c:number)=>pad+c*w+r*w*0.5
  const cy = (r:number)=>pad+r*1.5*R
  const WIN = new Set(["0,0","1,0","1,1","2,1","2,2"])
  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width={svgW} height={svgH}>
      <defs>
        <radialGradient id="hm-p1" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#7dd3fc"/><stop offset="100%" stopColor="#0369a1"/>
        </radialGradient>
        <radialGradient id="hm-p2" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#fca5a5"/><stop offset="100%" stopColor="#9f1239"/>
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={svgW} height={svgH} rx={4} fill="#0a0a12"/>
      {Array.from({length:n},(_,r)=>Array.from({length:n},(_,c)=>{
        const isLR=c===0||c===n-1, isTB=r===0||r===n-1
        const fill=isLR&&isTB?"#0e0e1e":isLR?"#081828":isTB?"#1e0810":"#0f0f1a"
        return <polygon key={`${r}-${c}`} points={hex(cx(r,c),cy(r))} fill={fill} stroke="#1e1e30" strokeWidth={0.5}/>
      }))}
      {Array.from(WIN).map((key,i)=>{
        const [r,c]=key.split(",").map(Number)
        return <motion.polygon key={key} initial={{opacity:0}} animate={{opacity:1}}
          transition={{delay:0.3+i*0.07}}
          points={hex(cx(r,c),cy(r))} fill="#22d3ee20" stroke="#22d3ee40" strokeWidth={0.8}/>
      })}
      {HEX_STONES.map((s,i)=>(
        <motion.circle key={i}
          initial={{scale:0,opacity:0}} animate={{scale:1,opacity:1}}
          transition={{delay:0.25+i*0.06,type:"spring",damping:14,stiffness:280}}
          style={{transformOrigin:`${cx(s.r,s.c)}px ${cy(s.r)}px`}}
          cx={cx(s.r,s.c)} cy={cy(s.r)} r={R*0.44} fill={`url(#hm-p${s.player})`}/>
      ))}
    </svg>
  )
}

// ── Orbital mini preview ──────────────────────────────────────────────────────

function OrbitalMiniPreview() {
  const W=88,H=72,cx=W/2,cy=H/2
  const o1={rx:26,ry:18}, o2={rx:38,ry:28}
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{overflow:"visible"}}>
      <defs>
        <radialGradient id="om-star" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#fde68a"/><stop offset="60%" stopColor="#f97316"/><stop offset="100%" stopColor="#dc2626"/>
        </radialGradient>
        <radialGradient id="om-p1" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#93c5fd"/><stop offset="100%" stopColor="#1d4ed8"/>
        </radialGradient>
        <radialGradient id="om-p2" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#c4b5fd"/><stop offset="100%" stopColor="#7c3aed"/>
        </radialGradient>
        <filter id="om-glo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect x={0} y={0} width={W} height={H} rx={6} fill="#05051a"/>
      {[12,28,65,78,14,55,72,33].map((v,i)=>(
        <circle key={i} cx={(v*11+i*7)%W} cy={(v*7+i*13)%H} r={0.7} fill="white" opacity={0.4+(i%3)*0.2}/>
      ))}
      <ellipse cx={cx} cy={cy} rx={o1.rx} ry={o1.ry} fill="none" stroke="#818cf8" strokeWidth={0.6} strokeDasharray="2 3" opacity={0.35}/>
      <ellipse cx={cx} cy={cy} rx={o2.rx} ry={o2.ry} fill="none" stroke="#6366f1" strokeWidth={0.5} strokeDasharray="2 4" opacity={0.25}/>
      <circle cx={cx} cy={cy} r={7.5} fill="url(#om-star)" filter="url(#om-glo)"/>
      <motion.circle cx={cx} cy={cy} r={3.5} fill="url(#om-p1)"
        animate={{cx:[cx+o1.rx,cx,cx-o1.rx,cx,cx+o1.rx],cy:[cy,cy-o1.ry,cy,cy+o1.ry,cy]}}
        transition={{duration:3.8,repeat:Infinity,ease:"linear"}}/>
      <motion.circle cx={cx} cy={cy} r={2.8} fill="url(#om-p2)"
        animate={{cx:[cx-o2.rx,cx,cx+o2.rx,cx,cx-o2.rx],cy:[cy,cy+o2.ry,cy,cy-o2.ry,cy]}}
        transition={{duration:5.5,repeat:Infinity,ease:"linear"}}/>
      <motion.path d={`M ${cx-o2.rx-4} ${cy} Q ${cx} ${cy-o2.ry-10} ${cx+o2.rx+4} ${cy}`}
        fill="none" stroke="#a5f3fc" strokeWidth={1} strokeDasharray="2 3"
        animate={{opacity:[0.3,0.7,0.3]}} transition={{duration:2.5,repeat:Infinity}}/>
      <motion.circle r={2} fill="#e0e7ff"
        animate={{cx:[cx-o2.rx-4,cx,cx+o2.rx+4],cy:[cy,cy-o2.ry-10,cy]}}
        transition={{duration:2.0,repeat:Infinity,ease:"easeInOut",repeatDelay:0.8}}/>
    </svg>
  )
}

// ── Neon Drift mini preview ───────────────────────────────────────────────────

function NeonDriftMiniPreview() {
  const W=88, H=72
  const PINK="#ff2d87", CYAN="#00f0ff"
  // Road: trapezoid narrowing to vanishing point at top-centre
  const road = `${W/2-7},22 ${W/2+7},22 ${W-8},${H-2} 8,${H-2}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <defs>
        <linearGradient id="nd-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a0618"/>
          <stop offset="100%" stopColor="#150a28"/>
        </linearGradient>
        <linearGradient id="nd-road" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0e0720"/>
          <stop offset="100%" stopColor="#1c0c32"/>
        </linearGradient>
        <filter id="nd-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.8" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="nd-glow-sm" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="2.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Sky */}
      <rect x={0} y={0} width={W} height={H} rx={6} fill="url(#nd-bg)"/>

      {/* Distant glow on horizon */}
      <ellipse cx={W/2} cy={22} rx={20} ry={6} fill="#cc00ff" opacity={0.12}/>

      {/* Road surface */}
      <polygon points={road} fill="url(#nd-road)"/>

      {/* Left edge — pink neon */}
      <line x1={W/2-7} y1={22} x2={8} y2={H-2} stroke={PINK} strokeWidth={1.4} filter="url(#nd-glow)"/>
      {/* Right edge — cyan neon */}
      <line x1={W/2+7} y1={22} x2={W-8} y2={H-2} stroke={CYAN} strokeWidth={1.4} filter="url(#nd-glow)"/>

      {/* Centre dashes (perspective-scaled) */}
      {[0.25, 0.44, 0.62, 0.80].map((t, i) => {
        const y = 22 + t * (H - 2 - 22)
        const hw = 0.8 + t * 1.6
        const dh = 1.6 + t * 2.2
        return (
          <rect key={i} x={W/2 - hw} y={y} width={hw*2} height={dh}
            fill="rgba(255,255,255,0.55)" rx={hw}/>
        )
      })}

      {/* Speed-blur streaks on the sides */}
      {[-1, 1].map((side, si) => (
        [16, 24, 32, 40].map((y, i) => (
          <motion.line key={`${si}-${i}`}
            x1={side < 0 ? 2  : W-2}  y1={y}
            x2={side < 0 ? 10 : W-10} y2={y}
            stroke={si === 0 ? PINK : CYAN}
            strokeWidth={0.7}
            animate={{ opacity:[0.15, 0.55, 0.15], x1:[side<0?2:W-2, side<0?4:W-4, side<0?2:W-2] }}
            transition={{ duration: 0.6 + i*0.12, repeat:Infinity, delay: i*0.1+si*0.3 }}
          />
        ))
      ))}

      {/* Car silhouette */}
      <rect x={W/2-9} y={H-18} width={18} height={10} rx={2.5}
        fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.18)" strokeWidth={0.8}/>
      <rect x={W/2-6} y={H-24} width={12} height={8} rx={2}
        fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" strokeWidth={0.6}/>

      {/* Headlight glow */}
      <circle cx={W/2-6} cy={H-8} r={2.5} fill={CYAN} opacity={0.80} filter="url(#nd-glow-sm)"/>
      <circle cx={W/2+6} cy={H-8} r={2.5} fill={CYAN} opacity={0.80} filter="url(#nd-glow-sm)"/>

      {/* Tail light */}
      <circle cx={W/2-7} cy={H-18} r={1.8} fill={PINK} opacity={0.70} filter="url(#nd-glow-sm)"/>
      <circle cx={W/2+7} cy={H-18} r={1.8} fill={PINK} opacity={0.70} filter="url(#nd-glow-sm)"/>
    </svg>
  )
}

// ── Cryptogram mini preview ───────────────────────────────────────────────────

function CryptogramMiniPreview() {
  const W=88, H=72
  const TEAL="#2dd4bf", GOLD="#f0b429", GRN="#4ade80"
  const cells=[{cipher:"X",guess:"T",ok:true,x:14},{cipher:"Y",guess:"H",ok:true,x:34},{cipher:"Z",guess:"E",ok:true,x:54},{cipher:"W",guess:"",ok:false,x:74}]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <rect x={0} y={0} width={W} height={H} rx={6} fill="#060a12"/>
      {[14,42,68].map((bx,i)=>(
        <motion.text key={i} x={bx} y={18} textAnchor="middle"
          style={{fontFamily:"monospace",fontSize:9,fill:TEAL}}
          animate={{opacity:[0.06,0.18,0.06]}}
          transition={{duration:2.5+i*0.7,repeat:Infinity}}>
          {["A","N","E"][i]}
        </motion.text>
      ))}
      {cells.map(({cipher,guess,ok,x},i)=>(
        <g key={i}>
          <motion.rect x={x-8} y={22} width={16} height={16} rx={3}
            fill={ok?`${GRN}1a`:"transparent"}
            stroke={ok?GRN:guess?TEAL:"rgba(255,255,255,0.14)"} strokeWidth={1.2}
            initial={{opacity:0,scale:0}} animate={{opacity:1,scale:1}}
            transition={{delay:0.3+i*0.18,type:"spring",damping:14,stiffness:260}}
            style={{transformOrigin:`${x}px 30px`}}/>
          {guess&&(
            <motion.text x={x} y={34} textAnchor="middle"
              initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.45+i*0.18}}
              style={{fontFamily:"monospace",fontSize:9,fontWeight:700,fill:ok?GRN:"#fff"}}>
              {guess}
            </motion.text>
          )}
          <line x1={x-7} y1={50} x2={x+7} y2={50} stroke="rgba(255,255,255,0.14)" strokeWidth={1}/>
          <text x={x} y={49} textAnchor="middle"
            style={{fontFamily:"monospace",fontSize:8,fill:"rgba(255,255,255,0.35)"}}>
            {cipher}
          </text>
        </g>
      ))}
      <motion.rect x={74-8} y={22} width={16} height={16} rx={3}
        fill="transparent" stroke={GOLD} strokeWidth={1.5}
        animate={{opacity:[1,0.3,1]}} transition={{duration:1.2,repeat:Infinity}}/>
      <text x={W/2} y={67} textAnchor="middle"
        style={{fontFamily:"monospace",fontSize:7,fill:TEAL,opacity:0.30,letterSpacing:"0.15em"}}>
        DECODE
      </text>
    </svg>
  )
}

// ── Preview dispatcher ────────────────────────────────────────────────────────

function GamePreview({ game }: { game: Game }) {
  if (game.cryptogramPreview) return <CryptogramMiniPreview/>
  if (game.neonDriftPreview)  return <NeonDriftMiniPreview/>
  if (game.orbitalPreview)    return <OrbitalMiniPreview/>
  if (game.hexPreview)        return <HexMiniBoard/>
  if (game.goPreview)         return <GoMiniBoard/>
  if (game.dotPreview)        return <BoxMiniBoard/>
  return <MiniBoard rows={game.preview??[]} accent={game.accent}/>
}

// ── Single game card ──────────────────────────────────────────────────────────

function GameCard({ game, index, spanFull = false }: { game: Game; index: number; spanFull?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.42, ease: "easeOut" }}
      className={`group relative overflow-hidden rounded-2xl flex gap-4 p-4 sm:p-5 transition-all duration-300${spanFull ? " sm:col-span-2" : ""}`}
      style={{
        background:     "rgba(6, 8, 28, 0.60)",
        border:         "1px solid rgba(255,255,255,0.10)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.border        = "1px solid rgba(255,255,255,0.20)"
        el.style.background    = "rgba(8, 10, 34, 0.72)"
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.border        = "1px solid rgba(255,255,255,0.10)"
        el.style.background    = "rgba(6, 8, 28, 0.60)"
      }}
    >
      {/* Accent glow — behind the thumbnail, tinted to game colour */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `radial-gradient(ellipse 130px 100px at 54px 50%, ${game.accent}18, transparent)` }}
      />

      {/* ── Thumbnail ── */}
      <div
        className="relative flex-shrink-0 flex items-center justify-center rounded-xl overflow-hidden"
        style={{
          width: 86, height: 86,
          background: "rgba(0,0,0,0.45)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div
          className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ background: `radial-gradient(circle at center, ${game.accent}22, transparent 68%)` }}
        />
        <GamePreview game={game}/>
      </div>

      {/* ── Info ── */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 gap-2">

        {/* Name + badges */}
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h2 className="text-white font-bold text-[17px] tracking-tight leading-tight">
              {game.name}
            </h2>
            {game.isLive && (
              <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-55"/>
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400"/>
                </span>
                Live
              </span>
            )}
            {game.isNew && (
              <span className="text-[9px] font-black uppercase tracking-[0.18em] px-1.5 py-0.5 rounded-full"
                style={{ color: game.accent, background: `${game.accent}1a`, border: `1px solid ${game.accent}38` }}>
                New
              </span>
            )}
          </div>

          <p className="text-[12px] leading-snug" style={{ color: "rgba(255,255,255,0.52)" }}>
            {game.tagline}
          </p>
        </div>

        {/* Tags + CTA */}
        <div className="flex items-center justify-between gap-3">
          {/* Dot-separated tags */}
          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
            {game.tags.slice(0, 3).map((tag, i) => (
              <React.Fragment key={tag}>
                {i > 0 && <span style={{ color: "rgba(255,255,255,0.18)", fontSize: 9 }}>·</span>}
                <span className="text-[10px] uppercase tracking-widest font-medium whitespace-nowrap"
                  style={{ color: "rgba(255,255,255,0.36)" }}>
                  {tag}
                </span>
              </React.Fragment>
            ))}
          </div>

          {/* Buttons */}
          {game.comingSoon ? (
            <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-widest rounded-full px-3 py-1.5"
              style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.22)" }}>
              Soon
            </span>
          ) : (
            <div className="flex items-center gap-2 flex-shrink-0">
              {game.learnHref && (
                <Link href={game.learnHref}
                  className="text-[10px] font-bold uppercase tracking-widest transition-colors"
                  style={{ color: "rgba(255,255,255,0.28)" }}
                  onMouseEnter={e=>(e.currentTarget.style.color="rgba(255,255,255,0.60)")}
                  onMouseLeave={e=>(e.currentTarget.style.color="rgba(255,255,255,0.28)")}>
                  Guide
                </Link>
              )}
              <Link href={game.href ?? "#"}>
                <motion.span whileTap={{ scale: 0.92 }}
                  className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[10px] font-black uppercase tracking-widest select-none cursor-pointer"
                  style={{ background: game.accent, color: "#04060e", boxShadow: `0 2px 14px ${game.accent}45` }}>
                  <Play className="w-2.5 h-2.5 fill-current"/>
                  Play
                </motion.span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ── Main Hub ──────────────────────────────────────────────────────────────────

export function GameHub() {
  const liveCount = GAMES.filter(g => g.isLive).length
  const isOdd     = GAMES.length % 2 !== 0

  return (
    <div
      className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center px-4 py-14 sm:py-16"
      style={{
        paddingLeft:  "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
    >
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="mb-12 text-center"
      >
        {/* Live count */}
        <p className="mb-5 text-[10px] uppercase tracking-[0.48em] font-semibold"
          style={{ color: "rgba(255,255,255,0.30)" }}>
          {liveCount}&ensp;games&ensp;ready
        </p>

        {/* Wordmark — aurora-tinted gradient */}
        <h1
          className="text-[64px] sm:text-[82px] font-black uppercase leading-none tracking-[-0.025em] mb-5 select-none"
          style={{
            background: "linear-gradient(168deg, #ffffff 15%, rgba(45,212,191,0.55) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor:  "transparent",
          }}
        >
          Arcade
        </h1>

        {/* Thin separator */}
        <div className="mx-auto mb-5" style={{ width:28, height:1, background:"rgba(255,255,255,0.15)" }}/>

        <p className="text-[13px] leading-relaxed max-w-[200px] mx-auto"
          style={{ color: "rgba(255,255,255,0.38)" }}>
          Premium browser games, free to play.
        </p>
      </motion.div>

      {/* ── Game grid ── */}
      <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {GAMES.map((game, i) => (
          <GameCard
            key={game.id}
            game={game}
            index={i}
            spanFull={isOdd && i === GAMES.length - 1}
          />
        ))}

        {/* Coming soon */}
        <motion.div
          initial={{ opacity:0, y:18 }}
          animate={{ opacity:1, y:0 }}
          transition={{ delay: GAMES.length * 0.06 + 0.04, duration: 0.42, ease: "easeOut" }}
          className="rounded-2xl flex items-center justify-center gap-3 py-6 sm:col-span-2"
          style={{
            border:     "1px dashed rgba(255,255,255,0.09)",
            background: "rgba(255,255,255,0.01)",
          }}
        >
          <span className="text-lg font-light" style={{ color:"rgba(255,255,255,0.16)" }}>+</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.28em]"
            style={{ color:"rgba(255,255,255,0.18)" }}>
            More games coming soon
          </span>
        </motion.div>
      </div>

      {/* ── Footer ── */}
      <motion.div
        initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.7 }}
        className="mt-12 flex flex-col items-center gap-1.5"
      >
        <span className="text-[9px] uppercase tracking-[0.32em] font-medium"
          style={{ color:"rgba(255,255,255,0.18)" }}>
          v1.0 · Game Arcade
        </span>
        <span className="text-[9px] tracking-[0.16em]" style={{ color:"rgba(255,255,255,0.12)" }}>
          Created by Rahul Chouhan
        </span>
      </motion.div>
    </div>
  )
}
