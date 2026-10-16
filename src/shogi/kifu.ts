// KIF・KI2・CSA 形式の棋譜を読み込む
import { applyMove, currentPosition, resign } from './game';
import type { GameState } from './game';
import { initialPosition, legalMoves, sameMove, sq, sqX, sqY } from './rules';
import type { Color, Hand, HandType, Move, Piece, PieceType, Position } from './types';
import { HAND_TYPES } from './types';

export type KifuFormat = 'KIF' | 'KI2' | 'CSA';

export interface Kifu {
  format: KifuFormat;
  game: GameState;
  /** 先手・後手の名前や棋戦名など */
  info: { label: string; value: string }[];
  /** 投了以外の終わり方 (中断・持将棋など) の説明 */
  endText?: string;
  /** 途中で読めなかった指し手があったときの説明 (そこまでは読み込む) */
  error?: string;
}

// ---- 文字コード ----

/** UTF-8 として読めなければ Shift_JIS として読む (.kif は Shift_JIS のことが多い) */
export function decodeKifu(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('shift_jis').decode(buf);
  }
}

// ---- 形式の判別 ----

export function detectFormat(text: string, fileName?: string): KifuFormat {
  const ext = fileName?.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (ext === 'csa') return 'CSA';
  if (ext === 'ki2' || ext === 'ki2u') return 'KI2';
  if (ext === 'kif' || ext === 'kifu') return 'KIF';
  if (/^(?:[+-]\d{4}[A-Z]{2}|PI|P[1-9+-]|V2)/m.test(text)) return 'CSA';
  if (/^\s*\d+\s+\S/m.test(text)) return 'KIF';
  return 'KI2';
}

export function parseKifu(text: string, fileName?: string): Kifu {
  const t = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const format = detectFormat(t, fileName);
  return format === 'CSA' ? parseCsa(t) : parseJapanese(t, format);
}

// ---- 共通 ----

const emptyHand = (): Hand => ({ FU: 0, KY: 0, KE: 0, GI: 0, KI: 0, KA: 0, HI: 0 });
const opp = (c: Color): Color => (c === 0 ? 1 : 0);
const sideName = (c: Color) => (c === 0 ? '先手' : '後手');

/** 指し手を順に適用していく。読めない手があればそこで止める */
class Builder {
  game: GameState;
  error?: string;
  constructor(start: Position) {
    this.game = { positions: [start], moves: [], notation: [], result: null };
  }
  get pos() {
    return currentPosition(this.game);
  }
  get prev(): Move | null {
    const ms = this.game.moves;
    return ms.length ? ms[ms.length - 1] : null;
  }
  get stopped() {
    return this.error !== undefined;
  }
  /** m が null か合法手でなければ false を返して以降を読まない */
  play(m: Move | null, label: string): boolean {
    if (this.stopped) return false;
    const legal = m && legalMoves(this.pos).find((l) => sameMove(l, m));
    if (!legal) {
      this.error = `${this.game.moves.length + 1}手目「${label}」を読み取れませんでした。そこまでの手を表示しています。`;
      return false;
    }
    this.game = applyMove(this.game, legal);
    return true;
  }
}

// 終局の表し方 (手番の側から見た言葉) を、結果または説明文にする
function finish(b: Builder, word: string): string | undefined {
  if (b.stopped) return undefined;
  const g = b.game;
  const me = b.pos.turn;
  if (g.result) return undefined; // 詰み・千日手は局面から判定済み
  switch (word) {
    case '投了':
      b.game = resign(g, me);
      return undefined;
    case '詰み':
      return `詰みにより${sideName(opp(me))}の勝ちです`;
    case '千日手':
      return '千日手で引き分けです';
    case '持将棋':
      return '持将棋で引き分けです';
    case '中断':
      return '対局は中断されました';
    case '切れ負け':
    case '時間切れ':
      return `時間切れにより${sideName(opp(me))}の勝ちです`;
    case '反則勝ち':
      return `反則により${sideName(me)}の勝ちです`;
    case '反則負け':
      return `反則により${sideName(opp(me))}の勝ちです`;
    case '入玉勝ち':
      return `入玉宣言により${sideName(me)}の勝ちです`;
    case '不戦勝':
      return `不戦勝により${sideName(me)}の勝ちです`;
    case '不戦敗':
      return `不戦敗により${sideName(opp(me))}の勝ちです`;
  }
  return undefined;
}

const TERMINALS = ['投了', '詰み', '千日手', '持将棋', '中断', '切れ負け', '時間切れ', '反則勝ち', '反則負け', '入玉勝ち', '不戦勝', '不戦敗'];

// ---- KIF・KI2 ----

const JP_PIECE: Record<string, PieceType> = {
  歩: 'FU',
  香: 'KY',
  桂: 'KE',
  銀: 'GI',
  金: 'KI',
  角: 'KA',
  飛: 'HI',
  玉: 'OU',
  王: 'OU',
  と: 'TO',
  成香: 'NY',
  杏: 'NY',
  成桂: 'NK',
  圭: 'NK',
  成銀: 'NG',
  全: 'NG',
  馬: 'UM',
  龍: 'RY',
  竜: 'RY',
};

const FILE_CHARS = '１２３４５６７８９';
const RANK_CHARS = '一二三四五六七八九';
const digit = (c: string) => {
  for (const s of [FILE_CHARS, RANK_CHARS, '123456789']) {
    const i = s.indexOf(c);
    if (i >= 0) return i + 1;
  }
  return 0;
};

/** 筋 (1〜9) と段 (1〜9) からマス番号 */
const square = (file: number, rank: number) => sq(9 - file, rank - 1);

const MOVE_RE =
  /^(?:([1-9１-９])([1-9１-９一二三四五六七八九])|同\s*)(成香|成桂|成銀|[歩香桂銀金角飛玉王と杏圭全馬龍竜])([右左直]?)([上引寄行入]?)(不成|生|成|打)?(?:\((\d)(\d)\))?/;

/** 「７六歩(77)」「同銀左上」「５五角打」などを指し手にする */
export function parseJapaneseMove(pos: Position, prev: Move | null, str: string): Move | null {
  const mm = MOVE_RE.exec(str.trim());
  if (!mm) return null;
  const [, f, r, name, lr, ud, act, ff, fr] = mm;
  const to = f ? square(digit(f), digit(r)) : prev?.to;
  if (to === undefined) return null;
  const type = JP_PIECE[name];
  const promote = act === '成';

  // KIF は移動元が書いてある
  if (ff) {
    if (ff === '0') return HAND_TYPES.includes(type as HandType) ? { from: null, to, drop: type as HandType, promote: false } : null;
    return { from: square(Number(ff), Number(fr)), to, promote };
  }

  // KI2 は移動先と駒の種類から、合法手の中で当てはまるものを探す
  const legal = legalMoves(pos).filter((m) => m.to === to);
  const drop = legal.find((m) => m.from === null && m.drop === type);
  if (act === '打') return drop ?? null;
  let cands = legal.filter((m) => m.from !== null && pos.board[m.from]!.type === type && m.promote === promote);
  if (cands.length === 0) return drop ?? null;
  if (cands.length === 1) return cands[0];

  // 手番側から見た座標 (rx が大きいほど右、ry が小さいほど前)
  const me = pos.turn;
  const rx = (s: number) => (me === 0 ? sqX(s) : 8 - sqX(s));
  const ry = (s: number) => (me === 0 ? sqY(s) : 8 - sqY(s));
  if (ud === '上' || ud === '行' || ud === '入') cands = cands.filter((m) => ry(m.from!) > ry(to));
  if (ud === '引') cands = cands.filter((m) => ry(m.from!) < ry(to));
  if (ud === '寄') cands = cands.filter((m) => ry(m.from!) === ry(to));
  if (lr === '直') cands = cands.filter((m) => rx(m.from!) === rx(to) && ry(m.from!) === ry(to) + 1);
  if (lr === '右' || lr === '左') {
    const xs = cands.map((m) => rx(m.from!));
    const target = lr === '右' ? Math.max(...xs) : Math.min(...xs);
    cands = cands.filter((m) => rx(m.from!) === target);
  }
  return cands.length === 1 ? cands[0] : null;
}

// 駒落ち: 上手 (後手) から取り除く駒の位置 [筋, 段]
const L1: [number, number] = [1, 1];
const L9: [number, number] = [9, 1];
const N2: [number, number] = [2, 1];
const N8: [number, number] = [8, 1];
const ROOK: [number, number] = [8, 2];
const BISHOP: [number, number] = [2, 2];
const FOUR = [ROOK, BISHOP, L1, L9];
const SIX = [...FOUR, N2, N8];
const EIGHT = [...SIX, [3, 1], [7, 1]] as [number, number][];
const HANDICAPS: Record<string, [number, number][]> = {
  香落ち: [L1],
  右香落ち: [L9],
  角落ち: [BISHOP],
  飛車落ち: [ROOK],
  飛落ち: [ROOK],
  飛香落ち: [ROOK, L1],
  二枚落ち: [ROOK, BISHOP],
  三枚落ち: [ROOK, BISHOP, L1],
  四枚落ち: FOUR,
  五枚落ち: [...FOUR, N2],
  左五枚落ち: [...FOUR, N8],
  六枚落ち: SIX,
  八枚落ち: EIGHT,
  十枚落ち: [...EIGHT, [4, 1], [6, 1]],
};

function handicapPosition(name: string): Position | null {
  const removed = HANDICAPS[name];
  if (!removed) return null;
  const pos = initialPosition();
  for (const [f, r] of removed) pos.board[square(f, r)] = null;
  pos.turn = 1;
  return pos;
}

const KANJI_NUM = '一二三四五六七八九';
function kanjiNumber(s: string): number {
  if (!s) return 1;
  if (/^\d+$/.test(s)) return Number(s);
  const i = s.indexOf('十');
  if (i < 0) return KANJI_NUM.indexOf(s) + 1;
  const tens = i === 0 ? 1 : KANJI_NUM.indexOf(s[i - 1]) + 1;
  const ones = s.slice(i + 1) ? KANJI_NUM.indexOf(s[i + 1]) + 1 : 0;
  return tens * 10 + ones;
}

function parseHandText(s: string): Hand {
  const hand = emptyHand();
  if (s.trim() === 'なし') return hand;
  for (const item of s.split(/[\s、,]+/)) {
    const m = /^([歩香桂銀金角飛])([一二三四五六七八九十\d]*)$/.exec(item);
    if (m) hand[JP_PIECE[m[1]] as HandType] += kanjiNumber(m[2]);
  }
  return hand;
}

/** BOD 形式の盤面の 1 行 (|v香v桂 ・…|一) */
function parseBodRow(line: string, rank: number, board: (Piece | null)[]) {
  const body = line.slice(1, line.lastIndexOf('|'));
  for (let i = 0; i < 9; i++) {
    const cell = body.slice(i * 2, i * 2 + 2);
    const type = JP_PIECE[cell[1]];
    if (type) board[sq(i, rank)] = { type, color: cell[0] === 'v' ? 1 : 0 };
  }
}

const INFO_KEYS = ['先手', '後手', '下手', '上手', '棋戦', '戦型', '開始日時', '場所'];

function parseJapanese(text: string, format: 'KIF' | 'KI2'): Kifu {
  const lines = text.split('\n');
  const info: Kifu['info'] = [];
  let start = initialPosition();
  let bodRank = 0;
  let bod: { board: (Piece | null)[]; hands: [Hand, Hand]; turn: Color } | null = null;
  let i = 0;

  // ヘッダー (最初の指し手まで)
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (format === 'KIF' && /^\s*\d+\s+\S/.test(line)) break;
    if (format === 'KI2' && /^\s*[▲△☗☖▽]/.test(line)) break;
    if (/^[#*&]/.test(line)) continue;
    if (line.startsWith('|')) {
      bod ??= { board: Array(81).fill(null), hands: [emptyHand(), emptyHand()], turn: 0 };
      parseBodRow(line, bodRank++, bod.board);
      continue;
    }
    const kv = /^([^：:]+)[：:](.*)$/.exec(line);
    if (kv) {
      const [, key, value] = kv;
      const v = value.trim();
      if (key === '手合割') {
        const h = handicapPosition(v);
        if (h) start = h;
      } else if (/^(先手|下手)の持駒$/.test(key)) {
        bod ??= { board: Array(81).fill(null), hands: [emptyHand(), emptyHand()], turn: 0 };
        bod.hands[0] = parseHandText(v);
      } else if (/^(後手|上手)の持駒$/.test(key)) {
        bod ??= { board: Array(81).fill(null), hands: [emptyHand(), emptyHand()], turn: 0 };
        bod.hands[1] = parseHandText(v);
      } else if (INFO_KEYS.includes(key) && v) {
        info.push({ label: key, value: v });
      }
      continue;
    }
    if (bod && /^(後手|上手)番/.test(line.trim())) bod.turn = 1;
    if (bod && /^(先手|下手)番/.test(line.trim())) bod.turn = 0;
  }
  if (bod && bodRank === 9) start = { board: bod.board, hands: bod.hands, turn: bod.turn };

  const b = new Builder(start);
  let endText: string | undefined;
  let ended = false;
  for (; i < lines.length && !ended && !b.stopped; i++) {
    const line = lines[i];
    if (/^変化[：:]/.test(line)) break; // 変化手順は読まない (本譜のみ)
    if (/^[#*&]/.test(line)) continue;
    const made = /^まで\d+手で(.+?)\s*$/.exec(line.trim());
    if (made) {
      if (!b.game.result && endText === undefined) endText = madeText(b, made[1]);
      break;
    }
    const tokens =
      format === 'KIF'
        ? [/^\s*\d+\s+(\S+)/.exec(line.replace(/同\s+/, '同'))?.[1] ?? '']
        : (line.replace(/同\s+/g, '同').match(/[▲△☗☖▽][^▲△☗☖▽\s]+/g) ?? []).map((s) => s.slice(1));
    for (const tok of tokens) {
      if (!tok) continue;
      const word = TERMINALS.find((w) => tok.startsWith(w));
      if (word) {
        endText = finish(b, word);
        ended = true;
        break;
      }
      if (!b.play(parseJapaneseMove(b.pos, b.prev, tok), tok)) break;
    }
  }
  return { format, game: b.game, info, endText, error: b.error };
}

/** KI2 の「まで77手で先手の勝ち」の後半 */
function madeText(b: Builder, rest: string): string | undefined {
  const win = /^(先手|後手|下手|上手)の勝ち$/.exec(rest);
  if (win) {
    const winner: Color = win[1] === '先手' || win[1] === '下手' ? 0 : 1;
    b.game = resign(b.game, opp(winner));
    return undefined;
  }
  const word = TERMINALS.find((w) => rest.startsWith(w));
  if (word) return finish(b, word);
  return rest;
}

// ---- CSA ----

const CSA_PIECE: Record<string, PieceType> = {
  FU: 'FU',
  KY: 'KY',
  KE: 'KE',
  GI: 'GI',
  KI: 'KI',
  KA: 'KA',
  HI: 'HI',
  OU: 'OU',
  TO: 'TO',
  NY: 'NY',
  NK: 'NK',
  NG: 'NG',
  UM: 'UM',
  RY: 'RY',
};

const CSA_END: Record<string, string> = {
  TORYO: '投了',
  TSUMI: '詰み',
  SENNICHITE: '千日手',
  JISHOGI: '持将棋',
  CHUDAN: '中断',
  TIME_UP: '時間切れ',
  KACHI: '入玉勝ち',
  ILLEGAL_MOVE: '反則負け',
};

/** "-7162GI" のような CSA の指し手 */
export function parseCsaMove(pos: Position, str: string): Move | null {
  const m = /^([+-])(\d)(\d)(\d)(\d)([A-Z]{2})/.exec(str);
  if (!m) return null;
  const type = CSA_PIECE[m[6]];
  if (!type || (m[1] === '+' ? 0 : 1) !== pos.turn) return null;
  const to = square(Number(m[4]), Number(m[5]));
  if (m[2] === '0') return HAND_TYPES.includes(type as HandType) ? { from: null, to, drop: type as HandType, promote: false } : null;
  const from = square(Number(m[2]), Number(m[3]));
  const p = pos.board[from];
  if (!p) return null;
  return { from, to, promote: p.type !== type };
}

const PIECE_TOTAL: Record<HandType, number> = { FU: 18, KY: 4, KE: 4, GI: 4, KI: 4, KA: 2, HI: 2 };

function parseCsa(text: string): Kifu {
  const stmts = text
    .split('\n')
    .flatMap((l) => (l.startsWith("'") ? [] : l.split(',')))
    .map((s) => s.trim())
    .filter(Boolean);
  const info: Kifu['info'] = [];
  let board: (Piece | null)[] | null = null;
  const hands: [Hand, Hand] = [emptyHand(), emptyHand()];
  let turn: Color = 0;
  let b: Builder | null = null;
  let endText: string | undefined;
  const startPos = (): Position => (board ? { board, hands, turn } : { ...initialPosition(), turn });

  for (const s of stmts) {
    if (b?.stopped) break;
    if (/^[+-]\d{4}/.test(s)) {
      b ??= new Builder(startPos());
      b.play(parseCsaMove(b.pos, s), s);
      continue;
    }
    if (s.startsWith('%')) {
      b ??= new Builder(startPos());
      const word = CSA_END[s.slice(1).replace(/^[+-]/, '')];
      if (word) endText = finish(b, word);
      break;
    }
    if (b) continue; // 指し手の後の時間 (T12) など
    if (s.startsWith('N+') || s.startsWith('N-')) {
      if (s.length > 2) info.push({ label: s[1] === '+' ? '先手' : '後手', value: s.slice(2) });
    } else if (s.startsWith('$EVENT:')) {
      info.push({ label: '棋戦', value: s.slice(7) });
    } else if (s.startsWith('$START_TIME:')) {
      info.push({ label: '開始日時', value: s.slice(12) });
    } else if (s.startsWith('PI')) {
      board = initialPosition().board;
      for (let k = 2; k + 4 <= s.length; k += 4) board[square(Number(s[k]), Number(s[k + 1]))] = null;
    } else if (/^P[1-9]/.test(s)) {
      board ??= Array(81).fill(null);
      const rank = Number(s[1]);
      for (let k = 0; k < 9; k++) {
        const cell = s.slice(2 + k * 3, 5 + k * 3);
        const type = CSA_PIECE[cell.slice(1)];
        board[square(9 - k, rank)] = type ? { type, color: cell[0] === '-' ? 1 : 0 } : null;
      }
    } else if (/^P[+-]/.test(s)) {
      board ??= Array(81).fill(null);
      const color: Color = s[1] === '+' ? 0 : 1;
      for (let k = 2; k + 4 <= s.length; k += 4) {
        const f = Number(s[k]);
        const r = Number(s[k + 1]);
        const code = s.slice(k + 2, k + 4);
        if (code === 'AL') {
          // 残りの駒をすべて持駒にする
          for (const h of HAND_TYPES) {
            let used = hands[0][h] + hands[1][h];
            for (const p of board) if (p && p.type !== 'OU' && (p.type === h || PROMOTE_BASE[p.type] === h)) used++;
            hands[color][h] += PIECE_TOTAL[h] - used;
          }
          continue;
        }
        const type = CSA_PIECE[code];
        if (!type) continue;
        if (f === 0) hands[color][type as HandType]++;
        else board[square(f, r)] = { type, color };
      }
    } else if (s === '+' || s === '-') {
      turn = s === '+' ? 0 : 1;
    }
  }
  b ??= new Builder(startPos());
  return { format: 'CSA', game: b.game, info, endText, error: b.error };
}

const PROMOTE_BASE: Partial<Record<PieceType, HandType>> = { TO: 'FU', NY: 'KY', NK: 'KE', NG: 'GI', UM: 'KA', RY: 'HI' };
