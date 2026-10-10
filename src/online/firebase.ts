import { initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { connectDatabaseEmulator, get, getDatabase, onValue, ref, runTransaction, serverTimestamp, set } from 'firebase/database';
import type { Color } from '../shogi/types';

// 設定値は .env.local (Git 管理外) またはビルド時の環境変数から読み込む
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const onlineConfigured = !!(config.apiKey && config.databaseURL);

// 開発時に Firebase Emulator Suite へ接続する場合は VITE_FIREBASE_EMULATOR=1 を指定する
const useEmulator = import.meta.env.VITE_FIREBASE_EMULATOR === '1';

let app: FirebaseApp | null = null;
function getApp(): FirebaseApp {
  if (app) return app;
  app = initializeApp(config);
  if (useEmulator) {
    connectAuthEmulator(getAuth(app), 'http://127.0.0.1:9099', { disableWarnings: true });
    connectDatabaseEmulator(getDatabase(app), '127.0.0.1', 9000);
  }
  return app;
}
const db = () => getDatabase(getApp());

// 同時に呼ばれても匿名ログインは1回だけ行う
let uidPromise: Promise<string> | null = null;
const myUid = () => (uidPromise ??= signInAnonymously(getAuth(getApp())).then((c) => c.user.uid));

export interface RoomState {
  sente: string | null;
  gote: string | null;
  moves: string[];
  /** 投了した側 */
  resigned: Color | null;
}

export interface Seat {
  roomId: string;
  uid: string;
  /** 自分の手番の色。観戦者なら null */
  color: Color | null;
}

const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomRoomId = () =>
  Array.from({ length: 6 }, () => ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)]).join('');

const seatKey = (c: Color) => (c === 0 ? 'sente' : 'gote');

export async function createRoom(color: Color): Promise<Seat> {
  const uid = await myUid();
  for (;;) {
    const roomId = randomRoomId();
    const r = ref(db(), `rooms/${roomId}`);
    if ((await get(r)).exists()) continue;
    await set(r, { createdAt: serverTimestamp(), [seatKey(color)]: uid });
    return { roomId, uid, color };
  }
}

export async function joinRoom(roomId: string): Promise<Seat> {
  const uid = await myUid();
  const snap = await get(ref(db(), `rooms/${roomId}`));
  if (!snap.exists()) throw new Error('部屋が見つかりません');
  for (const c of [0, 1] as const) {
    if (snap.child(seatKey(c)).val() === uid) return { roomId, uid, color: c };
  }
  for (const c of [0, 1] as const) {
    if (snap.child(seatKey(c)).exists()) continue;
    const res = await runTransaction(ref(db(), `rooms/${roomId}/${seatKey(c)}`), (cur) =>
      cur === null || cur === uid ? uid : undefined,
    );
    if (res.committed) return { roomId, uid, color: c };
  }
  // 席が埋まっていれば観戦
  return { roomId, uid, color: null };
}

export function watchRoom(roomId: string, cb: (s: RoomState) => void): () => void {
  return onValue(ref(db(), `rooms/${roomId}`), (snap) => {
    const v = snap.val() ?? {};
    const raw = v.moves ?? {};
    const moves = Object.keys(raw)
      .map(Number)
      .sort((a, b) => a - b)
      .map((k) => raw[k] as string);
    cb({ sente: v.sente ?? null, gote: v.gote ?? null, moves, resigned: v.resigned ?? null });
  });
}

/** index 手目に指し手を書き込む。既に書き込まれていたら false */
export async function sendMove(roomId: string, index: number, usi: string): Promise<boolean> {
  const res = await runTransaction(ref(db(), `rooms/${roomId}/moves/${index}`), (cur) =>
    cur === null ? usi : undefined,
  );
  return res.committed;
}

export async function sendResign(roomId: string, color: Color): Promise<void> {
  await set(ref(db(), `rooms/${roomId}/resigned`), color);
}
