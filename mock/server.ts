// Servidor de pruebas local: mismo protocolo que la Edge Function, todo en memoria.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { apply, newGame, privateView, publicView, playerForUid, GameError, type Ctx, type Lexicon } from '../engine/engine.ts';
import type { State } from '../engine/types.ts';
const lex: Lexicon = { words: JSON.parse(readFileSync(new URL('../data/words.json', import.meta.url), 'utf8')), adjs: JSON.parse(readFileSync(new URL('../data/adjectives.json', import.meta.url), 'utf8')) };
const games = new Map<string, { s: State; prev: State | null; v: number }>();
const views = (s: State, t: string, v: number) => { const me = playerForUid(s, t); return { version: v, public: publicView(s, { lex }), private: me ? privateView(s, me.id, { lex }) : null, pendingReclaim: !me && s.reclaims.some(r => r.uid === t) }; };
createServer(async (req, res) => {
  const send = (b: unknown, st = 200) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(b)); };
  let raw = ''; for await (const c of req) raw += c;
  try {
    const b = JSON.parse(raw || '{}'); const t = String(b.token);
    const ctx: Ctx = { now: Date.now(), rng: Math.random, lex, uid: t };
    if (b.op === 'create') { const code = 'TEST'.slice(0, 4 - String(games.size).length) + (games.size || ''); const s = newGame(code, code.padEnd(4, 'X').slice(0, 4), ctx, b.name, b.avatar); games.set(s.code, { s, prev: null, v: 1 }); return send(views(s, t, 1)); }
    const g = games.get(String(b.code).toUpperCase()); if (!g) throw new GameError('No existe ninguna partida con ese código.');
    if (b.op === 'state') return send(views(g.s, t, g.v));
    if (b.op === 'debug') { for (const p of g.s.players) { if (b.comodines) p.comodines = b.comodines; if (typeof b.points === 'number') p.points = b.points; } g.v++; return send(views(g.s, t, g.v)); }
    if (b.op === 'act') {
      if (b.action.type === 'undo') { if (g.prev) { g.s = g.prev; g.prev = null; g.v++; } return send(views(g.s, t, g.v)); }
      const before = JSON.stringify(g.s);
      const next = apply(JSON.parse(before), b.action, ctx, b.actionId);
      if (JSON.stringify(next) !== before) { if (b.action.type === 'pickWinner') g.prev = JSON.parse(before); g.s = next; g.v++; }
      return send(views(g.s, t, g.v));
    }
    send({ error: 'op' }, 400);
  } catch (e) { if (e instanceof GameError) send({ error: e.message }, 400); else { console.error(e); send({ error: 'Error del servidor.' }, 500); } }
}).listen(8787, () => console.log('mock on 8787'));
