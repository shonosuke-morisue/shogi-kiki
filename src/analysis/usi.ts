import { fromUsi, legalMoves, makeMove, toUsi } from '../shogi/rules';
import { moveToJapanese } from '../shogi/notation';
import type { Color, Move, Position } from '../shogi/types';

/** 評価値。先手から見た値に揃えてある */
export type Score = { kind: 'cp'; value: number } | { kind: 'mate'; plies: number };

export interface Analysis {
  depth: number;
  score: Score;
  /** 読み筋 (USI 形式) */
  pv: string[];
}

/**
 * エンジンの "info depth 12 ... score cp 34 ... pv 7g7f 3c3d" を読む。
 * エンジンは手番側から見た値を返すので、先手から見た値に直す。
 */
export function parseInfo(line: string, turn: Color): Analysis | null {
  const t = line.trim().split(/\s+/);
  if (t[0] !== 'info') return null;
  const at = (key: string) => t.indexOf(key);
  const d = at('depth');
  const s = at('score');
  if (d < 0 || s < 0) return null;
  // "score cp 34 lowerbound" のような途中経過は表示が揺れるので使わない
  if (t[s + 3] === 'lowerbound' || t[s + 3] === 'upperbound') return null;
  const sign = turn === 0 ? 1 : -1;
  let score: Score;
  if (t[s + 1] === 'cp') score = { kind: 'cp', value: sign * Number(t[s + 2]) };
  else if (t[s + 1] === 'mate') {
    // "mate +" / "mate -" は手数不明の詰み
    const raw = t[s + 2];
    const n = raw === '+' || raw === '-' ? (raw === '+' ? 1 : -1) * 9999 : Number(raw);
    score = { kind: 'mate', plies: sign * n };
  } else return null;
  const p = at('pv');
  return { depth: Number(t[d + 1]), score, pv: p < 0 ? [] : t.slice(p + 1) };
}

/** 読み筋を日本語表記にする。合法手でなくなったところで打ち切る */
export function pvToJapanese(pos: Position, pv: string[], limit = 8): string[] {
  const out: string[] = [];
  let prev: Move | null = null;
  for (const s of pv.slice(0, limit)) {
    let m: Move;
    try {
      m = fromUsi(s);
    } catch {
      break;
    }
    const legal = legalMoves(pos).find((x) => toUsi(x) === toUsi(m));
    if (!legal) break;
    out.push(moveToJapanese(pos, legal, prev));
    pos = makeMove(pos, legal);
    prev = legal;
  }
  return out;
}

/** 表示用の文字列。例: +123、-45、先手勝ち (5手詰) */
export function scoreText(s: Score): string {
  if (s.kind === 'mate') {
    const side = s.plies > 0 ? '先手' : '後手';
    const n = Math.abs(s.plies);
    return n >= 9999 ? `${side}勝ち (詰みあり)` : `${side}勝ち (${n}手詰)`;
  }
  return s.value > 0 ? `+${s.value}` : `${s.value}`;
}

/** 形勢の言葉。将棋ソフトでよく使われる目安に合わせている */
export function judgement(s: Score): string {
  if (s.kind === 'mate') return s.plies > 0 ? '先手勝ち' : '後手勝ち';
  const v = Math.abs(s.value);
  const side = s.value > 0 ? '先手' : '後手';
  if (v < 300) return '互角';
  if (v < 800) return `${side}有利`;
  if (v < 2000) return `${side}優勢`;
  return `${side}勝勢`;
}

/** 評価値バーで先手側が占める割合 (0〜1)。±2000 付近でほぼ端に寄る */
export function senteRate(s: Score): number {
  if (s.kind === 'mate') return s.plies > 0 ? 1 : 0;
  return 1 / (1 + Math.exp(-s.value / 600));
}
