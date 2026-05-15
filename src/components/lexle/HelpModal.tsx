'use client'

interface HelpModalProps {
  open: boolean
  onClose: () => void
}

export function HelpModal({ open, onClose }: HelpModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      style={{ backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="animate-modal-in bg-[#1a1a1c] border border-[#3a3a3c] rounded-2xl p-6 w-full max-w-sm shadow-2xl overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 64px)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-extrabold tracking-widest uppercase text-white">How to Play</h2>
          <button
            onClick={onClose}
            className="text-[#818384] hover:text-white transition-colors text-xl w-8 h-8 flex items-center justify-center"
          >✕</button>
        </div>
        <p className="text-[#ccc] text-sm mb-4 leading-relaxed">
          Guess the <strong className="text-white">LEXLE</strong> in up to 6 tries. Each guess must be a real English word.
        </p>
        <div className="border-t border-[#3a3a3c] pt-4 flex flex-col gap-4">
          <div>
            <div className="flex gap-1.5 mb-1">
              <div style={{ width:36,height:36,background:'#538d4e',border:'2px solid #538d4e',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:14 }}>W</div>
              <div style={{ width:36,height:36,background:'#3a3a3c',border:'2px solid #3a3a3c',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:14 }}>E</div>
              <div style={{ width:36,height:36,background:'#3a3a3c',border:'2px solid #3a3a3c',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:14 }}>A</div>
              <div style={{ width:36,height:36,background:'#3a3a3c',border:'2px solid #3a3a3c',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:14 }}>R</div>
              <div style={{ width:36,height:36,background:'#3a3a3c',border:'2px solid #3a3a3c',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:14 }}>Y</div>
            </div>
            <p className="text-[#aaa] text-xs"><strong className="text-white">W</strong> — correct spot.</p>
          </div>
          <div>
            <div className="flex gap-1.5 mb-1">
              <div style={{ width:36,height:36,background:'#3a3a3c',border:'2px solid #3a3a3c',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:14 }}>P</div>
              <div style={{ width:36,height:36,background:'#b59f3b',border:'2px solid #b59f3b',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:14 }}>I</div>
              <div style={{ width:36,height:36,background:'#3a3a3c',border:'2px solid #3a3a3c',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:14 }}>L</div>
              <div style={{ width:36,height:36,background:'#3a3a3c',border:'2px solid #3a3a3c',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:14 }}>L</div>
              <div style={{ width:36,height:36,background:'#3a3a3c',border:'2px solid #3a3a3c',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:14 }}>S</div>
            </div>
            <p className="text-[#aaa] text-xs"><strong className="text-white">I</strong> — in word, wrong spot.</p>
          </div>
          <div>
            <div className="flex gap-1.5 mb-1">
              <div style={{ width:36,height:36,background:'#3a3a3c',border:'2px solid #3a3a3c',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:14 }}>V</div>
              <div style={{ width:36,height:36,background:'#3a3a3c',border:'2px solid #3a3a3c',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:14 }}>A</div>
              <div style={{ width:36,height:36,background:'#3a3a3c',border:'2px solid #3a3a3c',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:14 }}>G</div>
              <div style={{ width:36,height:36,background:'#3a3a3c',border:'2px solid #3a3a3c',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',color:'#555',fontWeight:800,fontSize:14 }}>U</div>
              <div style={{ width:36,height:36,background:'#3a3a3c',border:'2px solid #3a3a3c',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:14 }}>E</div>
            </div>
            <p className="text-[#aaa] text-xs"><strong className="text-white">U</strong> — not in word.</p>
          </div>
        </div>
        <div className="border-t border-[#3a3a3c] mt-4 pt-3">
          <p className="text-[#818384] text-xs font-bold mb-0.5">⚙ Hard Mode</p>
          <p className="text-[#555] text-xs">Every guess must reuse all revealed green and yellow letters.</p>
        </div>
      </div>
    </div>
  )
}
