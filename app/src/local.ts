// Servidor local (demo): mismo protocolo que la Edge Function, todo en el navegador.
import { apply, newGame, privateView, publicView, playerForUid, GameError, type Ctx, type Lexicon } from '../../engine/engine';
import type { State } from '../../engine/types';
import words from '../../data/words.json';
import adjs from '../../data/adjectives.json';

const clean = (x: string) => x.replace(/&#32;/g, ' ').replace(/\s+/g, ' ').trim();
export const lex: Lexicon = { words: (words as Lexicon['words']).map(w => ({ w: clean(w.w), d: clean(w.d) })), adjs: adjs as Lexicon['adjs'] };
interface G { s: State; prev: State | null; v: number }
const KEY = 'lp.demo.games';
let games: Record<string, G> = {};
try { games = JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { games = {}; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(games)); } catch { /* sin almacenamiento: solo en memoria */ } };
const listeners = new Set<() => void>();
export const onLocalChange = (f: () => void) => { listeners.add(f); return () => listeners.delete(f); };
const emit = () => { save(); listeners.forEach(f => f()); };

export const views = (s: State, t: string, v: number) => {
  const me = playerForUid(s, t);
  return { version: v, public: publicView(s, { lex }), private: me ? privateView(s, me.id, { lex }) : null, pendingReclaim: !me && s.reclaims.some(r => r.uid === t) };
};
export const getGame = (code: string) => games[code];

export function localHandle(b: Record<string, any>): { status: number; body: any } {
  const t = String(b.token);
  const ctx: Ctx = { now: Date.now(), rng: Math.random, lex, uid: t };
  try {
    if (b.op === 'create') {
      const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
      const code = Array.from({ length: 4 }, () => L[Math.floor(Math.random() * L.length)]).join('');
      const s = newGame(code, code, ctx, b.name, b.avatar);
      games[code] = { s, prev: null, v: 1 }; emit();
      return { status: 200, body: views(s, t, 1) };
    }
    const g = games[String(b.code).toUpperCase()];
    if (!g) throw new GameError('No existe ninguna partida con ese código.');
    if (b.op === 'state') return { status: 200, body: views(g.s, t, g.v) };
    if (b.op === 'act') {
      if (b.action.type === 'undo') {
        if (!g.prev) throw new GameError('No hay nada que deshacer.');
        g.s = g.prev; g.prev = null; g.v++; emit();
        return { status: 200, body: views(g.s, t, g.v) };
      }
      const before = JSON.stringify(g.s);
      const next = apply(JSON.parse(before), b.action, ctx, b.actionId);
      if (JSON.stringify(next) !== before) {
        if (b.action.type === 'pickWinner') g.prev = JSON.parse(before);
        if (b.action.type === 'next') g.prev = null;
        g.s = next; g.v++; emit();
      }
      return { status: 200, body: views(g.s, t, g.v) };
    }
    return { status: 400, body: { error: 'Operación desconocida.' } };
  } catch (e) {
    if (e instanceof GameError) return { status: 400, body: { error: e.message } };
    console.error(e);
    return { status: 500, body: { error: 'Error del motor.' } };
  }
}
