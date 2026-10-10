import { describe, expect, it } from 'vitest';
import { attackCounts, attackersOf, fromUsi, initialPosition, legalMoves, makeMove, sq, toUsi } from './rules';
import type { Piece, Position } from './types';

function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of legalMoves(pos)) n += perft(makeMove(pos, m), depth - 1);
  return n;
}

function emptyPosition(pieces: [number, number, Piece][]): Position {
  const pos = initialPosition();
  pos.board = Array(81).fill(null);
  for (const [x, y, p] of pieces) pos.board[sq(x, y)] = p;
  return pos;
}

describe('rules', () => {
  it('初期局面の合法手数 (perft) が既知の値と一致する', () => {
    const pos = initialPosition();
    expect(perft(pos, 1)).toBe(30);
    expect(perft(pos, 2)).toBe(900);
    expect(perft(pos, 3)).toBe(25470);
  });

  it('USI 形式で往復変換できる', () => {
    for (const s of ['7g7f', '8h2b+', 'P*5e']) expect(toUsi(fromUsi(s))).toBe(s);
  });

  it('初期局面の利きの数', () => {
    const [b, w] = attackCounts(initialPosition().board);
    // ７六 (x=2, y=5) には先手の歩が1枚利く
    expect(b[sq(2, 5)]).toBe(1);
    expect(w[sq(2, 5)]).toBe(0);
    // ５八 (x=4, y=7) には先手の玉・左右の金・２八の飛車が利く
    expect(b[sq(4, 7)]).toBe(4);
  });

  it('二歩は打てない', () => {
    const pos = emptyPosition([
      [4, 8, { type: 'OU', color: 0 }],
      [4, 0, { type: 'OU', color: 1 }],
      [0, 6, { type: 'FU', color: 0 }],
    ]);
    pos.hands[0].FU = 1;
    const drops = legalMoves(pos).filter((m) => m.drop === 'FU');
    expect(drops.some((m) => m.to % 9 === 0)).toBe(false);
    expect(drops.some((m) => m.to % 9 === 1)).toBe(true);
  });

  it('打ち歩詰めは反則、突き歩詰めは可', () => {
    // 後手玉 1一、後手の香 2一・歩 2二で逃げ道なし。先手の金 2三 (1二 に利く)
    const pos = emptyPosition([
      [8, 0, { type: 'OU', color: 1 }],
      [7, 0, { type: 'KY', color: 1 }],
      [7, 1, { type: 'FU', color: 1 }],
      [7, 2, { type: 'KI', color: 0 }],
      [4, 8, { type: 'OU', color: 0 }],
    ]);
    pos.hands[0].FU = 1;
    const ms = legalMoves(pos);
    expect(ms.some((m) => m.drop === 'FU' && m.to === sq(8, 1))).toBe(false);
    // 歩以外の駒打ちによる詰みは可
    pos.hands[0] = { ...pos.hands[0], FU: 0, KI: 1 };
    expect(legalMoves(pos).some((m) => m.drop === 'KI' && m.to === sq(8, 1))).toBe(true);
  });

  it('行き所のない駒は成りが強制される', () => {
    const pos = emptyPosition([
      [4, 8, { type: 'OU', color: 0 }],
      [0, 8, { type: 'OU', color: 1 }],
      [2, 1, { type: 'FU', color: 0 }],
    ]);
    const ms = legalMoves(pos).filter((m) => m.from === sq(2, 1));
    expect(ms).toEqual([{ from: sq(2, 1), to: sq(2, 0), promote: true }]);
  });

  it('マスに利いている駒を先手・後手別に返す', () => {
    // 5五 に先手の飛車 (5九、間は空き) と後手の角 (1一) が利く。先手の金 5六 は飛車を遮らない位置
    const pos = emptyPosition([
      [4, 8, { type: 'HI', color: 0 }],
      [8, 0, { type: 'KA', color: 1 }],
      [3, 5, { type: 'KI', color: 0 }],
      [0, 0, { type: 'FU', color: 1 }],
    ]);
    const [s, g] = attackersOf(pos.board, sq(4, 4));
    expect(s.sort()).toEqual([sq(3, 5), sq(4, 8)].sort());
    expect(g).toEqual([sq(8, 0)]);
    // 遮られた飛び駒は数えない
    pos.board[sq(4, 6)] = { type: 'FU', color: 1 };
    expect(attackersOf(pos.board, sq(4, 4))[0]).toEqual([sq(3, 5)]);
  });
});
