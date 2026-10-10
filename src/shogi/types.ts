/** 0 = 先手 (下側・上に向かって進む), 1 = 後手 */
export type Color = 0 | 1;

export type HandType = 'FU' | 'KY' | 'KE' | 'GI' | 'KI' | 'KA' | 'HI';
export type PieceType = HandType | 'OU' | 'TO' | 'NY' | 'NK' | 'NG' | 'UM' | 'RY';

export interface Piece {
  type: PieceType;
  color: Color;
}

export type Hand = Record<HandType, number>;

export interface Position {
  /** 81マス。添字 = y * 9 + x。x=0 が9筋(先手から見て左)、y=0 が一段目(上) */
  board: (Piece | null)[];
  hands: [Hand, Hand];
  turn: Color;
}

export interface Move {
  /** 盤上の移動元。駒打ちの場合は null */
  from: number | null;
  to: number;
  /** 駒打ちの駒種 */
  drop?: HandType;
  promote: boolean;
}

export const HAND_TYPES: HandType[] = ['HI', 'KA', 'KI', 'GI', 'KE', 'KY', 'FU'];

export const PROMOTE: Partial<Record<PieceType, PieceType>> = {
  FU: 'TO',
  KY: 'NY',
  KE: 'NK',
  GI: 'NG',
  KA: 'UM',
  HI: 'RY',
};

export const UNPROMOTE: Record<PieceType, HandType | 'OU'> = {
  FU: 'FU',
  KY: 'KY',
  KE: 'KE',
  GI: 'GI',
  KI: 'KI',
  KA: 'KA',
  HI: 'HI',
  OU: 'OU',
  TO: 'FU',
  NY: 'KY',
  NK: 'KE',
  NG: 'GI',
  UM: 'KA',
  RY: 'HI',
};
