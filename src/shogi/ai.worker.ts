import { chooseMove } from './ai';
import type { AiLevel } from './ai';
import type { Position } from './types';

self.onmessage = (e: MessageEvent<{ id: number; pos: Position; level: AiLevel }>) => {
  const { id, pos, level } = e.data;
  self.postMessage({ id, move: chooseMove(pos, level) });
};
