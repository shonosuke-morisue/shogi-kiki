import { describe, expect, it } from 'vitest';
import { decodeKifu, detectFormat, parseKifu } from './kifu';
import { sq, toUsi } from './rules';

const usi = (k: ReturnType<typeof parseKifu>) => k.game.moves.map(toUsi);
const SHORT = ['7g7f', '3c3d', '8h2b+', '3a2b', 'B*4e'];

const KIF = `# ---- Kifu for Windows ----
開始日時：2026/10/16 10:00:00
手合割：平手
先手：先手さん
後手：後手さん
手数----指手---------消費時間--
   1 ７六歩(77)   ( 0:01/00:00:01)
   2 ３四歩(33)   ( 0:01/00:00:01)
   3 ２二角成(88)   ( 0:01/00:00:02)
   4 同　銀(31)   ( 0:01/00:00:02)
   5 ４五角打     ( 0:01/00:00:03)
   6 投了
まで5手で先手の勝ち
`;

describe('kifu', () => {
  it('KIF を読み込む', () => {
    const k = parseKifu(KIF, 'a.kif');
    expect(k.format).toBe('KIF');
    expect(usi(k)).toEqual(SHORT);
    expect(k.game.result).toEqual({ kind: 'resign', winner: 0 });
    expect(k.info).toContainEqual({ label: '先手', value: '先手さん' });
    expect(k.error).toBeUndefined();
  });

  it('KI2 を読み込む (打の省略、まで〜の勝ち)', () => {
    const k = parseKifu('先手：A\n後手：B\n\n▲７六歩    △３四歩    ▲２二角成  △同　銀\n▲４五角\nまで5手で先手の勝ち\n');
    expect(k.format).toBe('KI2');
    expect(usi(k)).toEqual(SHORT);
    expect(k.game.result).toEqual({ kind: 'resign', winner: 0 });
  });

  it('KI2 の右・左で同じ駒を区別する', () => {
    const k = parseKifu('▲５八金右 △５二金右 ▲６八金直 △４二金寄');
    expect(usi(k)).toEqual(['4i5h', '6a5b', '6i6h', '5b4b']);
    const l = parseKifu('▲５八金左 △５二金左');
    expect(usi(l)).toEqual(['6i5h', '4a5b']);
  });

  it('CSA を読み込む', () => {
    const csa = `V2.2
N+先手さん
N-後手さん
PI
+
+7776FU
T1
-3334FU,T1
+8822UM
-3122GI
+0045KA
%TORYO
`;
    const k = parseKifu(csa);
    expect(k.format).toBe('CSA');
    expect(usi(k)).toEqual(SHORT);
    expect(k.game.result).toEqual({ kind: 'resign', winner: 0 });
    expect(k.info).toContainEqual({ label: '後手', value: '後手さん' });
  });

  it('CSA の局面指定 (P1〜P9 と持駒)', () => {
    const csa = `P1 *  *  *  *  * -OU *  *  * 
P2 *  *  *  *  *  *  *  *  * 
P3 *  *  *  *  * +FU *  *  * 
P4 *  *  *  *  *  *  *  *  * 
P5 *  *  *  *  *  *  *  *  * 
P6 *  *  *  *  *  *  *  *  * 
P7 *  *  *  *  *  *  *  *  * 
P8 *  *  *  *  *  *  *  *  * 
P9 *  *  *  * +OU *  *  *  * 
P+00KI
P-00AL
+
+0042KI
%TSUMI
`;
    const k = parseKifu(csa);
    const start = k.game.positions[0];
    expect(start.board[sq(5, 0)]).toEqual({ type: 'OU', color: 1 });
    expect(start.hands[0].KI).toBe(1);
    expect(start.hands[1].FU).toBe(17);
    expect(usi(k)).toEqual(['G*4b']);
    expect(k.game.result).toEqual({ kind: 'checkmate', winner: 0 });
  });

  it('駒落ちは上手 (後手) から指す', () => {
    const k = parseKifu('手合割：香落ち\n手数----指手--\n   1 ３四歩(33)\n   2 ７六歩(77)\n');
    expect(k.game.positions[0].board[sq(8, 0)]).toBeNull();
    expect(usi(k)).toEqual(['3c3d', '7g7f']);
  });

  it('KIF の盤面 (BOD) から始める', () => {
    const kif = `後手の持駒：なし
  ９ ８ ７ ６ ５ ４ ３ ２ １
+---------------------------+
| ・ ・ ・ ・ ・v玉 ・ ・ ・|一
| ・ ・ ・ ・ ・ ・ ・ ・ ・|二
| ・ ・ ・ ・ ・ 歩 ・ ・ ・|三
| ・ ・ ・ ・ ・ ・ ・ ・ ・|四
| ・ ・ ・ ・ ・ ・ ・ ・ ・|五
| ・ ・ ・ ・ ・ ・ ・ ・ ・|六
| ・ ・ ・ ・ ・ ・ ・ ・ ・|七
| ・ ・ ・ ・ ・ ・ ・ ・ ・|八
| ・ ・ ・ ・ 玉 ・ ・ ・ ・|九
+---------------------------+
先手の持駒：金　歩二
手数----指手---------消費時間--
   1 ４二金打
   2 詰み
`;
    const k = parseKifu(kif);
    expect(k.game.positions[0].hands[0]).toMatchObject({ KI: 1, FU: 2 });
    expect(usi(k)).toEqual(['G*4b']);
    expect(k.game.result).toEqual({ kind: 'checkmate', winner: 0 });
  });

  it('変化手順は読まず、読めない手があればそこまでを返す', () => {
    const k = parseKifu('   1 ７六歩(77)\n   2 ３四歩(33)\n\n変化：2手\n   2 ８四歩(83)\n');
    expect(usi(k)).toEqual(['7g7f', '3c3d']);
    const bad = parseKifu('   1 ７六歩(77)\n   2 ５五角打\n');
    expect(usi(bad)).toEqual(['7g7f']);
    expect(bad.error).toContain('2手目');
  });

  it('中断などは説明文を返す', () => {
    expect(parseKifu('   1 ７六歩(77)\n   2 中断\n').endText).toBe('対局は中断されました');
    expect(parseKifu('+7776FU\n%CHUDAN\n').endText).toBe('対局は中断されました');
  });

  it('拡張子と内容から形式を判別する', () => {
    expect(detectFormat('', 'x.KIFU')).toBe('KIF');
    expect(detectFormat('', 'x.ki2')).toBe('KI2');
    expect(detectFormat('+7776FU')).toBe('CSA');
    expect(detectFormat('   1 ７六歩(77)')).toBe('KIF');
    expect(detectFormat('▲７六歩')).toBe('KI2');
  });

  it('Shift_JIS のファイルも読める', () => {
    expect(decodeKifu(new Uint8Array([0x95, 0xe0]).buffer)).toBe('歩');
    expect(decodeKifu(new TextEncoder().encode('歩').buffer as ArrayBuffer)).toBe('歩');
  });
});
