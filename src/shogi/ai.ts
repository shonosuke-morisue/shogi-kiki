import { legalMoves, makeMove } from './rules';
import type { HandType, Move, PieceType, Position } from './types';
import { HAND_TYPES } from './types';

export type AiLevel = 1 | 2 | 3;

const VALUE: Record<PieceType, number> = {
  FU: 100,
  KY: 300,
  KE: 350,
  GI: 500,
  KI: 550,
  KA: 800,
  HI: 1000,
  OU: 0,
  TO: 550,
  NY: 550,
  NK: 550,
  NG: 550,
  UM: 1100,
  RY: 1300,
};
// 持ち駒は打つ場所を選べる分すこし高めに評価する
const HAND_VALUE = (h: HandType) => Math.round(VALUE[h] * 1.1);

const MATE = 1_000_000;

/** 手番側から見た評価値 */
function evaluate(pos: Position): number {
  let score = 0;
  for (let s = 0; s < 81; s++) {
    const p = pos.board[s];
    if (!p) continue;
    let v = VALUE[p.type];
    // 歩は前に進むほど少しだけ評価を上げる
    if (p.type === 'FU') v += (p.color === 0 ? 8 - Math.floor(s / 9) : Math.floor(s / 9)) * 3;
    score += p.color === pos.turn ? v : -v;
  }
  for (const h of HAND_TYPES) {
    score += (pos.hands[pos.turn][h] - pos.hands[pos.turn === 0 ? 1 : 0][h]) * HAND_VALUE(h);
  }
  return score;
}

function moveOrderScore(pos: Position, m: Move): number {
  let s = 0;
  const captured = pos.board[m.to];
  if (captured) s += 10 * VALUE[captured.type] - (m.from !== null ? VALUE[pos.board[m.from]!.type] : 0);
  if (m.promote) s += 300;
  return s;
}

function ordered(pos: Position, moves: Move[]): Move[] {
  return moves
    .map((m) => ({ m, s: moveOrderScore(pos, m) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.m);
}

function quiescence(pos: Position, alpha: number, beta: number, depth: number): number {
  const stand = evaluate(pos);
  if (depth === 0 || stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  const captures = legalMoves(pos).filter((m) => pos.board[m.to]);
  for (const m of ordered(pos, captures)) {
    const v = -quiescence(makeMove(pos, m), -beta, -alpha, depth - 1);
    if (v >= beta) return v;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

function search(pos: Position, depth: number, alpha: number, beta: number, ply: number): number {
  const moves = legalMoves(pos);
  if (moves.length === 0) return -MATE + ply;
  if (depth === 0) return quiescence(pos, alpha, beta, 3);
  let best = -Infinity;
  for (const m of ordered(pos, moves)) {
    const v = -search(makeMove(pos, m), depth - 1, -beta, -alpha, ply + 1);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * 1: やさしい (1手読み + 大きめのゆらぎ)
 * 2: ふつう (2手読み)
 * 3: つよい (3手読み)
 */
export function chooseMove(pos: Position, level: AiLevel): Move | null {
  const moves = legalMoves(pos);
  if (moves.length === 0) return null;
  const noise = level === 1 ? 300 : level === 2 ? 30 : 10;
  let best: Move = moves[0];
  let bestScore = -Infinity;
  for (const m of ordered(pos, moves)) {
    // bestScore - noise を下回る手はゆらぎを足しても選ばれないので、そこで枝刈りしてよい
    const alpha = bestScore - noise;
    const v = -search(makeMove(pos, m), level - 1, -Infinity, -alpha, 1) + Math.random() * noise;
    if (v > bestScore) {
      bestScore = v;
      best = m;
    }
  }
  return best;
}
