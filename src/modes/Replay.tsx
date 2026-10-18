import { useState } from 'react';
import type { DragEvent } from 'react';
import { EvalPanel } from '../analysis/EvalPanel';
import { GameView } from '../components/GameView';
import { decodeKifu, parseKifu } from '../shogi/kifu';
import type { Kifu } from '../shogi/kifu';

export function Replay() {
  const [kifu, setKifu] = useState<Kifu | null>(null);
  // 読み込むたびに GameView を作り直して開始局面から表示する
  const [loadCount, setLoadCount] = useState(0);
  const [evalOn, setEvalOn] = useState(loadEvalSetting);
  const toggleEval = (on: boolean) => {
    setEvalOn(on);
    try {
      localStorage.setItem(EVAL_KEY, on ? '1' : '0');
    } catch {
      // 保存できなくても表示の切り替えはできる
    }
  };

  const load = (k: Kifu) => {
    setKifu(k);
    setLoadCount((n) => n + 1);
  };

  if (!kifu) return <KifuLoader onLoad={load} />;

  const empty = kifu.game.moves.length === 0;
  return (
    <GameView
      key={loadCount}
      game={kifu.game}
      controls={[]}
      onMove={() => {}}
      allowBranch={false}
      initialView={empty ? undefined : 0}
      status={kifu.endText}
      info={
        <section className="panel">
          <h3>棋譜の情報 ({kifu.format})</h3>
          {kifu.info.length > 0 && (
            <dl className="kifu-info">
              {kifu.info.map((r, i) => (
                <div key={i}>
                  <dt>{r.label}</dt>
                  <dd>{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {kifu.error && <p className="error">{kifu.error}</p>}
          {empty && !kifu.error && <p className="focus-note">指し手が見つかりませんでした。</p>}
          <p className="focus-note">◀ ▶ ボタンか、キーボードの ← → で1手ずつ進められます。</p>
        </section>
      }
      renderPanel={(pos) => <EvalPanel pos={pos} enabled={evalOn} onToggle={toggleEval} />}
      actions={<button onClick={() => setKifu(null)}>別の棋譜を読み込む</button>}
    />
  );
}

const EVAL_KEY = 'shogi-kiki:eval';

function loadEvalSetting(): boolean {
  try {
    return localStorage.getItem(EVAL_KEY) !== '0';
  } catch {
    return true;
  }
}

function KifuLoader({ onLoad }: { onLoad: (k: Kifu) => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const tryParse = (t: string, fileName?: string) => {
    if (!t.trim()) {
      setError('棋譜が空です。');
      return;
    }
    const k = parseKifu(t, fileName);
    if (k.game.moves.length === 0 && k.error) setError(k.error);
    else onLoad(k);
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    tryParse(decodeKifu(await file.arrayBuffer()), file.name);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    readFile(e.dataTransfer.files[0]);
  };

  return (
    <div className="menu" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <section className="card">
        <h2>棋譜ファイルを開く</h2>
        <p>KIF・KI2・CSA 形式に対応しています。ファイルをここにドラッグしても読み込めます。</p>
        <input type="file" accept=".kif,.kifu,.ki2,.ki2u,.csa,.txt" onChange={(e) => readFile(e.target.files?.[0])} />
      </section>
      <section className="card">
        <h2>棋譜を貼り付ける</h2>
        <textarea
          className="kifu-text"
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'例:\n▲７六歩 △３四歩 ▲２六歩 △８四歩'}
        />
        <button className="primary" onClick={() => tryParse(text)}>
          読み込む
        </button>
      </section>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
