import { useEffect, useMemo, useState } from 'react';
import { legalMoves, toSfen } from '../shogi/rules';
import type { Position } from '../shogi/types';
import { engineSupported, getEngine } from './engine';
import type { AnalysisRequest } from './engine';
import type { Analysis } from './usi';
import { judgement, pvToJapanese, scoreText, senteRate } from './usi';

/** sfen はどの局面の結果か (局面が変わったら古い結果は表示しない) */
type State =
  | { kind: 'error'; message: string }
  | { kind: 'thinking' | 'done'; sfen: string; result: Analysis | null };

/** 表示中の局面の評価値 (棋譜再現モード専用) */
export function EvalPanel({ pos, enabled, onToggle }: { pos: Position; enabled: boolean; onToggle: (on: boolean) => void }) {
  const supported = engineSupported();
  const [state, setState] = useState<State | null>(null);
  const [ready, setReady] = useState(false);
  const sfen = toSfen(pos);
  const mated = useMemo(() => legalMoves(pos).length === 0, [pos]);

  useEffect(() => {
    if (!enabled || !supported || mated) return;
    let alive = true;
    let cancel = () => {};
    getEngine().then(
      (engine) => {
        if (!alive) return;
        setReady(true);
        const req: AnalysisRequest = {
          sfen,
          turn: pos.turn,
          onInfo: (a) => alive && setState({ kind: 'thinking', sfen, result: a }),
          onDone: () => alive && setState((s) => ({ kind: 'done', sfen, result: s && s.kind !== 'error' && s.sfen === sfen ? s.result : null })),
        };
        engine.analyze(req);
        cancel = () => engine.cancel(req);
      },
      (e: Error) => alive && setState({ kind: 'error', message: e.message }),
    );
    return () => {
      alive = false;
      cancel();
    };
  }, [sfen, pos.turn, enabled, supported, mated]);

  let body;
  if (!enabled) body = <p className="focus-note">オンにすると、表示中の局面を将棋エンジンが読んで評価値を出します。</p>;
  else if (!supported)
    body = <p className="focus-note">このブラウザでは評価値を計算できません (最新の Chrome・Edge・Firefox・Safari でお試しください)。</p>;
  else if (mated) body = <p className="focus-note">詰んでいる局面です。</p>;
  else if (state?.kind === 'error') body = <p className="error">エンジンを起動できませんでした: {state.message}</p>;
  else if (!ready) body = <p className="focus-note">エンジンを読み込んでいます…</p>;
  else {
    const current = state && state.sfen === sfen ? state : null;
    body = <EvalResult pos={pos} result={current?.result ?? null} thinking={current?.kind !== 'done'} />;
  }

  return (
    <section className="panel">
      <h3>評価値</h3>
      <label className="check">
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
        評価値を表示する
      </label>
      {body}
    </section>
  );
}

function EvalResult({ pos, result, thinking }: { pos: Position; result: Analysis | null; thinking: boolean }) {
  if (!result) return <p className="focus-note">考えています…</p>;
  const rate = senteRate(result.score);
  const pv = pvToJapanese(pos, result.pv);
  return (
    <div className="eval">
      <div className="eval-head">
        <span className="eval-score">{scoreText(result.score)}</span>
        <span className="eval-judge">{judgement(result.score)}</span>
      </div>
      <div className="eval-bar" role="img" aria-label={`先手の勝ちやすさ ${Math.round(rate * 100)}%`}>
        <span className="eval-bar-sente" style={{ width: `${rate * 100}%` }} />
      </div>
      <div className="eval-bar-labels">
        <span className="sente">☗先手</span>
        <span className="gote">☖後手</span>
      </div>
      {pv.length > 0 && (
        <p className="eval-pv">
          <span className="eval-label">読み筋</span>
          {pv.join(' ')}
        </p>
      )}
      <p className="eval-meta">
        深さ {result.depth} まで読みました{thinking ? ' (読み中…)' : ''}・評価値は先手から見た値です
      </p>
    </div>
  );
}
