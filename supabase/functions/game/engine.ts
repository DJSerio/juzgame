import type {
  Action, Comodin, HistoryEntry, Play, Player, Prompt, Round, RouletteItem, State,
} from './types.ts';

export interface Lexicon { words: { w: string; d: string }[]; adjs: { a: string; s: string[] }[] }
export interface Ctx { now: number; rng: () => number; lex: Lexicon; uid: string }
export class GameError extends Error {}

function fail(msg: string): never { throw new GameError(msg); }

export const COMODIN_INFO: Record<Comodin, { name: string; desc: string }> = {
  x2: { name: 'x2', desc: 'Si tu palabra gana, sumas el doble.' },
  x3: { name: 'x3', desc: 'Si tu palabra gana, sumas el triple.' },
  cambio: { name: 'Cambio al azar', desc: 'Cambias una palabra tuya por una de un jugador al azar.' },
  nuevas: { name: 'Palabras nuevas', desc: 'Cambias las palabras que quieras por otras nuevas.' },
  escribe: { name: 'Escribe tu palabra', desc: 'Juegas la palabra que tú escribas.' },
  soborno: { name: 'Soborno', desc: 'Si tu palabra gana, el juez también suma 1.' },
  abogado: { name: 'Abogado', desc: 'Solo tú puedes defender tu palabra. No hay debate.' },
  doble: { name: 'Doble envío', desc: 'Juegas dos palabras, como dos cartas separadas. Si gana cualquiera, ganas tú.' },
  golpe: { name: 'Golpe de Estado', desc: 'Eliges tú el adjetivo en lugar del juez. Disimula.' },
  espia: { name: 'Espía', desc: 'Ves qué palabra ha jugado otro jugador.' },
  apuesta: { name: 'Apuesta', desc: 'Apuesta qué palabra ganará (no la tuya). Si aciertas, +1.' },
  escudo: { name: 'Escudo', desc: 'Automático: para el primer Ladrón o Cambio al azar que vaya a por ti.' },
  ladron: { name: 'Ladrón', desc: 'Robas 1 punto al líder al instante.' },
  carrete: { name: 'Carrete', desc: 'La siguiente ronda se juega con fotos de la galería.' },
  pareja: { name: 'Puntos en pareja', desc: 'Parejas secretas: tú vas con el juez. La pareja ganadora suma 2 cada uno.' },
};

const NORMAL_POOL: Comodin[] = ['x2', 'cambio', 'nuevas', 'escribe', 'soborno', 'abogado', 'doble', 'golpe', 'espia', 'apuesta', 'escudo', 'carrete', 'pareja'];

// 20 casillas
export const WHEEL: RouletteItem[] = [
  ...Array.from({ length: 10 }, () => ({ kind: 'comodin', comodin: 'x2' } as RouletteItem)), // comodín normal (se sortea cuál)
  { kind: 'comodin', comodin: 'x3' },
  { kind: 'comodin', comodin: 'ladron' },
  { kind: 'vacia' }, { kind: 'vacia' }, { kind: 'vacia' }, { kind: 'vacia' }, { kind: 'vacia' },
  { kind: 'mano_ajena' }, { kind: 'todo_nada' }, { kind: 'robin_hood' },
];

const pick = <T>(arr: T[], rng: () => number): T => arr[Math.floor(rng() * arr.length)];
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const id = (s: State, p = 'x') => `${p}${(++s.seq).toString(36)}`;

export function newGame(gameId: string, code: string, ctx: Ctx, hostName: string, avatar = ''): State {
  const s: State = {
    id: gameId, code, hostId: '', config: { target: 6, finalDouble: false, handMode: 'deplete', handSize: 7 },
    phase: 'lobby', players: [], judgeOrder: [], judgeIdx: 0, roundNo: 0,
    deck: shuffle(ctx.lex.words.map((_, i) => i), ctx.rng), discard: [],
    adjDeck: shuffle(ctx.lex.adjs.map((_, i) => i), ctx.rng),
    round: null, nextCarrete: null, roulette: null, roundsSinceRoulette: 0,
    countdown: { active: false, queue: [], finalLen: 0 }, finalVuelta: false,
    prompts: [], report: null, reclaims: [], history: [], feed: [], orderPick: null, reveal: null,
    processed: [], seq: 0, createdAt: ctx.now,
  };
  const p = addPlayer(s, ctx, hostName, avatar);
  s.hostId = p.id;
  return s;
}

function checkAvatar(s: State, avatar: string, self?: string) {
  const a = String(avatar ?? '').slice(0, 24);
  if (a && s.players.some(p => !p.removed && p.id !== self && p.avatar === a)) fail('Ese personaje ya lo ha cogido otro jugador.');
  return a;
}
function addPlayer(s: State, ctx: Ctx, name: string, avatar = ''): Player {
  const clean = name.trim().slice(0, 20);
  if (!clean) fail('Pon un nombre.');
  if (s.players.some(p => !p.removed && p.name.toLowerCase() === clean.toLowerCase())) fail('Ese nombre ya está cogido.');
  const av = checkAvatar(s, avatar);
  const p: Player = {
    id: id(s, 'p'), uid: ctx.uid, name: clean, avatar: av, hand: [], comodines: [], points: 0, removed: false,
    pending: { todo: false, manoAjena: false }, notices: [], joinedAt: ctx.now,
  };
  s.players.push(p);
  return p;
}

const active = (s: State) => s.players.filter(p => !p.removed);
const byId = (s: State, pid: string) => s.players.find(p => p.id === pid) ?? fail('Jugador no encontrado.');
const nameOf = (s: State, pid: string | null | undefined) => (pid ? s.players.find(p => p.id === pid)?.name ?? '?' : '?');
const wordText = (ctx: Ctx, w: { wordId?: number; custom?: string }) => w.custom ?? ctx.lex.words[w.wordId!]?.w ?? '?';
const notify = (s: State, p: Player, ctx: Ctx, text: string, kind?: string, data?: unknown) => {
  p.notices.push({ id: id(s, 'n'), text, at: ctx.now, kind, data });
  if (p.notices.length > 30) p.notices.splice(0, p.notices.length - 30);
};
const addPoints = (s: State, p: Player, n: number) => {
  p.points = Math.round((p.points + n) * 2) / 2;
  if (s.round) s.round.gains[p.id] = (s.round.gains[p.id] ?? 0) + n;
};

function draw(s: State, ctx: Ctx): number {
  if (s.deck.length === 0) {
    if (s.discard.length === 0) {
      // reciclar todo lo que no está en manos
      const inHands = new Set(s.players.flatMap(p => p.hand));
      s.discard = ctx.lex.words.map((_, i) => i).filter(i => !inHands.has(i));
    }
    s.deck = shuffle(s.discard, ctx.rng); s.discard = [];
  }
  return s.deck.pop()!;
}
function drawAdj(s: State, ctx: Ctx): number {
  if (s.adjDeck.length === 0) s.adjDeck = shuffle(ctx.lex.adjs.map((_, i) => i), ctx.rng);
  return s.adjDeck.pop()!;
}
function fillHand(s: State, p: Player, ctx: Ctx) { while (p.hand.length < s.config.handSize) p.hand.push(draw(s, ctx)); }

export function playerForUid(s: State, uid: string): Player | undefined {
  return s.players.find(p => p.uid === uid && !p.removed);
}

/* ------------------------------------------------------------------ */

export function apply(s: State, a: Action, ctx: Ctx, actionId?: string): State {
  if (actionId) {
    if (s.processed.includes(actionId)) return s; // idempotente
    s.processed.push(actionId);
    if (s.processed.length > 300) s.processed.splice(0, s.processed.length - 300);
  }
  if (a.type === 'join') return join(s, a.name, ctx, a.avatar);
  if (a.type === 'reclaim') return reclaim(s, a.name, ctx);

  const me = playerForUid(s, ctx.uid) ?? fail('No estás en esta partida.');
  const isHost = me.id === s.hostId;
  const host = () => { if (!isHost) fail('Solo el anfitrión puede hacer esto.'); };

  switch (a.type) {
    case 'setAvatar': {
      if (s.phase !== 'lobby') fail('El personaje se elige antes de empezar.');
      me.avatar = checkAvatar(s, a.avatar, me.id);
      break;
    }
    case 'config': {
      host(); if (s.phase !== 'lobby') fail('La partida ya ha empezado.');
      const c = a.config;
      if (c.target && [5, 6, 8, 10].includes(c.target)) s.config.target = c.target;
      if (typeof c.finalDouble === 'boolean') s.config.finalDouble = c.finalDouble;
      if (c.handMode === 'refill' || c.handMode === 'deplete') s.config.handMode = c.handMode;
      break;
    }
    case 'start': {
      host(); if (s.phase !== 'lobby') fail('Ya ha empezado.');
      const n = active(s).length; if (n < 3) fail('Hacen falta al menos 3 jugadores.');
      s.orderPick = { cards: shuffle(Array.from({ length: n }, (_, i) => i + 1), ctx.rng), picks: {} };
      s.phase = 'order';
      break;
    }
    case 'pickCard': {
      if (s.phase !== 'order' || !s.orderPick) fail('Ahora no toca.');
      const op = s.orderPick;
      if (op.picks[me.id] !== undefined) fail('Ya has elegido carta.');
      // cada uno ve sus propias cartas: si otro ya cogió esa posición, se asigna otra libre al azar
      const taken = new Set(Object.values(op.picks));
      const free = op.cards.map((_, i) => i).filter(i => !taken.has(i));
      if (!free.length) fail('No quedan cartas.');
      op.picks[me.id] = free.includes(a.card) ? a.card : pick(free, ctx.rng);
      maybeFinishOrder(s, ctx);
      break;
    }
    case 'spin': spin(s, me, ctx); break;
    case 'keepChoice': {
      const r = s.roulette?.results[me.id];
      if (!r?.needsChoice || !r.offered) fail('No tienes nada que elegir.');
      const all = [...me.comodines, r!.offered!];
      const idx = all.indexOf(a.discard); if (idx < 0) fail('Ese comodín no está.');
      all.splice(idx, 1); me.comodines = all; r!.needsChoice = false;
      s.roulette!.pending = s.roulette!.pending.filter(x => x !== me.id);
      maybeFinishRoulette(s, ctx);
      break;
    }
    case 'skipRoulette': {
      host(); if (!s.roulette) fail('No hay ruleta.');
      const r = s.roulette.results[a.playerId];
      if (r?.needsChoice) { r.needsChoice = false; }
      s.roulette.pending = s.roulette.pending.filter(x => x !== a.playerId);
      maybeFinishRoulette(s, ctx);
      break;
    }
    case 'chooseAdjective': {
      const r = curRound(s, 'adjective');
      if (r.type !== 'normal') fail('Esta ronda es de Carrete.');
      if (r.judgeId !== me.id && !isHost) fail('Elige el juez.');
      if (r.adjective !== null) fail('Ya hay adjetivo.');
      if (a.index < 0 || a.index > 2) fail('Opción inválida.');
      r.adjective = r.adjOptions[a.index];
      startPlay(s, ctx);
      break;
    }
    case 'setPhrase': {
      const r = curRound(s, 'adjective');
      if (r.type !== 'carrete') fail('No es ronda de Carrete.');
      if (r.judgeId !== me.id && !isHost) fail('La frase la pone el juez.');
      const ph = a.phrase.trim().slice(0, 120); if (!ph) fail('Escribe una frase.');
      r.phrase = ph; startPlay(s, ctx);
      break;
    }
    case 'golpe': {
      const r = curRound(s, 'adjective');
      if (r.type !== 'normal') fail('No se puede en Carrete.');
      if (me.id === r.judgeId) fail('El juez no puede dar un golpe de Estado.');
      useComodin(s, me, 'golpe');
      if (a.index < 0 || a.index > 2) fail('Opción inválida.');
      r.adjective = r.adjOptions[a.index]; r.golpeBy = me.id;
      r.events.push(`${me.name} dio un golpe de Estado y eligió el adjetivo.`);
      s.feed.push('¡Golpe de Estado! Alguien ha elegido el adjetivo por el juez.');
      startPlay(s, ctx);
      break;
    }
    case 'play': doPlay(s, me, a, ctx); break;
    case 'tool': doTool(s, me, a, ctx); break;
    case 'manoAjenaPick': {
      const r = curRound(s, 'play');
      const t = r.manoAjena.find(m => m.chooser === me.id) ?? fail('No te toca elegir.');
      resolveManoAjena(s, t.target, a.slot, ctx);
      break;
    }
    case 'shield': {
      const pr = s.prompts.find(p => p.id === a.promptId && p.to === me.id) ?? fail('Aviso caducado.');
      resolvePrompt(s, pr, a.use, ctx);
      break;
    }
    case 'flip': {
      const r = curRound(s, 'judging');
      if (r.judgeId !== me.id && !isHost) fail('Solo el juez.');
      r.revealed = Math.min(r.revealed + 1, r.plays.length);
      break;
    }
    case 'discard': {
      const r = curRound(s, 'judging');
      if (r.judgeId !== me.id && !isHost) fail('Solo el juez.');
      if (r.revealed < r.plays.length) fail('Destapa primero todas las cartas.');
      if (!r.plays.some(p => p.id === a.playId)) fail('No existe.');
      r.discarded = r.discarded.includes(a.playId) ? r.discarded.filter(x => x !== a.playId) : [...r.discarded, a.playId];
      break;
    }
    case 'debate': {
      const r = curRound(s, 'judging');
      if (r.judgeId !== me.id && !isHost) fail('Solo el juez.');
      if (r.mordaza) fail('Hay un abogado: no se puede invocar debate.');
      if (r.revealed < r.plays.length) fail('Destapa primero todas las cartas.');
      const ids = [...new Set(a.playIds)].filter(x => r.plays.some(p => p.id === x));
      if (ids.length < 2 || ids.length > 3) fail('Elige 2 o 3 palabras.');
      const owners = new Set(ids.map(x => r.plays.find(p => p.id === x)!.playerId));
      if (owners.size === 1) { r.events.push('Las cartas del debate eran del mismo jugador: gana directamente.'); pickWinner(s, me, isHost, ids[0], ctx); break; }
      r.debate = { playIds: ids, order: shuffle(ids, ctx.rng), turn: 0 };
      break;
    }
    case 'debateNext': {
      const r = curRound(s, 'judging');
      if (r.judgeId !== me.id && !isHost) fail('Solo el juez.');
      if (!r.debate) fail('No hay debate.');
      r.debate.turn = Math.min(r.debate.turn + 1, r.debate.order.length);
      break;
    }
    case 'endDebate': {
      const r = curRound(s, 'judging');
      if (r.judgeId !== me.id && !isHost) fail('Solo el juez.');
      r.debate = null; break;
    }
    case 'apuesta': {
      const r = curRound(s, 'judging');
      if (me.id === r.judgeId) fail('El juez no apuesta.');
      if (r.revealed < r.plays.length) fail('Espera a que el juez destape todas las cartas.');
      const play = r.plays.find(p => p.id === a.playId) ?? fail('No existe.');
      if (play.playerId === me.id) fail('No puedes apostar por la tuya.');
      useComodin(s, me, 'apuesta');
      r.apuestas[me.id] = a.playId;
      break;
    }
    case 'pickWinner': pickWinner(s, me, isHost, a.playId, ctx); break;
    case 'judgeDiscard': {
      const r = curRound(s, 'play');
      if (r.judgeId !== me.id) fail('Solo el juez tira una palabra.');
      if (s.config.handMode !== 'deplete' || r.type !== 'normal') fail('En este modo no hace falta.');
      if (r.judgeDiscarded) fail('Ya has tirado una.');
      if (a.index < 0 || a.index >= me.hand.length) fail('Palabra inválida.');
      const w = me.hand.splice(a.index, 1)[0]; s.discard.push(w);
      r.judgeDiscarded = true;
      break;
    }
    case 'vote': {
      const r = curRound(s, 'vote');
      if (me.id === r.judgeId) fail('El juez ya ha decidido.');
      if (!r.plays.some(p => p.playerId === me.id)) fail('Solo votan los que han jugado.');
      const play = r.plays.find(p => p.id === a.playId) ?? fail('No existe.');
      if (play.playerId === me.id) fail('No puedes votarte.');
      r.votes[me.id] = a.playId;
      const voters = r.plays.map(p => p.playerId).filter((v, i, arr) => arr.indexOf(v) === i);
      if (voters.every(v => r.votes[v] || byId(s, v).removed)) closeVote(s, ctx);
      break;
    }
    case 'closeVote': {
      curRound(s, 'vote');
      if (!isHost && s.round!.judgeId !== me.id) fail('Solo el juez o el anfitrión.');
      closeVote(s, ctx); break;
    }
    case 'next': {
      if (s.phase !== 'reveal') fail('Ahora no.');
      if (!isHost && s.round?.judgeId !== me.id) fail('Solo el juez o el anfitrión.');
      advance(s, ctx); break;
    }
    case 'tick': tick(s, ctx); break;
    case 'skipPlayer': {
      host(); const r = curRound(s, 'play');
      const t = byId(s, a.playerId);
      if (r.plays.some(p => p.playerId === t.id)) fail('Ya ha jugado.');
      if (!r.skipped.includes(t.id)) r.skipped.push(t.id);
      r.manoAjena = r.manoAjena.filter(m => m.target !== t.id);
      r.events.push(`${t.name} se saltó la ronda.`);
      maybeStartJudging(s, ctx);
      break;
    }
    case 'passJudge': {
      host(); const r = curRound(s, 'adjective');
      if (r.adjective !== null || r.phrase) fail('Ya ha empezado la ronda.');
      passJudge(s, ctx); break;
    }
    case 'removePlayer': {
      host(); const t = byId(s, a.playerId);
      if (t.id === s.hostId) fail('Pasa antes el anfitrión a otro.');
      removePlayer(s, t, ctx); break;
    }
    case 'transferHost': { host(); const t = byId(s, a.playerId); if (t.removed) fail('No está.'); s.hostId = t.id; break; }
    case 'claimHost': { s.hostId = me.id; s.feed.push(`${me.name} es ahora el anfitrión.`); break; }
    case 'undo': {
      host(); fail('UNDO'); // lo gestiona el servidor con la instantánea previa
      break;
    }
    case 'report': {
      if (['lobby', 'order', 'end'].includes(s.phase)) fail('Ahora no.');
      if (s.report) fail('Ya hay una acusación en curso.');
      const t = byId(s, a.accused); if (t.id === me.id) fail('No puedes acusarte.');
      s.report = { id: id(s, 'r'), by: me.id, accused: t.id, votes: { [me.id]: true }, round: s.history.length ? s.history[s.history.length - 1].no : 0 };
      s.feed.push(`🚨 ${me.name} acusa a ${t.name} de hacer trampas. Votación.`);
      checkReport(s, ctx);
      break;
    }
    case 'reportVote': {
      const rep = s.report ?? fail('No hay acusación.');
      if (me.id === rep.accused) fail('El acusado no vota.');
      rep.votes[me.id] = a.yes;
      checkReport(s, ctx); break;
    }
    case 'cancelReport': { host(); s.report = null; s.feed.push('Acusación anulada por el anfitrión.'); break; }
    case 'approveReclaim': {
      host(); const rq = s.reclaims.find(r => r.id === a.requestId) ?? fail('Solicitud no encontrada.');
      const t = byId(s, a.playerId); t.uid = rq.uid; t.removed = false;
      s.reclaims = s.reclaims.filter(r => r.id !== rq.id);
      s.feed.push(`${t.name} ha vuelto a la partida.`);
      break;
    }
    case 'rejectReclaim': { host(); s.reclaims = s.reclaims.filter(r => r.id !== a.requestId); break; }
    case 'revealNext': {
      host(); if (s.phase !== 'end' || !s.reveal) fail('Ahora no.');
      s.reveal.shown = Math.min(s.reveal.shown + 1, s.reveal.ranking.length); break;
    }
    case 'dismissNotice': { me.notices = me.notices.filter(n => n.id !== a.noticeId); break; }
    default: fail('Acción desconocida.');
  }
  return s;
}

/* ------------------------------ fases ----------------------------- */

function join(s: State, name: string, ctx: Ctx, avatar?: string): State {
  const existing = playerForUid(s, ctx.uid);
  if (existing) return s;
  if (s.phase !== 'lobby') return reclaim(s, name, ctx);
  if (active(s).length >= 10) fail('La sala está llena.');
  addPlayer(s, ctx, name, avatar);
  return s;
}

function reclaim(s: State, name: string, ctx: Ctx): State {
  if (s.reclaims.some(r => r.uid === ctx.uid)) return s;
  s.reclaims.push({ id: id(s, 'q'), uid: ctx.uid, name: name.trim().slice(0, 20), at: ctx.now });
  return s;
}

function maybeFinishOrder(s: State, ctx: Ctx) {
  const op = s.orderPick!;
  const players = active(s);
  if (!players.every(p => op.picks[p.id] !== undefined)) return;
  s.judgeOrder = players.slice().sort((a, b) => op.cards[op.picks[a.id]] - op.cards[op.picks[b.id]]).map(p => p.id);
  s.judgeIdx = 0;
  for (const p of players) fillHand(s, p, ctx);
  s.feed.push(`Orden de jueces: ${s.judgeOrder.map(x => nameOf(s, x)).join(' → ')}`);
  openRoulette(s);
}

function openRoulette(s: State) {
  s.phase = 'roulette';
  s.roulette = { pending: active(s).map(p => p.id), results: {} };
  s.roundsSinceRoulette = 0;
}

function hint(s: State): string {
  const pts = active(s).map(p => p.points).sort((a, b) => b - a);
  const top = pts[0] ?? 0, second = pts[1] ?? 0, bottom = pts[pts.length - 1] ?? 0;
  if (top === 0) return 'Todavía no ha puntuado nadie. Todo por decidir.';
  if (top >= s.config.target - 2) return 'Alguien está muy cerca de la meta…';
  if (top - second >= 3) return 'Alguien se está escapando.';
  if (top - bottom <= 2) return 'La partida está muy reñida.';
  return 'Hay un pelotón en cabeza y alguien rezagado.';
}

function spin(s: State, me: Player, ctx: Ctx) {
  if (s.phase !== 'roulette' || !s.roulette) fail('No hay ruleta ahora.');
  if (s.roulette.results[me.id]) fail('Ya has tirado.');
  const slot = Math.floor(ctx.rng() * WHEEL.length);
  let item = WHEEL[slot];
  if (item.kind === 'comodin' && slot < 10) item = { kind: 'comodin', comodin: pick(NORMAL_POOL, ctx.rng) };
  let label = '';
  let needsChoice = false; let offered: Comodin | undefined;
  switch (item.kind) {
    case 'comodin':
      label = COMODIN_INFO[item.comodin].name;
      if (me.comodines.length >= 2) { needsChoice = true; offered = item.comodin; }
      else me.comodines.push(item.comodin);
      break;
    case 'vacia': label = 'Casilla vacía'; break;
    case 'mano_ajena': {
      label = 'Mano Ajena';
      me.pending.manoAjena = true;
      break;
    }
    case 'todo_nada': label = 'Todo o Nada'; me.pending.todo = true; break;
    case 'robin_hood': {
      label = 'Robin Hood';
      const others = active(s).filter(p => p.id !== me.id);
      const minPts = Math.min(...active(s).map(p => p.points));
      if (me.points === minPts) { notify(s, me, ctx, 'Robin Hood: el último eres tú. Te libras.'); break; }
      const lasts = others.filter(p => p.points === minPts);
      const last = pick(lasts, ctx.rng);
      const give = Math.min(1, me.points);
      if (give > 0) {
        me.points -= give; last.points += give;
        notify(s, last, ctx, 'Robin Hood: alguien te ha regalado 1 punto.');
        pushEvent(s, `${me.name} hizo de Robin Hood y le dio 1 punto a ${last.name}.`);
      }
      break;
    }
  }
  const h = hint(s);
  s.roulette.results[me.id] = { label, item, slot, hint: h, needsChoice, offered };
  const effect = item.kind === 'comodin' ? COMODIN_INFO[item.comodin].desc
    : item.kind === 'vacia' ? 'Esta vez no te toca nada.'
    : item.kind === 'mano_ajena' ? 'La próxima ronda que juegues, otro jugador elegirá a ciegas tu palabra.'
    : item.kind === 'todo_nada' ? 'La próxima ronda que juegues: si ganas sumas +2, si no pierdes 1 punto.'
    : 'Le regalas 1 punto al último de la clasificación (si tenías alguno).';
  notify(s, me, ctx, `${label}: ${effect}`, 'roulette', { label, item, slot, hint: h, good: item.kind === 'comodin' ? true : item.kind === 'vacia' ? null : false });
  if (!needsChoice) s.roulette.pending = s.roulette.pending.filter(x => x !== me.id);
  maybeFinishRoulette(s, ctx);
}

function pushEvent(s: State, text: string) {
  if (s.round) s.round.events.push(text);
  else s.feed.push(text);
  // también a la cronología de la ronda anterior si no hay ronda
  if (!s.round && s.history.length) s.history[s.history.length - 1].events.push(text);
}

function maybeFinishRoulette(s: State, ctx: Ctx) {
  if (!s.roulette || s.roulette.pending.length > 0) return;
  // ¿quedan escudos pendientes de responder? no bloquean
  startRound(s, ctx);
}

function judgeForThisRound(s: State): string {
  if (s.countdown.active) {
    while (s.countdown.queue.length && byId(s, s.countdown.queue[0]).removed) s.countdown.queue.shift();
    return s.countdown.queue[0];
  }
  const order = s.judgeOrder.filter(pid => !byId(s, pid).removed);
  return order[s.judgeIdx % order.length];
}

function startRound(s: State, ctx: Ctx) {
  s.roulette = null;
  s.roundNo += 1;
  const judgeId = judgeForThisRound(s);
  if (!judgeId) { s.roundNo -= 1; endGame(s); return; }
  const type = s.nextCarrete ? 'carrete' : 'normal';
  if (s.nextCarrete) s.feed.push('📸 ¡Ronda de Carrete! Prepara la galería.');
  s.nextCarrete = null;
  s.finalVuelta = s.countdown.active && s.countdown.queue.length <= s.countdown.finalLen;
  const round: Round = {
    no: s.roundNo, type, judgeId,
    adjOptions: type === 'normal' ? [drawAdj(s, ctx), drawAdj(s, ctx), drawAdj(s, ctx)] : [],
    adjective: null, phrase: null, adjDeadline: type === 'normal' ? ctx.now + 20000 : ctx.now + 120000, playDeadline: 0, revealed: 0,
    golpeBy: null, plays: [], order: [], comodinUsed: {}, skipped: [], discarded: [], debate: null,
    mordaza: null, pareja: null, apuestas: {}, votes: {}, winner: null, publicWinners: [],
    todoActive: [], manoAjena: [], events: [], gains: {},
  };
  s.round = round;
  s.round!.handStart = Object.fromEntries(active(s).map(p => [p.id, p.hand.length]));
  s.phase = 'adjective';
}

function curRound(s: State, phase: State['phase']): Round {
  if (s.phase !== phase || !s.round) fail('Ahora no toca eso.');
  return s.round!;
}

function startPlay(s: State, ctx: Ctx) {
  const r = s.round!;
  s.phase = 'play';
  r.playDeadline = 0; // sin límite para los jugadores
  for (const p of active(s)) {
    if (p.id === r.judgeId) continue;
    if (p.pending.todo) { p.pending.todo = false; r.todoActive.push(p.id); notify(s, p, ctx, 'Todo o Nada activo: si ganas +2, si no −1.'); }
    if (p.pending.manoAjena && r.type === 'normal' && p.hand.length) {
      p.pending.manoAjena = false;
      const choosers = active(s).filter(x => x.id !== p.id);
      const chooser = pick(choosers, ctx.rng);
      r.manoAjena.push({ target: p.id, chooser: chooser.id, deadline: ctx.now + 40000 });
      notify(s, p, ctx, 'Mano Ajena: otro jugador elige a ciegas qué palabra juegas.');
      notify(s, chooser, ctx, `Te toca elegir a ciegas la palabra de ${p.name} (Mano Ajena).`);
    }
  }
}

function useComodin(s: State, me: Player, c: Comodin) {
  const r = s.round!;
  if (c !== 'escudo' && r.comodinUsed[me.id]) fail('Solo puedes usar un comodín por ronda.');
  const i = me.comodines.indexOf(c); if (i < 0) fail('No tienes ese comodín.');
  me.comodines.splice(i, 1);
  if (c !== 'escudo') r.comodinUsed[me.id] = c;
}

function canUseInCarrete(c: Comodin) { return !['escribe', 'doble', 'cambio', 'nuevas', 'golpe'].includes(c); }

function doPlay(s: State, me: Player, a: Extract<Action, { type: 'play' }>, ctx: Ctx) {
  const r = curRound(s, 'play');
  if (me.id === r.judgeId) fail('El juez no juega palabra.');
  if (r.plays.some(p => p.playerId === me.id)) fail('Ya has jugado.');
  if (r.skipped.includes(me.id)) fail('Te han saltado esta ronda.');
  if (r.manoAjena.some(m => m.target === me.id)) fail('Esta ronda tu palabra la elige otro (Mano Ajena).');
  const c = a.comodin;
  if (c && ['cambio', 'nuevas', 'espia', 'apuesta', 'golpe', 'escudo'].includes(c)) fail('Ese comodín no se usa al jugar.');
  if (c && r.type === 'carrete' && !canUseInCarrete(c)) fail('Ese comodín no sirve en Carrete.');
  if (c === 'abogado' && r.mordaza) fail('Ya hay un abogado en esta ronda.');
  if (c === 'pareja' && r.pareja) fail('Ya hay parejas esta ronda.');
  if (c === 'carrete' && s.nextCarrete) fail('La próxima ronda ya es de Carrete.');

  const words: { wordId?: number; custom?: string }[] = [];
  const handIdx = [...new Set(a.hand ?? [])].sort((x, y) => y - x);
  if (r.type === 'carrete') {
    if (!a.photo) fail('Sube una foto.');
  } else if (c === 'escribe') {
    const t = (a.custom ?? '').trim().slice(0, 60); if (!t) fail('Escribe tu palabra.');
    words.push({ custom: t });
  } else {
    const need = c === 'doble' ? 2 : 1;
    if (handIdx.length !== need) fail(need === 2 ? 'Elige dos palabras.' : 'Elige una palabra.');
    for (const i of handIdx) if (i < 0 || i >= me.hand.length) fail('Palabra inválida.');
  }
  if (c) useComodin(s, me, c);
  for (const i of handIdx) { if (r.type === 'normal' && c !== 'escribe') { const w = me.hand.splice(i, 1)[0]; words.unshift({ wordId: w }); s.discard.push(w); } }
  let play: Play;
  if (c === 'doble') {
    // dos cartas separadas y anónimas: si gana cualquiera de las dos, ganas tú
    for (const w of words) r.plays.push(play = { id: id(s, 'y'), playerId: me.id, words: [w], comodin: c });
    if (s.config.handMode === 'deplete') me.hand.push(draw(s, ctx)); // gastas 1, como todos
  } else {
    play = { id: id(s, 'y'), playerId: me.id, words, photo: a.photo, comodin: c };
    r.plays.push(play);
  }

  if (c === 'abogado') r.mordaza = play!.id;
  if (c === 'carrete') { s.nextCarrete = me.id; r.events.push(`${me.name} activó Carrete para la siguiente ronda.`); }
  if (c === 'pareja') makePairs(s, me, ctx);
  if (c === 'ladron') ladron(s, me, ctx);
  maybeStartJudging(s, ctx);
}

function makePairs(s: State, me: Player, ctx: Ctx) {
  const r = s.round!;
  const others = shuffle(active(s).filter(p => p.id !== me.id && p.id !== r.judgeId).map(p => p.id), ctx.rng);
  const pairs: [string, string][] = [[me.id, r.judgeId]];
  for (let i = 0; i + 1 < others.length; i += 2) pairs.push([others[i], others[i + 1]]);
  r.pareja = { by: me.id, pairs };
  r.events.push(`${me.name} activó Puntos en Pareja.`);
}

function leaderOtherThan(s: State, me: Player, ctx: Ctx): Player | null {
  const others = active(s).filter(p => p.id !== me.id);
  if (!others.length) return null;
  const max = Math.max(...others.map(p => p.points));
  return pick(others.filter(p => p.points === max), ctx.rng);
}

function ladron(s: State, me: Player, ctx: Ctx) {
  const victim = leaderOtherThan(s, me, ctx);
  if (!victim) return;
  if (!autoShield(s, victim, 'ladron', me, ctx)) applyLadron(s, me, victim, ctx);
}
function applyLadron(s: State, thief: Player, victim: Player, ctx: Ctx) {
  const n = Math.min(1, victim.points);
  if (n <= 0) { notify(s, thief, ctx, 'Ladrón: el líder no tenía nada que robar.'); return; }
  addPoints(s, victim, -n); addPoints(s, thief, n);
  notify(s, victim, ctx, '🦹 Te han robado 1 punto.');
  notify(s, thief, ctx, '🦹 Has robado 1 punto al líder.');
  (s.round ? s.round.events : s.feed).push(`${thief.name} robó 1 punto a ${victim.name}.`);
}

/** Escudo automático: si el objetivo tiene Escudo, bloquea el ataque y se gasta. */
function autoShield(s: State, target: Player, kind: 'ladron' | 'cambio', from: Player, ctx: Ctx): boolean {
  const i = target.comodines.indexOf('escudo');
  if (i < 0) return false;
  target.comodines.splice(i, 1);
  const label = kind === 'ladron' ? 'Ladrón' : 'Cambio al azar';
  notify(s, target, ctx, `🛡️ Tu Escudo ha parado un ${label} que iba a por ti. Se ha gastado.`, 'round', { good: true });
  notify(s, from, ctx, `🛡️ Tu ${label} ha chocado contra un Escudo.`, 'round', { good: false });
  (s.round ? s.round.events : s.feed).push(`${target.name} paró con Escudo un ${label} de ${from.name}.`);
  return true;
}
function maybeShield(s: State, target: Player, kind: Prompt['kind'], from: string | undefined, payload: Record<string, unknown>, ctx: Ctx): Prompt | null {
  if (!target.comodines.includes('escudo')) return null;
  const pr: Prompt = { id: id(s, 'k'), to: target.id, kind, from, deadline: ctx.now + 25000, payload };
  s.prompts.push(pr);
  return pr;
}

function resolvePrompt(s: State, pr: Prompt, use: boolean, ctx: Ctx) {
  s.prompts = s.prompts.filter(p => p.id !== pr.id);
  const target = byId(s, pr.to);
  if (use) {
    const i = target.comodines.indexOf('escudo'); if (i >= 0) target.comodines.splice(i, 1);
    const label = { ladron: 'Ladrón', cambio: 'Cambio al azar', mano_ajena: 'Mano Ajena' }[pr.kind];
    (s.round ? s.round.events : s.feed).push(`${target.name} usó Escudo contra ${label}${pr.from ? ` de ${nameOf(s, pr.from)}` : ''}.`);
    if (pr.from) notify(s, byId(s, pr.from), ctx, `🛡️ Tu ${label} ha chocado contra un Escudo.`);
    return;
  }
  if (pr.kind === 'ladron') applyLadron(s, byId(s, pr.from!), target, ctx);
  if (pr.kind === 'mano_ajena') target.pending.manoAjena = true;
  if (pr.kind === 'cambio') applyCambio(s, byId(s, pr.from!), target, pr.payload.wordId as number, ctx);
}

function doTool(s: State, me: Player, a: Extract<Action, { type: 'tool' }>, ctx: Ctx) {
  const r = curRound(s, 'play');
  if (me.id === r.judgeId) fail('El juez no puede.');
  if (r.plays.some(p => p.playerId === me.id)) fail('Ya has jugado.');
  if (r.type === 'carrete' && a.comodin !== 'espia') fail('No sirve en Carrete.');
  if (a.comodin === 'espia') {
    const t = byId(s, a.target ?? '');
    if (t.id === me.id || t.id === r.judgeId) fail('Elige a otro jugador.');
    const play = r.plays.find(p => p.playerId === t.id);
    if (!play) fail(`${t.name} todavía no ha jugado. Prueba en un momento.`);
    useComodin(s, me, 'espia');
    const what = r.type === 'carrete' ? 'una foto' : play!.words.map(w => wordText(ctx, w)).join(' + ');
    notify(s, me, ctx, `🕵️ ${t.name} ha jugado: ${what}`, 'espia', { photo: play!.photo });
    r.events.push(`${me.name} espió a ${t.name}.`);
    return;
  }
  if (a.comodin === 'nuevas') {
    const idx = [...new Set(a.handIndices ?? [])].filter(i => i >= 0 && i < me.hand.length);
    if (!idx.length) fail('Elige qué palabras cambiar.');
    useComodin(s, me, 'nuevas');
    for (const i of idx) { s.discard.push(me.hand[i]); me.hand[i] = draw(s, ctx); }
    r.events.push(`${me.name} cambió ${idx.length} palabra(s) por nuevas.`);
    return;
  }
  if (a.comodin === 'cambio') {
    const i = a.handIndex ?? -1; if (i < 0 || i >= me.hand.length) fail('Elige la palabra que quieres soltar.');
    const targets = active(s).filter(p => p.id !== me.id && p.hand.length > 0);
    if (!targets.length) fail('No hay con quién cambiar.');
    useComodin(s, me, 'cambio');
    const t = pick(targets, ctx.rng);
    const wordId = me.hand[i];
    if (!autoShield(s, t, 'cambio', me, ctx)) applyCambio(s, me, t, wordId, ctx);
  }
}

function applyCambio(s: State, me: Player, t: Player, wordId: number, ctx: Ctx) {
  const i = me.hand.indexOf(wordId); if (i < 0 || !t.hand.length) return;
  const j = Math.floor(ctx.rng() * t.hand.length);
  const got = t.hand[j];
  t.hand[j] = wordId; me.hand[i] = got;
  notify(s, me, ctx, `🔄 Has cambiado «${ctx.lex.words[wordId].w}» por «${ctx.lex.words[got].w}».`);
  notify(s, t, ctx, `🔄 Alguien te ha cambiado «${ctx.lex.words[got].w}» por «${ctx.lex.words[wordId].w}».`);
  (s.round ? s.round.events : s.feed).push(`${me.name} cambió una palabra con ${t.name}.`);
}

function resolveManoAjena(s: State, targetId: string, slot: number, ctx: Ctx) {
  const r = s.round!;
  const t = byId(s, targetId);
  r.manoAjena = r.manoAjena.filter(m => m.target !== targetId);
  if (!t.hand.length) return;
  const i = Math.max(0, Math.min(t.hand.length - 1, slot));
  const w = t.hand.splice(i, 1)[0]; s.discard.push(w);
  r.plays.push({ id: id(s, 'y'), playerId: t.id, words: [{ wordId: w }], forced: true });
  notify(s, t, ctx, `Mano Ajena: juegas «${ctx.lex.words[w].w}».`);
  r.events.push(`Mano Ajena: eligieron a ciegas «${ctx.lex.words[w].w}» para ${t.name}.`);
  maybeStartJudging(s, ctx);
}

/** Modo gastar: el juez también pierde 1 palabra por ronda, para que todos tengan siempre las mismas. */
function judgeAutoDiscard(s: State, ctx: Ctx) {
  const r = s.round!;
  if (s.config.handMode !== 'deplete' || r.type !== 'normal' || !r.handStart) return;
  r.judgeDiscarded = true;
  // todos (juez incluido) acaban la ronda con exactamente una palabra menos
  for (const p of active(s)) {
    const target = (r.handStart[p.id] ?? p.hand.length) - 1;
    while (p.hand.length > Math.max(0, target)) {
      const w = p.hand.splice(Math.floor(ctx.rng() * p.hand.length), 1)[0]; s.discard.push(w);
      notify(s, p, ctx, p.id === r.judgeId ? `🗑️ Como no elegiste, se ha tirado «${ctx.lex.words[w].w}» a la papelera.` : `🗑️ Para ir igual que el resto, se ha tirado «${ctx.lex.words[w].w}».`, 'round');
    }
  }
}
function maybeStartJudging(s: State, ctx: Ctx) {
  const r = s.round!;
  if (s.phase !== 'play') return;
  const needed = active(s).filter(p => p.id !== r.judgeId && !r.skipped.includes(p.id));
  if (!needed.every(p => r.plays.some(pl => pl.playerId === p.id))) return;
  if (r.plays.length === 0) { // nadie jugó: ronda nula
    r.events.push('Nadie jugó: ronda anulada.');
    finishRound(s, ctx, null);
    return;
  }
  judgeAutoDiscard(s, ctx);
  r.order = shuffle(r.plays.map(p => p.id), ctx.rng);
  r.revealed = 0;
  s.phase = 'judging';
}

function pickWinner(s: State, me: Player, isHost: boolean, playId: string, ctx: Ctx) {
  const r = curRound(s, 'judging');
  if (r.judgeId !== me.id && !isHost) fail('Solo el juez.');
  if (r.revealed < r.plays.length) fail('Destapa primero todas las cartas.');
  const play = r.plays.find(p => p.id === playId) ?? fail('No existe.');
  r.winner = play.id; r.debate = null;
  if (r.type === 'carrete' && new Set(r.plays.map(p => p.playerId)).size >= 2) { s.phase = 'vote'; return; }
  finishRound(s, ctx, play);
}

function closeVote(s: State, ctx: Ctx) {
  const r = s.round!;
  const counts: Record<string, number> = {};
  for (const v of Object.values(r.votes)) counts[v] = (counts[v] ?? 0) + 1;
  const max = Math.max(0, ...Object.values(counts));
  r.publicWinners = max > 0 ? Object.keys(counts).filter(k => counts[k] === max) : [];
  finishRound(s, ctx, r.plays.find(p => p.id === r.winner) ?? null);
}

function finishRound(s: State, ctx: Ctx, winnerPlay: Play | null) {
  const r = s.round!;
  const mult = s.finalVuelta && s.config.finalDouble ? 2 : 1;
  const judge = byId(s, r.judgeId);
  if (winnerPlay) {
    const w = byId(s, winnerPlay.playerId);
    let base = r.todoActive.includes(w.id) ? 2 : 1;
    if (winnerPlay.comodin === 'x2') base *= 2;
    if (winnerPlay.comodin === 'x3') base *= 3;
    if (r.pareja) {
      base = Math.max(base, 2);
      const pair = r.pareja.pairs.find(pp => pp.includes(w.id));
      const partner = pair ? pair.find(x => x !== w.id) : undefined;
      if (partner) { addPoints(s, byId(s, partner), 2 * mult); r.events.push(`Puntos en Pareja: ${w.name} y ${nameOf(s, partner)} suman 2 cada uno.`); }
    }
    addPoints(s, w, base * mult);
    if (winnerPlay.comodin === 'soborno') { addPoints(s, judge, 1 * mult); r.events.push(`${judge.name} aceptó el soborno de ${w.name}.`); }
  }
  for (const pid of r.todoActive) {
    if (!winnerPlay || winnerPlay.playerId !== pid) { addPoints(s, byId(s, pid), -1); r.events.push(`${nameOf(s, pid)} perdió el Todo o Nada (−1).`); }
  }
  for (const [pid, playId] of Object.entries(r.apuestas)) {
    if (winnerPlay && playId === winnerPlay.id) { addPoints(s, byId(s, pid), 1 * mult); r.events.push(`${nameOf(s, pid)} acertó su apuesta (+1).`); }
    else r.events.push(`${nameOf(s, pid)} falló su apuesta.`);
  }
  if (r.type === 'carrete') for (const pw of r.publicWinners) addPoints(s, byId(s, r.plays.find(p => p.id === pw)!.playerId), 0.5 * mult);

  // avisos privados: qué ha hecho cada comodín
  const won = (pid: string) => !!winnerPlay && winnerPlay.playerId === pid;
  const told = new Set<string>();
  for (const pl of r.plays) {
    const p = byId(s, pl.playerId); if (!pl.comodin || p.removed || told.has(p.id)) continue;
    told.add(p.id);
    const g = r.gains[p.id] ?? 0;
    const msg: Partial<Record<Comodin, [string, string]>> = {
      x2: [`×2: tu palabra ganó y sumas ${g}.`, '×2: no ganaste, el comodín se ha gastado.'],
      x3: [`×3: tu palabra ganó y sumas ${g}.`, '×3: no ganaste, el comodín se ha gastado.'],
      soborno: ['Soborno: el juez picó. Ganas tú y él se lleva 1 punto.', 'Soborno: el juez no picó.'],
      abogado: ['Abogado: tu defensa convenció al juez.', 'Abogado: tu defensa no convenció.'],
      doble: ['Doble envío: una de tus dos palabras ha ganado.', 'Doble envío: ninguna de tus palabras ganó.'],
      escribe: ['Tu palabra escrita ha ganado.', 'Tu palabra escrita no ganó.'],
    };
    const m = msg[pl.comodin];
    if (m) notify(s, p, ctx, won(p.id) ? m[0] : m[1], 'round', { good: won(p.id) });
    if (pl.comodin === 'carrete') notify(s, p, ctx, '📸 Carrete: la próxima ronda se juega con fotos.', 'round');
  }
  if (r.pareja) for (const pair of r.pareja.pairs) for (const pid of pair) {
    const partner = pair.find(x => x !== pid)!;
    const p = s.players.find(x => x.id === pid); if (!p || p.removed) continue;
    const ok = !!winnerPlay && pair.includes(winnerPlay.playerId);
    notify(s, p, ctx, `💞 Puntos en pareja: tu pareja secreta era ${nameOf(s, partner)}. ${ok ? '¡Ganasteis y sumáis 2 cada uno!' : 'Esta vez no ganasteis.'}`, 'round', { good: ok });
  }
  for (const [pid, playId] of Object.entries(r.apuestas)) notify(s, byId(s, pid), ctx, winnerPlay && playId === winnerPlay.id ? '🎲 Apuesta acertada: +1.' : '🎲 Apuesta fallada.', 'round', { good: !!winnerPlay && playId === winnerPlay.id });
  for (const pid of r.todoActive) notify(s, byId(s, pid), ctx, won(pid) ? 'Todo o Nada: ¡ganaste! +2.' : 'Todo o Nada: no ganaste, −1.', 'round', { good: won(pid) });
  if (winnerPlay?.comodin === 'soborno') notify(s, judge, ctx, '🤫 Elegiste la palabra sobornada: +1 para ti.', 'round', { good: true });

  // mano: rellenar
  if (s.config.handMode === 'refill') for (const p of active(s)) fillHand(s, p, ctx);
  else for (const p of active(s)) if (p.hand.length === 0) fillHand(s, p, ctx);

  const voteCounts: Record<string, number> = {};
  for (const v of Object.values(r.votes)) voteCounts[v] = (voteCounts[v] ?? 0) + 1;
  const entry: HistoryEntry = {
    no: r.no, type: r.type, judge: judge.name,
    adjective: r.adjective !== null ? ctx.lex.adjs[r.adjective].a : null, phrase: r.phrase, golpeBy: r.golpeBy ? nameOf(s, r.golpeBy) : null,
    plays: r.plays.map(p => ({ player: nameOf(s, p.playerId), words: p.words.map(w => wordText(ctx, w)), photo: p.photo, comodin: p.comodin, winner: winnerPlay?.id === p.id, votes: voteCounts[p.id] })),
    gains: Object.fromEntries(Object.entries(r.gains).map(([k, v]) => [nameOf(s, k), v])), events: r.events.slice(), final: s.finalVuelta,
  };
  s.history.push(entry);
  for (const p of active(s)) {
    const g = r.gains[p.id] ?? 0;
    notify(s, p, ctx, g > 0 ? `Ronda ${r.no}: +${g} ${g === 1 ? 'punto' : 'puntos'}.` : g < 0 ? `Ronda ${r.no}: ${g} punto(s).` : `Ronda ${r.no}: sin puntos.`, 'gain', { gain: g });
  }
  s.phase = 'reveal';
}

function advance(s: State, ctx: Ctx) {
  const r = s.round!;
  // cuenta atrás
  if (s.countdown.active) {
    s.countdown.queue.shift();
    if (s.countdown.queue.length === 0) return endGame(s);
  } else {
    const n = s.judgeOrder.filter(pid => !byId(s, pid).removed).length;
    s.judgeIdx = (s.judgeIdx + 1) % n;
    if (active(s).some(p => p.points >= s.config.target)) {
      const order = s.judgeOrder.filter(pid => !byId(s, pid).removed);
      const rest = s.judgeIdx === 0 ? [] : order.slice(s.judgeIdx);
      s.countdown = { active: true, queue: [...rest, ...order], finalLen: order.length, triggeredBy: r.no };
      s.feed.push('⚠️ Alguien ha llegado a la meta. Empieza la cuenta atrás.');
    }
  }
  s.round = null;
  s.roundsSinceRoulette += 1;
  if (s.roundsSinceRoulette >= 3) openRoulette(s);
  else startRound(s, ctx);
}

function endGame(s: State) {
  s.round = null; s.phase = 'end';
  const ranking = active(s).map(p => ({ id: p.id, name: p.name, points: p.points })).sort((a, b) => a.points - b.points);
  s.reveal = { ranking, shown: 0 };
}

function passJudge(s: State, ctx: Ctx) {
  const r = s.round!;
  const cur = r.judgeId;
  if (s.countdown.active) {
    const q = s.countdown.queue;
    if (q.length < 2) fail('No hay a quién pasarle el turno.');
    [q[0], q[1]] = [q[1], q[0]];
  } else {
    const order = s.judgeOrder;
    const i = order.indexOf(cur); const j = (i + 1) % order.length;
    [order[i], order[j]] = [order[j], order[i]];
  }
  r.events.push(`${nameOf(s, cur)} pasó su turno de juez.`);
  // devolver adjetivos y reiniciar ronda
  s.roundNo -= 1;
  startRound(s, ctx);
}

function removePlayer(s: State, t: Player, ctx: Ctx) {
  t.removed = true;
  s.deck.push(...t.hand); t.hand = [];
  s.feed.push(`${t.name} ha salido de la partida.`);
  s.prompts = s.prompts.filter(p => p.to !== t.id);
  if (s.roulette) { s.roulette.pending = s.roulette.pending.filter(x => x !== t.id); maybeFinishRoulette(s, ctx); }
  if (s.phase === 'order') maybeFinishOrder(s, ctx);
  if (s.round) {
    const r = s.round;
    r.manoAjena = r.manoAjena.filter(m => m.target !== t.id);
    for (const m of r.manoAjena) if (m.chooser === t.id) m.chooser = pick(active(s).filter(p => p.id !== m.target), ctx.rng).id;
    if (r.judgeId === t.id && ['adjective', 'play', 'judging', 'vote'].includes(s.phase)) {
      // el juez se ha ido: se devuelven las palabras jugadas y se repite la ronda con otro juez
      const back = new Set<string>();
      for (const pl of r.plays) {
        const owner = s.players.find(p => p.id === pl.playerId);
        if (!owner || owner.removed) continue;
        if (pl.comodin && back.has(owner.id)) { for (const w of pl.words) if (w.wordId !== undefined) { s.discard = s.discard.filter(x => x !== w.wordId); owner.hand.push(w.wordId); } continue; }
        back.add(owner.id);
        for (const w of pl.words) if (w.wordId !== undefined) { s.discard = s.discard.filter(x => x !== w.wordId); owner.hand.push(w.wordId); }
        if (pl.comodin && !['ladron', 'carrete', 'pareja'].includes(pl.comodin) && owner.comodines.length < 2) owner.comodines.push(pl.comodin);
      }
      s.feed.push('El juez ha salido: se repite la ronda con otro juez.');
      if (!s.countdown.active) { const order = s.judgeOrder.filter(pid => !byId(s, pid).removed); s.judgeIdx = s.judgeIdx % Math.max(1, order.length); }
      s.roundNo -= 1; startRound(s, ctx); return;
    }
    if (s.phase === 'play') maybeStartJudging(s, ctx);
  }
}

function checkReport(s: State, ctx: Ctx) {
  const rep = s.report!;
  const voters = active(s).filter(p => p.id !== rep.accused);
  if (Object.values(rep.votes).some(v => v === false)) {
    s.feed.push(`Absuelto: ${nameOf(s, rep.accused)} no ha hecho trampas.`);
    s.report = null; return;
  }
  if (!voters.every(p => rep.votes[p.id] === true)) return;
  const acc = byId(s, rep.accused);
  const last = s.history.find(h => h.no === rep.round);
  const annul = last ? Math.max(0, last.gains[acc.name] ?? 0) : 0;
  acc.points = Math.round((acc.points - 1 - annul) * 2) / 2;
  if (last) last.events.push(`⚖️ ${acc.name} condenado por trampas: −1${annul ? ` y se le anulan ${annul}` : ''}.`);
  notify(s, acc, ctx, `⚖️ Condenado por trampas: −1${annul ? ` y pierdes los ${annul} de la última ronda` : ''}.`);
  s.feed.push(`⚖️ Culpable: ${acc.name} pierde puntos por tramposo.`);
  s.report = null;
}

function tick(s: State, ctx: Ctx) {
  for (const pr of s.prompts.slice()) if (ctx.now > pr.deadline) resolvePrompt(s, pr, false, ctx);
  const r = s.round;
  if (!r) return;
  if (s.phase === 'adjective' && r.type === 'normal' && r.adjective === null && ctx.now > r.adjDeadline) {
    r.adjective = r.adjOptions[Math.floor(ctx.rng() * 3)];
    r.events.push('Se acabó el tiempo: el adjetivo salió al azar.');
    startPlay(s, ctx);
  }
  if (s.phase === 'play') for (const m of r.manoAjena.slice()) if (ctx.now > m.deadline) resolveManoAjena(s, m.target, Math.floor(ctx.rng() * 7), ctx);
  if (s.phase === 'play' && r.playDeadline && ctx.now > r.playDeadline) {
    for (const p of active(s)) {
      if (p.id === r.judgeId || r.skipped.includes(p.id) || r.plays.some(pl => pl.playerId === p.id) || r.manoAjena.some(m => m.target === p.id)) continue;
      if (r.type === 'normal' && p.hand.length) {
        const i = Math.floor(ctx.rng() * p.hand.length);
        const w = p.hand.splice(i, 1)[0]; s.discard.push(w);
        r.plays.push({ id: id(s, 'y'), playerId: p.id, words: [{ wordId: w }], forced: true });
        notify(s, p, ctx, `⏱️ Se acabó el tiempo: se ha jugado «${ctx.lex.words[w].w}» al azar.`, 'round');
        r.events.push(`${p.name} se quedó sin tiempo y jugó una palabra al azar.`);
      } else { r.skipped.push(p.id); notify(s, p, ctx, '⏱️ Se acabó el tiempo: esta ronda no juegas.', 'round'); }
    }
    maybeStartJudging(s, ctx);
  }
}

/* ------------------------------ vistas ----------------------------- */

export function publicView(s: State, ctx: Pick<Ctx, 'lex'>) {
  const r = s.round;
  const adj = r && r.adjective !== null ? ctx.lex.adjs[r.adjective] : null;
  const showPlays = s.phase === 'judging' || s.phase === 'vote' || s.phase === 'reveal';
  const playMap = new Map(r?.plays.map(p => [p.id, p]) ?? []);
  return {
    code: s.code, phase: s.phase, hostId: s.hostId, config: s.config, roundNo: s.roundNo,
    players: s.players.map(p => ({
      id: p.id, name: p.name, avatar: p.avatar ?? '', removed: p.removed,
      played: !!r && r.plays.some(pl => pl.playerId === p.id), skipped: !!r && r.skipped.includes(p.id),
    })),
    judgeOrder: s.judgeOrder.map(x => nameOf(s, x)),
    judgeOrderIds: s.judgeOrder,
    orderPick: s.orderPick ? { count: s.orderPick.cards.length, picks: Object.fromEntries(Object.entries(s.orderPick.picks).map(([pid, c]) => [c, { name: nameOf(s, pid), number: s.phase === 'order' && Object.keys(s.orderPick!.picks).length < s.orderPick!.cards.length ? null : s.orderPick!.cards[c] }])) } : null,
    roulette: s.roulette ? { pending: s.roulette.pending, spun: Object.keys(s.roulette.results) } : null,
    round: r ? {
      no: r.no, type: r.type, judgeId: r.judgeId,
      adjective: adj ? { a: adj.a, s: adj.s } : null, phrase: r.phrase,
      adjDeadline: r.adjDeadline, golpe: !!r.golpeBy,
      plays: showPlays ? r.order.map((pid, i) => {
        const p = playMap.get(pid)!;
        if (s.phase === 'judging' && i >= r.revealed) return { id: p.id, hidden: true as const, words: [] as { w: string; d: string; custom: boolean; id?: number }[], photo: undefined as string | undefined };
        return { id: p.id, hidden: false as const, words: p.words.map(w => ({ w: w.custom ?? ctx.lex.words[w.wordId!].w, d: w.custom ? 'Escrita por un jugador' : ctx.lex.words[w.wordId!].d, custom: !!w.custom, id: w.wordId })), photo: p.photo };
      }) : [],
      revealed: r.revealed, total: r.plays.length, playDeadline: r.playDeadline,
      discarded: r.discarded, debate: r.debate, mordaza: r.mordaza,
      winner: s.phase === 'reveal' || s.phase === 'vote' ? r.winner : null,
      publicWinners: s.phase === 'reveal' ? r.publicWinners : [],
      votesIn: Object.keys(r.votes).length,
      pareja: !!r.pareja, apuestas: Object.keys(r.apuestas).length,
      manoAjena: r.manoAjena.map(m => nameOf(s, m.target)),
    } : null,
    countdown: s.countdown.active, finalVuelta: s.finalVuelta, roundsLeft: s.countdown.active ? s.countdown.queue.length : null,
    report: s.report ? { id: s.report.id, by: nameOf(s, s.report.by), accused: s.report.accused, accusedName: nameOf(s, s.report.accused), votes: Object.keys(s.report.votes).length, needed: active(s).length - 1 } : null,
    reclaims: s.reclaims.map(q => ({ id: q.id, name: q.name })),
    feed: s.feed.slice(-8),
    nextCarrete: !!s.nextCarrete,
    reveal: s.reveal ? { total: s.reveal.ranking.length, shown: s.reveal.shown, ranking: s.reveal.ranking.slice(0, s.reveal.shown) } : null,
    history: s.phase === 'end' && s.reveal && s.reveal.shown >= s.reveal.ranking.length ? s.history : null,
  };
}

export function privateView(s: State, pid: string, ctx: Pick<Ctx, 'lex'>) {
  const p = s.players.find(x => x.id === pid);
  if (!p) return null;
  const r = s.round;
  const isJudge = r?.judgeId === p.id;
  const myPlay = r?.plays.find(x => x.playerId === p.id);
  const rr = s.roulette?.results[p.id];
  return {
    id: p.id, name: p.name, isHost: s.hostId === p.id, points: p.points,
    hand: p.hand.map(w => ({ id: w, w: ctx.lex.words[w].w, d: ctx.lex.words[w].d })),
    comodines: p.comodines, pending: p.pending,
    notices: p.notices,
    isJudge,
    adjOptions: r && (isJudge || p.comodines.includes('golpe')) && s.phase === 'adjective' && r.type === 'normal'
      ? r.adjOptions.map(i => ctx.lex.adjs[i]) : null,
    sobornos: isJudge && r && (s.phase === 'judging' || s.phase === 'vote') ? r.plays.filter(x => x.comodin === 'soborno').length : 0,
    myPlayId: myPlay?.id ?? null,
    myPlayIds: r ? r.plays.filter(x => x.playerId === p.id).map(x => x.id) : [],
    mustDiscard: !!r && s.phase === 'play' && r.judgeId === p.id && s.config.handMode === 'deplete' && r.type === 'normal' && !r.judgeDiscarded,
    usedComodin: r?.comodinUsed[p.id] ?? null,
    manoAjenaTask: r?.manoAjena.find(m => m.chooser === p.id) ? { target: nameOf(s, r!.manoAjena.find(m => m.chooser === p.id)!.target), slots: byId(s, r!.manoAjena.find(m => m.chooser === p.id)!.target).hand.length } : null,
    manoAjenaMe: !!r?.manoAjena.some(m => m.target === p.id),
    todoActive: !!r?.todoActive.includes(p.id),
    myApuesta: r?.apuestas[p.id] ?? null,
    myVote: r?.votes[p.id] ?? null,
    prompts: s.prompts.filter(x => x.to === p.id).map(x => ({ id: x.id, kind: x.kind, deadline: x.deadline })),
    roulette: rr ? { label: rr.label, slot: rr.slot, hint: rr.hint, needsChoice: rr.needsChoice, offered: rr.offered, item: rr.item } : null,
    myVoteReport: s.report ? s.report.votes[p.id] ?? null : null,
    myOrder: s.orderPick && s.orderPick.picks[p.id] !== undefined ? s.orderPick.cards[s.orderPick.picks[p.id]] : null,
    avatar: p.avatar ?? '',
    lastGain: r ? r.gains[p.id] ?? 0 : null,
  };
}
