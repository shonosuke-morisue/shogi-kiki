import type { Analysis } from './usi';
import { parseInfo } from './usi';
import type { Color } from '../shogi/types';

/**
 * 評価値エンジン (やねうら王 WebAssembly 版, GPLv3)。
 * SharedArrayBuffer を使うため、ページが cross-origin isolated のときだけ動く。
 */

interface EngineModule {
  addMessageListener: (listener: (line: string) => void) => void;
  postMessage: (command: string) => void;
}

declare global {
  interface Window {
    YaneuraOu_K_P?: (opts?: object) => Promise<EngineModule>;
  }
}

const ENGINE_DIR = `${import.meta.env.BASE_URL}engine/`;
const SCRIPT = 'yaneuraou.k-p.js';
/** 1局面あたりの思考時間 (ミリ秒) */
const THINK_MS = 1500;

export const engineSupported = () =>
  typeof SharedArrayBuffer !== 'undefined' && window.crossOriginIsolated === true && typeof WebAssembly === 'object';

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`${src} を読み込めませんでした`));
    document.head.appendChild(el);
  });
}

interface Request {
  sfen: string;
  turn: Color;
  onInfo: (a: Analysis) => void;
  onDone: () => void;
}

class Engine {
  private mod: EngineModule;
  /** 探索中のリクエスト (bestmove が返るまで) */
  private running: Request | null = null;
  /** 探索中に来た次のリクエスト。最新の1件だけ残す */
  private pending: Request | null = null;

  constructor(mod: EngineModule) {
    this.mod = mod;
    mod.addMessageListener((line) => this.onLine(line));
  }

  analyze(req: Request) {
    if (this.running) {
      this.pending = req;
      this.mod.postMessage('stop');
    } else this.start(req);
  }

  /** 表示中の局面の探索をやめる (画面を離れたとき) */
  cancel(req: Request) {
    if (this.pending === req) this.pending = null;
    if (this.running === req) this.mod.postMessage('stop');
  }

  private start(req: Request) {
    this.running = req;
    this.mod.postMessage(`position sfen ${req.sfen}`);
    this.mod.postMessage(`go movetime ${THINK_MS}`);
  }

  private onLine(line: string) {
    const req = this.running;
    if (!req) return;
    if (line.startsWith('bestmove')) {
      this.running = null;
      // 打ち切られた探索の完了は知らせない (次の局面に移っているため)
      if (!this.pending) req.onDone();
      const next = this.pending;
      this.pending = null;
      if (next) this.start(next);
      return;
    }
    // 次の局面が待っているときは古い局面の途中経過を出さない
    if (this.pending) return;
    const a = parseInfo(line, req.turn);
    if (a) req.onInfo(a);
  }
}

let enginePromise: Promise<Engine> | null = null;

function waitFor(mod: EngineModule, command: string, reply: string): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    mod.addMessageListener((line) => {
      if (!done && line.startsWith(reply)) {
        done = true;
        resolve();
      }
    });
    mod.postMessage(command);
  });
}

async function boot(): Promise<Engine> {
  if (!engineSupported()) throw new Error('unsupported');
  if (!window.YaneuraOu_K_P) await loadScript(ENGINE_DIR + SCRIPT);
  const mod = await window.YaneuraOu_K_P!({
    locateFile: (file: string) => ENGINE_DIR + file,
    mainScriptUrlOrBlob: ENGINE_DIR + SCRIPT,
  });
  await waitFor(mod, 'usi', 'usiok');
  // 既定の置換表 1GB はスマホでは大きすぎるので小さくする
  mod.postMessage('setoption name USI_Hash value 64');
  const threads = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
  mod.postMessage(`setoption name Threads value ${threads}`);
  mod.postMessage('setoption name PvInterval value 300');
  // 時間ぎりぎりまで考えるよう、通信遅延の見込みをなくす
  mod.postMessage('setoption name NetworkDelay value 0');
  mod.postMessage('setoption name NetworkDelay2 value 0');
  mod.postMessage('setoption name MinimumThinkingTime value 1000');
  await waitFor(mod, 'isready', 'readyok');
  mod.postMessage('usinewgame');
  return new Engine(mod);
}

/** エンジンを用意する (初回だけダウンロードと初期化が走る) */
export function getEngine(): Promise<Engine> {
  enginePromise ??= boot().catch((e) => {
    enginePromise = null;
    throw e;
  });
  return enginePromise;
}

export type { Engine, Request as AnalysisRequest };
