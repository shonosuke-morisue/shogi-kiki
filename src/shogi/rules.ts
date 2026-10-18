import type { Color, Hand, HandType, Move, Piece, PieceType, Position } from './types';
import { HAND_TYPES, PROMOTE, UNPROMOTE } from './types';

type Vec = readonly [number, number];

// 駒の動き(先手から見た向き。dy < 0 が前方)
const GOLD: Vec[] = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [0, 1]];
const DIAG: Vec[] = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
const ORTH: Vec[] = [[0, -1], [-1, 0], [1, 0], [0, 1]];
const KING: Vec[] = [...DIAG, ...ORTH];

interface MoveDef {
  steps: Vec[];
  slides: Vec[];
}

export const MOVE_DEFS: Record<PieceType, MoveDef> = {
  FU: { steps: [[0, -1]], slides: [] },
  KY: { steps: [], slides: [[0, -1]] },
  KE: { steps: [[-1, -2], [1, -2]], slides: [] },
  GI: { steps: [[-1, -1], [0, -1], [1, -1], [-1, 1], [1, 1]], slides: [] },
  KI: { steps: GOLD, slides: [] },
  TO: { steps: GOLD, slides: [] },
  NY: { steps: GOLD, slides: [] },
  NK: { steps: GOLD, slides: [] },
  NG: { steps: GOLD, slides: [] },
  OU: { steps: KING, slides: [] },
  KA: { steps: [], slides: DIAG },
  HI: { steps: [], slides: ORTH },
  UM: { steps: ORTH, slides: DIAG },
  RY: { steps: DIAG, slides: ORTH },
};

export const sq = (x: number, y: number) => y * 9 + x;
export const sqX = (s: number) => s % 9;
export const sqY = (s: number) => Math.floor(s / 9);
const onBoard = (x: number, y: number) => x >= 0 && x < 9 && y >= 0 && y < 9;
const opp = (c: Color): Color => (c === 0 ? 1 : 0);

const emptyHand = (): Hand => ({ FU: 0, KY: 0, KE: 0, GI: 0, KI: 0, KA: 0, HI: 0 });

export function initialPosition(): Position {
  const board: (Piece | null)[] = Array(81).fill(null);
  const back: PieceType[] = ['KY', 'KE', 'GI', 'KI', 'OU', 'KI', 'GI', 'KE', 'KY'];
  for (let x = 0; x < 9; x++) {
    board[sq(x, 0)] = { type: back[x], color: 1 };
    board[sq(x, 2)] = { type: 'FU', color: 1 };
    board[sq(x, 6)] = { type: 'FU', color: 0 };
    board[sq(x, 8)] = { type: back[x], color: 0 };
  }
  board[sq(1, 1)] = { type: 'HI', color: 1 };
  board[sq(7, 1)] = { type: 'KA', color: 1 };
  board[sq(1, 7)] = { type: 'KA', color: 0 };
  board[sq(7, 7)] = { type: 'HI', color: 0 };
  return { board, hands: [emptyHand(), emptyHand()], turn: 0 };
}

/** 盤上の駒が利いているマス(自分の駒がいるマスも含む) */
export function attacksFrom(board: (Piece | null)[], from: number): number[] {
  const p = board[from];
  if (!p) return [];
  const def = MOVE_DEFS[p.type];
  const sign = p.color === 0 ? 1 : -1;
  const x0 = sqX(from);
  const y0 = sqY(from);
  const out: number[] = [];
  for (const [dx, dy] of def.steps) {
    const x = x0 + dx;
    const y = y0 + dy * sign;
    if (onBoard(x, y)) out.push(sq(x, y));
  }
  for (const [dx, dy] of def.slides) {
    let x = x0 + dx;
    let y = y0 + dy * sign;
    while (onBoard(x, y)) {
      const s = sq(x, y);
      out.push(s);
      if (board[s]) break;
      x += dx;
      y += dy * sign;
    }
  }
  return out;
}

/** 各マスに先手・後手の駒がそれぞれ何枚利いているか */
export function attackCounts(board: (Piece | null)[]): [number[], number[]] {
  const counts: [number[], number[]] = [Array(81).fill(0), Array(81).fill(0)];
  for (let s = 0; s < 81; s++) {
    const p = board[s];
    if (!p) continue;
    for (const t of attacksFrom(board, s)) counts[p.color][t]++;
  }
  return counts;
}

/** マス t に利いている駒のマス(先手・後手別) */
export function attackersOf(board: (Piece | null)[], t: number): [number[], number[]] {
  const out: [number[], number[]] = [[], []];
  for (let s = 0; s < 81; s++) {
    const p = board[s];
    if (p && attacksFrom(board, s).includes(t)) out[p.color].push(s);
  }
  return out;
}

const hasVec = (list: Vec[], x: number, y: number) => list.some(([a, b]) => a === x && b === y);

/** マス t に color 側の駒が利いているか(t から外側に向かって調べる) */
export function isAttacked(board: (Piece | null)[], t: number, by: Color): boolean {
  const tx = sqX(t);
  const ty = sqY(t);
  const sign = by === 0 ? 1 : -1;
  for (const [dx, dy] of KING) {
    let x = tx + dx;
    let y = ty + dy;
    let dist = 1;
    while (onBoard(x, y)) {
      const p = board[sq(x, y)];
      if (p) {
        if (p.color === by) {
          // 駒から t へのベクトルを駒の向きの定義に直す
          const vx = -dx;
          const vy = -dy * sign;
          const def = MOVE_DEFS[p.type];
          if (hasVec(def.slides, vx, vy) || (dist === 1 && hasVec(def.steps, vx, vy))) return true;
        }
        break;
      }
      x += dx;
      y += dy;
      dist++;
    }
  }
  // 桂馬
  for (const dx of [-1, 1]) {
    const x = tx + dx;
    const y = ty + 2 * sign;
    if (!onBoard(x, y)) continue;
    const p = board[sq(x, y)];
    if (p && p.color === by && p.type === 'KE') return true;
  }
  return false;
}

export function findKing(board: (Piece | null)[], color: Color): number {
  for (let s = 0; s < 81; s++) {
    const p = board[s];
    if (p && p.type === 'OU' && p.color === color) return s;
  }
  return -1;
}

export function inCheck(pos: Position, color: Color = pos.turn): boolean {
  const k = findKing(pos.board, color);
  return k >= 0 && isAttacked(pos.board, k, opp(color));
}

const relY = (color: Color, y: number) => (color === 0 ? y : 8 - y);
const inZone = (color: Color, y: number) => relY(color, y) <= 2;

/** その段では二度と動けない(行き所のない駒)か */
function isDeadSquare(type: PieceType, color: Color, y: number): boolean {
  const r = relY(color, y);
  if (type === 'FU' || type === 'KY') return r === 0;
  if (type === 'KE') return r <= 1;
  return false;
}

export function canPromote(p: Piece, from: number, to: number): boolean {
  return !!PROMOTE[p.type] && (inZone(p.color, sqY(from)) || inZone(p.color, sqY(to)));
}

export function mustPromote(p: Piece, to: number): boolean {
  return isDeadSquare(p.type, p.color, sqY(to));
}

export function makeMove(pos: Position, m: Move): Position {
  const board = pos.board.slice();
  const hands: [Hand, Hand] = [{ ...pos.hands[0] }, { ...pos.hands[1] }];
  const me = pos.turn;
  if (m.from === null) {
    const t = m.drop!;
    hands[me][t]--;
    board[m.to] = { type: t, color: me };
  } else {
    const p = board[m.from]!;
    const captured = board[m.to];
    if (captured) {
      const base = UNPROMOTE[captured.type];
      if (base !== 'OU') hands[me][base]++;
    }
    board[m.from] = null;
    board[m.to] = { type: m.promote ? PROMOTE[p.type]! : p.type, color: me };
  }
  return { board, hands, turn: opp(me) };
}

function pseudoMoves(pos: Position): Move[] {
  const moves: Move[] = [];
  const me = pos.turn;
  const { board } = pos;
  for (let s = 0; s < 81; s++) {
    const p = board[s];
    if (!p || p.color !== me) continue;
    for (const t of attacksFrom(board, s)) {
      const target = board[t];
      if (target && target.color === me) continue;
      if (canPromote(p, s, t)) {
        moves.push({ from: s, to: t, promote: true });
        if (!mustPromote(p, t)) moves.push({ from: s, to: t, promote: false });
      } else {
        moves.push({ from: s, to: t, promote: false });
      }
    }
  }
  // 駒打ち
  const pawnFiles = new Set<number>();
  for (let s = 0; s < 81; s++) {
    const p = board[s];
    if (p && p.color === me && p.type === 'FU') pawnFiles.add(sqX(s));
  }
  for (const h of HAND_TYPES) {
    if (pos.hands[me][h] === 0) continue;
    for (let t = 0; t < 81; t++) {
      if (board[t]) continue;
      if (isDeadSquare(h, me, sqY(t))) continue;
      if (h === 'FU' && pawnFiles.has(sqX(t))) continue; // 二歩
      moves.push({ from: null, to: t, drop: h, promote: false });
    }
  }
  return moves;
}

function leavesKingSafe(pos: Position, m: Move): boolean {
  const next = makeMove(pos, m);
  return !inCheck(next, pos.turn);
}

function hasAnyLegalMove(pos: Position): boolean {
  return pseudoMoves(pos).some((m) => leavesKingSafe(pos, m));
}

/** 打ち歩詰めか */
function isPawnDropMate(pos: Position, m: Move): boolean {
  if (m.drop !== 'FU') return false;
  const next = makeMove(pos, m);
  if (!inCheck(next)) return false;
  return !hasAnyLegalMove(next);
}

export function legalMoves(pos: Position): Move[] {
  return pseudoMoves(pos).filter((m) => leavesKingSafe(pos, m) && !isPawnDropMate(pos, m));
}

export function sameMove(a: Move, b: Move): boolean {
  return a.from === b.from && a.to === b.to && a.promote === b.promote && a.drop === b.drop;
}

export function positionKey(pos: Position): string {
  let k = '';
  for (const p of pos.board) k += p ? `${p.color}${p.type}` : '.';
  for (const c of [0, 1] as const) for (const h of HAND_TYPES) k += pos.hands[c][h];
  return k + pos.turn;
}

export type GameResult =
  | { kind: 'checkmate'; winner: Color }
  | { kind: 'resign'; winner: Color }
  | { kind: 'perpetualCheck'; winner: Color }
  | { kind: 'repetition' };

// ---- USI 形式の指し手文字列 (オンライン対戦での保存に使う) ----
const RANKS = 'abcdefghi';
const USI_PIECE: Record<HandType, string> = { FU: 'P', KY: 'L', KE: 'N', GI: 'S', KI: 'G', KA: 'B', HI: 'R' };

const usiSq = (s: number) => `${9 - sqX(s)}${RANKS[sqY(s)]}`;
const parseUsiSq = (str: string) => sq(9 - Number(str[0]), RANKS.indexOf(str[1]));

export function toUsi(m: Move): string {
  if (m.from === null) return `${USI_PIECE[m.drop!]}*${usiSq(m.to)}`;
  return `${usiSq(m.from)}${usiSq(m.to)}${m.promote ? '+' : ''}`;
}

export function fromUsi(str: string): Move {
  if (str[1] === '*') {
    const drop = (Object.keys(USI_PIECE) as HandType[]).find((h) => USI_PIECE[h] === str[0])!;
    return { from: null, to: parseUsiSq(str.slice(2, 4)), drop, promote: false };
  }
  return { from: parseUsiSq(str.slice(0, 2)), to: parseUsiSq(str.slice(2, 4)), promote: str[4] === '+' };
}

// ---- SFEN 形式の局面文字列 (評価値エンジンに局面を渡すのに使う) ----
const SFEN_PIECE: Record<PieceType, string> = {
  FU: 'P', KY: 'L', KE: 'N', GI: 'S', KI: 'G', KA: 'B', HI: 'R', OU: 'K',
  TO: '+P', NY: '+L', NK: '+N', NG: '+S', UM: '+B', RY: '+R',
};

/** 例: lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1 */
export function toSfen(pos: Position, moveNumber = 1): string {
  const rows: string[] = [];
  for (let y = 0; y < 9; y++) {
    let row = '';
    let empty = 0;
    for (let x = 0; x < 9; x++) {
      const p = pos.board[sq(x, y)];
      if (!p) {
        empty++;
        continue;
      }
      if (empty) row += empty;
      empty = 0;
      const c = SFEN_PIECE[p.type];
      row += p.color === 0 ? c : c.toLowerCase();
    }
    if (empty) row += empty;
    rows.push(row);
  }
  let hands = '';
  for (const c of [0, 1] as const) {
    for (const h of HAND_TYPES) {
      const n = pos.hands[c][h];
      if (!n) continue;
      if (n > 1) hands += n;
      hands += c === 0 ? USI_PIECE[h] : USI_PIECE[h].toLowerCase();
    }
  }
  return `${rows.join('/')} ${pos.turn === 0 ? 'b' : 'w'} ${hands || '-'} ${moveNumber}`;
}
