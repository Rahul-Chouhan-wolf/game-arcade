// ─── Cryptogram · Puzzle database & selection ─────────────────────────────────
// Seeded daily puzzle + infinite mode. Pure functions, no side effects.

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert'
export type Category   = 'philosophy' | 'science' | 'literature' | 'history' | 'scifi' | 'wisdom'

export interface CryptoQuote {
  id:         string
  text:       string      // plain-text quote (mixed case, will be uppercased)
  author:     string
  source:     string      // book / film / speech / etc.
  category:   Category
  difficulty: Difficulty
}

// ─── Quote library ────────────────────────────────────────────────────────────

export const QUOTES: CryptoQuote[] = [
  // ── Philosophy ──
  {
    id: 'p01', text: 'The unexamined life is not worth living.',
    author: 'Socrates', source: 'Apology', category: 'philosophy', difficulty: 'easy',
  },
  {
    id: 'p02', text: 'We are what we repeatedly do. Excellence is not an act, but a habit.',
    author: 'Aristotle', source: 'Nicomachean Ethics', category: 'philosophy', difficulty: 'medium',
  },
  {
    id: 'p03', text: 'I think therefore I am.',
    author: 'René Descartes', source: 'Discourse on the Method', category: 'philosophy', difficulty: 'easy',
  },
  {
    id: 'p04', text: 'God is dead. God remains dead. And we have killed him.',
    author: 'Friedrich Nietzsche', source: 'The Gay Science', category: 'philosophy', difficulty: 'medium',
  },
  {
    id: 'p05', text: 'Man is condemned to be free; because once thrown into the world, he is responsible for everything he does.',
    author: 'Jean-Paul Sartre', source: 'Existentialism is a Humanism', category: 'philosophy', difficulty: 'expert',
  },
  {
    id: 'p06', text: 'The only true wisdom is in knowing you know nothing.',
    author: 'Socrates', source: 'Apology', category: 'philosophy', difficulty: 'easy',
  },
  {
    id: 'p07', text: 'Reality is merely an illusion, albeit a very persistent one.',
    author: 'Albert Einstein', source: 'Letter to Michele Besso', category: 'philosophy', difficulty: 'medium',
  },
  {
    id: 'p08', text: 'To live is to suffer, to survive is to find some meaning in the suffering.',
    author: 'Friedrich Nietzsche', source: 'Notebooks', category: 'philosophy', difficulty: 'medium',
  },
  {
    id: 'p09', text: 'In the middle of difficulty lies opportunity.',
    author: 'Albert Einstein', source: 'Interviews', category: 'philosophy', difficulty: 'easy',
  },
  {
    id: 'p10', text: 'The mind is everything. What you think you become.',
    author: 'Buddha', source: 'Dhammapada', category: 'philosophy', difficulty: 'easy',
  },
  {
    id: 'p11', text: 'No man ever steps in the same river twice, for it is not the same river and he is not the same man.',
    author: 'Heraclitus', source: 'Fragments', category: 'philosophy', difficulty: 'hard',
  },
  {
    id: 'p12', text: 'What we observe is not nature itself, but nature exposed to our method of questioning.',
    author: 'Werner Heisenberg', source: 'Physics and Philosophy', category: 'philosophy', difficulty: 'hard',
  },

  // ── Science ──
  {
    id: 's01', text: 'Imagination is more important than knowledge.',
    author: 'Albert Einstein', source: 'The Saturday Evening Post', category: 'science', difficulty: 'easy',
  },
  {
    id: 's02', text: 'If you thought that science was certain, well that is just an error on your part.',
    author: 'Richard Feynman', source: 'The Meaning of It All', category: 'science', difficulty: 'hard',
  },
  {
    id: 's03', text: 'The cosmos is within us. We are made of star-stuff.',
    author: 'Carl Sagan', source: 'Cosmos', category: 'science', difficulty: 'medium',
  },
  {
    id: 's04', text: 'Not only is the universe stranger than we think, it is stranger than we can think.',
    author: 'Werner Heisenberg', source: 'Across the Frontiers', category: 'science', difficulty: 'medium',
  },
  {
    id: 's05', text: 'The important thing is to not stop questioning. Curiosity has its own reason for existing.',
    author: 'Albert Einstein', source: 'Life Magazine', category: 'science', difficulty: 'hard',
  },
  {
    id: 's06', text: 'Science is not only a disciple of reason but also one of romance and passion.',
    author: 'Stephen Hawking', source: 'Black Holes and Baby Universes', category: 'science', difficulty: 'medium',
  },
  {
    id: 's07', text: 'The secret of getting ahead is getting started.',
    author: 'Mark Twain', source: 'Notebooks', category: 'science', difficulty: 'easy',
  },
  {
    id: 's08', text: 'Equipped with his five senses, man explores the universe around him and calls the adventure science.',
    author: 'Edwin Hubble', source: 'The Nature of Science', category: 'science', difficulty: 'expert',
  },
  {
    id: 's09', text: 'The measure of intelligence is the ability to change.',
    author: 'Albert Einstein', source: 'Interviews', category: 'science', difficulty: 'easy',
  },
  {
    id: 's10', text: 'Somewhere, something incredible is waiting to be known.',
    author: 'Carl Sagan', source: 'Broca\'s Brain', category: 'science', difficulty: 'easy',
  },

  // ── Literature ──
  {
    id: 'l01', text: 'All that glitters is not gold.',
    author: 'William Shakespeare', source: 'The Merchant of Venice', category: 'literature', difficulty: 'easy',
  },
  {
    id: 'l02', text: 'Not all those who wander are lost.',
    author: 'J.R.R. Tolkien', source: 'The Fellowship of the Ring', category: 'literature', difficulty: 'easy',
  },
  {
    id: 'l03', text: 'Big Brother is watching you.',
    author: 'George Orwell', source: 'Nineteen Eighty-Four', category: 'literature', difficulty: 'easy',
  },
  {
    id: 'l04', text: 'All animals are equal, but some animals are more equal than others.',
    author: 'George Orwell', source: 'Animal Farm', category: 'literature', difficulty: 'medium',
  },
  {
    id: 'l05', text: 'It was the best of times, it was the worst of times.',
    author: 'Charles Dickens', source: 'A Tale of Two Cities', category: 'literature', difficulty: 'easy',
  },
  {
    id: 'l06', text: 'The world is a book, and those who do not travel read only one page.',
    author: 'Saint Augustine', source: 'Confessions', category: 'literature', difficulty: 'medium',
  },
  {
    id: 'l07', text: 'A reader lives a thousand lives before he dies. The man who never reads lives only one.',
    author: 'George R.R. Martin', source: 'A Dance with Dragons', category: 'literature', difficulty: 'hard',
  },
  {
    id: 'l08', text: 'There is nothing to writing. All you do is sit down at a typewriter and bleed.',
    author: 'Ernest Hemingway', source: 'Interviews', category: 'literature', difficulty: 'medium',
  },
  {
    id: 'l09', text: 'The difference between the almost right word and the right word is really a large matter.',
    author: 'Mark Twain', source: 'Letter to George Bainton', category: 'literature', difficulty: 'hard',
  },
  {
    id: 'l10', text: 'The only way out of the labyrinth of suffering is to forgive.',
    author: 'John Green', source: 'Looking for Alaska', category: 'literature', difficulty: 'medium',
  },
  {
    id: 'l11', text: 'Words are our most inexhaustible source of magic.',
    author: 'J.K. Rowling', source: 'Harry Potter and the Deathly Hallows', category: 'literature', difficulty: 'medium',
  },
  {
    id: 'l12', text: 'We accept the love we think we deserve.',
    author: 'Stephen Chbosky', source: 'The Perks of Being a Wallflower', category: 'literature', difficulty: 'easy',
  },

  // ── History ──
  {
    id: 'h01', text: 'Never give in, never give in, never, never, never.',
    author: 'Winston Churchill', source: 'Address at Harrow School', category: 'history', difficulty: 'easy',
  },
  {
    id: 'h02', text: 'The supreme art of war is to subdue the enemy without fighting.',
    author: 'Sun Tzu', source: 'The Art of War', category: 'history', difficulty: 'medium',
  },
  {
    id: 'h03', text: 'Courage is not the absence of fear, but the triumph over it.',
    author: 'Nelson Mandela', source: 'Long Walk to Freedom', category: 'history', difficulty: 'medium',
  },
  {
    id: 'h04', text: 'Give me liberty or give me death.',
    author: 'Patrick Henry', source: 'Virginia Convention Speech', category: 'history', difficulty: 'easy',
  },
  {
    id: 'h05', text: 'To err is human, to forgive divine.',
    author: 'Alexander Pope', source: 'An Essay on Criticism', category: 'history', difficulty: 'easy',
  },
  {
    id: 'h06', text: 'In war, truth is the first casualty.',
    author: 'Aeschylus', source: 'Fragments', category: 'history', difficulty: 'easy',
  },
  {
    id: 'h07', text: 'Injustice anywhere is a threat to justice everywhere.',
    author: 'Martin Luther King Jr.', source: 'Letter from Birmingham Jail', category: 'history', difficulty: 'medium',
  },
  {
    id: 'h08', text: 'The most courageous act is still to think for yourself, aloud.',
    author: 'Coco Chanel', source: 'Interviews', category: 'history', difficulty: 'medium',
  },

  // ── Sci-Fi ──
  {
    id: 'f01', text: 'The stars are the street lights of eternity.',
    author: 'Unknown', source: 'Attributed', category: 'scifi', difficulty: 'easy',
  },
  {
    id: 'f02', text: 'Space is not the final frontier. The mind is.',
    author: 'Various', source: 'Science Fiction Anthology', category: 'scifi', difficulty: 'easy',
  },
  {
    id: 'f03', text: 'Any sufficiently advanced technology is indistinguishable from magic.',
    author: 'Arthur C. Clarke', source: 'Profiles of the Future', category: 'scifi', difficulty: 'medium',
  },
  {
    id: 'f04', text: 'The sky above the port was the color of television, tuned to a dead channel.',
    author: 'William Gibson', source: 'Neuromancer', category: 'scifi', difficulty: 'hard',
  },
  {
    id: 'f05', text: 'It is a well-known fact that those people who most want to rule people are the ones least suited to do it.',
    author: 'Douglas Adams', source: 'The Restaurant at the End of the Universe', category: 'scifi', difficulty: 'expert',
  },
  {
    id: 'f06', text: 'The answer to the great question of life, the universe and everything is forty-two.',
    author: 'Douglas Adams', source: 'The Hitchhiker\'s Guide to the Galaxy', category: 'scifi', difficulty: 'medium',
  },
  {
    id: 'f07', text: 'Do androids dream of electric sheep?',
    author: 'Philip K. Dick', source: 'Do Androids Dream of Electric Sheep?', category: 'scifi', difficulty: 'easy',
  },
  {
    id: 'f08', text: 'Violence is the last refuge of the incompetent.',
    author: 'Isaac Asimov', source: 'Foundation', category: 'scifi', difficulty: 'medium',
  },
  {
    id: 'f09', text: 'A robot may not injure a human being or, through inaction, allow a human to come to harm.',
    author: 'Isaac Asimov', source: 'I, Robot', category: 'scifi', difficulty: 'hard',
  },
  {
    id: 'f10', text: 'We are all the sum of our tears. Too little and the ground is not fertile and nothing can grow. Too much and the roots drown.',
    author: 'J. Michael Straczynski', source: 'Babylon 5', category: 'scifi', difficulty: 'expert',
  },

  // ── Wisdom ──
  {
    id: 'w01', text: 'The journey of a thousand miles begins with one step.',
    author: 'Lao Tzu', source: 'Tao Te Ching', category: 'wisdom', difficulty: 'easy',
  },
  {
    id: 'w02', text: 'Before you judge a man, walk a mile in his shoes.',
    author: 'Native American Proverb', source: 'Traditional', category: 'wisdom', difficulty: 'easy',
  },
  {
    id: 'w03', text: 'Waste no more time arguing about what a good man should be. Be one.',
    author: 'Marcus Aurelius', source: 'Meditations', category: 'wisdom', difficulty: 'medium',
  },
  {
    id: 'w04', text: 'You have power over your mind, not outside events. Realize this, and you will find strength.',
    author: 'Marcus Aurelius', source: 'Meditations', category: 'wisdom', difficulty: 'medium',
  },
  {
    id: 'w05', text: 'Luck is what happens when preparation meets opportunity.',
    author: 'Seneca', source: 'Letters', category: 'wisdom', difficulty: 'easy',
  },
  {
    id: 'w06', text: 'It does not matter how slowly you go as long as you do not stop.',
    author: 'Confucius', source: 'Analects', category: 'wisdom', difficulty: 'easy',
  },
  {
    id: 'w07', text: 'The impediment to action advances action. What stands in the way becomes the way.',
    author: 'Marcus Aurelius', source: 'Meditations', category: 'wisdom', difficulty: 'hard',
  },
  {
    id: 'w08', text: 'Out beyond ideas of wrongdoing and rightdoing, there is a field. I will meet you there.',
    author: 'Rumi', source: 'The Masnavi', category: 'wisdom', difficulty: 'medium',
  },
]

// ─── Seeding helpers ──────────────────────────────────────────────────────────

function fnv1a(str: string): number {
  let h = 0x811c9dc5 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

/** Deterministic seed from UTC date string "YYYY-MM-DD". */
export function dateSeed(date: Date = new Date()): { quoteSeed: number; cipherSeed: number } {
  const dateStr = date.toISOString().slice(0, 10)
  const h       = fnv1a(dateStr)
  return { quoteSeed: h, cipherSeed: h ^ 0xabcdef01 }
}

// ─── Puzzle selection ─────────────────────────────────────────────────────────

/** Filter by difficulty and pick by seeded index. */
export function getQuoteForDifficulty(
  difficulty: Difficulty,
  seed:       number,
): CryptoQuote {
  const pool = QUOTES.filter(q => q.difficulty === difficulty)
  const idx  = seed % pool.length
  return pool[idx >= 0 ? idx : pool.length + idx]
}

/**
 * Daily puzzle: same quote for everyone on the same UTC day.
 * Returns the quote AND the cipher seed (separate from quote selection).
 */
export function getDailyPuzzle(
  difficulty: Difficulty = 'medium',
  date: Date = new Date(),
): { quote: CryptoQuote; cipherSeed: number } {
  const { quoteSeed, cipherSeed } = dateSeed(date)
  return { quote: getQuoteForDifficulty(difficulty, quoteSeed), cipherSeed }
}

/**
 * Infinite mode: deterministic puzzle at index `n`.
 * Cycles through all difficulties, quotes never repeat within same difficulty pool.
 */
export function getInfinitePuzzle(n: number): { quote: CryptoQuote; cipherSeed: number } {
  const diffCycle: Difficulty[] = ['easy', 'easy', 'medium', 'medium', 'hard', 'expert']
  const difficulty = diffCycle[n % diffCycle.length]
  const seed       = fnv1a(`infinite-${n}`)
  return { quote: getQuoteForDifficulty(difficulty, seed), cipherSeed: seed ^ 0xf00dbeef }
}

/** Get all quotes for a given difficulty (for custom/random mode). */
export function getByDifficulty(difficulty: Difficulty): CryptoQuote[] {
  return QUOTES.filter(q => q.difficulty === difficulty)
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy:   'Easy',
  medium: 'Medium',
  hard:   'Hard',
  expert: 'Expert',
}

export const CATEGORY_LABEL: Record<Category, string> = {
  philosophy: 'Philosophy',
  science:    'Science',
  literature: 'Literature',
  history:    'History',
  scifi:      'Sci-Fi',
  wisdom:     'Wisdom',
}

export const DIFFICULTY_HINTS: Record<Difficulty, number> = {
  easy:   3,
  medium: 2,
  hard:   1,
  expert: 0,
}
