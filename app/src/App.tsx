import { useCallback, useEffect, useRef, useState } from 'react';
import { DEMO } from './config';
import { useApp, PlayersStrip, Topbar, StatusBanners, Notices, ShieldPrompt, ReportVote, Menu, Rules, RoundSteps, RouletteResult } from './ui/common';
import { Home, Lobby, Order, OrderRanking, Roulette, Adjective, Play, Judging, Vote, Reveal, WaitingReclaim } from './ui/screens';
import { End } from './ui/endgame';
import { DemoBar, DemoMenuExtra, DemoSetup } from './ui/demoui';

function useMyTurnBuzz() {
  const { snap } = useApp();
  const me = snap?.private, pub = snap?.public;
  const mine = !!me && !!pub && (
    (pub.phase === 'adjective' && me.isJudge) || (pub.phase === 'play' && !me.isJudge && !me.myPlayId) ||
    (pub.phase === 'judging' && me.isJudge) || (pub.phase === 'roulette' && !!pub.roulette?.pending.includes(me.id)));
  const prev = useRef(false);
  useEffect(() => { if (mine && !prev.current) { try { navigator.vibrate?.(80); } catch { /* */ } } prev.current = mine; }, [mine]);
}

export default function App() {
  const { code, snap, error } = useApp();
  const [menu, setMenu] = useState(false);
  const [rules, setRules] = useState(false);
  useMyTurnBuzz();
  const phase = snap?.public.phase;
  const prevPhase = useRef(phase);
  const [ranking, setRanking] = useState(false);
  useEffect(() => { if (prevPhase.current === 'order' && phase && phase !== 'order') setRanking(true); prevPhase.current = phase; }, [phase]);
  const closeRanking = useCallback(() => setRanking(false), []);
  if (!code) return DEMO ? <DemoSetup /> : <Home />;
  if (!snap) return <main className="app" style={{ justifyContent: 'center', alignItems: 'center' }}><p className="muted"><span className="spin">◌</span> Conectando con la sala {code}…</p>{error && <div className="banner bad">{error}</div>}</main>;
  const pub = snap.public;
  const me = snap.private;
  let screen;
  if (!me) screen = snap.pendingReclaim ? <WaitingReclaim /> : <Home />;
  else switch (pub.phase) {
    case 'lobby': screen = <Lobby />; break;
    case 'order': screen = <Order />; break;
    case 'roulette': screen = <Roulette />; break;
    case 'adjective': screen = <Adjective />; break;
    case 'play': screen = <Play />; break;
    case 'judging': screen = <Judging />; break;
    case 'vote': screen = <Vote />; break;
    case 'reveal': screen = <Reveal />; break;
    case 'end': screen = <End />; break;
  }
  return (
    <>
      {DEMO && <DemoBar />}
      <main className="app">
        <Topbar onMenu={() => setMenu(true)} />
        <PlayersStrip />
        <StatusBanners />
        <RoundSteps />
        {pub.feed.length > 0 && !['lobby', 'end'].includes(pub.phase) && !(pub.feed[pub.feed.length - 1].startsWith('Orden de jueces') && pub.roundNo > 0) && <p className="feed" aria-live="polite">{pub.feed[pub.feed.length - 1]}</p>}
        <ReportVote />
        <div key={`${pub.phase}-${pub.roundNo}-${me?.id}`} className="screen-in">{screen}</div>
        {error && <div className="toast" role="status">{error}</div>}
        <Notices />
        <ShieldPrompt />
        {ranking ? <OrderRanking onDone={closeRanking} /> : <RouletteResult key={me?.id} />}
        {menu && <Menu onClose={() => setMenu(false)} onRules={() => { setMenu(false); setRules(true); }} extra={DEMO ? <DemoMenuExtra onClose={() => setMenu(false)} /> : undefined} />}
        {rules && <Rules onClose={() => setRules(false)} />}
      </main>
    </>
  );
}
