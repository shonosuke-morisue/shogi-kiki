import { useEffect, useState } from 'react';
import { GameView } from '../components/GameView';
import type { AiLevel } from '../shogi/ai';
import { thinkInWorker } from '../shogi/aiClient';
import { applyMove, currentPosition, newGame, resign, truncate } from '../shogi/game';
import type { Color } from '../shogi/types';

export function AiGame({ human, level }: { human: Color; level: AiLevel }) {
  const [game, setGame] = useState(newGame);
  const pos = currentPosition(game);
  const aiTurn = !game.result && pos.turn !== human;

  useEffect(() => {
    if (!aiTurn) return;
    let cancelled = false;
    const started = game;
    thinkInWorker(pos, level).then((m) => {
      if (cancelled || !m) return;
      // 思考中に過去の局面から指し直すなどで局面が変わっていたら結果を捨てる
      setGame((g) => (g === started ? applyMove(g, m) : g));
    });
    return () => {
      cancelled = true;
    };
  }, [game, pos, aiTurn, level]);

  return (
    <GameView
      game={game}
      controls={[human]}
      initialViewer={human}
      onMove={(m, at) => setGame((g) => applyMove(truncate(g, at), m))}
      status={aiTurn ? 'AIが考えています…' : undefined}
      actions={
        <>
          <button disabled={!!game.result} onClick={() => setGame((g) => resign(g, human))}>
            投了
          </button>
          <button onClick={() => setGame(newGame())}>最初から</button>
        </>
      }
    />
  );
}
