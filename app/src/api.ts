import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { ANON_KEY, API_URL, DEMO, MOCK, SUPABASE_URL } from './config';
import { localHandle } from './local';
import type { publicView, privateView } from '../../engine/engine';
import type { Action } from '../../engine/types';

export type Pub = ReturnType<typeof publicView>;
export type Priv = NonNullable<ReturnType<typeof privateView>>;
export interface Snapshot { version: number; public: Pub; private: Priv | null; pendingReclaim?: boolean }

/* -------------------- estado global mínimo -------------------- */
export interface AppState {
  code: string | null;
  snap: Snapshot | null;
  online: boolean;          // conexión con el servidor
  live: boolean;            // canal realtime activo
  pending: number;          // acciones en cola
  error: string | null;
  presence: Record<string, boolean>;
  busy: boolean;
}
let state: AppState = { code: null, snap: null, online: true, live: false, pending: 0, error: null, presence: {}, busy: false };
const subs = new Set<() => void>();
export const getState = () => state;
export const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
function set(p: Partial<AppState>) { state = { ...state, ...p }; subs.forEach(f => f()); }

/* -------------------- identidad -------------------- */
const LS = { token: 'lp.token', code: 'lp.code', name: 'lp.name', outbox: 'lp.outbox' };
const ls = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* */ } },
  del(k: string) { try { localStorage.removeItem(k); } catch { /* */ } },
};
let demoToken: string | null = null;
export function setDemoToken(t: string) { demoToken = t; }
export function token(): string {
  if (DEMO && demoToken) return demoToken;
  let t = ls.get(LS.token);
  if (!t) { t = crypto.randomUUID() + crypto.randomUUID(); ls.set(LS.token, t); }
  return t;
}
export const savedName = () => ls.get(LS.name) ?? '';
export const savedCode = () => ls.get(LS.code);

/* -------------------- llamadas -------------------- */
async function call(body: Record<string, unknown>, timeoutMs = 12000): Promise<any> {
  if (DEMO) {
    const r = localHandle({ ...body, token: token() });
    if (r.status >= 400) { const e = new Error(r.body.error) as Error & { status?: number }; e.status = r.status; throw e; }
    return r.body;
  }
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(API_URL, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
      body: JSON.stringify({ ...body, token: token() }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || `Error ${r.status}`) as Error & { status?: number }; e.status = r.status; throw e; }
    return j;
  } finally { clearTimeout(to); }
}
const isNetwork = (e: unknown) => !(e as { status?: number }).status || (e as { status: number }).status >= 500 || (e as { status: number }).status === 409;

function accept(s: Snapshot) {
  if (state.snap && s.version < state.snap.version) return;
  set({ snap: s, online: true });
}

export async function refresh() {
  if (!state.code) return;
  try { accept(await call({ op: 'state', code: state.code })); set({ online: true }); }
  catch (e) { if (isNetwork(e)) set({ online: false }); else set({ error: (e as Error).message }); }
}

export async function createGame(name: string, avatar: string) {
  set({ busy: true, error: null });
  try {
    ls.set(LS.name, name);
    const s: Snapshot = await call({ op: 'create', name, avatar });
    enterRoom(s.public.code); accept(s);
  } catch (e) { set({ error: (e as Error).message }); } finally { set({ busy: false }); }
}

export interface LeagueGame { created_at: string; code: string; players: { name: string; avatar: string; points: number; pos: number; league: number }[] }
export async function fetchLeague(): Promise<LeagueGame[]> {
  try { const r = await call({ op: 'league' }); return r.games ?? []; } catch { return []; }
}

export async function peekGame(code: string): Promise<{ taken: string[] } | null> {
  set({ busy: true, error: null });
  try { const s: Snapshot = await call({ op: 'state', code: code.trim().toUpperCase() }); return { taken: s.public.players.filter(p => !p.removed).map(p => p.avatar).filter(Boolean) }; }
  catch (e) { set({ error: (e as Error).message }); return null; } finally { set({ busy: false }); }
}

export async function joinGame(code: string, name: string, avatar: string) {
  set({ busy: true, error: null });
  try {
    ls.set(LS.name, name);
    const c = code.trim().toUpperCase();
    const s: Snapshot = await call({ op: 'act', code: c, action: { type: 'join', name, avatar }, actionId: crypto.randomUUID() });
    enterRoom(c); accept(s);
  } catch (e) { set({ error: (e as Error).message }); } finally { set({ busy: false }); }
}

export function leaveRoom() {
  ls.del(LS.code); ls.del(LS.outbox);
  channel?.unsubscribe(); channel = null;
  set({ code: null, snap: null, presence: {}, pending: 0 });
}

/* -------------------- cola de acciones (offline-safe) -------------------- */
interface Queued { id: string; action: Action; at: number }
let outbox: Queued[] = (() => { try { return JSON.parse(ls.get(LS.outbox) ?? '[]'); } catch { return []; } })();
const persistOutbox = () => { ls.set(LS.outbox, JSON.stringify(outbox)); set({ pending: outbox.length }); };
let flushing = false;

export function act(action: Action) {
  outbox.push({ id: crypto.randomUUID(), action, at: Date.now() });
  persistOutbox();
  void flush();
}

async function flush() {
  if (flushing || !state.code) return;
  flushing = true;
  let delay = 600;
  try {
    while (outbox.length) {
      const q = outbox[0];
      // acciones viejas (más de 10 min) se descartan: el juego habrá avanzado
      if (Date.now() - q.at > 10 * 60_000) { outbox.shift(); persistOutbox(); continue; }
      try {
        const s = await call({ op: 'act', code: state.code, action: q.action, actionId: q.id });
        accept(s); outbox.shift(); persistOutbox(); delay = 600;
      } catch (e) {
        if (isNetwork(e)) {
          set({ online: false });
          await new Promise(r => setTimeout(r, delay)); delay = Math.min(delay * 2, 8000);
          continue;
        }
        outbox.shift(); persistOutbox();
        if (q.action.type !== 'tick') toast((e as Error).message);
        void refresh();
      }
    }
  } finally { flushing = false; }
}

/* -------------------- avisos -------------------- */
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string) {
  set({ error: msg });
  clearTimeout(toastTimer); toastTimer = setTimeout(() => set({ error: null }), 3500);
}

/* -------------------- tiempo real + respaldo -------------------- */
const sb = MOCK || DEMO ? null : createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
let channel: RealtimeChannel | null = null;
let pollTimer: ReturnType<typeof setInterval> | undefined;

export function enterRoom(code: string) {
  ls.set(LS.code, code);
  set({ code });
  connectRealtime();
  void flush();
}

function connectRealtime() {
  if (!sb || !state.code) return;
  channel?.unsubscribe();
  const code = state.code;
  channel = sb.channel(`room:${code}`, { config: { presence: { key: token().slice(0, 12) } } })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `code=eq.${code}` }, (payload) => {
      const v = (payload.new as { version: number }).version;
      if (!state.snap || v > state.snap.version) void refresh();
    })
    .on('presence', { event: 'sync' }, () => {
      const st = channel!.presenceState() as Record<string, { pid?: string }[]>;
      const pres: Record<string, boolean> = {};
      for (const arr of Object.values(st)) for (const m of arr) if (m.pid) pres[m.pid] = true;
      set({ presence: pres });
    })
    .subscribe((status) => {
      set({ live: status === 'SUBSCRIBED' });
      if (status === 'SUBSCRIBED') { void refresh(); trackPresence(); }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setTimeout(() => { if (state.code === code && !state.live) connectRealtime(); }, 3000);
    });
}

let trackedPid: string | null = null;
function trackPresence() {
  const pid = state.snap?.private?.id;
  if (!channel || !pid || !state.live) return;
  trackedPid = pid;
  void channel.track({ pid, at: Date.now() });
}
subscribe(() => { const pid = state.snap?.private?.id; if (pid && pid !== trackedPid) trackPresence(); });

function startLoops() {
  clearInterval(pollTimer);
  // respaldo: si el tiempo real cae, consulta cada 3 s; si va bien, cada 15 s por seguridad
  let last = 0;
  pollTimer = setInterval(() => {
    const now = Date.now();
    const every = state.live ? 15000 : 3000;
    if (state.code && now - last >= every) { last = now; void refresh(); }
    if (outbox.length) void flush();
    maybeTick();
  }, 1000);
  window.addEventListener('online', () => { void refresh(); void flush(); connectRealtime(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { void refresh(); void flush(); if (!state.live) connectRealtime(); void wakeLock(); }
  });
}

let lastTick = 0;
function maybeTick() {
  const s = state.snap; if (!s) return;
  const now = Date.now(); if (now - lastTick < 4000) return;
  const r = s.public.round;
  const due = (s.public.phase === 'adjective' && r?.type === 'normal' && !r.adjective && now > r.adjDeadline + 800)
    || (s.private?.prompts ?? []).some(p => now > p.deadline + 800);
  if (due) { lastTick = now; act({ type: 'tick' }); }
}

/* -------------------- pantalla encendida -------------------- */
export let lock: { release: () => Promise<void> } | null = null;
export async function wakeLock() {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    if (nav.wakeLock && document.visibilityState === 'visible') lock = await nav.wakeLock.request('screen');
  } catch { lock = null; }
}

/* -------------------- fotos del Carrete -------------------- */
export async function compressImage(file: File, max = 1280, quality = 0.72): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null);
  const img: CanvasImageSource & { width: number; height: number } = bmp ?? await new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file);
  });
  // recorte 4:5 para que todas tengan el mismo formato
  const targetRatio = 4 / 5;
  let sw = img.width, sh = img.height, sx = 0, sy = 0;
  if (sw / sh > targetRatio) { sw = sh * targetRatio; sx = (img.width - sw) / 2; } else { sh = sw / targetRatio; sy = (img.height - sh) / 2; }
  const w = Math.min(max, Math.round(sw)), h = Math.round(w / targetRatio);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  return await new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('No se pudo procesar la foto'))), 'image/jpeg', quality));
}

export async function uploadPhoto(file: File): Promise<string> {
  const blob = await compressImage(file);
  if (MOCK || DEMO) return await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(blob); });
  for (let i = 0; i < 4; i++) {
    try {
      const u = await call({ op: 'upload', code: state.code });
      const { error } = await sb!.storage.from('carrete').uploadToSignedUrl(u.path, u.token, blob, { contentType: 'image/jpeg' });
      if (error) throw error;
      return u.publicUrl as string;
    } catch (e) {
      if (i === 3) throw e;
      await new Promise(r => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw new Error('No se pudo subir');
}

/* -------------------- arranque -------------------- */
export function boot() {
  startLoops();
  const params = new URLSearchParams(location.search);
  const urlCode = params.get('c');
  const code = savedCode();
  if (!DEMO && code && (!urlCode || urlCode.toUpperCase() === code)) { enterRoom(code); void refresh(); }
  void wakeLock();
}
if (import.meta.env.DEV) (window as unknown as { __st: () => AppState; __ob: () => unknown }).__st = () => state;
if (import.meta.env.DEV) (window as unknown as { __ob: () => unknown }).__ob = () => outbox;
