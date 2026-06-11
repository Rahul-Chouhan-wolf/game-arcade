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
  studyHref?:         string
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
  tictactoePreview?:          boolean
  ludoPreview?:               boolean
  snakeAndLaddersPreview?:    boolean
  solarVoyagePreview?:        boolean
  slitherPreview?:            boolean
  railRunnerPreview?:         boolean
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
    id: "slither",
    name: "Slither",
    tagline: "Eat. Grow. Dominate the arena.",
    description: "Classic multiplayer snake — steer your worm, devour glowing orbs, and outlast every rival. Mouse to steer, click to boost.",
    tags: ["Arcade", "Snake", "AI Bots"],
    accent: "#ff3366",
    href: "/slither",
    isLive: true,
    isNew: true,
    slitherPreview: true,
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
  {
    id: "tictactoe",
    name: "Tic Tac Toe",
    tagline: "Classic grid war — outsmart or be outsmarted",
    description: "Play locally against a friend or challenge the AI. Four difficulty levels including an unbeatable Impossible mode powered by minimax.",
    tags: ["Classic", "vs AI", "Local PvP"],
    accent: "#ff2d87",
    href: "/tictactoe",
    isLive: true,
    isNew: true,
    tictactoePreview: true,
  },
  {
    id: "ludo",
    name: "Ludo",
    tagline: "Race your tokens home — roll, capture, win",
    description: "Classic Ludo with 2–4 players, authentic rules, AI opponents (Easy/Medium/Hard), and premium animated visuals.",
    tags: ["Board", "2–4 Players", "Strategy"],
    accent: "#f59e0b",
    href: "/ludo",
    isLive: true,
    isNew: true,
    ludoPreview: true,
  },
  {
    id: "snake-and-ladders",
    name: "Snake & Ladders",
    tagline: "Roll, climb, and slide your way to 100",
    description: "Cinematic Snake & Ladders with glowing 3D board, animated snakes, golden ladders, 2–4 players with AI, and premium audio.",
    tags: ["Board", "2–4 Players", "Classic"],
    accent: "#a855f7",
    href: "/snake-and-ladders",
    isLive: true,
    isNew: true,
    snakeAndLaddersPreview: true,
  },
  {
    id: "solar-voyage",
    name: "Solar Voyage",
    tagline: "Slingshot a rocket across the Solar System",
    description: "Launch from Earth and lead the orbiting planets to reach any world. Real orbital-mechanics trajectory puzzles with curated missions and gravity assists.",
    tags: ["Space", "Physics", "Puzzle"],
    accent: "#7c93f0",
    href: "/solar-voyage",
    isLive: true,
    isNew: true,
    solarVoyagePreview: true,
  },
  {
    id: "subway-surfer",
    name: "Rail Runner",
    tagline: "Dodge trains. Grab coins. Don't look back.",
    description: "3-lane endless runner on live train tracks. Leap the barricades, roll under signal bars, swerve around trains, and chain coins as the speed climbs.",
    tags: ["Runner", "Endless", "Arcade"],
    accent: "#f2b418",
    href: "/subway-surfer",
    isLive: true,
    isNew: true,
    railRunnerPreview: true,
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

// ── Tic Tac Toe mini preview ──────────────────────────────────────────────────

const TTT_GRID_SIZE = 72
const TTT_CELL      = TTT_GRID_SIZE / 3

type TTTCell = "X" | "O" | null
const TTT_BOARD: TTTCell[] = ["X", null, "O", null, "X", null, "O", null, "X"]

function TicTacToeMiniPreview() {
  const pad       = 4
  const total     = TTT_GRID_SIZE + pad * 2
  const gridColor = "rgba(0,216,255,0.35)"

  function cellCenter(i: number): [number, number] {
    const c = i % 3
    const r = Math.floor(i / 3)
    return [pad + c * TTT_CELL + TTT_CELL / 2, pad + r * TTT_CELL + TTT_CELL / 2]
  }

  const winCells = new Set([0, 4, 8])

  return (
    <svg viewBox={`0 0 ${total} ${total}`} width={total} height={total}>
      <defs>
        <filter id="ttm-glow-x">
          <feGaussianBlur stdDeviation="1.2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="ttm-glow-o">
          <feGaussianBlur stdDeviation="1.2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="ttm-glow-win">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {[1,2].map(i=>(
        <g key={i}>
          <line x1={pad+i*TTT_CELL} y1={pad} x2={pad+i*TTT_CELL} y2={pad+TTT_GRID_SIZE} stroke={gridColor} strokeWidth={1}/>
          <line x1={pad} y1={pad+i*TTT_CELL} x2={pad+TTT_GRID_SIZE} y2={pad+i*TTT_CELL} stroke={gridColor} strokeWidth={1}/>
        </g>
      ))}
      <motion.line
        initial={{pathLength:0,opacity:0}} animate={{pathLength:1,opacity:1}}
        transition={{delay:0.7,duration:0.35,ease:"easeOut"}}
        x1={pad+TTT_CELL/2-5} y1={pad+TTT_CELL/2-5}
        x2={pad+2*TTT_CELL+TTT_CELL/2+5} y2={pad+2*TTT_CELL+TTT_CELL/2+5}
        stroke="#ffd700" strokeWidth={1.5} strokeLinecap="round" filter="url(#ttm-glow-win)"/>
      {TTT_BOARD.map((cell,i)=>{
        if(!cell) return null
        const [cx,cy]=cellCenter(i)
        const isWin=winCells.has(i)
        const s=TTT_CELL*0.28
        if(cell==="X"){
          const color=isWin?"#ffd700":"#ff2d87"
          return (
            <g key={i} filter="url(#ttm-glow-x)">
              <motion.line initial={{pathLength:0,opacity:0}} animate={{pathLength:1,opacity:1}}
                transition={{delay:0.1+i*0.07,duration:0.2}}
                x1={cx-s} y1={cy-s} x2={cx+s} y2={cy+s} stroke={color} strokeWidth={2} strokeLinecap="round"/>
              <motion.line initial={{pathLength:0,opacity:0}} animate={{pathLength:1,opacity:1}}
                transition={{delay:0.18+i*0.07,duration:0.2}}
                x1={cx+s} y1={cy-s} x2={cx-s} y2={cy+s} stroke={color} strokeWidth={2} strokeLinecap="round"/>
            </g>
          )
        }
        const color=isWin?"#ffd700":"#00d8ff"
        return (
          <motion.circle key={i} initial={{pathLength:0,opacity:0}} animate={{pathLength:1,opacity:1}}
            transition={{delay:0.1+i*0.07,duration:0.25}}
            cx={cx} cy={cy} r={s} fill="none" stroke={color} strokeWidth={2} filter="url(#ttm-glow-o)"/>
        )
      })}
    </svg>
  )
}

// ── Ludo mini preview ─────────────────────────────────────────────────────────

function LudoMiniPreview() {
  return (
    <svg viewBox="0 0 88 72" width={88} height={72}>
      <rect x={0} y={0} width={88} height={72} rx={6} fill="#f5f0e8"/>
      {/* Yard quadrants */}
      <rect x={2}  y={2}  width={30} height={30} fill="#D32F2F" rx={3}/>
      <rect x={56} y={2}  width={30} height={30} fill="#388E3C" rx={3}/>
      <rect x={56} y={40} width={30} height={30} fill="#F9A825" rx={3}/>
      <rect x={2}  y={40} width={30} height={30} fill="#1565C0" rx={3}/>
      {/* Inner white yards */}
      <rect x={5}  y={5}  width={24} height={24} fill="white" rx={3}/>
      <rect x={59} y={5}  width={24} height={24} fill="white" rx={3}/>
      <rect x={59} y={43} width={24} height={24} fill="white" rx={3}/>
      <rect x={5}  y={43} width={24} height={24} fill="white" rx={3}/>
      {/* Cross track */}
      <rect x={34} y={2}  width={20} height={68} fill="white" stroke="#ddd" strokeWidth={0.5}/>
      <rect x={2}  y={30} width={84} height={12} fill="white" stroke="#ddd" strokeWidth={0.5}/>
      {/* Center */}
      <polygon points="44,36 34,30 54,30" fill="#D32F2F"/>
      <polygon points="44,36 54,30 54,42" fill="#388E3C"/>
      <polygon points="44,36 54,42 34,42" fill="#F9A825"/>
      <polygon points="44,36 34,42 34,30" fill="#1565C0"/>
      {/* Tokens in yard */}
      <motion.circle cx={12} cy={12} r={5} fill="#D32F2F" stroke="#B71C1C" strokeWidth={1}
        animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 2, delay: 0 }}/>
      <circle cx={22} cy={12} r={5} fill="#D32F2F" stroke="#B71C1C" strokeWidth={1} opacity={0.55}/>
      <circle cx={70} cy={12} r={5} fill="#388E3C" stroke="#1B5E20" strokeWidth={1}/>
      <circle cx={70} cy={58} r={5} fill="#F9A825" stroke="#F57F17" strokeWidth={1}/>
      <circle cx={12} cy={58} r={5} fill="#1565C0" stroke="#0D47A1" strokeWidth={1}/>
      {/* Pin token on track */}
      <motion.path d="M 44 22 C 41 18 39 15 39 13 A 5 5 0 1 1 49 13 C 49 15 47 18 44 22 Z"
        fill="#D32F2F" stroke="white" strokeWidth={0.8}
        animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}/>
      <circle cx={44} cy={13} r={2.2} fill="white"/>
      {/* Star */}
      <text x={44} y={57} textAnchor="middle" fontSize={8} fill="#F9A825">★</text>
    </svg>
  )
}

// ── Snake & Ladders mini preview ─────────────────────────────────────────────

function SnakeAndLaddersMiniPreview() {
  const W = 88, H = 72
  const COLS = 5, ROWS = 4
  const CW = W / COLS, CH = H / ROWS
  const PURPLE = "#a855f7", GOLD = "#fbbf24", RED = "#ef4444", CYAN = "#22d3ee"

  // Mini 5×4 board (20 cells)
  const cells = Array.from({ length: ROWS * COLS }, (_, i) => i + 1)
  // Mini snake: 18→3, mini ladder: 2→12
  const snakeHead = 18, snakeTail = 3
  const ladderBase = 2, ladderTop = 13

  const tileXY = (n: number): [number, number] => {
    const idx = n - 1
    const row = Math.floor(idx / COLS)
    const inRow = idx % COLS
    const col = row % 2 === 0 ? inRow : (COLS - 1 - inRow)
    return [(COLS - 1 - col) * CW + CW / 2, (ROWS - 1 - row) * CH + CH / 2]
  }

  const [sx, sy] = tileXY(snakeHead)
  const [tx, ty] = tileXY(snakeTail)
  const [lbx, lby] = tileXY(ladderBase)
  const [ltx, lty] = tileXY(ladderTop)
  const mx = (sx + tx) / 2, my = (sy + ty) / 2
  const dx = tx - sx, dy = ty - sy
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const cv = len * 0.3
  const snakePath = `M ${sx} ${sy} C ${mx - dy/len*cv} ${my + dx/len*cv} ${mx + dy/len*cv} ${my - dx/len*cv} ${tx} ${ty}`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <defs>
        <filter id="snl-glow">
          <feGaussianBlur stdDeviation="1.8" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <linearGradient id="snl-sg" gradientUnits="userSpaceOnUse" x1={sx} y1={sy} x2={tx} y2={ty}>
          <stop offset="0%" stopColor={RED}/>
          <stop offset="100%" stopColor={GOLD}/>
        </linearGradient>
        <linearGradient id="snl-lg" gradientUnits="userSpaceOnUse" x1={lbx} y1={lby} x2={ltx} y2={lty}>
          <stop offset="0%" stopColor={GOLD}/>
          <stop offset="100%" stopColor="#4ade80"/>
        </linearGradient>
      </defs>

      {/* Board cells */}
      {cells.map(n => {
        const idx = n - 1
        const row = Math.floor(idx / COLS)
        const inRow = idx % COLS
        const col = row % 2 === 0 ? inRow : (COLS - 1 - inRow)
        const cx = (COLS - 1 - col) * CW
        const cy = (ROWS - 1 - row) * CH
        const isSnakeHead = n === snakeHead
        const isLadderBase = n === ladderBase
        return (
          <rect key={n} x={cx} y={cy} width={CW} height={CH}
            fill={isSnakeHead ? "rgba(239,68,68,0.2)" : isLadderBase ? "rgba(251,191,36,0.18)" : (row + col) % 2 === 0 ? "rgba(30,12,60,0.9)" : "rgba(20,8,45,0.9)"}
            stroke="rgba(168,85,247,0.12)" strokeWidth={0.5}/>
        )
      })}

      {/* Ladder */}
      <line x1={lbx-3} y1={lby} x2={ltx-3} y2={lty} stroke="url(#snl-lg)" strokeWidth={1.5} strokeLinecap="round" filter="url(#snl-glow)" opacity={0.85}/>
      <line x1={lbx+3} y1={lby} x2={ltx+3} y2={lty} stroke="url(#snl-lg)" strokeWidth={1.5} strokeLinecap="round" filter="url(#snl-glow)" opacity={0.85}/>
      {[0.25, 0.5, 0.75].map((t, i) => (
        <line key={i}
          x1={lbx-3 + (ltx-lbx)*t} y1={lby + (lty-lby)*t}
          x2={lbx+3 + (ltx-lbx)*t} y2={lby + (lty-lby)*t}
          stroke="url(#snl-lg)" strokeWidth={1.2} strokeLinecap="round" filter="url(#snl-glow)" opacity={0.7}/>
      ))}

      {/* Snake */}
      <path d={snakePath} fill="none" stroke="url(#snl-sg)" strokeWidth={4} strokeLinecap="round" filter="url(#snl-glow)" opacity={0.85}/>
      <circle cx={sx} cy={sy} r={3.5} fill={RED} filter="url(#snl-glow)"/>

      {/* Token 1 — purple on tile 7 */}
      {(() => {
        const [px, py] = tileXY(7)
        return <motion.circle cx={px} cy={py} r={3.5} fill={PURPLE} filter="url(#snl-glow)"
          animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2, delay: 0 }}/>
      })()}
      {/* Token 2 — cyan on tile 11 */}
      {(() => {
        const [px, py] = tileXY(11)
        return <circle cx={px} cy={py} r={3} fill={CYAN} opacity={0.8} filter="url(#snl-glow)"/>
      })()}

      {/* Win star */}
      {(() => {
        const [px, py] = tileXY(20)
        return <motion.text x={px} y={py + 3} textAnchor="middle"
          style={{ fontSize: 8, fill: PURPLE, filter: "url(#snl-glow)" }}
          animate={{ opacity: [0.6, 1, 0.6] }} transition={{ repeat: Infinity, duration: 1.8 }}>
          ★
        </motion.text>
      })()}
    </svg>
  )
}

// ── Solar Voyage mini preview ─────────────────────────────────────────────────

function SolarVoyageMiniPreview() {
  const W = 88, H = 72, cx = W / 2, cy = H / 2
  const orbits = [
    { r: 11, c: "#9c8b7a", dur: 4 },
    { r: 18, c: "#d9a066", dur: 6 },
    { r: 26, c: "#3b82f6", dur: 8 },   // Earth
    { r: 33, c: "#c1440e", dur: 11 },  // Mars (target)
  ]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <defs>
        <radialGradient id="sv-sun" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#fff7e0"/><stop offset="55%" stopColor="#fdb813"/><stop offset="100%" stopColor="#ff8a00"/>
        </radialGradient>
        <filter id="sv-glow"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <rect x={0} y={0} width={W} height={H} rx={6} fill="#05051a"/>
      {[6,18,30,44,58,70,80].map((v,i)=>(
        <circle key={i} cx={(v*9+i*11)%W} cy={(v*7+i*5)%H} r={0.6} fill="white" opacity={0.4}/>
      ))}
      {/* orbits */}
      {orbits.map((o,i)=>(
        <ellipse key={i} cx={cx} cy={cy} rx={o.r} ry={o.r} fill="none"
          stroke={i===3?"rgba(124,147,240,0.4)":"rgba(255,255,255,0.08)"} strokeWidth={i===3?0.8:0.5} strokeDasharray={i===3?"":"2 3"}/>
      ))}
      {/* sun */}
      <circle cx={cx} cy={cy} r={6} fill="url(#sv-sun)" filter="url(#sv-glow)"/>
      {/* planets */}
      {orbits.map((o,i)=>(
        <motion.g key={i} animate={{ rotate: 360 }} transition={{ duration: o.dur, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}>
          <circle cx={cx + o.r} cy={cy} r={i>=2?2.4:1.8} fill={o.c} filter="url(#sv-glow)"/>
        </motion.g>
      ))}
      {/* rocket trajectory Earth→Mars */}
      <motion.path d={`M ${cx+26} ${cy} Q ${cx+40} ${cy-22} ${cx+30} ${cy-14}`}
        fill="none" stroke="#34d399" strokeWidth={1} strokeDasharray="2 2"
        animate={{ opacity: [0.3, 0.9, 0.3] }} transition={{ duration: 2.5, repeat: Infinity }}/>
      <motion.circle r={1.6} fill="#e8eefc" filter="url(#sv-glow)"
        animate={{ cx: [cx+26, cx+38, cx+30], cy: [cy, cy-18, cy-14] }}
        transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 0.5, ease: "easeInOut" }}/>
    </svg>
  )
}

// ── Slither mini preview ─────────────────────────────────────────────────────

function SlitherMiniPreview() {
  const W = 88, H = 72
  const RED = "#ff3366", PINK = "#ff6699", CYAN = "#48dbfb", YEL = "#ffd93d", GRN = "#6bcb77"

  // Static snake body segments (curved path)
  const segs = [
    { x: 62, y: 36 },
    { x: 55, y: 34 },
    { x: 48, y: 32 },
    { x: 41, y: 31 },
    { x: 34, y: 32 },
    { x: 28, y: 35 },
    { x: 24, y: 40 },
    { x: 23, y: 47 },
    { x: 26, y: 53 },
    { x: 32, y: 57 },
    { x: 39, y: 58 },
  ]

  // Food orbs
  const food = [
    { x: 14, y: 18, c: CYAN,  r: 3.2 },
    { x: 72, y: 16, c: YEL,   r: 2.8 },
    { x: 78, y: 52, c: GRN,   r: 3.0 },
    { x: 50, y: 60, c: "#a29bfe", r: 2.5 },
    { x: 10, y: 56, c: "#fd79a8", r: 2.6 },
    { x: 68, y: 36, c: "#ffa502", r: 2.3 },
    { x: 38, y: 12, c: "#2ed573", r: 2.8 },
  ]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ overflow: "visible" }}>
      <defs>
        <filter id="sl-glow">
          <feGaussianBlur stdDeviation="1.8" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="sl-food-glow">
          <feGaussianBlur stdDeviation="1.4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <radialGradient id="sl-bg" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#181030"/>
          <stop offset="100%" stopColor="#0c0c1e"/>
        </radialGradient>
      </defs>

      {/* Background */}
      <rect x={0} y={0} width={W} height={H} rx={6} fill="url(#sl-bg)"/>

      {/* Subtle grid dots */}
      {[14,28,42,56,70].map(gx =>
        [12,24,36,48,60].map(gy => (
          <circle key={`${gx}-${gy}`} cx={gx} cy={gy} r={0.5} fill="rgba(255,255,255,0.07)"/>
        ))
      )}

      {/* Food orbs with glow */}
      {food.map((f, i) => (
        <g key={i} filter="url(#sl-food-glow)">
          <motion.circle
            cx={f.x} cy={f.y} r={f.r}
            fill={f.c}
            animate={{ r: [f.r, f.r * 1.25, f.r], opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 1.4 + i * 0.18, repeat: Infinity, ease: "easeInOut", delay: i * 0.22 }}
          />
          {/* Specular */}
          <circle cx={f.x - f.r * 0.28} cy={f.y - f.r * 0.28} r={f.r * 0.35} fill="rgba(255,255,255,0.5)"/>
        </g>
      ))}

      {/* Snake body glow halo */}
      {segs.map((s, i) => {
        const r = i === 0 ? 7.5 : 6.5
        return (
          <circle key={`g${i}`} cx={s.x} cy={s.y} r={r * 1.55}
            fill={`${RED}1a`} />
        )
      })}

      {/* Snake body segments */}
      {[...segs].reverse().map((s, ri) => {
        const i = segs.length - 1 - ri
        const r = i === 0 ? 7.5 : 6.5
        const fill = i === 0 ? "#ff4477" : i % 2 === 0 ? RED : PINK
        return (
          <motion.g key={i}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 * (segs.length - 1 - i), duration: 0.25, ease: "backOut" }}
            style={{ transformOrigin: `${s.x}px ${s.y}px` }}
          >
            {/* Highlight */}
            <circle cx={s.x - r * 0.28} cy={s.y - r * 0.28} r={r * 0.42} fill="rgba(255,255,255,0.22)"/>
            {/* Body */}
            <circle cx={s.x} cy={s.y} r={r} fill={fill} filter="url(#sl-glow)"/>
          </motion.g>
        )
      })}

      {/* Eyes on head */}
      {(() => {
        const h = segs[0]
        const ang = Math.atan2(segs[0].y - segs[1].y, segs[0].x - segs[1].x)
        const er = 2.6
        const eo = 4.2
        return ([-1, 1] as const).map(side => {
          const pa = ang + side * (Math.PI / 2 - 0.15)
          const ex = h.x + Math.cos(pa) * eo
          const ey = h.y + Math.sin(pa) * eo
          return (
            <g key={side}>
              <circle cx={ex} cy={ey} r={er} fill="#f0f0f0"/>
              <circle cx={ex + Math.cos(ang) * 0.8} cy={ey + Math.sin(ang) * 0.8} r={er * 0.6} fill="#111"/>
              <circle cx={ex + Math.cos(ang) * 0.8 - 0.5} cy={ey + Math.sin(ang) * 0.8 - 0.5} r={er * 0.2} fill="rgba(255,255,255,0.8)"/>
            </g>
          )
        })
      })()}

      {/* Animated shimmer on snake */}
      <motion.circle
        cx={62} cy={36} r={3}
        fill="rgba(255,255,255,0.35)"
        animate={{ opacity: [0, 0.35, 0], scale: [0.5, 1.8, 0.5] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "62px 36px" }}
      />
    </svg>
  )
}

// ── Rail Runner mini preview ──────────────────────────────────────────────────

function RailRunnerMiniPreview() {
  return (
    <svg viewBox="0 0 124 72" width="124" height="72" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="rrsky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2f8fe0"/>
          <stop offset="85%" stopColor="#9fd6f2"/>
          <stop offset="100%" stopColor="#ffe9c4"/>
        </linearGradient>
        <linearGradient id="rrgnd" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8d8579"/>
          <stop offset="100%" stopColor="#5c544a"/>
        </linearGradient>
      </defs>
      <rect width="124" height="72" rx="6" fill="url(#rrsky)"/>
      {/* Sun + clouds */}
      <circle cx="98" cy="10" r="8" fill="rgba(255,250,210,0.9)"/>
      <ellipse cx="28" cy="9"  rx="10" ry="3.2" fill="rgba(255,255,255,0.9)"/>
      <ellipse cx="58" cy="14" rx="7"  ry="2.6" fill="rgba(255,255,255,0.8)"/>
      {/* Skyline */}
      {[6,18,32,48,64,80,96,110].map((x, i) => (
        <rect key={i} x={x} y={24 - (i * 5) % 8} width={8 + (i % 3) * 3} height={(i * 5) % 8 + 4} fill="rgba(110,140,175,0.55)"/>
      ))}
      {/* Ground */}
      <rect y="28" width="124" height="44" fill="url(#rrgnd)"/>
      {/* Rails converging to vanishing point */}
      {[-40, -26, -8, 8, 26, 40].map((o, i) => (
        <line key={i} x1={62 + o * 0.1} y1="28" x2={62 + o * 1.6} y2="72" stroke="#e4e8ee" strokeWidth="1" opacity="0.9"/>
      ))}
      {/* Sleepers */}
      {[34, 41, 50, 61].map((y, i) => (
        <g key={i}>
          <rect x={62 - 18 - i * 9} y={y} width={14 + i * 4} height={1.5 + i * 0.6} fill="#4a3826"/>
          <rect x={62 - 6 - i * 2}  y={y} width={12 + i * 4} height={1.5 + i * 0.6} fill="#4a3826"/>
          <rect x={62 + 6 + i * 4}  y={y} width={14 + i * 4} height={1.5 + i * 0.6} fill="#4a3826"/>
        </g>
      ))}
      {/* Train in left lane */}
      <rect x="14" y="30" width="26" height="26" rx="3" fill="#e8a020"/>
      <rect x="17" y="33" width="20" height="8"  rx="2" fill="#141e2a"/>
      <rect x="14" y="43" width="26" height="3"  fill="#d23c28"/>
      <circle cx="18" cy="50" r="1.6" fill="#ff4030"/>
      <circle cx="36" cy="50" r="1.6" fill="#ff4030"/>
      {/* Coins center lane */}
      {[46, 41, 37].map((y, i) => (
        <circle key={i} cx="62" cy={y} r={2.6 - i * 0.5} fill="#f2b418" stroke="#a86e08" strokeWidth="0.6"/>
      ))}
      {/* Runner (from behind) in right lane */}
      <ellipse cx="88" cy="66" rx="6" ry="1.6" fill="rgba(0,0,0,0.25)"/>
      <rect x="84" y="50" width="8" height="11" rx="2.5" fill="#2563eb"/>
      <rect x="85.5" y="53" width="5" height="4.5" rx="1" fill="#cf7a1e"/>
      <circle cx="88" cy="47.5" r="3" fill="#e8b48a"/>
      <path d="M 85 47 A 3 3 0 0 1 91 47 Z" fill="#d92b20"/>
      <line x1="85.5" y1="61" x2="84" y2="65" stroke="#27384f" strokeWidth="2" strokeLinecap="round"/>
      <line x1="90.5" y1="61" x2="91.5" y2="63.5" stroke="#27384f" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

// ── Preview dispatcher ────────────────────────────────────────────────────────

function GamePreview({ game }: { game: Game }) {
  if (game.railRunnerPreview)      return <RailRunnerMiniPreview/>
  if (game.slitherPreview)         return <SlitherMiniPreview/>
  if (game.solarVoyagePreview)     return <SolarVoyageMiniPreview/>
  if (game.snakeAndLaddersPreview) return <SnakeAndLaddersMiniPreview/>
  if (game.cryptogramPreview) return <CryptogramMiniPreview/>
  if (game.neonDriftPreview)  return <NeonDriftMiniPreview/>
  if (game.orbitalPreview)    return <OrbitalMiniPreview/>
  if (game.tictactoePreview)  return <TicTacToeMiniPreview/>
  if (game.ludoPreview)       return <LudoMiniPreview/>
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
        background:     "rgba(6, 8, 28, 0.50)",
        border:         "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(24px) saturate(1.4)",
        WebkitBackdropFilter: "blur(24px) saturate(1.4)",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.border        = "1px solid rgba(255,255,255,0.18)"
        el.style.background    = "rgba(8, 10, 34, 0.65)"
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.border        = "1px solid rgba(255,255,255,0.08)"
        el.style.background    = "rgba(6, 8, 28, 0.50)"
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
      className="relative z-10 flex w-full flex-col items-center px-4 pb-14 pt-0 sm:pb-16"
      style={{
        paddingLeft:  "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
    >
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
