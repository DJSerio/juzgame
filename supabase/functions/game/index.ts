import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { apply, newGame, privateView, publicView, playerForUid, leagueEntry, GameError, type Ctx, type Lexicon } from './engine.ts';
import type { Action, State } from './types.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const clean = (s: string) => s.replace(/&#32;/g, ' ').replace(/\s+/g, ' ').trim();
let lex: Lexicon = { words: [], adjs: [] };
async function loadLex() {
  if (lex.words.length) return;
  const { data, error } = await db.from('lexicon').select('id, data').order('id');
  if (error) throw error;
  const words: Lexicon['words'] = []; const adjs: Lexicon['adjs'] = [];
  for (const row of data!) {
    if (row.id < 3) for (const [w, d] of row.data as [string, string][]) words.push({ w: clean(w), d: clean(d) });
    else for (const [a, s] of row.data as [string, string[]][]) adjs.push({ a: clean(a), s });
  }
  lex = { words, adjs };
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const rng = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
const SNAPSHOT_BEFORE = new Set(['pickWinner', 'vote', 'closeVote']);

function views(s: State, token: string, version: number) {
  const me = playerForUid(s, token);
  return { version, public: publicView(s, { lex }), private: me ? privateView(s, me.id, { lex }) : null, pendingReclaim: !me && s.reclaims.some(r => r.uid === token) };
}

async function load(code: string) {
  const { data: g } = await db.from('games').select('id, code').eq('code', code.toUpperCase()).maybeSingle();
  if (!g) throw new GameError('No existe ninguna partida con ese código.');
  const { data: st, error } = await db.from('game_state').select('state, prev, version').eq('game_id', g.id).single();
  if (error) throw error;
  return { id: g.id as string, state: st.state as State, prev: st.prev as State | null, version: st.version as number };
}

async function save(id: string, state: State, prev: State | null, version: number) {
  const { data, error } = await db.from('game_state').update({ state, prev, version: version + 1 }).eq('game_id', id).eq('version', version).select('version');
  if (error) throw error;
  if (!data?.length) return false;
  await db.from('games').update({ version: version + 1, public: publicView(state, { lex }), updated_at: new Date().toISOString() }).eq('id', id);
  return true;
}

function code() {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from({ length: 4 }, () => L[Math.floor(rng() * L.length)]).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    await loadLex();
    const body = await req.json();
    const token = String(body.token ?? '');
    if (token.length < 16) return json({ error: 'Token inválido.' }, 400);

    if (body.op === 'create') {
      for (let i = 0; i < 6; i++) {
        const c = code();
        const { data: g, error } = await db.from('games').insert({ code: c }).select('id').single();
        if (error) continue;
        const ctx: Ctx = { now: Date.now(), rng, lex, uid: token };
        const s = newGame(g.id, c, ctx, String(body.name ?? ''), String(body.avatar ?? ''));
        await db.from('game_state').insert({ game_id: g.id, state: s, version: 1 });
        await db.from('games').update({ version: 1, public: publicView(s, { lex }) }).eq('id', g.id);
        return json(views(s, token, 1));
      }
      return json({ error: 'No se pudo crear la sala.' }, 500);
    }

    if (body.op === 'league') {
      const { data, error } = await db.from('league').select('created_at, code, players').order('created_at', { ascending: false }).limit(300);
      if (error) throw error;
      return json({ games: data });
    }
    if (body.op === 'state') {
      const g = await load(String(body.code ?? ''));
      return json(views(g.state, token, g.version));
    }

    if (body.op === 'upload') {
      const g = await load(String(body.code ?? ''));
      if (!playerForUid(g.state, token)) return json({ error: 'No estás en esta partida.' }, 403);
      const path = `${g.id}/${crypto.randomUUID()}.jpg`;
      const { data, error } = await db.storage.from('carrete').createSignedUploadUrl(path);
      if (error) throw error;
      const { data: pub } = db.storage.from('carrete').getPublicUrl(path);
      return json({ path, token: data.token, signedUrl: data.signedUrl, publicUrl: pub.publicUrl });
    }

    if (body.op === 'act') {
      const action = body.action as Action;
      for (let attempt = 0; attempt < 10; attempt++) {
        const g = await load(String(body.code ?? ''));
        let next: State; let prev = g.prev;
        if (action.type === 'undo') {
          const me = playerForUid(g.state, token);
          if (!me || me.id !== g.state.hostId) throw new GameError('Solo el anfitrión puede deshacer.');
          if (!g.prev || !['vote', 'reveal'].includes(g.state.phase)) throw new GameError('No hay nada que deshacer.');
          next = g.prev; prev = null;
          next.feed.push('↩️ El anfitrión ha deshecho la última decisión del juez.');
        } else {
          const ctx: Ctx = { now: Date.now(), rng, lex, uid: token };
          const before = JSON.stringify(g.state);
          next = apply(JSON.parse(before), action, ctx, body.actionId ? String(body.actionId) : undefined);
          if (JSON.stringify(next) === before) return json(views(g.state, token, g.version)); // nada cambió (p.ej. tick)
          if (SNAPSHOT_BEFORE.has(action.type) && g.state.phase !== 'vote') prev = JSON.parse(before);
          if (action.type === 'vote' && next.phase === 'vote') prev = g.prev; // voto parcial: conservar
          if (action.type === 'next') prev = null;
        }
        const toLeague = next.phase === 'end' && !next.leagueSaved && next.history.length > 0;
        if (toLeague) next.leagueSaved = true;
        if (await save(g.id, next, prev, g.version)) {
          if (toLeague) await db.from('league').insert({ code: next.code, players: leagueEntry(next) });
          return json(views(next, token, g.version + 1));
        }
        await new Promise(r => setTimeout(r, 30 + Math.random() * 120));
      }
      return json({ error: 'Mucho tráfico, inténtalo otra vez.' }, 409);
    }
    return json({ error: 'Operación desconocida.' }, 400);
  } catch (e) {
    if (e instanceof GameError) return json({ error: e.message }, 400);
    console.error(e);
    return json({ error: 'Error del servidor.' }, 500);
  }
});
