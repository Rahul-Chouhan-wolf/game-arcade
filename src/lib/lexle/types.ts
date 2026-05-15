export type TileState = 'correct' | 'present' | 'absent' | 'tbd' | 'empty'
export type Difficulty = 'easy' | 'normal' | 'hard'
export type Category = 'any' | 'animals' | 'countries' | 'fruits' | 'foods' | 'sports' | 'colors'
export type WordLength = 4 | 5 | 6 | 7

export interface Tile {
  letter: string
  state: TileState
}

export interface Layout {
  tileSize: number
  tileFontSize: string
  keyH: number
  keyFontSize: string
  isMobile: boolean
  scratchTileSz: number
}

export interface GameSettings {
  wordLength: WordLength
  difficulty: Difficulty
  category: Category
  maxGuesses: number
}

export interface Definition {
  pos: string
  definition: string
  example?: string
}
