import { useEffect, useMemo, useRef, useState } from 'react';
import { GameView } from '../components/GameView';
import { createRoom, joinRoom, onlineConfigured, sendMove, sendResign, watchRoom } from '../online/firebase';
import type { RoomState, Seat } from '../online/firebase';
import { applyMove, newGame, resign } from '../shogi/game';
import { fromUsi, toUsi } from '../shogi/rules';
import type { Color } from '../shogi/types';

const roomUrl = (roomId: string) => `${location.origin}${location.pathname}?room=${roomId}`;

export function OnlineLobby({ initialRoom, onEnter }: { initialRoom: string | null; onEnter: (s: Seat) => void }) {
  const [color, setColor] = useState<Color>(0);
  const [code, setCode] = useState(initialRoom ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (f: () => Promise<Seat>) => {
    setBusy(true);
    setError(null);
    try {
      const seat = await f();
      history.replaceState(null, '', `?room=${seat.roomId}`);
      onEnter(seat);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  // 招待リンクから開いたときは自動で入室する (開発時の StrictMode で二重に走らないようにする)
  const autoJoined = useRef(false);
  useEffect(() => {
    if (autoJoined.current || !initialRoom || !onlineConfigured) return;
    autoJoined.current = true;
    // oxlint-disable-next-line react/set-state-in-effect
    run(() => joinRoom(initialRoom.toUpperCase()));
    // 初回表示時に一度だけ実行する
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!onlineConfigured) {
    return (
      <div className="menu">
        <section className="card">
          <h2>オンライン対戦は未設定です</h2>
          <p>
            Firebase の設定値がまだ入っていません。README の「オンライン対戦の設定」の手順で
            <code>.env.local</code> を作成してから、もう一度ビルドしてください。
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="menu">
      <section className="card">
        <h2>部屋を作る</h2>
        <div className="field">
          <span>自分の手番</span>
          <div className="seg">
            <button className={color === 0 ? 'on' : ''} onClick={() => setColor(0)}>
              先手
            </button>
            <button className={color === 1 ? 'on' : ''} onClick={() => setColor(1)}>
              後手
            </button>
          </div>
        </div>
        <button className="primary" disabled={busy} onClick={() => run(() => createRoom(color))}>
          部屋を作る
        </button>
      </section>
      <section className="card">
        <h2>部屋に入る</h2>
        <div className="field">
          <input
            className="code-input"
            placeholder="部屋コード (6文字)"
            value={code}
            maxLength={6}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button className="primary" disabled={busy || code.length !== 6} onClick={() => run(() => joinRoom(code))}>
            入る
          </button>
        </div>
      </section>
      {busy && <p>接続しています…</p>}
      {error && <p className="error">エラー: {error}</p>}
    </div>
  );
}

export function OnlineGame({ seat }: { seat: Seat }) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => watchRoom(seat.roomId, setRoom), [seat.roomId]);

  const game = useMemo(() => {
    let g = newGame();
    if (!room) return g;
    for (const usi of room.moves) {
      if (g.result) break;
      g = applyMove(g, fromUsi(usi));
    }
    if (room.resigned !== null && !g.result) g = resign(g, room.resigned);
    return g;
  }, [room]);

  if (!room) return <p className="center">部屋に接続しています…</p>;

  const opponentMissing = seat.color !== null && !(seat.color === 0 ? room.gote : room.sente);
  const url = roomUrl(seat.roomId);
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
  };

  let status: string | undefined;
  if (seat.color === null) status = '観戦中です';
  else if (opponentMissing) status = '対戦相手の参加を待っています';
  else if (game.positions[game.positions.length - 1].turn !== seat.color) status = '相手の手番です';
  else status = 'あなたの手番です';

  return (
    <>
      <div className="room-bar">
        <span>
          部屋コード <strong>{seat.roomId}</strong>
          {seat.color !== null && ` ・ あなたは${seat.color === 0 ? '☗先手' : '☖後手'}`}
        </span>
        <button onClick={copy}>{copied ? 'コピーしました' : '招待リンクをコピー'}</button>
      </div>
      <GameView
        game={game}
        controls={seat.color !== null && !opponentMissing ? [seat.color] : []}
        initialViewer={seat.color ?? 0}
        onMove={(m) => sendMove(seat.roomId, game.moves.length, toUsi(m))}
        status={status}
        actions={
          seat.color !== null && (
            <button disabled={!!game.result || opponentMissing} onClick={() => sendResign(seat.roomId, seat.color!)}>
              投了
            </button>
          )
        }
      />
    </>
  );
}
