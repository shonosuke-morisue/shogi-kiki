import { useState } from 'react';
import type { CSSProperties } from 'react';
import { PIECE_CHAR } from '../shogi/notation';
import type { Color, HandType, Move, Piece, Position } from '../shogi/types';
import { HAND_TYPES } from '../shogi/types';
import { kikiAlpha } from './kiki';

export type KikiMode = 'both' | 'sente' | 'gote' | 'off';

export type Selection = { kind: 'board'; sq: number } | { kind: 'hand'; type: HandType } | null;

interface Props {
  pos: Position;
  counts: [number[], number[]];
  kikiMode: KikiMode;
  showNumbers: boolean;
  /** 盤面の下側に来る手番 (後手で指すときは 1) */
  viewer: Color;
  selected: Selection;
  targets: Set<number>;
  /** 直前の指し手 (移動アニメーションと強調表示に使う) */
  lastMove: Move | null;
  /** これまでに指された手数。増えたときだけアニメーションする */
  moveCount: number;
  checkSq: number | null;
  /** 利いている駒を調べているマス */
  focusSq: number | null;
  /** focusSq に利いている駒のマス (先手・後手別) */
  attackers: [Set<number>, Set<number>];
  onSquareClick: (sq: number) => void;
  onHandClick: (color: Color, type: HandType) => void;
}

const FILE_LABEL = ['９', '８', '７', '６', '５', '４', '３', '２', '１'];
const RANK_LABEL = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

const SENTE_RGB = '20, 100, 255';
const GOTE_RGB = '220, 38, 38';


function kikiBackground(nSente: number, nGote: number, viewer: Color, mode: KikiMode): string | undefined {
  const layers: string[] = [];
  // 各陣営の色は自陣側から濃く、相手側へ薄くなるグラデーションで重ねる
  const layer = (rgb: string, n: number, fromBottom: boolean) => {
    const a = kikiAlpha(n);
    return `linear-gradient(${fromBottom ? 'to top' : 'to bottom'}, rgba(${rgb}, ${a}) 0%, rgba(${rgb}, ${a * 0.45}) 100%)`;
  };
  if ((mode === 'both' || mode === 'sente') && nSente > 0) layers.push(layer(SENTE_RGB, nSente, viewer === 0));
  if ((mode === 'both' || mode === 'gote') && nGote > 0) layers.push(layer(GOTE_RGB, nGote, viewer === 1));
  return layers.length ? layers.join(', ') : undefined;
}

/** 画面上の行・列 (盤面反転を考慮) */
const displayRC = (s: number, viewer: Color) => {
  const d = viewer === 0 ? s : 80 - s;
  return { row: Math.floor(d / 9), col: d % 9 };
};

/** 動かした駒が移動元 (駒打ちなら持ち駒の側) から滑ってくるための開始位置 (マス単位) */
function slideOffset(m: Move, viewer: Color, mover: Color): { x: number; y: number } {
  const to = displayRC(m.to, viewer);
  if (m.from === null) {
    // 自分の持ち駒は盤の下、相手の持ち駒は盤の上から
    return { x: 0, y: mover === viewer ? 9.6 - to.row : -1.6 - to.row };
  }
  const from = displayRC(m.from, viewer);
  return { x: from.col - to.col, y: from.row - to.row };
}

export function Board(props: Props) {
  const { pos, counts, kikiMode, showNumbers, viewer, selected, targets, lastMove, moveCount, checkSq, focusSq, attackers } = props;
  const lastTo = lastMove?.to ?? null;
  // 手数が増えたとき (指したとき・1手進めたとき) だけアニメーションし、戻したときは動かさない
  const [prevCount, setPrevCount] = useState(moveCount);
  const [animCount, setAnimCount] = useState(-1);
  if (moveCount !== prevCount) {
    setPrevCount(moveCount);
    setAnimCount(moveCount > prevCount ? moveCount : -1);
  }
  const animating = lastMove && animCount === moveCount ? lastMove : null;
  const mover: Color = pos.turn === 0 ? 1 : 0;
  const order = Array.from({ length: 81 }, (_, i) => (viewer === 0 ? i : 80 - i));
  const files = viewer === 0 ? FILE_LABEL : [...FILE_LABEL].reverse();
  const ranks = viewer === 0 ? RANK_LABEL : [...RANK_LABEL].reverse();
  const top: Color = viewer === 0 ? 1 : 0;

  return (
    <div className="board-area">
      <HandView {...props} color={top} />
      <div className="board-wrap">
        <div className="file-labels">
          {files.map((f) => (
            <span key={f}>{f}</span>
          ))}
        </div>
        <div className="board-row">
          <div className="board">
            {order.map((s) => {
              const p = pos.board[s];
              const nS = counts[0][s];
              const nG = counts[1][s];
              const style: CSSProperties = { backgroundImage: kikiBackground(nS, nG, viewer, kikiMode) };
              const cls = ['cell'];
              if (selected?.kind === 'board' && selected.sq === s) cls.push('selected');
              if (lastTo === s) cls.push('last');
              if (checkSq === s) cls.push('check');
              if (targets.has(s)) cls.push(p ? 'target capture' : 'target');
              if (focusSq === s) cls.push('focus');
              if (attackers[0].has(s)) cls.push('attacker sente');
              if (attackers[1].has(s)) cls.push('attacker gote');
              return (
                <button key={s} className={cls.join(' ')} style={style} onClick={() => props.onSquareClick(s)}>
                  {p && animating?.to === s ? (
                    <span
                      key={moveCount}
                      className="piece-slide"
                      style={(() => {
                        const o = slideOffset(animating, viewer, mover);
                        return { '--from-x': o.x, '--from-y': o.y } as CSSProperties;
                      })()}
                    >
                      <PieceGlyph type={p.type} color={p.color} viewer={viewer} />
                    </span>
                  ) : (
                    p && <PieceGlyph type={p.type} color={p.color} viewer={viewer} />
                  )}
                  {showNumbers && kikiMode !== 'off' && (
                    <>
                      {(kikiMode === 'both' || kikiMode === 'sente') && nS > 0 && (
                        <span className={`num sente ${viewer === 0 ? 'bl' : 'tr'}`}>{nS}</span>
                      )}
                      {(kikiMode === 'both' || kikiMode === 'gote') && nG > 0 && (
                        <span className={`num gote ${viewer === 1 ? 'bl' : 'tr'}`}>{nG}</span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
          <div className="rank-labels">
            {ranks.map((r) => (
              <span key={r}>{r}</span>
            ))}
          </div>
        </div>
      </div>
      <HandView {...props} color={viewer} />
    </div>
  );
}

const isPromoted = (t: string) => ['TO', 'NY', 'NK', 'NG', 'UM', 'RY'].includes(t);

function PieceGlyph({ type, color, viewer }: { type: Piece['type']; color: Color; viewer: Color }) {
  return (
    <span className={`piece ${color !== viewer ? 'flip' : ''} ${isPromoted(type) ? 'promoted' : ''}`}>
      {type === 'OU' && color === 1 ? '王' : PIECE_CHAR[type]}
    </span>
  );
}

function HandView(props: Props & { color: Color }) {
  const { pos, color, selected } = props;
  const hand = pos.hands[color];
  const items = HAND_TYPES.filter((h) => hand[h] > 0);
  return (
    <div className={`hand ${color === props.viewer ? 'mine' : 'theirs'}`}>
      <span className="hand-label">{color === 0 ? '☗先手' : '☖後手'}</span>
      {items.length === 0 && <span className="hand-empty">持ち駒なし</span>}
      {items.map((h) => {
        const active = selected?.kind === 'hand' && selected.type === h && pos.turn === color;
        return (
          <button key={h} className={`hand-piece ${active ? 'selected' : ''}`} onClick={() => props.onHandClick(color, h)}>
            <span className={`piece ${color !== props.viewer ? 'flip' : ''}`}>{PIECE_CHAR[h]}</span>
            {hand[h] > 1 && <span className="hand-count">{hand[h]}</span>}
          </button>
        );
      })}
    </div>
  );
}
