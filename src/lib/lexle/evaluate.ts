import { Tile, TileState } from './types'

export function evaluateGuess(guess: string, target: string): Tile[] {
  const g = guess.toUpperCase().split('')
  const t = target.toUpperCase().split('')
  const result: Tile[] = g.map(l => ({ letter: l, state: 'absent' as TileState }))
  const rem = [...t]
  g.forEach((l, i) => { if (l === rem[i]) { result[i].state = 'correct'; rem[i] = '' } })
  g.forEach((l, i) => {
    if (result[i].state === 'correct') return
    const idx = rem.indexOf(l)
    if (idx !== -1) { result[i].state = 'present'; rem[idx] = '' }
  })
  return result
}

export function checkHardMode(word: string, hardCorrect: Record<number, string>, hardPresent: Set<string>): string | null {
  const w = word.toUpperCase()
  for (const [idx, letter] of Object.entries(hardCorrect)) {
    if (w[+idx] !== letter) return `Position ${+idx + 1} must be ${letter}`
  }
  for (const letter of hardPresent) {
    if (!w.includes(letter)) return `Must include ${letter}`
  }
  return null
}
