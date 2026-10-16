import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { currentPosition, resultText } from '../shogi/game';
import type { GameState } from '../shogi/game';
import { PIECE_CHAR, squareName } from '../shogi/notation';
import { attackCounts, attackersOf, findKing, inCheck, legalMoves } from '../shogi/rules';
import type { Color, HandType, Move } from '../shogi/types';
import { PROMOTE } from '../shogi/types';
import { Board } from './Board';
import { kikiAlpha } from './kiki';
import type { KikiMode, Selection } from './Board';

interface Props {
  game: GameState;
  /** この画面の利用者が動かせる手番 */
  controls: Color[];
  /** at は指した局面の手数。過去の局面で指したときは、それ以降の棋譜を消して分岐させる */
  onMove: (m: Move, at: number) => void;
  /** 過去の局面からでも指せるか (false なら戻る・進むは閲覧のみ) */
  allowBranch?: boolean;
  initialViewer?: Color;
  /** 状況表示の上書き (AI 思考中・相手待ちなど) */
  status?: ReactNode;
  actions?: ReactNode;
  /** 最初に表示する手数 (省略時は最新の局面) */
  initialView?: number;
  /** サイドパネルの先頭に出す内容 (棋譜の対局者名など) */
  info?: ReactNode;
}

export function GameView({ game, controls, onMove, allowBranch = true, initialViewer = 0, status, actions, initialView, info }: Props) {
  const total = game.moves.length;
  // 表示している手数。null のときは常に最新の局面を表示する
  const [view, setView] = useState<number | null>(initialView ?? null);
  // 「最初から」などで棋譜が短くなったら最新表示に戻す
  if (view !== null && view >= total) setView(null);
  const idx = view === null || view >= total ? total : view;
  const atLatest = idx === total;
  const pos = atLatest ? currentPosition(game) : game.positions[idx];
  const result = atLatest ? game.result : null;
  const [selected, setSelected] = useState<Selection>(null);
  const [promotion, setPromotion] = useState<{ promote: Move; stay: Move } | null>(null);
  const [kikiMode, setKikiMode] = useState<KikiMode>('both');
  const [showNumbers, setShowNumbers] = useState(true);
  const [viewer, setViewer] = useState<Color>(initialViewer);
  // 利いている駒を調べるマス。局面が変わったら解除する
  const [focus, setFocus] = useState<{ sq: number; moveCount: number } | null>(null);
  const focusSq = focus && focus.moveCount === idx ? focus.sq : null;

  const counts = useMemo(() => attackCounts(pos.board), [pos]);
  const moves = useMemo(() => (result ? [] : legalMoves(pos)), [pos, result]);
  const myTurn = !result && controls.includes(pos.turn) && (atLatest || allowBranch);

  const candidates = useMemo(() => {
    if (!selected) return [];
    return moves.filter((m) =>
      selected.kind === 'board' ? m.from === selected.sq : m.from === null && m.drop === selected.type,
    );
  }, [moves, selected]);
  const targets = useMemo(() => new Set(candidates.map((m) => m.to)), [candidates]);
  const attackers = useMemo((): [Set<number>, Set<number>] => {
    if (focusSq === null) return [new Set(), new Set()];
    const [s, g] = attackersOf(pos.board, focusSq);
    return [new Set(s), new Set(g)];
  }, [pos, focusSq]);

  const play = (m: Move) => {
    setSelected(null);
    setPromotion(null);
    setView(null);
    onMove(m, idx);
  };

  const goTo = (n: number) => {
    setSelected(null);
    setPromotion(null);
    setView(n >= total ? null : Math.max(0, n));
  };

  // キーボードの ← → でも1手ずつ動かす
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === 'ArrowLeft' && idx > 0) goTo(idx - 1);
      else if (e.key === 'ArrowRight' && !atLatest) goTo(idx + 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onSquareClick = (s: number) => {
    if (myTurn && targets.has(s)) {
      const ms = candidates.filter((m) => m.to === s);
      const promote = ms.find((m) => m.promote);
      const stay = ms.find((m) => !m.promote);
      if (promote && stay) setPromotion({ promote, stay });
      else play(ms[0]);
      return;
    }
    // クリックしたマスに利いている駒を強調する (同じマスをもう一度押すと解除)
    const again = focusSq === s;
    setFocus(again ? null : { sq: s, moveCount: idx });
    // 自分が動かせる駒なら、あわせて選択して移動先も表示する
    const p = pos.board[s];
    setSelected(!again && myTurn && p && p.color === pos.turn ? { kind: 'board', sq: s } : null);
  };

  const onHandClick = (color: Color, type: HandType) => {
    if (!myTurn || color !== pos.turn) return;
    setFocus(null);
    setSelected(selected?.kind === 'hand' && selected.type === type ? null : { kind: 'hand', type });
  };

  const last = idx ? game.moves[idx - 1] : null;
  const checked = !result && inCheck(pos);
  const turnName = pos.turn === 0 ? '☗先手' : '☖後手';

  let statusText: ReactNode = status;
  if (!atLatest) {
    statusText = `${idx}手目の局面を表示しています`;
    if (!allowBranch && controls.length) statusText += ' (最新の局面に戻ると指せます)';
  } else if (result) statusText = resultText(result);
  else if (!statusText) statusText = `${turnName}の手番です`;

  const promotingPiece = promotion?.promote.from != null ? pos.board[promotion.promote.from] : null;

  return (
    <div className="game">
      <div className="game-main">
        <div className={`status ${result ? 'over' : ''}`}>
          {statusText}
          {checked && <span className="check-badge">王手</span>}
        </div>
        <Board
          pos={pos}
          counts={counts}
          kikiMode={kikiMode}
          showNumbers={showNumbers}
          viewer={viewer}
          selected={selected}
          targets={targets}
          lastMove={last}
          moveCount={idx}
          checkSq={checked ? findKing(pos.board, pos.turn) : null}
          focusSq={focusSq}
          attackers={attackers}
          onSquareClick={onSquareClick}
          onHandClick={onHandClick}
        />
        <div className="nav">
          <button disabled={idx === 0} onClick={() => goTo(0)} title="開始局面へ">
            ⏮
          </button>
          <button disabled={idx === 0} onClick={() => goTo(idx - 1)}>
            ◀ 1手戻る
          </button>
          <span className="nav-count">
            {idx} / {total}手
          </span>
          <button disabled={atLatest} onClick={() => goTo(idx + 1)}>
            1手進む ▶
          </button>
          <button disabled={atLatest} onClick={() => goTo(total)} title="最新の局面へ">
            ⏭
          </button>
        </div>
      </div>

      <aside className="side">
        {info}
        <section className="panel">
          <h3>利きの表示</h3>
          <div className="seg">
            {(
              [
                ['both', '両方'],
                ['sente', '先手'],
                ['gote', '後手'],
                ['off', 'なし'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} className={kikiMode === k ? 'on' : ''} onClick={() => setKikiMode(k)}>
                {label}
              </button>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" checked={showNumbers} onChange={(e) => setShowNumbers(e.target.checked)} />
            利きの数を数字でも表示
          </label>
          <Legend />
        </section>

        <section className="panel">
          <h3>マスに利いている駒</h3>
          {focusSq === null ? (
            <p className="focus-note">盤上のマスをクリックすると、そこに利いている駒を強調します。</p>
          ) : (
            <div className="focus-info">
              <span className="focus-sq">{squareName(focusSq)}</span>
              <span className="focus-count sente">☗先手 {attackers[0].size}枚</span>
              <span className="focus-count gote">☖後手 {attackers[1].size}枚</span>
              <button onClick={() => setFocus(null)}>解除</button>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="buttons">
            <button onClick={() => setViewer(viewer === 0 ? 1 : 0)}>盤面を反転</button>
            {actions}
          </div>
        </section>

        <section className="panel">
          <h3>棋譜</h3>
          <ol className="kifu">
            {game.notation.map((n, i) => (
              <li key={i}>
                <button className={i + 1 === idx ? 'current' : ''} onClick={() => goTo(i + 1)}>
                  <span className="kifu-no">{i + 1}</span>
                  {n}
                </button>
              </li>
            ))}
          </ol>
        </section>
      </aside>

      {promotion && (
        <div className="modal-bg" onClick={() => setPromotion(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p>成りますか?</p>
            <div className="promo-choices">
              <button onClick={() => play(promotion.promote)}>
                <span className="piece promoted">{promotingPiece && PIECE_CHAR[PROMOTE[promotingPiece.type]!]}</span>
                成る
              </button>
              <button onClick={() => play(promotion.stay)}>
                <span className="piece">{promotingPiece && PIECE_CHAR[promotingPiece.type]}</span>
                成らない
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Legend() {
  const steps = [1, 2, 3, 4, 5];
  return (
    <div className="legend">
      {(
        [
          ['先手', '20, 100, 255'],
          ['後手', '220, 38, 38'],
        ] as const
      ).map(([name, rgb]) => (
        <div key={name} className="legend-row">
          <span className="legend-name">{name}</span>
          {steps.map((n) => (
            <span key={n} className="legend-cell" style={{ backgroundImage: `linear-gradient(rgba(${rgb}, ${kikiAlpha(n)}), rgba(${rgb}, ${kikiAlpha(n)}))` }}>
              {n === 5 ? '5+' : n}
            </span>
          ))}
        </div>
      ))}
      <p className="legend-note">色が濃いマスほど、多くの駒が利いています。</p>
    </div>
  );
}
