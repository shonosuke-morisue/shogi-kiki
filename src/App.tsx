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

const params = new URLSearchParams(location.search);
const initialRoom = params.get('room');
const initialScreen: Screen = initialRoom ? { kind: 'lobby' } : params.get('mode') === 'replay' ? { kind: 'replay' } : { kind: 'menu' };

const REPO_URL = 'https://github.com/shonosuke-morisue/shogi-kiki';

/**
 * 棋譜再現モードを開く。評価値エンジンを動かすため、Service Worker を入れてから
 * ?mode=replay を付けて開き直し、そのページだけを cross-origin isolated にする (public/coi-sw.js)。
 */
async function openReplay(show: () => void) {
  if (!window.crossOriginIsolated && (await installIsolation())) {
    location.assign(`${location.pathname}?mode=replay`);
    return;
  }
  // Service Worker が使えなくても、評価値なしで棋譜再現はできる
  history.replaceState(null, '', `${location.pathname}?mode=replay`);
  show();
}

async function installIsolation(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  try {
    await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}coi-sw.js`, { scope: import.meta.env.BASE_URL });
    await navigator.serviceWorker.ready;
    return true;
  } catch {
    return false;
  }
}

// ?mode=replay を直接開いたが Service Worker がまだ入っていないときは、入れてから1度だけ開き直す
if (initialScreen.kind === 'replay' && !window.crossOriginIsolated) {
  const RETRY_KEY = 'shogi-kiki:isolation-retry';
  let retried = true;
  try {
    retried = sessionStorage.getItem(RETRY_KEY) === '1';
    sessionStorage.setItem(RETRY_KEY, '1');
  } catch {
    // 保存できない環境では開き直さない (無限に再読み込みしないように)
  }
  if (!retried) installIsolation().then((ok) => ok && location.reload());
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const toMenu = () => {
    // isolated なままだとオンライン対戦に影響しうるので、普通のページとして開き直す
    if (window.crossOriginIsolated) {
      location.assign(location.pathname);
      return;
    }
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
      {screen.kind === 'menu' && <Menu onSelect={(s) => (s.kind === 'replay' ? openReplay(() => setScreen(s)) : setScreen(s))} />}
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
        <p>KIF・KI2・CSA 形式の棋譜を読み込んで、1手ずつ並べ直します。将棋エンジンによる評価値も表示できます。</p>
        <button className="primary" onClick={() => onSelect({ kind: 'replay' })}>
          棋譜を読み込む
        </button>
      </section>

      <About />
    </div>
  );
}

function About() {
  return (
    <details className="about">
      <summary>このアプリについて・ライセンス</summary>
      <p>
        このアプリは GNU General Public License v3.0 (GPLv3) で公開しています。ソースコードは{' '}
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          GitHub
        </a>{' '}
        から入手でき、GPLv3 の条件のもとで自由に利用・改変・再配布できます。無保証です。
      </p>
      <p>評価値の計算には次のソフトウェアを使っています (エンジン本体は GPLv3)。</p>
      <ul>
        <li>
          <a href="https://github.com/yaneurao/YaneuraOu" target="_blank" rel="noreferrer">
            やねうら王 (YaneuraOu)
          </a>{' '}
          © yaneurao ほか
        </li>
        <li>
          <a href="https://github.com/mizar/YaneuraOu.wasm/tree/c9c34f240f89b611ca34060466e61220b0d3180c" target="_blank" rel="noreferrer">
            YaneuraOu.wasm
          </a>{' '}
          (WebAssembly 版, Mizar ほか, npm @mizarjp/yaneuraou.k-p 7.6.3-alpha.0) の改変なしのビルドを使用
        </li>
        <li>評価関数: 水匠ぷち (SuishoPetite) © たややん</li>
      </ul>
      <p>
        ライセンス全文はリポジトリの{' '}
        <a href={`${REPO_URL}/blob/main/LICENSE`} target="_blank" rel="noreferrer">
          LICENSE
        </a>{' '}
        をご覧ください。
      </p>
    </details>
  );
}
