// Modo demo: un solo dispositivo controla a todos los jugadores; los demás pueden jugar solos.
import { useSyncExternalStore } from 'react';
import { enterRoom, refresh, setDemoToken } from './api';
import { getGame, localHandle, onLocalChange, views } from './local';
import type { Action } from '../../engine/types';
import { randomAvatars } from './ui/avatar';

export interface DemoPlayer { name: string; token: string }
interface DemoState { players: DemoPlayer[]; current: number; auto: boolean; code: string | null }
const KEY = 'lp.demo.session';
let st: DemoState = { players: [], current: 0, auto: true, code: null };
try { const raw = localStorage.getItem(KEY); if (raw) st = JSON.parse(raw); } catch { /* */ }
const subs = new Set<() => void>();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* */ } };
function set(p: Partial<DemoState>) { st = { ...st, ...p }; save(); subs.forEach(f => f()); }
export const useDemo = () => useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f); }, () => st);

export const DEFAULT_NAMES = ['Andreu', 'Nuria', 'Sergio', 'Laura', 'Lluís', 'Claudia', 'Guillem'];

export function startDemo(names: string[], auto: boolean, chosen: string[] = []) {
  const players = names.map(name => ({ name, token: 'demo-' + crypto.randomUUID() }));
  const host = players[0];
  const pool = randomAvatars(40).filter(a => !chosen.includes(a));
  const avs = players.map((_, i) => chosen[i] || pool.shift()!);
  const created = localHandle({ op: 'create', name: host.name, avatar: avs[0], token: host.token });
  const code = created.body.public.code as string;
  players.slice(1).forEach((p, i) => localHandle({ op: 'act', code, token: p.token, action: { type: 'join', name: p.name, avatar: avs[i + 1] }, actionId: crypto.randomUUID() }));
  set({ players, current: 0, auto, code });
  setDemoToken(host.token);
  enterRoom(code);
  void refresh();
}

export function resumeDemo() {
  if (!st.code || !st.players.length || !getGame(st.code)) return false;
  setDemoToken(st.players[st.current].token);
  enterRoom(st.code);
  void refresh();
  return true;
}

export function switchTo(i: number) { set({ current: i }); setDemoToken(st.players[i].token); void refresh(); }
export function setAuto(auto: boolean) { set({ auto }); }
export function endDemo() { set({ players: [], code: null, current: 0 }); }

/* ¿qué jugador tiene que hacer algo ahora? */
export function needsAction(token: string): string | null {
  if (!st.code) return null;
  const g = getGame(st.code); if (!g) return null;
  const { public: pub, private: me } = views(g.s, token, g.v);
  if (!me) return null;
  const r = pub.round;
  if (me.prompts.length) return 'Escudo';
  if (pub.report && pub.report.accused !== me.id && me.myVoteReport == null) return 'Votar acusación';
  switch (pub.phase) {
    case 'lobby': return me.isHost ? 'Empezar' : null;
    case 'order': return pub.orderPick && me.myOrder == null ? 'Elegir carta' : null;
    case 'roulette': return pub.roulette?.pending.includes(me.id) ? 'Ruleta' : null;
    case 'adjective': return me.golpeNow ? 'Golpe de Estado' : r?.golpeArmed ? null : me.isJudge ? (r?.type === 'carrete' ? 'Frase' : 'Adjetivo') : null;
    case 'play': return me.mustDiscard ? 'Tirar palabra' : me.manoAjenaTask ? 'Mano Ajena' : (!me.isJudge && !me.myPlayId && !me.manoAjenaMe && !pub.players.find(p => p.id === me.id)?.skipped ? 'Jugar' : null);
    case 'judging': return me.isJudge ? 'Juzgar' : null;
    case 'vote': return !me.isJudge && me.myPlayId && !me.myVote ? 'Votar' : null;
    case 'reveal': return me.isJudge ? 'Siguiente' : null;
    case 'end': return pub.reveal && !pub.reveal.startedAt && !pub.reveal.ready.includes(me.id) ? 'Listo' : null;
  }
  return null;
}

/* ---------------- bots ---------------- */
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
function botAct(token: string): Action | null {
  const g = getGame(st.code!); if (!g) return null;
  const { public: pub, private: me } = views(g.s, token, g.v);
  if (!me) return null;
  const r = pub.round;
  if (me.prompts.length) return { type: 'shield', promptId: me.prompts[0].id, use: Math.random() < 0.6 };
  if (pub.report && pub.report.accused !== me.id && me.myVoteReport == null) return { type: 'reportVote', yes: Math.random() < 0.5 };
  switch (pub.phase) {
    case 'order': {
      if (!pub.orderPick) return null;
      return me.myOrder == null ? { type: 'pickCard', card: Math.floor(Math.random() * pub.orderPick.count) } : null;
    }
    case 'roulette':
      if (!pub.roulette?.pending.includes(me.id)) return null;
      if (me.roulette?.needsChoice) return { type: 'keepChoice', discard: pick([...me.comodines, me.roulette.offered!]) };
      return { type: 'spin' };
    case 'adjective':
      if (me.golpeNow) return { type: 'golpe', index: Math.floor(Math.random() * 3) };
      if (!me.isJudge || r?.golpeArmed) return null;
      return r?.type === 'carrete' ? { type: 'setPhrase', phrase: pick(['Tu peor foto', 'Mi cara un lunes', 'Lo más random de mi galería']) } : { type: 'chooseAdjective', index: Math.floor(Math.random() * 3) };
    case 'play': {
      if (me.mustDiscard) return { type: 'judgeDiscard', index: Math.floor(Math.random() * me.hand.length) };
      if (me.manoAjenaTask) return { type: 'manoAjenaPick', slot: Math.floor(Math.random() * me.manoAjenaTask.slots) };
      if (me.isJudge || me.myPlayId || me.manoAjenaMe) return null;
      if (r?.type === 'carrete') return { type: 'play', photo: botPhoto(me.name) };
      const c = me.usedComodin ? undefined : me.comodines.find(x => ['x2', 'x3', 'soborno', 'ladron'].includes(x));
      return { type: 'play', hand: [Math.floor(Math.random() * me.hand.length)], comodin: c && Math.random() < 0.5 ? c : undefined };
    }
    case 'judging': {
      if (!me.isJudge || !r) return null;
      if (r.revealed < r.total) return { type: 'flip' };
      return { type: 'pickWinner', playId: pick(r.plays).id };
    }
    case 'vote': {
      if (me.isJudge || !me.myPlayId || me.myVote || !r) return null;
      const opts = r.plays.filter(p => p.id !== me.myPlayId);
      return opts.length ? { type: 'vote', playId: pick(opts).id } : null;
    }
    case 'reveal': return me.isJudge ? { type: 'next' } : null;
    case 'end': return pub.reveal && !pub.reveal.startedAt && !pub.reveal.ready.includes(me.id) ? { type: 'endReady' } : null;
  }
  return null;
}

function botPhoto(name: string) {
  const hue = (name.charCodeAt(0) * 37) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="hsl(${hue},55%,45%)"/><text x="200" y="260" font-size="56" text-anchor="middle" fill="white" font-family="sans-serif">📷 ${name}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

let lastBot = 0;
setInterval(() => {
  if (!st.code || !st.players.length) return;
  const g = getGame(st.code); if (!g) return;
  // ticks de tiempo (adjetivo, escudos, jugada)
  localHandle({ op: 'act', code: st.code, token: st.players[0].token, action: { type: 'tick' } });
  if (!st.auto || Date.now() - lastBot < (g.s.phase === 'order' ? 1700 : 1100)) return;
  const others = st.players.filter((_, i) => i !== st.current);
  for (const p of others) {
    const a = botAct(p.token);
    if (a) { lastBot = Date.now(); localHandle({ op: 'act', code: st.code, token: p.token, action: a, actionId: crypto.randomUUID() }); break; }
  }
}, 500);

onLocalChange(() => { void refresh(); subs.forEach(f => f()); });
