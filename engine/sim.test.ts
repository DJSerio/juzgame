// Simulación: bots juegan partidas completas con comodines, cortes y acciones del anfitrión.
import { apply, newGame, publicView, privateView, GameError, playerForUid, type Ctx, type Lexicon } from './engine.ts';
import type { Action, State } from './types.ts';
import { readFileSync } from 'node:fs';

const lex: Lexicon = {
  words: JSON.parse(readFileSync(new URL('../data/words.json', import.meta.url), 'utf8')),
  adjs: JSON.parse(readFileSync(new URL('../data/adjectives.json', import.meta.url), 'utf8')),
};

function mulberry(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

let now = 1_000_000;
function run(seed: number, nPlayers: number, cfg: Partial<State['config']>) {
  const rng = mulberry(seed);
  const ctx = (uid: string): Ctx => ({ now, rng, lex, uid });
  const uids = Array.from({ length: nPlayers }, (_, i) => `u${i}`);
  let s = newGame('g', 'ABCD', ctx('u0'), 'P0');
  const act = (uid: string, a: Action) => {
    const copy = structuredClone(s);
    try { s = apply(copy, a, ctx(uid), Math.random().toString(36)); publicView(s, { lex }); return true; }
    catch (e) { if (e instanceof GameError) return false; console.error('seed', seed, a, e); throw e; }
  };
  for (let i = 1; i < nPlayers; i++) act(uids[i], { type: 'join', name: `P${i}` });
  act('u0', { type: 'config', config: cfg });
  if (!act('u0', { type: 'start' })) throw new Error('no start');
  let steps = 0; let removed = false;
  const stats = { rounds: 0, comodines: new Set<string>(), carrete: 0, reports: 0 };
  while (s.phase !== 'end') {
    if (++steps > 20000) { console.log(JSON.stringify({judge: s.round?.judgeId, players: s.players.map(p=>[p.id,p.uid,p.removed]), host: s.hostId, plays: s.round?.plays.length, prompts: s.prompts, report: s.report})); throw new Error(`stuck seed ${seed} phase ${s.phase}`); }
    now += 500 + Math.floor(rng() * 3000);
    const uid = uids[Math.floor(rng() * uids.length)];
    const me = playerForUid(s, uid);
    if (!me) { act(uid, { type: 'tick' }); continue; }
    const pv = privateView(s, me.id, { lex })!;
    const r = s.round;
    // acciones aleatorias raras
    const roll = rng();
    if (roll < 0.003 && !removed && nPlayers > 4 && s.phase === 'play') { const victim = s.players.find(p => !p.removed && p.id !== s.hostId)!; act(uids[0], { type: 'removePlayer', playerId: victim.id }); removed = true; continue; }
    if (roll < 0.006 && !s.report && s.phase === 'reveal') { const other = s.players.find(p => !p.removed && p.id !== me.id)!; if (act(uid, { type: 'report', accused: other.id })) stats.reports++; continue; }
    if (s.report && s.report.accused !== me.id && s.report.votes[me.id] === undefined) { act(uid, { type: 'reportVote', yes: rng() < 0.8 }); continue; }
    for (const pr of pv.prompts) act(uid, { type: 'shield', promptId: pr.id, use: rng() < 0.5 });
    if (roll < 0.02) { act(uid, { type: 'tick' }); continue; }
    if (roll < 0.04 && me.comodines.includes('golpe')) { if (act(uid, { type: 'armGolpe' })) stats.comodines.add('golpe-armado'); continue; }
    if (roll < 0.06 && me.comodines.includes('abogado')) { if (act(uid, { type: 'lawyer' })) stats.comodines.add('abogado-tarde'); continue; }
    if (roll < 0.07 && s.phase === 'judging' && r) { const v = s.players.find(p => !p.removed && p.id !== r.judgeId); if (v) act(r.judgeId === me.id ? uid : uids[0], { type: 'fine', playerId: v.id }); continue; }
    if (roll < 0.09 && me.comodines.includes('nuevas') && me.hand.length) { if (act(uid, { type: 'tool', comodin: 'nuevas', handIndices: [0] })) stats.comodines.add('nuevas-cualquier-momento'); continue; }
    switch (s.phase) {
      case 'order': act(uid, { type: 'pickCard', card: Math.floor(rng() * s.orderPick!.cards.length) }); break;
      case 'roulette':
        if (pv.roulette?.needsChoice) act(uid, { type: 'keepChoice', discard: [...me.comodines, pv.roulette.offered!][Math.floor(rng() * 3)] });
        else act(uid, { type: 'spin' });
        if (rng() < 0.01) act(uids[0], { type: 'skipRoulette', playerId: me.id });
        break;
      case 'adjective':
        if (r!.type === 'carrete') { if (pv.isJudge) act(uid, { type: 'setPhrase', phrase: 'Tu peor foto' }); }
        else if (pv.golpeNow) act(uid, { type: 'golpe', index: 0 });
        else if (pv.isJudge) { if (rng() < 0.7) act(uid, { type: 'chooseAdjective', index: Math.floor(rng() * 3) }); }
        else if (me.comodines.includes('golpe') && rng() < 0.3) act(uid, { type: 'golpe', index: 1 });
        break;
      case 'play': {
        if (pv.manoAjenaTask) { act(uid, { type: 'manoAjenaPick', slot: Math.floor(rng() * pv.manoAjenaTask.slots) }); break; }
        if (pv.isJudge || pv.myPlayId) break;
        if (rng() < 0.03) { act(uids[0], { type: 'skipPlayer', playerId: me.id }); break; }
        const tool = me.comodines.find(c => ['cambio', 'nuevas', 'espia'].includes(c));
        if (tool && rng() < 0.4) {
          const t = s.players.find(p => !p.removed && p.id !== me.id && p.id !== r!.judgeId)!;
          act(uid, { type: 'tool', comodin: tool as 'cambio', handIndex: 0, handIndices: [0, 1], target: t.id });
          stats.comodines.add(tool);
        }
        const c = me.comodines.find(c => !['cambio', 'nuevas', 'espia', 'apuesta', 'golpe', 'escudo'].includes(c));
        const useC = c && rng() < 0.6 ? c : undefined;
        const a: Action = r!.type === 'carrete'
          ? { type: 'play', photo: `ph/${uid}.jpg`, comodin: useC }
          : { type: 'play', hand: useC === 'doble' ? [0, 1] : [Math.floor(rng() * Math.max(1, me.hand.length))], custom: 'Mi palabra', comodin: useC };
        if (act(uid, a) && useC) stats.comodines.add(useC);
        else if (useC) act(uid, { ...a, comodin: undefined, hand: [0] } as Action);
        break;
      }
      case 'judging': {
        if (!pv.isJudge) { if (me.comodines.includes('apuesta') && rng() < 0.3) { const p = r!.plays.find(p => p.playerId !== me.id); if (p && act(uid, { type: 'apuesta', playId: p.id })) stats.comodines.add('apuesta'); } break; }
        const ids = r!.order;
        if (r!.revealed < r!.plays.length) { act(uid, { type: 'flip' }); break; }
        const x = rng();
        if (x < 0.2) act(uid, { type: 'discard', playId: ids[0] });
        else if (x < 0.3) act(uid, { type: 'debate', playIds: ids.slice(0, 2) });
        else if (x < 0.35) act(uid, { type: 'endDebate' });
        else act(uid, { type: 'pickWinner', playId: ids[Math.floor(rng() * ids.length)] });
        break;
      }
      case 'vote': {
        const p = r!.plays.find(p => p.playerId !== me.id);
        if (p) act(uid, { type: 'vote', playId: p.id });
        if (rng() < 0.05) act(uids[0], { type: 'closeVote' });
        break;
      }
      case 'reveal':
        if (r!.type === 'carrete') stats.carrete++;
        stats.rounds++;
        act(uids[0], { type: 'next' }); break;
    }
    // invariantes
    const all = s.players.filter(p => !p.removed).flatMap(p => p.hand);
    if (new Set(all).size !== all.length) throw new Error(`palabra duplicada en manos seed ${seed}`);
    for (const p of s.players) if (p.comodines.length > 2) throw new Error('más de 2 comodines');
    if (s.config.handMode === 'refill' && s.phase === 'adjective') for (const p of s.players) if (!p.removed && p.hand.length !== 7) throw new Error(`mano de ${p.hand.length} seed ${seed}`);
    if (s.config.handMode === 'deplete' && s.phase === 'adjective' && s.round?.type === 'normal' && !s.players.some(p => p.removed)) { const L = new Set(s.players.map(p => p.hand.length)); if (L.size > 1) throw new Error(`manos desiguales ${[...L]} seed ${seed} ronda ${s.roundNo}`); }
  }
  for (const u of uids) { try { act(u, { type: 'endReady' }); } catch { /* jugador retirado */ } }
  if (!s.reveal!.startedAt) act(uids[0], { type: 'endStart' });
  const pub = publicView(s, { lex });
  if (!pub.history) throw new Error('sin cronología');
  return { rounds: s.history.length, pts: s.reveal!.ranking.map(r => r.points), stats };
}

let total = 0; const used = new Set<string>(); let carr = 0;
for (let seed = 1; seed <= 300; seed++) {
  const n = 3 + (seed % 6);
  const cfg = { target: [5, 6, 8, 10][seed % 4], finalDouble: seed % 4 === 0, handMode: seed % 2 === 0 ? 'deplete' as const : 'refill' as const };
  const res = run(seed, n, cfg);
  total += res.rounds; res.stats.comodines.forEach(c => used.add(c)); carr += res.stats.carrete;
}
console.log('OK 300 partidas, rondas medias', (total / 300).toFixed(1), 'comodines usados', [...used].sort().join(','), 'rondas carrete', carr);
