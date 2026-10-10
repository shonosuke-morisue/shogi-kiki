import { inCheck, initialPosition, legalMoves, makeMove, positionKey } from './rules';
import type { GameResult } from './rules';
import { moveToJapanese } from './notation';
import type { Color, Move, Position } from './types';

export interface GameState {
  /** positions[i] は i 手目を指す前の局面。最後の要素が現局面 */
  positions: Position[];
  moves: Move[];
  notation: string[];
  result: GameResult | null;
}

export function newGame(): GameState {
  return { positions: [initialPosition()], moves: [], notation: [], result: null };
}

export const currentPosition = (g: GameState) => g.positions[g.positions.length - 1];

export function applyMove(g: GameState, m: Move): GameState {
  const pos = currentPosition(g);
  const next = makeMove(pos, m);
  const prev = g.moves.length ? g.moves[g.moves.length - 1] : null;
  const positions = [...g.positions, next];
  return {
    positions,
    moves: [...g.moves, m],
    notation: [...g.notation, moveToJapanese(pos, m, prev)],
    result: judge(positions),
  };
}

export function resign(g: GameState, loser: Color): GameState {
  return { ...g, result: { kind: 'resign', winner: loser === 0 ? 1 : 0 } };
}

function judge(positions: Position[]): GameResult | null {
  const pos = positions[positions.length - 1];
  // 指せる手がなければ手番側の負け(詰み)
  if (legalMoves(pos).length === 0) return { kind: 'checkmate', winner: pos.turn === 0 ? 1 : 0 };
  // 千日手: 同一局面が4回現れたら引き分け(連続王手の千日手は王手をかけ続けた側の負け)
  const key = positionKey(pos);
  const same: number[] = [];
  positions.forEach((p, i) => {
    if (positionKey(p) === key) same.push(i);
  });
  if (same.length >= 4) {
    const start = same[0];
    for (const c of [0, 1] as const) {
      // c が王手をかけ続けていたか (c が指した後の局面 = 相手番で王手されている局面)
      const checking = positions
        .slice(start + 1)
        .filter((p) => p.turn !== c)
        .every((p) => inCheck(p));
      if (checking) return { kind: 'perpetualCheck', winner: c === 0 ? 1 : 0 };
    }
    return { kind: 'repetition' };
  }
  return null;
}

export function resultText(r: GameResult): string {
  if (r.kind === 'repetition') return '千日手で引き分けです';
  const w = r.winner === 0 ? '先手' : '後手';
  if (r.kind === 'resign') return `投了により${w}の勝ちです`;
  if (r.kind === 'perpetualCheck') return `連続王手の千日手により${w}の勝ちです`;
  return `詰みにより${w}の勝ちです`;
}

/** 最初の n 手だけを残した状態に戻す (待った) */
export function truncate(g: GameState, n: number): GameState {
  return {
    positions: g.positions.slice(0, n + 1),
    moves: g.moves.slice(0, n),
    notation: g.notation.slice(0, n),
    result: null,
  };
}
