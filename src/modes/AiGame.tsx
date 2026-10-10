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
      // 思考中に「待った」などで局面が変わっていたら結果を捨てる
      setGame((g) => (g === started ? applyMove(g, m) : g));
    });
    return () => {
      cancelled = true;
    };
  }, [game, pos, aiTurn, level]);

  // 自分の手番まで戻す (AI の手と自分の手をまとめて取り消す)
  const undo = () =>
    setGame((g) => {
      let n = g.moves.length - 1;
      while (n > 0 && g.positions[n].turn !== human) n--;
      return g.positions[n].turn === human ? truncate(g, n) : g;
    });

  return (
    <GameView
      game={game}
      controls={[human]}
      initialViewer={human}
      onMove={(m) => setGame((g) => applyMove(g, m))}
      status={aiTurn ? 'AIが考えています…' : undefined}
      actions={
        <>
          <button disabled={game.moves.length < (human === 0 ? 1 : 2) || aiTurn} onClick={undo}>
            待った
          </button>
          <button disabled={!!game.result} onClick={() => setGame((g) => resign(g, human))}>
            投了
          </button>
          <button onClick={() => setGame(newGame())}>最初から</button>
        </>
      }
    />
  );
}
