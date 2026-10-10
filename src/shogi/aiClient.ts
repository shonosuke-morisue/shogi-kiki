import type { AiLevel } from './ai';
import type { Move, Position } from './types';

let worker: Worker | null = null;
let nextId = 0;

/** 別スレッド (Web Worker) で AI の指し手を考える */
export function thinkInWorker(pos: Position, level: AiLevel): Promise<Move | null> {
  worker ??= new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' });
  const id = ++nextId;
  const w = worker;
  return new Promise((resolve) => {
    const onMessage = (e: MessageEvent<{ id: number; move: Move | null }>) => {
      if (e.data.id !== id) return;
      w.removeEventListener('message', onMessage);
      resolve(e.data.move);
    };
    w.addEventListener('message', onMessage);
    w.postMessage({ id, pos, level });
  });
}
