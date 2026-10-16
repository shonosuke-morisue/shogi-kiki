import { lazy, Suspense, useState } from 'react';
import { AiGame } from './modes/AiGame';
import { LocalGame } from './modes/LocalGame';
import { Replay } from './modes/Replay';
import type { Seat } from './online/firebase';
import type { AiLevel } from './shogi/ai';
import type { Color } from './shogi/types';

type Screen =
  | { kind: 'menu' }
  | { kind: 'local' }
  | { kind: 'ai'; human: Color; level: AiLevel }
  | { kind: 'lobby' }
  | { kind: 'online'; seat: Seat }
  | { kind: 'replay' };

// Firebase を含むオンライン対戦部分は使うときだけ読み込む
const OnlineLobby = lazy(() => import('./modes/Online').then((m) => ({ default: m.OnlineLobby })));
const OnlineGame = lazy(() => import('./modes/Online').then((m) => ({ default: m.OnlineGame })));

const initialRoom = new URLSearchParams(location.search).get('room');

export default function App() {
  const [screen, setScreen] = useState<Screen>(initialRoom ? { kind: 'lobby' } : { kind: 'menu' });
  const toMenu = () => {
    history.replaceState(null, '', location.pathname);
    setScreen({ kind: 'menu' });
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1 onClick={toMenu}>利き将棋</h1>
        {screen.kind !== 'menu' && (
          <button className="link" onClick={toMenu}>
            メニューへ戻る
          </button>
        )}
      </header>
      {screen.kind === 'menu' && <Menu onSelect={setScreen} />}
      {screen.kind === 'local' && <LocalGame />}
      {screen.kind === 'replay' && <Replay />}
      {screen.kind === 'ai' && <AiGame human={screen.human} level={screen.level} />}
      <Suspense fallback={<p className="center">読み込み中…</p>}>
        {screen.kind === 'lobby' && (
          <OnlineLobby initialRoom={new URLSearchParams(location.search).get('room')} onEnter={(seat) => setScreen({ kind: 'online', seat })} />
        )}
        {screen.kind === 'online' && <OnlineGame seat={screen.seat} />}
      </Suspense>
    </div>
  );
}

function Menu({ onSelect }: { onSelect: (s: Screen) => void }) {
  const [human, setHuman] = useState<Color>(0);
  const [level, setLevel] = useState<AiLevel>(2);
  return (
    <div className="menu">
      <p className="lead">盤上の各マスに、先手(青)・後手(赤)の駒が何枚利いているかを色の濃さで表示する将棋です。</p>

      <section className="card">
        <h2>AIと対戦</h2>
        <div className="field">
          <span>手番</span>
          <div className="seg">
            <button className={human === 0 ? 'on' : ''} onClick={() => setHuman(0)}>
              先手
            </button>
            <button className={human === 1 ? 'on' : ''} onClick={() => setHuman(1)}>
              後手
            </button>
          </div>
        </div>
        <div className="field">
          <span>強さ</span>
          <div className="seg">
            {(
              [
                [1, 'やさしい'],
                [2, 'ふつう'],
                [3, 'つよい'],
              ] as const
            ).map(([lv, label]) => (
              <button key={lv} className={level === lv ? 'on' : ''} onClick={() => setLevel(lv)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <button className="primary" onClick={() => onSelect({ kind: 'ai', human, level })}>
          対局開始
        </button>
      </section>

      <section className="card">
        <h2>オンライン対戦</h2>
        <p>部屋を作ってリンクを送るだけで、離れた相手と対局できます。</p>
        <button className="primary" onClick={() => onSelect({ kind: 'lobby' })}>
          部屋を作る・入る
        </button>
      </section>

      <section className="card">
        <h2>ふたりで対局</h2>
        <p>1台の端末で交互に指します。</p>
        <button className="primary" onClick={() => onSelect({ kind: 'local' })}>
          対局開始
        </button>
      </section>

      <section className="card">
        <h2>棋譜を再現</h2>
        <p>KIF・KI2・CSA 形式の棋譜を読み込んで、1手ずつ並べ直します。</p>
        <button className="primary" onClick={() => onSelect({ kind: 'replay' })}>
          棋譜を読み込む
        </button>
      </section>
    </div>
  );
}
