import { sqX, sqY } from './rules';
import type { Move, PieceType, Position } from './types';

export const PIECE_CHAR: Record<PieceType, string> = {
  FU: '歩',
  KY: '香',
  KE: '桂',
  GI: '銀',
  KI: '金',
  KA: '角',
  HI: '飛',
  OU: '玉',
  TO: 'と',
  NY: '杏',
  NK: '圭',
  NG: '全',
  UM: '馬',
  RY: '龍',
};

const NOTATION_NAME: Record<PieceType, string> = {
  ...PIECE_CHAR,
  NY: '成香',
  NK: '成桂',
  NG: '成銀',
};

const FILE = ['', '１', '２', '３', '４', '５', '６', '７', '８', '９'];
const RANK = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

/** 例: ▲７六歩、△同角成、▲５五角打 (pos は指す前の局面) */
export function moveToJapanese(pos: Position, m: Move, prev: Move | null): string {
  const mark = pos.turn === 0 ? '▲' : '△';
  const dest = prev && prev.to === m.to ? '同' : `${FILE[9 - sqX(m.to)]}${RANK[sqY(m.to)]}`;
  if (m.from === null) return `${mark}${dest}${NOTATION_NAME[m.drop!]}打`;
  const p = pos.board[m.from]!;
  let suffix = '';
  if (m.promote) suffix = '成';
  else if (['FU', 'KY', 'KE', 'GI', 'KA', 'HI'].includes(p.type) && canPromoteHere(pos, m)) suffix = '不成';
  return `${mark}${dest}${NOTATION_NAME[p.type]}${suffix}`;
}

function canPromoteHere(pos: Position, m: Move): boolean {
  const zone = (y: number) => (pos.turn === 0 ? y <= 2 : y >= 6);
  return zone(sqY(m.from!)) || zone(sqY(m.to));
}
