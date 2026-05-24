import { CryptogramGame } from '@/components/cryptogram/CryptogramGame'

export const metadata = {
  title: 'Cryptogram · Game Arcade',
  description: 'Decode encrypted quotes using substitution cipher logic. A premium code-breaking puzzle experience.',
}

export default function CryptogramPage() {
  return <CryptogramGame />
}
