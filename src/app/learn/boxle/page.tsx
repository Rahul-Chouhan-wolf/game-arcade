import Link from 'next/link'

export const metadata = {
  title: 'Boxle — How to Play',
  description: 'Learn how to play Boxle — the dots and boxes strategy game.',
}

const RULES = [
  { icon: '📍', title: 'Connect the dots', body: 'Take turns drawing one line between two adjacent dots. Lines can be horizontal or vertical.' },
  { icon: '📦', title: 'Complete a box to score', body: 'If your line closes a box (all 4 sides), you claim it and get another turn. Chain reactions score multiple boxes at once!' },
  { icon: '🔄', title: 'Chain bonus turns', body: 'Every box you complete earns you an extra turn. String together long chains to dominate the board.' },
  { icon: '🏆', title: 'Most boxes wins', body: 'When all lines are drawn, the player with the most claimed boxes wins.' },
]

const TIPS = [
  'Avoid completing 3 sides of a box — your opponent will close it next turn',
  'Look for chains: if you must give up boxes, give up the fewest (short chain strategy)',
  'Control the tempo — force your opponent to open chains for you',
  'The "double cross" advanced tactic: sacrifice 2 boxes to gain a longer chain',
  'Watch board edges — edge boxes need only 3 lines total (1 edge already provided)',
]

export default function BoxleLearnRoute() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0a14' }}>
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b border-white/8"
              style={{ background: 'rgba(10,10,20,0.92)', backdropFilter: 'blur(16px)' }}>
        <Link href="/boxle" className="text-xs font-bold text-white/40 hover:text-white/70 transition-colors" style={{ minHeight:44, display:'flex', alignItems:'center' }}>← Boxle</Link>
        <div className="text-center">
          <p className="text-[11px] font-extrabold tracking-widest text-white uppercase">How to Play</p>
          <p className="text-[9px] text-white/30 tracking-widest">Boxle</p>
        </div>
        <Link href="/" className="text-xs font-bold text-white/40 hover:text-white/70 transition-colors" style={{ minHeight:44, display:'flex', alignItems:'center' }}>Hub →</Link>
      </header>

      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Visual overview */}
        <div className="rounded-2xl border border-white/10 bg-black/40 p-5" style={{ backdropFilter:'blur(16px)' }}>
          <h3 className="text-white font-extrabold text-sm mb-3">The Board</h3>
          <div className="flex gap-4 items-center">
            <svg viewBox="0 0 82 82" width={82} height={82}>
              {/* dots */}
              {Array.from({length:4},(_,r)=>Array.from({length:4},(_,c)=>(
                <circle key={`${r}-${c}`} cx={8+c*24} cy={8+r*24} r={2.5} fill="#818384"/>
              )))}
              {/* green lines (P1) */}
              {[[0,0,true],[0,1,true],[1,0,true],[0,0,false],[0,1,false]].map(([r,c,isH],i)=>(
                <line key={i} x1={8+Number(c)*24} y1={8+Number(r)*24}
                      x2={isH?8+(Number(c)+1)*24:8+Number(c)*24}
                      y2={isH?8+Number(r)*24:8+(Number(r)+1)*24}
                      stroke="#538d4e" strokeWidth={2} strokeLinecap="round"/>
              ))}
              {/* green box fill */}
              <rect x={9} y={9} width={22} height={22} rx={2} fill="#538d4e30"/>
              {/* purple lines (P2) */}
              {[[0,2,true],[0,2,false]].map(([r,c,isH],i)=>(
                <line key={i} x1={8+Number(c)*24} y1={8+Number(r)*24}
                      x2={isH?8+(Number(c)+1)*24:8+Number(c)*24}
                      y2={isH?8+Number(r)*24:8+(Number(r)+1)*24}
                      stroke="#c77dff" strokeWidth={2} strokeLinecap="round"/>
              ))}
              <text x={20} y={23} textAnchor="middle" fontSize={8} fill="#538d4e" fontWeight="bold">P1</text>
            </svg>
            <div className="text-xs text-white/50 leading-relaxed">
              <p className="mb-1"><span className="inline-block w-3 h-0.5 bg-[#538d4e] mr-1 align-middle"/>Green = Player 1 lines</p>
              <p className="mb-1"><span className="inline-block w-3 h-0.5 bg-[#c77dff] mr-1 align-middle"/>Purple = Player 2 lines</p>
              <p>Colored fill = claimed box</p>
            </div>
          </div>
        </div>

        {/* Rules */}
        <div className="rounded-2xl border border-white/10 bg-black/40 p-5 space-y-4" style={{ backdropFilter:'blur(16px)' }}>
          <h3 className="text-white font-extrabold text-sm">Rules</h3>
          {RULES.map(r => (
            <div key={r.title} className="flex gap-3">
              <span className="text-xl flex-none">{r.icon}</span>
              <div>
                <p className="text-xs font-bold text-white">{r.title}</p>
                <p className="text-[11px] text-white/45 leading-relaxed">{r.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Chain reactions */}
        <div className="rounded-2xl border border-white/10 bg-black/40 p-5" style={{ backdropFilter:'blur(16px)' }}>
          <h3 className="text-white font-extrabold text-sm mb-2">Chain Reactions</h3>
          <p className="text-[11px] text-white/50 leading-relaxed mb-3">
            When you close a box you get another turn. If that turn closes another box, you keep going.
            Long chains of boxes can flip the whole game in one turn.
          </p>
          <div className="rounded-lg bg-white/5 p-3 text-[11px] text-white/60 leading-relaxed">
            💡 <b className="text-white/80">Key insight:</b> The player who breaks a long chain usually wins.
            Try to leave only short chains for your opponent.
          </div>
        </div>

        {/* Tips */}
        <div className="rounded-2xl border border-white/10 bg-black/40 p-5" style={{ backdropFilter:'blur(16px)' }}>
          <h3 className="text-white font-extrabold text-sm mb-3">Strategy Tips</h3>
          <ul className="space-y-2">
            {TIPS.map((tip, i) => (
              <li key={i} className="flex gap-2 text-[11px] text-white/50 leading-relaxed">
                <span className="text-[#c77dff] font-bold flex-none">{i+1}.</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <footer className="py-6 text-center border-t border-white/5">
        <div className="flex justify-center gap-4">
          <Link href="/boxle" className="text-xs font-bold rounded-full px-4 py-2 transition-all active:scale-95"
                style={{ background:'#c77dff', color:'#000', boxShadow:'0 4px 16px #c77dff40' }}>
            Play Boxle
          </Link>
          <Link href="/" className="text-xs font-bold rounded-full px-4 py-2 border border-white/10 text-white/40 hover:text-white/70 transition-all">
            All Games
          </Link>
        </div>
      </footer>
    </div>
  )
}
