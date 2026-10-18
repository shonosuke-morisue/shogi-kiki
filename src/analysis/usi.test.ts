import { describe, expect, it } from 'vitest';
import { fromUsi, initialPosition, makeMove, toSfen } from '../shogi/rules';
import { judgement, parseInfo, pvToJapanese, scoreText } from './usi';

describe('toSfen', () => {
  it('初期局面', () => {
    expect(toSfen(initialPosition())).toBe('lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1');
  });

  it('成り駒・持ち駒・後手番', () => {
    let pos = initialPosition();
    for (const m of ['7g7f', '3c3d', '8h2b+']) pos = makeMove(pos, fromUsi(m));
    expect(toSfen(pos)).toBe('lnsgkgsnl/1r5+B1/pppppp1pp/6p2/9/2P6/PP1PPPPPP/7R1/LNSGKGSNL w B 1');
    pos = makeMove(pos, fromUsi('3a2b'));
    expect(toSfen(pos)).toBe('lnsgkg1nl/1r5s1/pppppp1pp/6p2/9/2P6/PP1PPPPPP/7R1/LNSGKGSNL b Bb 1');
  });
});

describe('parseInfo', () => {
  it('手番側の評価値を先手から見た値に直す', () => {
    const line = 'info depth 17 seldepth 21 score cp 36 nodes 403688 nps 477737 time 845 pv 3a2b 7i8h';
    expect(parseInfo(line, 0)).toEqual({ depth: 17, score: { kind: 'cp', value: 36 }, pv: ['3a2b', '7i8h'] });
    expect(parseInfo(line, 1)?.score).toEqual({ kind: 'cp', value: -36 });
  });

  it('詰みの読みと、使わない行', () => {
    expect(parseInfo('info depth 5 score mate 3 pv 5b5a', 1)?.score).toEqual({ kind: 'mate', plies: -3 });
    expect(parseInfo('info depth 9 score cp 120 lowerbound nodes 1', 0)).toBeNull();
    expect(parseInfo('info string loading eval file', 0)).toBeNull();
    expect(parseInfo('bestmove 7g7f', 0)).toBeNull();
  });
});

describe('表示', () => {
  it('読み筋を日本語にし、不正な手で打ち切る', () => {
    expect(pvToJapanese(initialPosition(), ['7g7f', '3c3d', '8h2b+', '3a2b', '9a9a'])).toEqual(['▲７六歩', '△３四歩', '▲２二角成', '△同銀']);
  });

  it('評価値の文字と形勢', () => {
    expect(scoreText({ kind: 'cp', value: 120 })).toBe('+120');
    expect(scoreText({ kind: 'mate', plies: -5 })).toBe('後手勝ち (5手詰)');
    expect(judgement({ kind: 'cp', value: -900 })).toBe('後手優勢');
    expect(judgement({ kind: 'cp', value: 50 })).toBe('互角');
  });
});
