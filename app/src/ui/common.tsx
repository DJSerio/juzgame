import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { act, getState, subscribe, leaveRoom, type Pub, type Priv } from '../api';
import { DEMO } from '../config';
import { Avatar } from './avatar';
import { createPortal } from 'react-dom';
import type { Comodin } from '../../../engine/types';

export const useApp = () => useSyncExternalStore(subscribe, getState);
export function useNow(ms = 1000) {
  const [n, setN] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setN(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return n;
}

/* ================= comodines ================= */
type When = 'play' | 'tool' | 'golpe' | 'apuesta' | 'escudo';
export const cLabel = (c: Comodin) => COMODIN[c].icon === COMODIN[c].name ? COMODIN[c].name : `${COMODIN[c].icon} ${COMODIN[c].name}`;
export const COMODIN: Record<Comodin, { name: string; icon: string; desc: string; when: When; good: string; steps: string[] }> = {
  x2: { name: '×2', icon: '×2', desc: 'Si tu palabra gana, sumas el doble.', when: 'play', good: 'Ganas 2 puntos en vez de 1.', steps: ['Elige tu palabra', 'Pulsa «Jugar con ×2»'] },
  x3: { name: '×3', icon: '×3', desc: 'Si tu palabra gana, sumas el triple.', when: 'play', good: 'Ganas 3 puntos en vez de 1.', steps: ['Elige tu palabra', 'Pulsa «Jugar con ×3»'] },
  cambio: { name: 'Cambio al azar', icon: '🔄', desc: 'Sueltas tu peor palabra y recibes una de la mano de otro jugador al azar.', when: 'tool', good: 'Te quitas una palabra mala.', steps: ['Toca la palabra que quieres soltar', 'Pulsa «Soltar esta palabra»', 'Después juega con normalidad'] },
  nuevas: { name: 'Palabras nuevas', icon: '🃏', desc: 'Cambias las palabras que quieras por otras nuevas del mazo.', when: 'tool', good: 'Renuevas tu mano.', steps: ['Toca las palabras que quieres cambiar', 'Pulsa «Cambiar por nuevas»', 'Después juega con normalidad'] },
  escribe: { name: 'Escribe tu palabra', icon: '✍️', desc: 'En vez de una carta, juegas la palabra que tú escribas.', when: 'play', good: 'Juegas la palabra perfecta.', steps: ['Escribe tu palabra', 'Pulsa «Jugar con Escribe tu palabra»'] },
  soborno: { name: 'Soborno', icon: '💰', desc: 'Al juez le llega un aviso secreto. Si elige tu palabra, él también suma 1.', when: 'play', good: 'Tientas al juez para que te elija.', steps: ['Elige tu palabra', 'Pulsa «Jugar con Soborno»'] },
  abogado: { name: 'Abogado', icon: '⚖️', desc: 'Solo tu palabra podrá defenderse ante el juez. Nadie más puede debatir.', when: 'play', good: 'Tienes la palabra en exclusiva.', steps: ['Elige tu palabra', 'Pulsa «Jugar con Abogado»', 'Cuando el juez destape las cartas, defiéndela'] },
  doble: { name: 'Doble envío', icon: '✌️', desc: 'Juegas dos palabras y salen como dos cartas separadas y anónimas. Si el juez elige cualquiera de las dos, ganas tú.', when: 'play', good: 'Doble oportunidad de ganar. Robas una palabra nueva para no quedarte con menos.', steps: ['Toca dos palabras', 'Pulsa «Jugar con Doble envío»'] },
  golpe: { name: 'Golpe de Estado', icon: '👑', desc: 'Eliges tú el adjetivo en lugar del juez, en secreto.', when: 'golpe', good: 'Eliges el adjetivo que mejor te va.', steps: ['Mientras el juez está eligiendo, pulsa «Dar golpe de Estado»', 'Elige tú el adjetivo', 'Disimula'] },
  espia: { name: 'Espía', icon: '🕵️', desc: 'Ves en secreto qué palabra ha jugado otro jugador.', when: 'tool', good: 'Sabes contra qué compites.', steps: ['Espera a que alguien haya jugado', 'Elige a quién espiar', 'Después juega tu palabra'] },
  apuesta: { name: 'Apuesta', icon: '🎲', desc: 'Cuando el juez destapa las cartas, apuestas cuál ganará (no la tuya). Si aciertas, +1.', when: 'apuesta', good: 'Puedes puntuar aunque tus cartas sean malas.', steps: ['Espera a que el juez destape todas las cartas', 'Pulsa «Apostar»', 'Toca la carta que crees que ganará'] },
  escudo: { name: 'Escudo', icon: '🛡️', desc: 'Te protege solo: para el primer Ladrón o Cambio al azar que otro jugador lance contra ti.', when: 'escudo', good: 'Nadie te roba puntos ni palabras.', steps: ['No hay que hacer nada', 'Si alguien va a por ti, el Escudo lo para y se gasta', 'Te avisaremos cuando pase'] },
  ladron: { name: 'Ladrón', icon: '🦹', desc: 'Al jugar tu palabra, robas 1 punto al que va primero.', when: 'play', good: 'Tú +1 y el líder −1, al momento.', steps: ['Elige tu palabra', 'Pulsa «Jugar con Ladrón»'] },
  carrete: { name: 'Carrete', icon: '📸', desc: 'La siguiente ronda se juega con fotos de la galería en vez de palabras.', when: 'play', good: 'Cambias el juego para todos.', steps: ['Elige tu palabra', 'Pulsa «Jugar con Carrete»', 'La próxima ronda será de fotos'] },
  pareja: { name: 'Puntos en pareja', icon: '💞', desc: 'Formas pareja secreta con el juez; el resto se empareja al azar. Si gana una palabra, su autor y su pareja suman 2 cada uno.', when: 'play', good: 'Si el juez te elige, sumáis 2 los dos.', steps: ['Elige tu palabra', 'Pulsa «Jugar con Puntos en pareja»'] },
};
const WHEN_TEXT: Record<When, string> = {
  play: 'Se usa al elegir tu palabra, cuando no eres el juez.',
  tool: 'Se usa antes de jugar tu palabra, cuando no eres el juez.',
  golpe: 'Se usa mientras el juez elige el adjetivo.',
  apuesta: 'Se usa cuando el juez ha destapado todas las cartas.',
  escudo: 'Es automático: actúa solo cuando alguien te ataca. No protege de la ruleta.',
};
const NOT_IN_CARRETE: Comodin[] = ['escribe', 'doble', 'cambio', 'nuevas', 'golpe'];

export function availability(c: Comodin, pub: Pub, me: Priv): { can: boolean; reason: string } {
  const info = COMODIN[c]; const r = pub.round;
  if (info.when === 'escudo') return { can: false, reason: 'No hace falta activarlo.' };
  if (me.usedComodin) return { can: false, reason: 'Ya has usado un comodín esta ronda (máximo uno por ronda).' };
  if (r?.type === 'carrete' && NOT_IN_CARRETE.includes(c)) return { can: false, reason: 'No sirve en las rondas de Carrete.' };
  if (me.isJudge && pub.phase !== 'lobby') return { can: false, reason: 'Esta ronda eres el juez. Guárdalo para cuando juegues.' };
  if (info.when === 'golpe') return pub.phase === 'adjective' && r?.type === 'normal' && !r.adjective ? { can: true, reason: '' } : { can: false, reason: 'Solo mientras el juez elige el adjetivo.' };
  if (info.when === 'apuesta') {
    if (pub.phase !== 'judging' || !r) return { can: false, reason: 'Cuando el juez destape todas las cartas.' };
    if (r.revealed < r.total) return { can: false, reason: 'Espera a que el juez destape todas las cartas.' };
    return me.myApuesta ? { can: false, reason: 'Ya has apostado.' } : { can: true, reason: '' };
  }
  if (pub.phase !== 'play') return { can: false, reason: 'Cuando te toque elegir tu palabra.' };
  if (me.myPlayId) return { can: false, reason: 'Ya has jugado esta ronda.' };
  if (me.manoAjenaMe) return { can: false, reason: 'Esta ronda tu palabra la elige otro (Mano Ajena).' };
  if (c === 'pareja' && r?.pareja) return { can: false, reason: 'Alguien ya ha activado parejas esta ronda.' };
  if (c === 'carrete' && pub.nextCarrete) return { can: false, reason: 'La próxima ronda ya es de Carrete.' };
  return { can: true, reason: '' };
}

// comodín activado (estado local del cliente)
let active: Comodin | null = null; let activeRound = -1;
const aSubs = new Set<() => void>();
export function setActive(c: Comodin | null, round: number) { active = c; activeRound = round; aSubs.forEach(f => f()); }
export function useActive(round: number): Comodin | null {
  const v = useSyncExternalStore(f => { aSubs.add(f); return () => aSubs.delete(f); }, () => active);
  return activeRound === round ? v : null;
}

export function Chip({ c, on, off, onClick, small }: { c: Comodin; on?: boolean; off?: boolean; onClick?: () => void; small?: boolean }) {
  return (
    <button className={`chip${on ? ' on' : ''}${off ? ' off' : ''}${small ? ' small' : ''}`} onClick={onClick} aria-pressed={on}>
      <span className="coin">{COMODIN[c].icon}</span>{COMODIN[c].name}
    </button>
  );
}

export function ComodinTray({ onGolpe, onApuesta }: { onGolpe?: () => void; onApuesta?: () => void }) {
  const { snap } = useApp();
  const [open, setOpen] = useState<Comodin | null>(null);
  const act_ = useActive(snap?.public.roundNo ?? -1);
  if (!snap?.private) return null;
  const pub = snap.public, me = snap.private;
  return (
    <section className="tray" aria-label="Tus comodines">
      <span className="tray-label">Comodines</span>
      {me.comodines.length === 0 && <span className="muted">Ninguno. La ruleta reparte cada 3 rondas.</span>}
      {me.isJudge && me.comodines.length > 0 && <span className="muted" style={{ flexBasis: '100%', fontSize: 13 }}>Eres el juez: guárdalos para cuando juegues.</span>}
      {me.comodines.map((c, i) => {
        const av = availability(c, pub, me);
        return <Chip key={c + i} c={c} small on={act_ === c} off={!av.can && COMODIN[c].when !== 'escudo'} onClick={() => setOpen(c)} />;
      })}
      {me.usedComodin && <span className="badge">Usado: {COMODIN[me.usedComodin].name}</span>}
      {open && <ComodinSheet c={open} onClose={() => setOpen(null)} onGolpe={onGolpe} onApuesta={onApuesta} />}
    </section>
  );
}

function ComodinSheet({ c, onClose, onGolpe, onApuesta }: { c: Comodin; onClose: () => void; onGolpe?: () => void; onApuesta?: () => void }) {
  const { snap } = useApp();
  const pub = snap!.public, me = snap!.private!;
  const info = COMODIN[c];
  const av = availability(c, pub, me);
  const isActive = useActive(pub.roundNo) === c;
  const use = () => {
    if (info.when === 'golpe' || info.when === 'apuesta') { window.dispatchEvent(new CustomEvent('lp:tool', { detail: info.when })); onClose(); return; }
    setActive(isActive ? null : c, pub.roundNo); onClose();
  };
  return (
    <Sheet title={info.icon === info.name ? info.name : `${info.icon} ${info.name}`} onClose={onClose}>
      <p style={{ fontSize: 18, margin: '0 0 8px' }}>{info.desc}</p>
      <p className="good">✓ {info.good}</p>
      <p className="muted" style={{ margin: '10px 0 4px' }}>{WHEN_TEXT[info.when]}</p>
      <ol className="steps">{info.steps.map(s => <li key={s}>{s}</li>)}</ol>
      {info.when !== 'escudo' && (av.can
        ? <button className="btn primary block" onClick={use}>{isActive ? 'Desactivar' : info.when === 'golpe' ? 'Dar golpe de Estado' : info.when === 'apuesta' ? 'Apostar ahora' : 'Activar para esta ronda'}</button>
        : <div className="banner">Ahora no se puede: {av.reason}</div>)}
      <button className="btn ghost block" onClick={onClose}>Cerrar</button>
    </Sheet>
  );
}

/* ================= cartas ================= */
export function WordCard({ w, d, no, selected, onClick, tag, className = '', style }: { w: string; d?: string; id?: number; no?: number; selected?: boolean; onClick?: () => void; tag?: string; className?: string; style?: React.CSSProperties }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`pcard${selected ? ' selected' : ''} ${className}`} onClick={onClick} aria-pressed={onClick ? selected : undefined} style={style}>
      <span className="pin" aria-hidden />
      {tag && <span className="tag">{tag}</span>}
      <span className="title">{w}</span>
      {d && <span className="flavor">{d}</span>}
    </Tag>
  );
}
export function CardBack({ onClick, label, className = '' }: { onClick?: () => void; label?: string; className?: string }) {
  const Tag = onClick ? 'button' : 'div';
  return <Tag className={`pcard back ${className}`} onClick={onClick} aria-label={label ?? 'Carta boca abajo'}><span className="mono">JUZ</span></Tag>;
}

export function AdjCard({ a, s, selected, onClick, className = '' }: { a: string; s?: string[]; selected?: boolean; onClick?: () => void; className?: string }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`card adj${selected ? ' selected' : ''} ${className}`} onClick={onClick}>
      <span className="corner tl" aria-hidden>✦</span>
      <span className="title">{a}</span>
      {s && s.length > 0 && <span className="syn">{s.join(' · ')}</span>}
    </Tag>
  );
}

export function Sheet({ title, children, onClose }: { title: string; children: ReactNode; onClose?: () => void }) {
  return (
    createPortal(<div className="scrim" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>, document.body)
  );
}

export const nameOf = (pub: Pub, id: string | null | undefined) => pub.players.find(p => p.id === id)?.name ?? '?';

/* ================= fases de la ronda ================= */
const STEPS = ['Adjetivo', 'Jugar', 'Juez', 'Resultado'];
export function RoundSteps() {
  const { snap } = useApp();
  const now = useNow(500);
  if (!snap?.private) return null;
  const pub = snap.public, me = snap.private, r = pub.round;
  if (!r || !['adjective', 'play', 'judging', 'vote', 'reveal'].includes(pub.phase)) return null;
  const idx = { adjective: 0, play: 1, judging: 2, vote: 2, reveal: 3 }[pub.phase as 'adjective'] ?? 0;
  const steps = r.type === 'carrete' ? ['Frase', 'Fotos', 'Juez', 'Resultado'] : STEPS;
  let left = 0, total = 0;
  if (pub.phase === 'adjective' && r.type === 'normal' && !r.adjective) { left = r.adjDeadline - now; total = 20000; }
  const secs = Math.max(0, Math.ceil(left / 1000));
  return (
    <div className={`roundbar ${me.isJudge ? 'judge' : ''} ${r.type}`}>
      <div className="roundbar-top">
        <span className="role">{me.isJudge ? '⚖️ Juzgas tú' : `⚖️ Juez: ${nameOf(pub, r.judgeId)}`}</span>
        {total > 0 && me.isJudge && <span className={`clock${secs <= 10 ? ' hot' : ''}`}>⏱ {secs}s</span>}
      </div>
      <ol className="stepper">{steps.map((s, i) => <li key={s} className={i < idx ? 'done' : i === idx ? 'now' : ''}>{s}</li>)}</ol>
      {total > 0 && me.isJudge && <div className="timer" aria-hidden><i style={{ width: `${Math.max(0, Math.min(100, (left / total) * 100))}%` }} /></div>}
      {(() => { const { you } = situationText(pub, me, total > 0 && me.isJudge ? secs : null); return you ? <p className="you-line"><b>Tú:</b> {you}</p> : null; })()}
    </div>
  );
}

export function situationText(pub: Pub, me: Priv, secs: number | null) {
  const r = pub.round!; const J = nameOf(pub, r.judgeId); const carrete = r.type === 'carrete';
  const players = pub.players.filter(p => !p.removed && p.id !== r.judgeId && !p.skipped);
  const done = players.filter(p => p.played).length;
  const t = secs != null ? ` Quedan ${secs} s.` : '';
  let now = '', you = '';
  switch (pub.phase) {
    case 'adjective':
      if (carrete) { now = `${me.isJudge ? 'Tú escribes' : J + ' escribe'} una frase; cada uno buscará una foto en su galería que encaje.`; you = me.isJudge ? 'Escribe la frase o elige una sugerida y pulsa «Lanzar la frase».' : 'Espera y ve abriendo tu galería.'; }
      else { now = `${me.isJudge ? 'Eliges tú' : J + ' elige'} el adjetivo de la ronda entre 3 opciones.${t}`; you = me.isJudge ? 'Primero se barajan unos segundos; luego toca uno y léelo en voz alta. Si se acaba el tiempo, sale uno al azar.' : me.comodines.includes('golpe') ? 'Tienes Golpe de Estado: elige tú el adjetivo aquí abajo antes que el juez.' : me.comodines.length ? `Espera. Luego jugarás una carta; entonces podrás activar tus comodines (botón 🃏 ${me.comodines.length}).` : 'Espera. Luego jugarás una carta de tu mano.'; }
      break;
    case 'play':
      now = `Todos menos el juez juegan ${carrete ? 'una foto' : 'una carta'} boca abajo. Listos: ${done} de ${players.length}.${t}`;
      you = me.isJudge ? (me.mustDiscard ? 'Mientras esperas, tira una de tus palabras a la papelera: así todos gastáis una por ronda.' : 'Eres el juez: espera. Después destaparás las cartas una a una.')
        : me.manoAjenaTask ? `Elige a ciegas la carta de ${me.manoAjenaTask.target}.`
        : me.myPlayId ? 'Ya has jugado. Espera al resto.'
        : me.manoAjenaMe ? 'Otro jugador elige tu carta a ciegas (Mano Ajena).'
        : carrete ? 'Elige una foto de tu galería y envíala.' : `Toca la carta que mejor encaje con «${r.adjective?.a}» y pulsa «Jugar». Si quieres usar un comodín, actívalo antes.`;
      break;
    case 'judging':
      if (r.revealed < r.total) { now = `${me.isJudge ? 'Destapas' : J + ' destapa'} las cartas una a una (${r.revealed}/${r.total}). Son anónimas.`; you = me.isJudge ? 'Pulsa «Destapar» y lee cada carta en voz alta.' : 'Escucha. Si es la tuya, ¡disimula!'; }
      else { now = `${me.isJudge ? 'Decides tú' : J + ' decide'} qué carta gana. Puede descartar cartas o abrir un debate.`; you = me.isJudge ? 'Lee las cartas en voz alta. Tras unos segundos de deliberación podrás elegir la ganadora (o descartar y abrir debate).' : me.comodines.includes('apuesta') && !me.myApuesta ? 'Tienes Apuesta: ahora puedes apostar qué carta ganará.' : 'Si hay debate y te toca, defiende tu carta.'; }
      break;
    case 'vote': now = 'El juez ya ha elegido. Ahora votáis la foto favorita del público (no vale votarse).'; you = me.isJudge ? 'Espera la votación.' : me.myVote ? 'Ya has votado.' : 'Toca tu foto favorita.'; break;
    case 'reveal': now = 'Resultado de la ronda. Los puntos son secretos: solo ves los tuyos.'; you = me.isJudge || me.isHost ? 'Cuando estéis listos, pulsa «Siguiente ronda».' : `Espera a que ${J} pase a la siguiente ronda.`; break;
  }
  return { now, you };
}

/* ================= comodines siempre a mano ================= */
export function ComodinButton() {
  const { snap } = useApp();
  const [open, setOpen] = useState(false);
  useEffect(() => { const h = () => setOpen(true); window.addEventListener('lp:open-comodines', h); return () => window.removeEventListener('lp:open-comodines', h); }, []);
  const [detail, setDetail] = useState<Comodin | null>(null);
  if (!snap?.private || ['lobby', 'order'].includes(snap.public.phase)) return null;
  const pub = snap.public, me = snap.private;
  return (
    <>
      <button className={`hud-coins${me.comodines.some(c => availability(c, pub, me).can) && !me.usedComodin ? ' ready' : ''}`} onClick={() => setOpen(true)} aria-label={`Mis comodines: ${me.comodines.map(c => COMODIN[c].name).join(', ') || 'ninguno'}`}>
        {[0, 1].map(i => { const c = me.comodines[i]; return c ? <span key={i} className="hcoin">{COMODIN[c].icon}</span> : <span key={i} className="hcoin empty" />; })}
        
      </button>
      {open && (
        <Sheet title="Tus comodines" onClose={() => setOpen(false)}>
          <p className="muted" style={{ marginTop: 0 }}>Puedes tener 2 como máximo y usar 1 por ronda. Se consiguen en la ruleta (al empezar y cada 3 rondas). Toca uno para ver cómo se usa.</p>
          {me.comodines.length === 0 && <div className="banner">Ahora no tienes ninguno.</div>}
          <div className="stack">
            {me.comodines.map((c, i) => {
              const av = availability(c, pub, me);
              return (
                <button key={c + i} className="crow" onClick={() => setDetail(c)}>
                  <span className="coin">{COMODIN[c].icon}</span>
                  <span className="crow-txt"><b>{COMODIN[c].name}</b><small>{COMODIN[c].desc}</small>
                    <em className={av.can ? 'ok' : ''}>{COMODIN[c].when === 'escudo' ? '🛡️ Automático' : av.can ? '✅ Puedes usarlo ahora' : '⏳ ' + av.reason}</em></span>
                </button>
              );
            })}
          </div>
          {me.usedComodin && <p className="muted">Esta ronda ya has usado: {COMODIN[me.usedComodin].name}.</p>}
          <button className="btn ghost block" onClick={() => setOpen(false)}>Cerrar</button>
        </Sheet>
      )}
      {detail && <ComodinSheet c={detail} onClose={() => { setDetail(null); setOpen(false); }} />}
    </>
  );
}

/* ================= tira de jugadores ================= */
export function PlayersStrip() {
  const { snap } = useApp();
  if (!snap?.private || snap.public.phase === 'lobby') return null;
  const pub = snap.public, me = snap.private, r = pub.round;
  const inRound = !!r && ['adjective', 'play'].includes(pub.phase);
  return (
    <div className="pstrip" aria-label="Jugadores">
      {pub.players.filter(p => !p.removed).map(p => {
        const judge = r?.judgeId === p.id;
        const st = inRound && !judge && pub.phase === 'play' ? (p.played ? 'ok' : p.skipped ? 'skip' : 'wait') : '';
        return (
          <div key={p.id} className={`pchip${judge ? ' judge' : ''}${p.id === me.id ? ' me' : ''}`}>
            <span className="pface"><Avatar id={p.avatar} judge={judge} crop="head" size={34} />{st && <i className={`pst ${st}`}>{st === 'ok' ? '✓' : st === 'skip' ? '–' : '…'}</i>}</span>
            <span className="pname">{p.id === me.id ? 'Tú' : p.name}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ================= la sala (decorado en perspectiva) ================= */
export function Courtroom() {
  const { snap } = useApp();
  const now = useNow(1000);
  if (!snap?.private || !snap.public.round) return null;
  const pub = snap.public, me = snap.private, r = pub.round;
  const judge = pub.players.find(p => p.id === r.judgeId);
  const others = pub.players.filter(p => !p.removed && p.id !== r.judgeId && p.id !== me.id);
  const n = others.length;
  let secs: number | null = null;
  if (pub.phase === 'adjective' && r.type === 'normal' && !r.adjective && me.isJudge) secs = Math.max(0, Math.ceil((r.adjDeadline - now) / 1000));
  const { now: nowTxt } = situationText(pub, me, secs);
  const sign = r.type === 'carrete' ? (r.phrase ? <><small>Foto que mejor encaje con</small><b>{r.phrase}</b></> : <small>Su señoría escribe la frase…</small>)
    : r.adjective ? <><small>¿Qué es más…?</small><b>{r.adjective.a}</b></> : <small>Su señoría elige el adjetivo…</small>;
  return (
    <section className={`court${pub.phase === "adjective" ? "" : " compact"}`} aria-label="Sala del juzgado">
      <div className="wall"><span className="seal">JUZ<br />GAME</span></div>
      <div className="judge-fig"><Avatar id={judge?.avatar} judge crop="bust" size={128} /></div>
      <div className="bench">
        <span className="plate">{me.isJudge ? 'Su señoría (tú)' : `Su señoría ${judge?.name ?? ''}`}</span>
        <div className={`sign${r.adjective || r.phrase ? ' set' : ''}`}>{sign}</div>
      </div>
      <div className="ctable">
        <div className="pile" aria-label="Cartas jugadas">{Array.from({ length: Math.min(9, pub.phase === 'play' ? pub.players.filter(p => p.played).length : ['judging', 'vote', 'reveal'].includes(pub.phase) ? (r.total || 0) : 0) }, (_, i) => <i key={i} style={{ transform: `translate(${(i % 3 - 1) * 16}px, ${-Math.floor(i / 3) * 3}px) rotate(${(i * 37 % 21) - 10}deg)` }} />)}</div>
      </div>
      <Silhouette side="left" />
      <Silhouette side="right" />
      <p className="court-cap">{nowTxt}</p>
    </section>
  );
}

function Silhouette({ side }: { side: 'left' | 'right' }) {
  return (
    <svg className={`silhouette ${side}`} viewBox="0 0 120 140" aria-hidden>
      <path d="M10 140 C12 104 30 88 56 84 C82 88 100 104 104 140 Z" fill="#24160D" stroke="#7A5232" strokeWidth="2" />
      <ellipse cx="57" cy="52" rx="30" ry="34" fill="#24160D" stroke="#7A5232" strokeWidth="2" />
      <g transform="translate(70 104) rotate(-14)"><rect x="0" y="0" width="22" height="30" rx="3" fill="#FBF6EA" stroke="#1A100A" strokeWidth="2" /><rect x="10" y="-4" width="22" height="30" rx="3" fill="#FBF6EA" stroke="#1A100A" strokeWidth="2" transform="rotate(12 21 11)" /></g>
      <ellipse cx="78" cy="122" rx="12" ry="9" fill="#2A1A10" />
    </svg>
  );
}

/* ================= recordatorio de comodines ================= */
export function ComodinReminder() {
  const { snap } = useApp();
  if (!snap?.private) return null;
  const pub = snap.public, me = snap.private;
  if (me.usedComodin) return null;
  const usable = me.comodines.filter(c => availability(c, pub, me).can);
  if (!usable.length) return null;
  return (
    <button className="reminder" onClick={() => window.dispatchEvent(new CustomEvent('lp:open-comodines'))}>
      <span>💡 Puedes usar ahora:</span>
      {usable.map((c, i) => <span key={c + i} className="rchip">{cLabel(c)}</span>)}
      <span className="rgo">Ver ›</span>
    </button>
  );
}

/* ================= barra superior ================= */
export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { snap, online, live, pending } = useApp();
  const [show, setShow] = useState(false);
  if (!snap) return null;
  const pub = snap.public, me = snap.private;
  const status = !online ? 'off' : (!live && !DEMO) || pending ? 'wait' : '';
  return (
    <header className="topbar">
      <span className="code" aria-label="Código de sala">{pub.code}</span>
      <span className={`dot ${status}`} title={!online ? 'Sin conexión: reintentando' : pending ? 'Enviando…' : 'Conectado'} />
      {pub.roundNo > 0 && <span className="round">R{pub.roundNo}</span>}
      <span className="spacer" />
      {me && pub.phase !== 'lobby' && (
        <button className="points" onClick={() => setShow(s => !s)} aria-label="Mis puntos (solo los ves tú)">
          {show ? <>{me.points} pts</> : <>🙈 pts</>}
        </button>
      )}
      <ComodinButton />
      <button className="iconbtn" onClick={onMenu} aria-label="Menú">☰</button>
    </header>
  );
}

export function StatusBanners() {
  const { snap, online, pending } = useApp();
  if (!snap) return null;
  const pub = snap.public;
  return (
    <>
      {!online && <div className="banner bad">Sin conexión. Tus jugadas se guardan y se enviarán solas cuando vuelva la señal.</div>}
      {online && pending > 0 && <div className="banner">Enviando {pending} jugada{pending > 1 ? 's' : ''}…</div>}
      {pub.countdown && pub.phase !== 'end' && <div className="banner warn">⚠️ Alguien ha llegado a {pub.config.target} puntos. {pub.finalVuelta ? 'Vuelta final' : 'Cuenta atrás'}: quedan {pub.roundsLeft} ronda{pub.roundsLeft === 1 ? '' : 's'}.{pub.finalVuelta && pub.config.finalDouble ? ' Los puntos valen doble.' : ''}</div>}
      {pub.nextCarrete && !['end', 'reveal'].includes(pub.phase) && <div className="banner">📸 La próxima ronda es de Carrete. Ve pensando en tu galería.</div>}
    </>
  );
}

/* ================= avisos privados ================= */
export function Notices() {
  const { snap } = useApp();
  const notes = snap?.private?.notices ?? [];
  const [seen, setSeen] = useState<Set<string>>(() => new Set(notes.map(n => n.id)));
  const fresh = notes.filter(n => !seen.has(n.id) && !['gain', 'round', 'roulette'].includes(n.kind ?? ''));
  if (!fresh.length) return null;
  const n = fresh[0];
  const dismiss = () => { setSeen(s => new Set([...s, n.id])); act({ type: 'dismissNotice', noticeId: n.id }); };
  const photo = (n.data as { photo?: string } | undefined)?.photo;
  return (
    <Sheet title="Solo para ti" onClose={dismiss}>
      <p style={{ fontSize: 19, margin: '0 0 12px' }}>{n.text}</p>
      {photo && <img className="photo-mini" src={photo} alt="Foto espiada" />}
      <button className="btn primary block" onClick={dismiss}>Entendido</button>
    </Sheet>
  );
}

/* ================= resultado de la ruleta (visible en cualquier fase) ================= */
export const WHEEL_LABELS = [...Array(10).fill('Comodín'), '×3', 'Ladrón', 'Vacía', 'Vacía', 'Vacía', 'Vacía', 'Vacía', 'Mano Ajena', 'Todo o Nada', 'Robin Hood'];
export const VISUAL = [0, 12, 1, 17, 2, 13, 3, 10, 4, 14, 5, 18, 6, 15, 7, 11, 8, 16, 9, 19];
const SLICE_COLOR = (slot: number) => slot < 10 ? '#6C4DF0' : slot === 10 || slot === 11 ? '#F2B705' : slot < 17 ? '#0D2C22' : '#C8412B';
export function Wheel({ slot, spinning }: { slot: number | null; spinning?: boolean }) {
  const n = 20, R = 100;
  const [rot, setRot] = useState(0);
  useEffect(() => { if (slot !== null) requestAnimationFrame(() => setRot(360 * 9 - (VISUAL.indexOf(slot) * 18 + 9))); }, [slot]);
  return (
    <div className={`wheel-wrap${spinning && slot === null ? ' idle-spin' : ''}`}>
      <div className="pointer" />
      <svg viewBox="-104 -104 208 208" className="wheel" style={{ transform: `rotate(${rot}deg)` }} role="img" aria-label="Ruleta">
        {VISUAL.map((s, i) => {
          const a0 = (i * 360) / n - 90, a1 = ((i + 1) * 360) / n - 90;
          const p = (a: number) => [R * Math.cos((a * Math.PI) / 180), R * Math.sin((a * Math.PI) / 180)];
          const [x0, y0] = p(a0), [x1, y1] = p(a1);
          const mid = (a0 + a1) / 2; const right = Math.cos((mid * Math.PI) / 180) >= 0;
          return (
            <g key={i}>
              <path d={`M0 0 L${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1} Z`} fill={SLICE_COLOR(s)} stroke="#12392C" strokeWidth="1.2" />
              <text transform={right ? `rotate(${mid}) translate(${R - 8} 0)` : `rotate(${mid}) translate(${R - 8} 0) rotate(180)`} textAnchor={right ? 'end' : 'start'} dominantBaseline="middle" fontSize="7.2" fontWeight="700" fill={s === 10 || s === 11 ? '#2B2000' : '#FFFDF7'} fontFamily="'Bricolage Grotesque', system-ui, sans-serif">{WHEEL_LABELS[s]}</text>
            </g>
          );
        })}
        <circle r="16" fill="#FBF6EA" stroke="#12392C" strokeWidth="3" />
      </svg>
    </div>
  );
}

const SPECIAL: Record<string, { title: string; what: string; when: string; how: string; why: string; tone: 'good' | 'bad' | 'neutral' }> = {
  vacia: { title: 'Casilla vacía', what: 'No te toca nada esta vez.', when: '—', how: '—', why: 'Mejor suerte en la próxima ruleta (cada 3 rondas).', tone: 'neutral' },
  mano_ajena: { title: 'Mano Ajena', what: 'Otro jugador elegirá a ciegas qué carta juegas.', when: 'La próxima ronda en la que no seas juez.', how: 'Automático: no puedes elegir tu carta esa ronda.', why: 'Es un castigo. Si tienes Escudo, te preguntaremos si quieres anularlo.', tone: 'bad' },
  todo_nada: { title: 'Todo o Nada', what: 'Si tu carta gana sumas +2; si no gana, pierdes 1 punto.', when: 'La próxima ronda en la que juegues.', how: 'Automático. Verás un aviso «Todo o Nada activo» al jugar.', why: 'Arriesgado: juega tu mejor carta esa ronda.', tone: 'bad' },
  robin_hood: { title: 'Robin Hood', what: 'Le regalas 1 punto al último de la clasificación.', when: 'Ya ha pasado, al girar.', how: 'Automático. Si el último eres tú, te libras.', why: 'Mantiene la partida igualada.', tone: 'bad' },
};
function RouletteExplain({ d }: { d: { label: string; hint: string; item: { kind: string; comodin?: Comodin } } }) {
  const c = d.item.kind === 'comodin' ? d.item.comodin! : null;
  const s = c ? null : SPECIAL[d.item.kind];
  const rows: [string, string][] = c
    ? [['Qué hace', COMODIN[c].desc], ['Para qué', COMODIN[c].good], ['Cuándo', WHEN_TEXT[COMODIN[c].when]], ['Cómo', COMODIN[c].steps.map((x, i) => `${i + 1}. ${x}`).join('  ')]]
    : s ? [['Qué pasa', s.what], ['Cuándo', s.when], ['Cómo', s.how], ['Ojo', s.why]].filter(r => r[1] !== '—') as [string, string][] : [];
  const tone = c ? 'good' : s?.tone ?? 'neutral';
  return (
    <div className={`result ${tone}`}>
      <p className="result-kicker">{c ? '¡Un comodín!' : tone === 'bad' ? 'Mala suerte…' : 'Nada'}</p>
      {c ? <Chip c={c} /> : <p className="result-title">{s?.title ?? d.label}</p>}
      <dl className="explain">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      {c && <p className="muted" style={{ margin: '8px 0 0' }}>Lo encontrarás en el botón 🃏 de arriba.</p>}
      <p className="muted" style={{ margin: '10px 0 0' }}>🔮 {d.hint}</p>
    </div>
  );
}

export function WheelLegend() {
  const items: [string, string, string][] = [
    ['#6C4DF0', 'Comodín ×10', 'Uno al azar: ' + (['x2', 'cambio', 'nuevas', 'escribe', 'soborno', 'abogado', 'doble', 'golpe', 'espia', 'apuesta', 'escudo', 'carrete', 'pareja'] as Comodin[]).map(c => COMODIN[c].name).join(', ') + '.'],
    ['#F2B705', '×3', 'Si tu carta gana, triple de puntos.'],
    ['#F2B705', 'Ladrón', 'Al jugar, robas 1 punto al líder.'],
    ['#0D2C22', 'Vacía ×5', 'No te toca nada.'],
    ['#C8412B', 'Mano Ajena', 'Otro elige tu carta a ciegas.'],
    ['#C8412B', 'Todo o Nada', 'Si ganas +2, si no −1.'],
    ['#C8412B', 'Robin Hood', 'Das 1 punto al último.'],
  ];
  return (
    <details className="legend" open>
      <summary>Qué puede salir</summary>
      <ul>{items.map(([col, k, v]) => <li key={k}><i style={{ background: col }} /><b>{k}</b><span>{v}</span></li>)}</ul>
    </details>
  );
}

export function RouletteResult() {
  const { snap } = useApp();
  const notes = (snap?.private?.notices ?? []).filter(n => n.kind === 'roulette');
  const shownRef = useRef<Set<string> | null>(null);
  if (shownRef.current === null) shownRef.current = new Set(notes.filter(n => Date.now() - n.at > 60000).map(n => n.id));
  const [, force] = useState(0);
  const [stage, setStage] = useState<'spin' | 'result'>('spin');
  const n = notes.find(x => !shownRef.current!.has(x.id));
  useEffect(() => { if (n) { setStage('spin'); const t = setTimeout(() => setStage('result'), 6600); return () => clearTimeout(t); } }, [n?.id]);
  if (!n) return null;
  const d = n.data as { label: string; slot: number; hint: string; good: boolean | null; item: { kind: string; comodin?: Comodin } };
  const close = () => { shownRef.current!.add(n.id); act({ type: 'dismissNotice', noticeId: n.id }); force(x => x + 1); };
  const effect = n.text.slice(n.text.indexOf(':') + 1).trim();
  return (
    <Sheet title={stage === 'spin' ? 'Girando…' : 'Te ha tocado…'}>
      {stage === 'spin' && <Wheel slot={d.slot} />}
      {stage === 'result' && <RouletteExplain d={d} />}
      {stage === 'result' && <button className="btn primary block" style={{ marginTop: 12 }} onClick={close}>Entendido</button>}
    </Sheet>
  );
}

/* ================= escudo ================= */
export function ShieldPrompt() {
  const { snap } = useApp();
  const now = useNow();
  const pr = snap?.private?.prompts?.[0];
  if (!pr) return null;
  const what = { ladron: 'un Ladrón: quieren robarte 1 punto', cambio: 'un Cambio al azar: quieren cambiarte una palabra', mano_ajena: 'una Mano Ajena: otro elegiría tu próxima palabra' }[pr.kind];
  const left = Math.max(0, Math.ceil((pr.deadline - now) / 1000));
  return (
    <Sheet title="🛡️ ¡Te atacan!">
      <p>Te han lanzado {what}. ¿Usas tu Escudo?</p>
      <p className="muted">Si no respondes en {left} s, el ataque se aplica.</p>
      <div className="row">
        <button className="btn primary" style={{ flex: 1 }} onClick={() => act({ type: 'shield', promptId: pr.id, use: true })}>Usar Escudo</button>
        <button className="btn" style={{ flex: 1 }} onClick={() => act({ type: 'shield', promptId: pr.id, use: false })}>Guardarlo</button>
      </div>
    </Sheet>
  );
}

/* ================= acusación de trampa ================= */
export function ReportVote() {
  const { snap } = useApp();
  const rep = snap?.public.report; const me = snap?.private;
  if (!rep || !me) return null;
  if (rep.accused === me.id) return <div className="banner bad">🚨 {rep.by} te acusa de hacer trampas. Los demás están votando ({rep.votes}/{rep.needed}).</div>;
  if (me.myVoteReport !== null && me.myVoteReport !== undefined) return <div className="banner">🚨 Votación contra {rep.accusedName}: {rep.votes}/{rep.needed} votos. Hace falta unanimidad.</div>;
  return (
    <Sheet title="🚨 Acusación de trampa">
      <p>{rep.by} acusa a <b>{rep.accusedName}</b> de hacer trampas (señas, pactos con el juez…). Hace falta unanimidad para condenarle: −1 y pierde lo que ganó la última ronda.</p>
      <div className="row">
        <button className="btn danger" style={{ flex: 1 }} onClick={() => act({ type: 'reportVote', yes: true })}>Culpable</button>
        <button className="btn" style={{ flex: 1 }} onClick={() => act({ type: 'reportVote', yes: false })}>Inocente</button>
      </div>
    </Sheet>
  );
}

/* ================= menú ================= */
export function Menu({ onClose, onRules, extra }: { onClose: () => void; onRules: () => void; extra?: ReactNode }) {
  const { snap, presence } = useApp();
  const [mode, setMode] = useState<'main' | 'report' | 'host'>('main');
  if (!snap || !snap.private) return null;
  const pub = snap.public, me = snap.private;
  const others = pub.players.filter(p => !p.removed && p.id !== me.id);
  const hostAway = !DEMO && !presence[pub.hostId] && pub.hostId !== me.id;
  const r = pub.round;
  const doAct: typeof act = (a) => { act(a); onClose(); };

  if (mode === 'report') return (
    <Sheet title="¿Quién ha hecho trampas?" onClose={onClose}>
      <p className="muted">Señas al juez, pactos de puntos… El Soborno es legal. Votarán los demás y hace falta unanimidad.</p>
      <div className="stack">{others.map(p => <button key={p.id} className="btn block" onClick={() => doAct({ type: 'report', accused: p.id })}>{p.name}</button>)}</div>
    </Sheet>
  );

  if (mode === 'host') return (
    <Sheet title="Panel del anfitrión" onClose={onClose}>
      {pub.reclaims.length > 0 && <>
        <h2 className="h-sm">Quieren volver a entrar</h2>
        {pub.reclaims.map(q => (
          <div key={q.id} className="banner">
            <p style={{ margin: '0 0 8px' }}>«{q.name}» pide entrar. ¿Quién es?</p>
            <div className="row">
              {pub.players.filter(p => p.id !== me.id).map(p => <button key={p.id} className="btn" onClick={() => doAct({ type: 'approveReclaim', requestId: q.id, playerId: p.id })}>{p.name}</button>)}
              <button className="btn ghost" onClick={() => doAct({ type: 'rejectReclaim', requestId: q.id })}>Rechazar</button>
            </div>
          </div>
        ))}
      </>}
      {pub.phase === 'play' && r && <>
        <h2 className="h-sm">Saltar a quien no juega</h2>
        <div className="row">{pub.players.filter(p => !p.removed && !p.played && !p.skipped && p.id !== r.judgeId).map(p => <button key={p.id} className="btn" onClick={() => doAct({ type: 'skipPlayer', playerId: p.id })}>Saltar a {p.name}</button>)}</div>
      </>}
      {pub.phase === 'adjective' && <button className="btn block" style={{ marginTop: 10 }} onClick={() => doAct({ type: 'passJudge' })}>Pasar el turno de juez al siguiente</button>}
      {(pub.phase === 'vote' || pub.phase === 'reveal') && <button className="btn block" style={{ marginTop: 10 }} onClick={() => doAct({ type: 'undo' })}>↩️ Deshacer la decisión del juez</button>}
      {pub.roulette && <>
        <h2 className="h-sm">Ruleta pendiente</h2>
        <div className="row">{pub.roulette.pending.map(pid => <button key={pid} className="btn" onClick={() => doAct({ type: 'skipRoulette', playerId: pid })}>Saltar ruleta de {nameOf(pub, pid)}</button>)}</div>
      </>}
      {pub.report && <button className="btn block" style={{ marginTop: 10 }} onClick={() => doAct({ type: 'cancelReport' })}>Anular la acusación</button>}
      <h2 className="h-sm">Jugadores</h2>
      <div className="players">
        {others.map(p => (
          <div className="player" key={p.id}>
            <span className={`dot ${presence[p.id] || DEMO ? '' : 'off'}`} />
            <span className="name">{p.name}</span>
            <button className="badge" onClick={() => doAct({ type: 'transferHost', playerId: p.id })}>Hacer anfitrión</button>
            <ConfirmButton className="badge" style={{ background: 'var(--brick)' }} label="Sacar" ask="¿Seguro? Toca otra vez" onConfirm={() => doAct({ type: 'removePlayer', playerId: p.id })} />
          </div>
        ))}
      </div>
    </Sheet>
  );

  return (
    <Sheet title="Menú" onClose={onClose}>
      <div className="stack">
        <button className="btn block" onClick={onRules}>📖 Reglas y comodines</button>
        {me.isHost && pub.phase !== 'lobby' && <button className="btn block" onClick={() => setMode('host')}>🎛️ Panel del anfitrión{pub.reclaims.length ? ` (${pub.reclaims.length})` : ''}</button>}
        {!['lobby', 'order', 'end'].includes(pub.phase) && !pub.report && <button className="btn block" onClick={() => setMode('report')}>🚨 Reportar trampa</button>}
        {hostAway && <button className="btn block" onClick={() => doAct({ type: 'claimHost' })}>👑 El anfitrión no está: hacerme anfitrión</button>}
        {extra}
        {!DEMO && <ConfirmButton className="btn ghost block" label="Salir de la sala" ask="¿Salir? Podrás volver con el código. Toca otra vez" onConfirm={() => { leaveRoom(); onClose(); }} />}
      </div>
    </Sheet>
  );
}

export function Rules({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Cómo se juega" onClose={onClose}>
      <ol className="steps big">
        <li><b>Adjetivo.</b> El juez elige uno de tres adjetivos (15 s).</li>
        <li><b>Jugar.</b> Los demás juegan en secreto la carta de su mano que mejor encaje, o la que más gracia le haga al juez (90 s).</li>
        <li><b>Juez.</b> El juez destapa las cartas una a una leyéndolas en voz alta, puede descartar, invocar un debate y elige la ganadora.</li>
        <li><b>Resultado.</b> Se ve la carta ganadora, pero no quién la jugó. Cada uno ve en privado lo que ha sumado.</li>
      </ol>
      <p>Los puntos son secretos. Cuando alguien llega a la meta, se termina la vuelta y se juega una vuelta final. Al acabar, se revela la clasificación y todo lo que pasó.</p>
      <p>Cada 3 rondas hay ruleta: puede tocar un comodín, nada… o algo malo. Máximo 2 comodines en mano y 1 por ronda. Toca un comodín de tu bandeja para ver qué hace y cuándo usarlo.</p>
      <h2 className="h-sm">Comodines</h2>
      <div className="stack">
        {(Object.keys(COMODIN) as Comodin[]).map(c => <div key={c} className="notice"><span className="chip small" style={{ padding: 0 }}><span className="coin">{COMODIN[c].icon}</span></span><p><b>{COMODIN[c].name}.</b> {COMODIN[c].desc} <span className="muted">{WHEN_TEXT[COMODIN[c].when]}</span></p></div>)}
      </div>
      <h2 className="h-sm">Ruleta mala</h2>
      <p><b>Mano Ajena:</b> otro elige a ciegas qué carta juegas. <b>Todo o Nada:</b> si ganas la ronda +2, si no −1. <b>Robin Hood:</b> regalas 1 punto al último.</p>
      <h2 className="h-sm">Trampas</h2>
      <p>Hacer señas o pactar puntos con el juez es trampa. Cualquiera puede reportarla desde el menú; si todos los demás votan culpable, −1 y pierde lo ganado en la última ronda.</p>
      <button className="btn primary block" onClick={onClose}>Vamos</button>
    </Sheet>
  );
}

export function ConfirmButton({ className, style, label, ask, onConfirm }: { className: string; style?: React.CSSProperties; label: string; ask: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const id = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(id); }, [armed]);
  return <button className={className} style={style} onClick={() => armed ? onConfirm() : setArmed(true)}>{armed ? ask : label}</button>;
}
export function useToolEvent(kind: 'golpe' | 'apuesta', f: () => void) {
  useEffect(() => { const h = (e: Event) => { if ((e as CustomEvent).detail === kind) f(); }; window.addEventListener('lp:tool', h); return () => window.removeEventListener('lp:tool', h); });
}
export const isJudge = (pub: Pub, me: Priv | null) => !!me && pub.round?.judgeId === me.id;
