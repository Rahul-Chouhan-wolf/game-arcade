import Link from 'next/link'

export const metadata = {
  title: 'Lexle — How to Play',
  description: 'Learn how to play Lexle — the word guessing game.',
}

const TILE_EXAMPLES = [
  { letters: ['C','R','A','N','E'], colors: ['#538d4e','#b59f3b','#3a3a3c','#3a3a3c','#3a3a3c'], caption: 'C is correct (right spot). R is present (wrong spot). Others are absent.' },
  { letters: ['C','L','O','A','K'], colors: ['#538d4e','#3a3a3c','#3a3a3c','#538d4e','#3a3a3c'], caption: 'C and A are in correct positions.' },
  { letters: ['C','H','A','R','T'], colors: ['#538d4e','#3a3a3c','#538d4e','#3a3a3c','#3a3a3c'], caption: 'Getting closer — C and A confirmed.' },
]

const RULES = [
  { icon: '🎯', title: 'Guess the 5-letter word', body: 'You have 6 attempts to find the hidden word. Each guess must be a real English word.' },
  { icon: '🟩', title: 'Green = right place', body: 'A green tile means the letter is in the word AND in the correct position.' },
  { icon: '🟨', title: 'Yellow = wrong place', body: 'A yellow tile means the letter is in the word but in a different position.' },
  { icon: '⬛', title: 'Grey = not in word', body: 'A grey tile means the letter does not appear in the word at all.' },
  { icon: '⌨️', title: 'Use the keyboard', body: 'The on-screen keyboard updates after each guess to reflect what you know.' },
]

export default function LexleLearnRoute() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0a14' }}>
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b border-white/8"
              style={{ background: 'rgba(10,10,20,0.92)', backdropFilter: 'blur(16px)' }}>
        <Link href="/lexle" className="text-xs font-bold text-white/40 hover:text-white/70 transition-colors" style={{ minHeight:44, display:'flex', alignItems:'center' }}>← Lexle</Link>
        <div className="text-center">
          <p className="text-[11px] font-extrabold tracking-widest text-white uppercase">How to Play</p>
          <p className="text-[9px] text-white/30 tracking-widest">Lexle</p>
        </div>
        <Link href="/" className="text-xs font-bold text-white/40 hover:text-white/70 transition-colors" style={{ minHeight:44, display:'flex', alignItems:'center' }}>Hub →</Link>
      </header>

      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Color key */}
        <div className="rounded-2xl border border-white/10 bg-black/40 p-5" style={{ backdropFilter:'blur(16px)' }}>
          <h3 className="text-white font-extrabold text-sm mb-2">Color Guide</h3>
          <div className="flex gap-3 flex-wrap">
            {[['#538d4e','Green','Correct spot'],['#b59f3b','Yellow','Wrong spot'],['#3a3a3c','Grey','Not in word']].map(([color, label, desc]) => (
              <div key={label} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md flex items-center justify-center text-white text-xs font-bold" style={{ background: color }}>{label[0]}</div>
                <div>
                  <p className="text-xs font-bold text-white">{label}</p>
                  <p className="text-[10px] text-white/40">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rules */}
        <div className="rounded-2xl border border-white/10 bg-black/40 p-5 space-y-4" style={{ backdropFilter:'blur(16px)' }}>
          <h3 className="text-white font-extrabold text-sm mb-3">Rules</h3>
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

        {/* Example guesses */}
        <div className="rounded-2xl border border-white/10 bg-black/40 p-5" style={{ backdropFilter:'blur(16px)' }}>
          <h3 className="text-white font-extrabold text-sm mb-4">Example Game</h3>
          <div className="space-y-3">
            {TILE_EXAMPLES.map((ex, i) => (
              <div key={i}>
                <div className="flex gap-1.5 mb-1">
                  {ex.letters.map((l, j) => (
                    <div key={j} className="w-10 h-10 rounded-md flex items-center justify-center text-white font-extrabold text-sm"
                         style={{ background: ex.colors[j], border:`1.5px solid ${ex.colors[j]}` }}>
                      {l}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-white/35">{ex.caption}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tips */}
        <div className="rounded-2xl border border-white/10 bg-black/40 p-5" style={{ backdropFilter:'blur(16px)' }}>
          <h3 className="text-white font-extrabold text-sm mb-3">Tips</h3>
          <ul className="space-y-2 text-[11px] text-white/50 list-disc list-inside leading-relaxed">
            <li>Start with a word that covers common letters: <b className="text-white/70">CRANE</b>, <b className="text-white/70">SLATE</b>, or <b className="text-white/70">ADIEU</b></li>
            <li>Use yellows in your next guess — try them in a different position</li>
            <li>Eliminate as many letters as possible in your first 2 guesses</li>
            <li>Watch the keyboard — grey keys tell you what not to use</li>
          </ul>
        </div>
      </div>

      <footer className="py-6 text-center border-t border-white/5">
        <div className="flex justify-center gap-4">
          <Link href="/lexle" className="text-xs font-bold rounded-full px-4 py-2 transition-all active:scale-95"
                style={{ background:'#538d4e', color:'#fff', boxShadow:'0 4px 16px #538d4e40' }}>
            Play Lexle
          </Link>
          <Link href="/" className="text-xs font-bold rounded-full px-4 py-2 border border-white/10 text-white/40 hover:text-white/70 transition-all">
            All Games
          </Link>
        </div>
      </footer>
    </div>
  )
}
