import { useState } from 'react';
import { GameView } from '../components/GameView';
import { applyMove, currentPosition, newGame, resign, truncate } from '../shogi/game';

export function LocalGame() {
  const [game, setGame] = useState(newGame);
  const turn = currentPosition(game).turn;
  return (
    <GameView
      game={game}
      controls={[0, 1]}
      onMove={(m) => setGame((g) => applyMove(g, m))}
      actions={
        <>
          <button disabled={game.moves.length === 0} onClick={() => setGame((g) => truncate(g, g.moves.length - 1))}>
            待った
          </button>
          <button disabled={!!game.result} onClick={() => setGame((g) => resign(g, turn))}>
            投了
          </button>
          <button onClick={() => setGame(newGame())}>最初から</button>
        </>
      }
    />
  );
}
