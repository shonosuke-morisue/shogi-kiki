import type { CSSProperties } from 'react';
import { PIECE_CHAR } from '../shogi/notation';
import type { Color, HandType, Position } from '../shogi/types';
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
  lastTo: number | null;
  checkSq: number | null;
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

export function Board(props: Props) {
  const { pos, counts, kikiMode, showNumbers, viewer, selected, targets, lastTo, checkSq } = props;
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
              return (
                <button key={s} className={cls.join(' ')} style={style} onClick={() => props.onSquareClick(s)}>
                  {p && (
                    <span className={`piece ${p.color !== viewer ? 'flip' : ''} ${isPromoted(p.type) ? 'promoted' : ''}`}>
                      {p.type === 'OU' && p.color === 1 ? '王' : PIECE_CHAR[p.type]}
                    </span>
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
