import { TicTacToeGame } from "@/components/tictactoe/TicTacToeGame"

export const metadata = {
  title: "Tic Tac Toe · Game Arcade",
  description: "Premium Tic Tac Toe — Play local PvP or challenge the unbeatable AI across four difficulty levels.",
}

export default function TicTacToePage() {
  return <TicTacToeGame />
}
