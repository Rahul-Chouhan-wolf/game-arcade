'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'

// ─── Constants ────────────────────────────────────────────────────────────────

const P1   = '#38bdf8'   // blue
const P2   = '#f87171'   // red
const GOLD = '#e8b86d'
const P1D  = '#0369a1'
const P2D  = '#9f1239'

// ─── Types ────────────────────────────────────────────────────────────────────

type Player = 1 | 2
type Pos    = [number, number]
interface Stone { r: number; c: number; p: Player; delay?: number; glow?: boolean }

// ─── Hex geometry (same formulas as HexGame) ──────────────────────────────────

function hexVertices(cx: number, cy: number, R: number): string {
  const pts: string[] = []
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 3 * i - Math.PI / 6
    pts.push(`${(cx + R * Math.cos(a)).toFixed(2)},${(cy + R * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(' ')
}

const HEX_DIRS: Pos[] = [[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0]]

function getNeighbors(r: number, c: number, n: number): Pos[] {
  return HEX_DIRS.map(([dr,dc]) => [r+dr,c+dc] as Pos).filter(([nr,nc]) => nr>=0&&nr<n&&nc>=0&&nc<n)
}

function cellBg(r: number, c: number, n: number): string {
  const lr = c === 0 || c === n-1, tb = r === 0 || r === n-1
  if (lr && tb) return '#0e0e1e'
  if (lr) return '#081828'
  if (tb) return '#1e0810'
  return '#0f0f1a'
}

function cellSk(r: number, c: number, n: number): string {
  const lr = c === 0 || c === n-1, tb = r === 0 || r === n-1
  if (lr && tb) return '#282838'
  if (lr) return '#1a3855'
  if (tb) return '#4a1a28'
  return '#1e1e30'
}

// ─── Core tutorial board ──────────────────────────────────────────────────────

interface TutBoardProps {
  n?: number; R?: number
  stones?: Stone[]
  pathCells?: Pos[]
  goldCells?: Pos[]; blueCells?: Pos[]; redCells?: Pos[]
  showArrows?: boolean
  interactive?: boolean
  onCellClick?: (r: number, c: number) => void
  wrongCell?: Pos | null; rightCell?: Pos | null
  hoverNeighbors?: boolean
  dimCells?: Pos[]
}

function TutBoard({
  n = 5, R = 24,
  stones = [], pathCells = [],
  goldCells = [], blueCells = [], redCells = [], dimCells = [],
  showArrows = true,
  interactive = false, onCellClick,
  wrongCell = null, rightCell = null,
  hoverNeighbors = false,
}: TutBoardProps) {
  const pad = R * 1.65
  const w   = Math.sqrt(3) * R
  const svgW = pad + (n - 1) * 1.5 * w + w / 2 + pad
  const svgH = pad + (n - 1) * 1.5 * R + R + pad

  const [hover, setHover] = useState<Pos | null>(null)

  const cx = (r: number, c: number) => pad + c * w + r * w * 0.5
  const cy = (r: number, c: number) => pad + r * 1.5 * R

  const stoneMap  = useMemo(() => new Map(stones.map(s => [`${s.r},${s.c}`,s])), [stones])
  const pathSet   = useMemo(() => new Set(pathCells.map(([r,c]) => `${r},${c}`)), [pathCells])
  const goldSet   = useMemo(() => new Set(goldCells.map(([r,c]) => `${r},${c}`)), [goldCells])
  const blueSet   = useMemo(() => new Set(blueCells.map(([r,c]) => `${r},${c}`)), [blueCells])
  const redSet    = useMemo(() => new Set(redCells.map(([r,c])  => `${r},${c}`)), [redCells])
  const dimSet    = useMemo(() => new Set(dimCells.map(([r,c])  => `${r},${c}`)), [dimCells])
  const nbrSet    = useMemo(() => {
    if (!hoverNeighbors || !hover) return new Set<string>()
    return new Set(getNeighbors(hover[0], hover[1], n).map(([r,c]) => `${r},${c}`))
  }, [hoverNeighbors, hover, n])

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', maxWidth: svgW, display: 'block' }}>
      <defs>
        <radialGradient id="lp1" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#7dd3fc"/><stop offset="100%" stopColor={P1D}/>
        </radialGradient>
        <radialGradient id="lp2" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#fca5a5"/><stop offset="100%" stopColor={P2D}/>
        </radialGradient>
      </defs>

      <rect x={0} y={0} width={svgW} height={svgH} rx={10} fill="#08080f"/>

      {/* Path glow lines (rendered behind stones) */}
      {pathCells.length > 1 && pathCells.slice(0,-1).map(([pr,pc], i) => {
        const [nr,nc] = pathCells[i+1]
        return (
          <motion.path key={`pl-${i}`}
            d={`M ${cx(pr,pc)} ${cy(pr,pc)} L ${cx(nr,nc)} ${cy(nr,nc)}`}
            stroke={GOLD} strokeWidth={R*0.22} strokeLinecap="round" fill="none"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.4 + i * 0.18, duration: 0.45, ease: 'easeOut' }}
            style={{ filter: `drop-shadow(0 0 ${R*0.35}px ${GOLD})` }}
          />
        )
      })}

      {/* Hex grid */}
      {Array.from({ length: n }, (_, r) =>
        Array.from({ length: n }, (_, c) => {
          const key = `${r},${c}`
          const stone   = stoneMap.get(key)
          const isGold  = goldSet.has(key)
          const isBlue  = blueSet.has(key)
          const isRed   = redSet.has(key)
          const isNbr   = nbrSet.has(key)
          const isHSrc  = hover?.[0]===r && hover?.[1]===c && hoverNeighbors
          const isDim   = dimSet.has(key)
          const isWrong = wrongCell?.[0]===r && wrongCell?.[1]===c
          const isRight = rightCell?.[0]===r && rightCell?.[1]===c

          let fill  = cellBg(r, c, n)
          let sk    = cellSk(r, c, n)
          let skw   = 0.6

          if (isGold)  { fill = `${GOLD}28`; sk = `${GOLD}cc`; skw = 1.4 }
          if (isBlue)  { fill = `${P1}22`;   sk = `${P1}aa`;   skw = 1.1 }
          if (isRed)   { fill = `${P2}22`;   sk = `${P2}aa`;   skw = 1.1 }
          if (isNbr)   { fill = `${P1}35`;   sk = `${P1}dd`;   skw = 1.4 }
          if (isHSrc)  { fill = `${GOLD}35`; sk = `${GOLD}dd`; skw = 1.6 }
          if (isWrong) { fill = `${P2}45`;   sk = P2;          skw = 2   }
          if (isRight) { fill = `${P1}45`;   sk = P1;          skw = 2   }

          const verts = hexVertices(cx(r,c), cy(r,c), R - 0.8)
          const opacity = isDim ? 0.35 : 1

          return (
            <g key={key} opacity={opacity}
               style={{ cursor: interactive && !stone ? 'pointer' : 'default' }}
               onClick={() => interactive && !stone && onCellClick?.(r,c)}
               onMouseEnter={() => hoverNeighbors && setHover([r,c])}
               onMouseLeave={() => hoverNeighbors && setHover(null)}>
              <polygon points={verts} fill={fill} stroke={sk} strokeWidth={skw}/>
              {stone && (
                <motion.circle
                  cx={cx(r,c)} cy={cy(r,c)} r={R*0.44}
                  fill={`url(#lp${stone.p})`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: stone.delay ?? 0, type:'spring', damping:14, stiffness:280 }}
                  style={{
                    transformOrigin: `${cx(r,c)}px ${cy(r,c)}px`,
                    filter: stone.glow ? `drop-shadow(0 0 ${R*0.38}px ${stone.p===1?P1:P2})` : undefined
                  }}
                />
              )}
              {isWrong && (
                <text x={cx(r,c)} y={cy(r,c)+1} textAnchor="middle" dominantBaseline="middle"
                      fontSize={R*0.52} fill={P2} fontWeight="bold" style={{pointerEvents:'none'}}>✗</text>
              )}
              {isRight && (
                <text x={cx(r,c)} y={cy(r,c)+1} textAnchor="middle" dominantBaseline="middle"
                      fontSize={R*0.52} fill={P1} fontWeight="bold" style={{pointerEvents:'none'}}>✓</text>
              )}
            </g>
          )
        })
      )}

      {/* Edge arrows */}
      {showArrows && (
        <>
          <text x={pad*0.38} y={svgH*0.5+2} textAnchor="middle" fontSize={R*0.58} fill={P1} fontWeight="bold">←</text>
          <text x={svgW-pad*0.38} y={svgH*0.56+2} textAnchor="middle" fontSize={R*0.58} fill={P1} fontWeight="bold">→</text>
          <text x={cx(0, Math.floor(n/2))} y={pad*0.38} textAnchor="middle" fontSize={R*0.58} fill={P2} fontWeight="bold">↓</text>
          <text x={cx(n-1, Math.floor(n/2))} y={svgH-pad*0.28} textAnchor="middle" fontSize={R*0.58} fill={P2} fontWeight="bold">↑</text>
        </>
      )}
    </svg>
  )
}

// ─── Replay button ─────────────────────────────────────────────────────────────

function ReplayBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors"
    >
      <span style={{ fontSize: 12 }}>↺</span> Replay
    </button>
  )
}

// ─── Section card wrapper ─────────────────────────────────────────────────────

function Card({
  title, badge, desc, children, accent = P1,
}: {
  title: string; badge?: string; desc: string | React.ReactNode
  children: React.ReactNode; accent?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="rounded-2xl border border-white/10 bg-black/40 p-5"
      style={{ backdropFilter: 'blur(16px)' }}
    >
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <h3 className="text-white font-extrabold text-sm tracking-tight">{title}</h3>
        {badge && (
          <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ color: accent, background: `${accent}18`, border: `1px solid ${accent}40` }}>
            {badge}
          </span>
        )}
      </div>
      <p className="text-white/45 text-xs mb-4 leading-relaxed">{desc}</p>
      {children}
    </motion.div>
  )
}

// ─── SECTION 1: Goal ──────────────────────────────────────────────────────────

// Blue winning path: left→right on 5×5
const GOAL_BLUE_STONES: Stone[] = [
  { r:2,c:0,p:1,delay:0 },{ r:1,c:1,p:1,delay:0.35 },
  { r:0,c:2,p:1,delay:0.7 },{ r:0,c:3,p:1,delay:1.05 },{ r:0,c:4,p:1,delay:1.4,glow:true },
]
const GOAL_BLUE_PATH: Pos[] = [[2,0],[1,1],[0,2],[0,3],[0,4]]

// Red winning path: top→bottom on 5×5 (straight center column)
const GOAL_RED_STONES: Stone[] = [
  { r:0,c:2,p:2,delay:0.1 },{ r:1,c:2,p:2,delay:0.45 },
  { r:2,c:2,p:2,delay:0.8 },{ r:3,c:2,p:2,delay:1.15 },{ r:4,c:2,p:2,delay:1.5,glow:true },
]
const GOAL_RED_PATH: Pos[] = [[0,2],[1,2],[2,2],[3,2],[4,2]]

function GoalSection() {
  const [blueKey, setBlueKey] = useState(0)
  const [redKey,  setRedKey]  = useState(0)
  return (
    <Card
      title="Your Goal"
      badge="Basics"
      desc={<>
        <span style={{ color: P1, fontWeight: 700 }}>Blue</span> connects the <b>left edge → right edge</b>.{' '}
        <span style={{ color: P2, fontWeight: 700 }}>Red</span> connects the <b>top edge → bottom edge</b>.
        First complete path wins.
      </>}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-bold mb-2" style={{ color: P1 }}>Blue wins →</p>
          <div key={blueKey}><TutBoard stones={GOAL_BLUE_STONES} pathCells={GOAL_BLUE_PATH}/></div>
          <div className="mt-2 flex justify-end"><ReplayBtn onClick={() => setBlueKey(k=>k+1)}/></div>
        </div>
        <div>
          <p className="text-[10px] font-bold mb-2" style={{ color: P2 }}>Red wins ↓</p>
          <div key={redKey}><TutBoard stones={GOAL_RED_STONES} pathCells={GOAL_RED_PATH}/></div>
          <div className="mt-2 flex justify-end"><ReplayBtn onClick={() => setRedKey(k=>k+1)}/></div>
        </div>
      </div>
      <p className="text-[10px] text-white/25 mt-3 text-center">
        Gold line = winning connection. Colored cell borders = each player's edges.
      </p>
    </Card>
  )
}

// ─── SECTION 2: Connections ───────────────────────────────────────────────────

function ConnectionsSection() {
  const [hoveredCell, setHoveredCell] = useState<Pos>([2,2])
  const isTouching = useRef(false)

  // Cycle through cells automatically on touch devices
  const DEMO_CELLS: Pos[] = [[2,2],[1,2],[0,3],[2,4],[3,2]]
  const [demoIdx, setDemoIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setDemoIdx(i => (i+1) % DEMO_CELLS.length), 1800)
    return () => clearInterval(t)
  }, [])

  const displayed: Pos = isTouching.current ? DEMO_CELLS[demoIdx] : hoveredCell
  const neighbors = getNeighbors(displayed[0], displayed[1], 5)
  const nbrPosArr = neighbors

  return (
    <Card
      title="Hex Adjacency"
      badge="Basics"
      desc="Every cell touches exactly 6 neighbors — not like square grids. Only direct neighbors count for connections. Hover (or watch) a cell to see its 6 neighbors light up."
    >
      <div className="flex justify-center">
        <div style={{ maxWidth: 260 }}
             onMouseEnter={() => { isTouching.current = false }}
             onTouchStart={() => { isTouching.current = true }}>
          <TutBoard
            hoverNeighbors
            goldCells={[displayed]}
            blueCells={nbrPosArr}
          />
        </div>
      </div>
      <p className="text-[10px] text-white/25 mt-3 text-center">
        <span style={{ color: GOLD }}>Gold</span> = selected · <span style={{ color: P1 }}>Blue</span> = its 6 direct neighbors
      </p>
    </Card>
  )
}

// ─── SECTION 3: Blocking ──────────────────────────────────────────────────────

const BLOCK_RED: Stone[]  = [
  {r:0,c:2,p:2,delay:0},{r:1,c:2,p:2,delay:0.5},{r:2,c:2,p:2,delay:1},{r:3,c:2,p:2,delay:1.5},
]
const BLOCK_RED_PATH: Pos[] = [[0,2],[1,2],[2,2],[3,2]]
const BLOCK_BLUE: Stone = { r:4,c:2,p:1,delay:0,glow:true }

function BlockingSection() {
  const [phase, setPhase] = useState(0)   // 0 = Red building, 1 = Blue blocks
  const [bKey, setBKey] = useState(0)

  // Auto-advance after showing Red's threat
  useEffect(() => {
    if (phase !== 0) return
    const t = setTimeout(() => setPhase(1), 2800)
    return () => clearTimeout(t)
  }, [phase, bKey])

  const replay = () => { setPhase(0); setBKey(k=>k+1) }

  const stones: Stone[] = phase === 0 ? BLOCK_RED : [...BLOCK_RED.map(s=>({...s,delay:0})), BLOCK_BLUE]
  const path: Pos[]  = phase === 0 ? BLOCK_RED_PATH : []
  const dimCells: Pos[] = phase === 1 ? BLOCK_RED_PATH : []

  return (
    <Card
      title="Blocking"
      badge="Tactics"
      accent={P2}
      desc="When your opponent is one step from winning, block their path. Every stone you place doubles as both a blocker and part of your own route."
    >
      <div className="flex justify-center">
        <div key={bKey} style={{ maxWidth: 240 }}>
          <TutBoard stones={stones} pathCells={path} dimCells={phase===1 ? BLOCK_RED_PATH : []}/>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <AnimatePresence mode="wait">
          {phase === 0 ? (
            <motion.p key="p0" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                      className="text-xs font-bold" style={{ color: P2 }}>
              Red is one move from winning ↓
            </motion.p>
          ) : (
            <motion.p key="p1" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                      className="text-xs font-bold" style={{ color: P1 }}>
              Blue blocks! Red's path is broken.
            </motion.p>
          )}
        </AnimatePresence>
        <ReplayBtn onClick={replay}/>
      </div>
    </Card>
  )
}

// ─── SECTION 4: Bridge Concept ────────────────────────────────────────────────

// Blue stones at (2,1) and (3,2); bridge through (2,2) and (3,1)
const BRIDGE_BASE: Stone[] = [{ r:2,c:1,p:1 }, { r:3,c:2,p:1 }]
const BRIDGE_CELLS: Pos[] = [[2,2],[3,1]]

// Path A: Red blocks (2,2) → Blue uses (3,1)
const BRIDGE_A_RED: Stone  = { r:2,c:2,p:2,delay:0 }
const BRIDGE_A_BLUE: Stone = { r:3,c:1,p:1,delay:0.5,glow:true }
const BRIDGE_A_PATH: Pos[] = [[2,1],[3,1],[3,2]]

// Path B: Red blocks (3,1) → Blue uses (2,2)
const BRIDGE_B_RED: Stone  = { r:3,c:1,p:2,delay:0 }
const BRIDGE_B_BLUE: Stone = { r:2,c:2,p:1,delay:0.5,glow:true }
const BRIDGE_B_PATH: Pos[] = [[2,1],[2,2],[3,2]]

function BridgeSection() {
  const [variant, setVariant] = useState<'intro'|'a'|'b'>('intro')
  const [bKey, setBKey] = useState(0)

  useEffect(() => {
    // intro → a → b → a → b ...
    const seq: Array<'intro'|'a'|'b'> = ['intro','a','b','a','b']
    const delays = [1200, 2200, 2200, 2200, 2200]
    let idx = 0
    const next = () => {
      idx++
      if (idx >= seq.length) { idx = 2 }  // loop between a and b
      setVariant(seq[idx])
    }
    const t = setTimeout(next, delays[idx])
    return () => clearTimeout(t)
  }, [bKey])

  const replay = () => { setVariant('intro'); setBKey(k=>k+1) }

  const extraStones: Stone[] =
    variant === 'a' ? [BRIDGE_A_RED, BRIDGE_A_BLUE] :
    variant === 'b' ? [BRIDGE_B_RED, BRIDGE_B_BLUE] : []
  const pathCells =
    variant === 'a' ? BRIDGE_A_PATH :
    variant === 'b' ? BRIDGE_B_PATH : []

  return (
    <Card
      title="The Bridge"
      badge="Tactics · Key Concept"
      desc="A bridge connects two of your stones through two shared empty cells. Your opponent cannot block BOTH cells in one move — use whichever one they leave open."
    >
      <div className="flex justify-center">
        <div key={bKey} style={{ maxWidth: 240 }}>
          <TutBoard
            stones={[...BRIDGE_BASE, ...extraStones]}
            pathCells={pathCells}
            goldCells={variant === 'intro' ? BRIDGE_CELLS : []}
          />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <AnimatePresence mode="wait">
          {variant === 'intro' && (
            <motion.p key="intro" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                      className="text-[11px]" style={{ color: GOLD }}>
              Gold cells = bridge gap (opponent must block both)
            </motion.p>
          )}
          {variant === 'a' && (
            <motion.p key="a" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                      className="text-[11px]" style={{ color: P1 }}>
              Red blocks top cell → Blue uses bottom cell ✓
            </motion.p>
          )}
          {variant === 'b' && (
            <motion.p key="b" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                      className="text-[11px]" style={{ color: P1 }}>
              Red blocks bottom cell → Blue uses top cell ✓
            </motion.p>
          )}
        </AnimatePresence>
        <ReplayBtn onClick={replay}/>
      </div>
    </Card>
  )
}

// ─── SECTION 5: Multi-Path Pressure ──────────────────────────────────────────

// Blue has stones; critical move at (1,1) threatens two paths
const MULTI_BASE: Stone[] = [
  {r:1,c:0,p:1},{r:0,c:2,p:1},{r:0,c:3,p:1},{r:0,c:4,p:1},
  {r:2,c:1,p:1},{r:2,c:2,p:1},{r:2,c:3,p:1},{r:2,c:4,p:1},
]
const MULTI_KEY: Stone = { r:1,c:1,p:1,glow:true }
const MULTI_PATH_A: Pos[] = [[1,0],[1,1],[0,2],[0,3],[0,4]]
const MULTI_PATH_B: Pos[] = [[1,0],[1,1],[2,1],[2,2],[2,3],[2,4]]

function MultiPathSection() {
  const [showPath, setShowPath] = useState<'a'|'b'>('a')
  const [bKey, setBKey] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setShowPath(p => p === 'a' ? 'b' : 'a'), 2000)
    return () => clearInterval(t)
  }, [bKey])

  return (
    <Card
      title="Multi-Path Pressure"
      badge="Tactics"
      desc="The strongest moves create TWO winning threats at once. Your opponent can only respond to one — you complete the other. Watch how one stone (glowing) threatens two paths."
    >
      <div className="flex justify-center">
        <div key={bKey} style={{ maxWidth: 240 }}>
          <TutBoard
            stones={[...MULTI_BASE, MULTI_KEY]}
            pathCells={showPath === 'a' ? MULTI_PATH_A : MULTI_PATH_B}
          />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <AnimatePresence mode="wait">
          <motion.p key={showPath} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                    className="text-[11px] font-bold" style={{ color: P1 }}>
            {showPath === 'a' ? 'Path A: via top row →' : 'Path B: via middle row →'}
          </motion.p>
        </AnimatePresence>
        <ReplayBtn onClick={() => setBKey(k=>k+1)}/>
      </div>
      <p className="text-[10px] text-white/25 mt-2">
        Glowing stone creates both threats simultaneously. Red can only block one.
      </p>
    </Card>
  )
}

// ─── SECTION 6: Edge Control ──────────────────────────────────────────────────

function EdgeControlSection() {
  return (
    <Card
      title="Edge Control"
      badge="Strategy"
      desc="Stones near the edges have fewer approach angles — harder to block. But center stones offer more routing flexibility. Balance both throughout the game."
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-bold mb-1.5 text-white/60">Center stone</p>
          <TutBoard
            R={20}
            stones={[{ r:2,c:2,p:1,glow:true }]}
            blueCells={[[1,2],[1,3],[2,1],[2,3],[3,1],[3,2]]}
          />
          <p className="text-[10px] text-white/35 mt-1">6 approach routes</p>
        </div>
        <div>
          <p className="text-[10px] font-bold mb-1.5 text-white/60">Corner stone</p>
          <TutBoard
            R={20}
            stones={[{ r:0,c:0,p:1,glow:true }]}
            blueCells={[[0,1],[1,0]]}
          />
          <p className="text-[10px] text-white/35 mt-1">Only 2 routes out</p>
        </div>
      </div>
    </Card>
  )
}

// ─── SECTION 7: Opening Strategy ──────────────────────────────────────────────

function OpeningSection() {
  const OPENINGS = [
    {
      label: 'Strong',
      accent: '#4ade80',
      stone: { r:2,c:2,p:1 as Player },
      desc: 'Center — maximum flexibility',
    },
    {
      label: 'OK',
      accent: GOLD,
      stone: { r:1,c:2,p:1 as Player },
      desc: 'Near-center — good options',
    },
    {
      label: 'Weak',
      accent: P2,
      stone: { r:0,c:0,p:1 as Player },
      desc: 'Corner — easily isolated',
    },
  ]

  return (
    <Card
      title="Opening Strategy"
      badge="Strategy"
      desc="Where you place your first stone shapes the whole game. Central positions give the most routing options. Corners and extreme edges are easy to cut off."
    >
      <div className="grid grid-cols-3 gap-2">
        {OPENINGS.map(o => (
          <div key={o.label}>
            <span className="text-[9px] font-bold uppercase tracking-wider block mb-1"
                  style={{ color: o.accent }}>{o.label}</span>
            <TutBoard R={16} stones={[o.stone]} showArrows={false}/>
            <p className="text-[9px] text-white/35 mt-1 leading-tight">{o.desc}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ─── SECTION 8: Zigzag Paths ──────────────────────────────────────────────────

const ZZ_STONES: Stone[] = [
  {r:4,c:0,p:1,delay:0},{r:3,c:1,p:1,delay:0.4},{r:2,c:1,p:1,delay:0.8},
  {r:2,c:2,p:1,delay:1.2},{r:1,c:3,p:1,delay:1.6},{r:0,c:3,p:1,delay:2.0},
  {r:0,c:4,p:1,delay:2.4,glow:true},
]
const ZZ_PATH: Pos[] = [[4,0],[3,1],[2,1],[2,2],[1,3],[0,3],[0,4]]

function ZigzagSection() {
  const [k, setK] = useState(0)
  return (
    <Card
      title="Paths Don't Need to Be Straight"
      badge="Strategy"
      desc="A connection is valid no matter how winding the route. Long zigzag paths are often stronger than obvious straight lines because they're harder to block."
    >
      <div className="flex justify-center">
        <div key={k} style={{ maxWidth: 240 }}>
          <TutBoard stones={ZZ_STONES} pathCells={ZZ_PATH}/>
        </div>
      </div>
      <div className="mt-2 flex justify-end">
        <ReplayBtn onClick={() => setK(k=>k+1)}/>
      </div>
    </Card>
  )
}

// ─── SECTION 9: Winning Path Animation ───────────────────────────────────────

// A full 5×5 game state where Blue has won
const WIN_STONES: Stone[] = [
  {r:2,c:0,p:1,glow:true},{r:1,c:1,p:1,glow:true},{r:0,c:2,p:1,glow:true},
  {r:0,c:3,p:1,glow:true},{r:0,c:4,p:1,glow:true},
  // Other stones on board
  {r:0,c:0,p:2},{r:0,c:1,p:2},{r:1,c:0,p:2},{r:1,c:2,p:2},
  {r:2,c:1,p:2},{r:2,c:3,p:2},{r:3,c:2,p:2},{r:3,c:3,p:2},
]
const WIN_PATH: Pos[] = [[2,0],[1,1],[0,2],[0,3],[0,4]]

function WinPathSection() {
  const [k, setK] = useState(0)
  return (
    <Card
      title="Winning Path"
      badge="Visual"
      accent={GOLD}
      desc="When you win, your exact connecting path is highlighted. Every stone in the chain glows. Watch the winning energy flow across the board."
    >
      <div className="flex justify-center">
        <div key={k} style={{ maxWidth: 240 }}>
          <TutBoard stones={WIN_STONES} pathCells={WIN_PATH}/>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs font-bold" style={{ color: GOLD }}>🏆 Blue connects left → right!</p>
        <ReplayBtn onClick={() => setK(k=>k+1)}/>
      </div>
    </Card>
  )
}

// ─── SECTION 10: Beginner Mistakes ───────────────────────────────────────────

function MistakesSection() {
  return (
    <Card
      title="Common Beginner Mistakes"
      badge="Advanced"
      accent={P2}
      desc="Avoid these pitfalls. Bad placement early on gives your opponent a huge advantage."
    >
      <div className="space-y-4">
        {[
          {
            label: '❌ Isolated stones',
            bad: [[0,0],[2,4],[4,1]] as Pos[],
            desc: 'Scattered stones with no bridges — opponent can cut between all of them',
          },
          {
            label: '❌ Ignoring opponent',
            bad: [] as Pos[],
            stones: [
              {r:0,c:2,p:2 as Player},{r:1,c:2,p:2 as Player},{r:2,c:2,p:2 as Player},{r:3,c:2,p:2 as Player},
              {r:0,c:0,p:1 as Player},{r:0,c:1,p:1 as Player},{r:4,c:3,p:1 as Player},{r:4,c:4,p:1 as Player},
            ] as Stone[],
            redPath: [[0,2],[1,2],[2,2],[3,2]] as Pos[],
            desc: 'Blue builds their own path but Red is one move from winning',
          },
        ].map(m => (
          <div key={m.label}>
            <p className="text-[10px] font-bold mb-2" style={{ color: P2 }}>{m.label}</p>
            <div className="flex justify-center">
              <div style={{ maxWidth: 200 }}>
                <TutBoard
                  R={18}
                  stones={m.stones ?? m.bad!.map(([r,c]) => ({ r,c,p:1 as Player }))}
                  redCells={m.bad}
                  pathCells={m.redPath}
                  showArrows={false}
                />
              </div>
            </div>
            <p className="text-[10px] text-white/35 mt-1 text-center">{m.desc}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ─── SECTION 11: Interactive Puzzles ─────────────────────────────────────────

interface Puzzle {
  title: string
  desc: string
  stones: Stone[]
  answer: Pos
  hint: string
  wrongHint: string
}

const PUZZLES: Puzzle[] = [
  {
    title: 'Puzzle 1: Finish the Path',
    desc: 'Blue has a nearly complete path. Which move wins the game?',
    stones: [
      {r:2,c:0,p:1},{r:1,c:1,p:1},{r:0,c:2,p:1},{r:0,c:3,p:1},
      {r:1,c:3,p:2},{r:2,c:2,p:2},{r:3,c:3,p:2},{r:2,c:4,p:2},
    ],
    answer: [0,4],
    hint: 'Click (0,4) — the last cell to complete Blue\'s left→right path!',
    wrongHint: 'Not quite — trace Blue\'s chain from the left edge and find where it ends.',
  },
  {
    title: 'Puzzle 2: Block Red',
    desc: 'Red is one move away from winning! Which cell stops them?',
    stones: [
      {r:0,c:2,p:2},{r:1,c:2,p:2},{r:2,c:2,p:2},{r:3,c:2,p:2},
      {r:1,c:0,p:1},{r:2,c:0,p:1},{r:3,c:3,p:1},
    ],
    answer: [4,2],
    hint: 'Click (4,2) — Red needs row 4 to complete top→bottom. Block it!',
    wrongHint: 'Red still has a direct route. Find the exact cell that cuts their chain.',
  },
  {
    title: 'Puzzle 3: Find the Bridge',
    desc: 'Blue has two stones. Which empty cell creates a bridge between them?',
    stones: [{r:1,c:1,p:1},{r:2,c:2,p:1},{r:0,c:3,p:2},{r:1,c:3,p:2},{r:3,c:0,p:2}],
    answer: [1,2],
    hint: 'Click (1,2) — it\'s a shared neighbor of both Blue stones, creating a bridge!',
    wrongHint: 'Look for a cell that directly neighbors BOTH Blue stones simultaneously.',
  },
]

function PuzzleCard({ puzzle }: { puzzle: Puzzle }) {
  const [state, setState] = useState<'idle'|'correct'|'wrong'>('idle')
  const [clicked, setClicked] = useState<Pos|null>(null)
  const [k, setK] = useState(0)

  const handleClick = (r: number, c: number) => {
    if (state !== 'idle') return
    const [ar, ac] = puzzle.answer
    if (r === ar && c === ac) {
      setState('correct'); setClicked([r,c])
    } else {
      setState('wrong'); setClicked([r,c])
      setTimeout(() => { setState('idle'); setClicked(null) }, 1800)
    }
  }

  const reset = () => { setState('idle'); setClicked(null); setK(k=>k+1) }

  return (
    <div className="rounded-xl border border-white/8 bg-white/3 p-4">
      <p className="text-xs font-extrabold text-white mb-1">{puzzle.title}</p>
      <p className="text-[11px] text-white/50 mb-3">{puzzle.desc}</p>
      <div className="flex justify-center">
        <div key={k} style={{ maxWidth: 220 }}>
          <TutBoard
            stones={puzzle.stones}
            interactive={state === 'idle'}
            onCellClick={handleClick}
            wrongCell={state === 'wrong' ? clicked : null}
            rightCell={state === 'correct' ? puzzle.answer : null}
          />
        </div>
      </div>
      <AnimatePresence>
        {state !== 'idle' && (
          <motion.div
            initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            className="mt-3 rounded-lg p-2.5 text-[11px] text-center"
            style={{
              background: state === 'correct' ? `${P1}18` : `${P2}18`,
              border: `1px solid ${state === 'correct' ? P1 : P2}30`,
              color: state === 'correct' ? P1 : P2,
            }}
          >
            {state === 'correct' ? `✓ ${puzzle.hint}` : `✗ ${puzzle.wrongHint}`}
          </motion.div>
        )}
      </AnimatePresence>
      {state === 'correct' && (
        <div className="mt-2 flex justify-end">
          <button onClick={reset} className="text-[10px] font-bold text-white/30 hover:text-white/60 transition-colors">
            Try again
          </button>
        </div>
      )}
    </div>
  )
}

function PuzzlesSection() {
  return (
    <Card
      title="Practice Puzzles"
      badge="Interactive"
      accent={GOLD}
      desc="Tap the best move. Wrong answers show why. Correct answers reveal the winning path."
    >
      <div className="space-y-4">
        {PUZZLES.map(p => <PuzzleCard key={p.title} puzzle={p}/>)}
      </div>
    </Card>
  )
}

// ─── SECTION 12: False Connections ────────────────────────────────────────────

function FalseConnectionSection() {
  return (
    <Card
      title="False Connections"
      badge="Advanced"
      accent={P2}
      desc="Just because two stones are close doesn't mean they're connected. Both cells of a bridge can be blocked if your opponent moves first. Protect your bridges!"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-bold mb-1" style={{ color: P1 }}>Real connection</p>
          <TutBoard
            R={18}
            stones={[{r:2,c:1,p:1},{r:2,c:2,p:1},{r:2,c:3,p:1}]}
            pathCells={[[2,1],[2,2],[2,3]]}
            showArrows={false}
          />
          <p className="text-[10px] text-white/35 mt-1">Direct chain — always safe</p>
        </div>
        <div>
          <p className="text-[10px] font-bold mb-1" style={{ color: P2 }}>Broken bridge</p>
          <TutBoard
            R={18}
            stones={[
              {r:2,c:1,p:1},{r:3,c:2,p:1},  // Blue stones
              {r:2,c:2,p:2},{r:3,c:1,p:2},  // Red blocks BOTH bridge cells
            ]}
            showArrows={false}
          />
          <p className="text-[10px] text-white/35 mt-1">Red blocked both cells — bridge cut!</p>
        </div>
      </div>
    </Card>
  )
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { label: 'Basics',   color: P1  },
  { label: 'Tactics',  color: P2  },
  { label: 'Strategy', color: GOLD},
  { label: 'Practice', color: '#a78bfa' },
]

// ─── Main Page ────────────────────────────────────────────────────────────────

export function HexLearnPage() {
  const [tab, setTab] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)

  const switchTab = (i: number) => {
    setTab(i)
    contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0a14' }}>

      {/* ── Sticky header ── */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b border-white/8"
        style={{ background: 'rgba(10,10,20,0.92)', backdropFilter: 'blur(16px)',
                 paddingLeft: 'max(1rem, env(safe-area-inset-left))',
                 paddingRight: 'max(1rem, env(safe-area-inset-right))' }}
      >
        <Link href="/"
              className="flex items-center gap-1.5 text-xs font-bold text-white/40 hover:text-white/70 transition-colors"
              style={{ minHeight: 44, display:'flex', alignItems:'center' }}>
          ← Back
        </Link>

        <div className="text-center">
          <p className="text-[11px] font-extrabold tracking-widest text-white uppercase">How to Play</p>
          <p className="text-[9px] text-white/30 tracking-widest">⬡ Hexle</p>
        </div>

        <Link href="/"
              className="text-xs font-bold text-white/40 hover:text-white/70 transition-colors"
              style={{ minHeight: 44, display:'flex', alignItems:'center' }}>
          Hub →
        </Link>
      </header>

      {/* ── Tab bar ── */}
      <div className="sticky top-[53px] z-30 border-b border-white/8"
           style={{ background: 'rgba(10,10,20,0.92)', backdropFilter: 'blur(16px)' }}>
        <div className="flex overflow-x-auto scrollbar-none"
             style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))',
                      paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
          {TABS.map((t, i) => (
            <button
              key={t.label}
              onClick={() => switchTab(i)}
              className="flex-none px-4 py-3 text-[11px] font-bold uppercase tracking-widest transition-colors whitespace-nowrap"
              style={{
                color: tab === i ? t.color : 'rgba(255,255,255,0.3)',
                borderBottom: `2px solid ${tab === i ? t.color : 'transparent'}`,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div ref={contentRef} className="flex-1 w-full max-w-lg mx-auto px-4 py-6 space-y-4"
           style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))',
                    paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>

        <AnimatePresence mode="wait">
          {tab === 0 && (
            <motion.div key="basics" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="space-y-4">
              <GoalSection/>
              <ConnectionsSection/>
            </motion.div>
          )}
          {tab === 1 && (
            <motion.div key="tactics" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="space-y-4">
              <BlockingSection/>
              <BridgeSection/>
              <MultiPathSection/>
              <FalseConnectionSection/>
            </motion.div>
          )}
          {tab === 2 && (
            <motion.div key="strategy" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="space-y-4">
              <EdgeControlSection/>
              <OpeningSection/>
              <ZigzagSection/>
              <WinPathSection/>
              <MistakesSection/>
            </motion.div>
          )}
          {tab === 3 && (
            <motion.div key="practice" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="space-y-4">
              <PuzzlesSection/>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer ── */}
      <footer className="py-6 text-center border-t border-white/5">
        <p className="text-[10px] text-white/20 uppercase tracking-widest">Hexle · How to Play</p>
        <div className="flex justify-center gap-4 mt-3">
          <Link href="/hexle"
                className="text-xs font-bold rounded-full px-4 py-2 transition-all active:scale-95"
                style={{ background: P1, color: '#000', boxShadow: `0 4px 16px ${P1}40` }}>
            Play Hexle
          </Link>
          <Link href="/"
                className="text-xs font-bold rounded-full px-4 py-2 border border-white/10 text-white/40 hover:text-white/70 transition-all">
            All Games
          </Link>
        </div>
      </footer>

    </div>
  )
}
