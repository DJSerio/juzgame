import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { act, createGame, joinGame, peekGame, savedName, uploadPhoto, toast } from '../api';
import { Avatar, AvatarPicker } from './avatar';
import { League } from './endgame';
import { APP_NAME, DEMO } from '../config';
import type { Comodin } from '../../../engine/types';
import { AdjCard, CardBack, Chip, COMODIN, cLabel, availability, useNow, ComodinReminder, Courtroom, Sheet, Wheel, WordCard, nameOf, setActive, useActive, useApp, useToolEvent, WheelLegend } from './common';

/* ================= INICIO ================= */
export function Logo({ small }: { small?: boolean }) {
  return (
    <div className={`logo${small ? ' small' : ''}`} aria-label="JUZ GAME">
      <span className="l1">JUZ</span><span className="l2">GAME</span>
      {!small && <span className="ribbon">SE ABRE LA SESIÓN</span>}
      <svg className="gavel" viewBox="-40 -36 80 120" aria-hidden><g transform="rotate(-32)"><rect x="-6" y="0" width="13" height="78" rx="4" fill="#8A5A32" stroke="#1F1B16" strokeWidth="5" /><rect x="-34" y="-30" width="68" height="36" rx="8" fill="#A86E3E" stroke="#1F1B16" strokeWidth="6" /><path d="M-20 -30 v36 M20 -30 v36" stroke="#1F1B16" strokeWidth="4" /></g></svg>
    </div>
  );
}

export function Home() {
  const { busy, error } = useApp();
  const params = new URLSearchParams(location.search);
  const [name, setName] = useState(savedName());
  const [code, setCode] = useState(params.get('c')?.toUpperCase() ?? '');
  const [mode, setMode] = useState<'join' | 'create'>(params.get('c') ? 'join' : 'create');
  const [step, setStep] = useState<1 | 2>(1);
  const [taken, setTaken] = useState<string[]>([]);
  const [avatar, setAvatar] = useState('');
  const ok = name.trim().length > 0 && (mode === 'create' || code.trim().length === 4);
  const next = async () => {
    if (mode === 'join') { const r = await peekGame(code); if (!r) return; setTaken(r.taken); if (r.taken.includes(avatar)) setAvatar(''); }
    setStep(2);
  };
  if (step === 2) return (
    <main className="app" style={{ paddingTop: 20 }}>
      <h2 style={{ marginBottom: 4 }}>Elige tu personaje</h2>
      <p className="lead">Así te verán los demás durante toda la partida. Cuando te toque juzgar, se pondrá la toga.</p>
      <AvatarPicker value={avatar} taken={taken} onPick={setAvatar} />
      {error && <div className="banner bad">{error}</div>}
      <div className="dock"><div className="inner">
        <button className="btn ghost" onClick={() => setStep(1)}>Atrás</button>
        <button className="btn primary" disabled={!avatar || busy} onClick={() => mode === 'create' ? createGame(name.trim(), avatar) : joinGame(code, name.trim(), avatar)}>
          {busy ? <span className="spin">◌</span> : !avatar ? 'Toca un personaje' : mode === 'create' ? 'Crear sala' : 'Entrar en la sala'}
        </button>
      </div></div>
    </main>
  );
  return (
    <main className="app" style={{ justifyContent: 'center', paddingTop: 30 }}>
      <Logo />
      <p className="lead" style={{ textAlign: 'center' }}>Un juez, un adjetivo y siete palabras. Convence a su señoría. Cada uno juega desde su móvil.</p>
      <div className="seg" role="tablist" style={{ marginBottom: 12 }}>
        <button className={mode === 'create' ? 'on' : ''} onClick={() => setMode('create')}>Crear sala</button>
        <button className={mode === 'join' ? 'on' : ''} onClick={() => setMode('join')}>Unirme</button>
      </div>
      <label className="field"><span>Tu nombre</span>
        <input className="input" value={name} maxLength={20} onChange={e => setName(e.target.value)} placeholder="Como te llaman" autoComplete="nickname" />
      </label>
      {mode === 'join' && <label className="field"><span>Código de la sala</span>
        <input className="input code" value={code} maxLength={4} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} placeholder="ABCD" autoCapitalize="characters" />
      </label>}
      {error && <div className="banner bad">{error}</div>}
      <button className="btn primary block" style={{ marginTop: 12 }} disabled={!ok || busy} onClick={next}>
        {busy ? <span className="spin">◌</span> : 'Siguiente: elige personaje'}
      </button>
      <League />
    </main>
  );
}

export function WaitingReclaim() {
  return (
    <div>
      <h2>Esperando al anfitrión</h2>
      <p className="lead">La partida ya ha empezado. El anfitrión tiene que confirmar quién eres para devolverte tus cartas y tus puntos.</p>
    </div>
  );
}

/* ================= SALA ================= */
const TARGETS = [
  { v: 5, label: 'Corta', time: '~40 min' },
  { v: 6, label: 'Normal', time: '~50 min' },
  { v: 8, label: 'Larga', time: '~1 h 10' },
  { v: 10, label: 'Maratón', time: '~1 h 30' },
];
export function Lobby() {
  const { snap, presence } = useApp();
  const [qr, setQr] = useState('');
  const [picking, setPicking] = useState(false);
  const pub = snap!.public, me = snap!.private!;
  const link = `${location.origin}${location.pathname}?c=${pub.code}`;
  useEffect(() => { QRCode.toDataURL(link, { margin: 1, width: 360, color: { dark: '#12392C', light: '#FFFFFF' } }).then(setQr).catch(() => {}); }, [link]);
  const players = pub.players.filter(p => !p.removed);
  const c = pub.config;
  const share = async () => {
    try { if (navigator.share) await navigator.share({ title: APP_NAME, text: `Entra con el código ${pub.code}`, url: link }); else { await navigator.clipboard.writeText(link); toast('Enlace copiado'); } } catch { /* */ }
  };
  return (
    <div>
      <h2>Sala {pub.code}</h2>
      <p className="lead">Escanead el código o entrad con el enlace.</p>
      {qr && <img className="qr" src={qr} alt={`QR para entrar en la sala ${pub.code}`} />}
      <button className="btn ghost block" onClick={share}>Compartir enlace</button>
      <h2>Jugadores ({players.length})</h2>
      <div className="players">
        {players.map(p => (
          <div className="player" key={p.id}>
            <Avatar id={p.avatar} crop="head" size={40} />
            <span className={`dot ${presence[p.id] || p.id === me.id ? '' : 'wait'}`} />
            <span className="name">{p.name}{p.id === me.id ? ' (tú)' : ''}</span>
            {p.id === pub.hostId && <span className="badge y">Anfitrión</span>}
            {p.id === me.id && <button className="badge" onClick={() => setPicking(true)}>Cambiar</button>}
          </div>
        ))}
      </div>
      {(picking || !me.avatar) && (
        <Sheet title="Elige tu personaje" onClose={me.avatar ? () => setPicking(false) : undefined}>
          <AvatarPicker value={me.avatar} taken={players.map(p => p.avatar)} onPick={id => { act({ type: 'setAvatar', avatar: id }); setPicking(false); }} />
        </Sheet>
      )}
      {me.isHost ? (
        <>
          <h2>Partida</h2>
          <p className="muted">Se juega hasta que alguien llega a la meta; después, una vuelta final para todos.</p>
          <div className="seg" style={{ margin: '8px 0 14px' }}>
            {TARGETS.map(t => <button key={t.v} className={c.target === t.v ? 'on' : ''} onClick={() => act({ type: 'config', config: { target: t.v } })}>{t.v} pts<small>{t.time}</small></button>)}
          </div>
          <div className="seg" style={{ marginBottom: 14 }}>
            <button className={c.handMode === 'deplete' ? 'on' : ''} onClick={() => act({ type: 'config', config: { handMode: 'deplete' } })}>Gastar las 7<small>Todos gastan 1 por ronda, el juez también</small></button>
            <button className={c.handMode === 'refill' ? 'on' : ''} onClick={() => act({ type: 'config', config: { handMode: 'refill' } })}>Robar cada ronda<small>Siempre 7 palabras</small></button>
          </div>
          <div className="seg" style={{ marginBottom: 14 }}>
            <button className={!c.finalDouble ? 'on' : ''} onClick={() => act({ type: 'config', config: { finalDouble: false } })}>Vuelta final normal</button>
            <button className={c.finalDouble ? 'on' : ''} onClick={() => act({ type: 'config', config: { finalDouble: true } })}>Vuelta final doble</button>
          </div>
          <div className="dock"><div className="inner">
            <button className="btn primary" disabled={players.length < 3} onClick={() => act({ type: 'start' })}>{players.length < 3 ? `Faltan ${3 - players.length} jugadores` : 'Empezar partida'}</button>
          </div></div>
        </>
      ) : (
        <p className="muted">Partida a {c.target} puntos · {c.handMode === 'refill' ? 'robando cada ronda' : 'gastando las 7'}{c.finalDouble ? ' · vuelta final doble' : ''}. Esperando a que {nameOf(pub, pub.hostId)} empiece.</p>
      )}
    </div>
  );
}

/* ================= ELIGE TU TURNO ================= */
const ORD = (n: number) => `${n}º`;
export function Order() {
  const { snap } = useApp();
  const pub = snap!.public, me = snap!.private!;
  const op = pub.orderPick!;
  const [tapped, setTapped] = useState<number | null>(null);
  const mineN = me.myOrder;
  const done = Object.keys(op.picks).length;
  const picked = mineN != null;
  return (
    <div>
      <h2>Elige tu turno</h2>
      <p className="lead">Toca una carta. El número que salga es tu turno de juez: el 1º juzga primero.</p>
      <div className={`order-grid${picked ? ' locked' : ''}`}>
        {Array.from({ length: op.count }, (_, i) => {
          const isMine = tapped === i || (picked && tapped == null && i === 0);
          return (
            <button key={i} className={`ocard${isMine ? ' flipped' : ''}`} disabled={picked || tapped != null} onClick={() => { setTapped(i); act({ type: 'pickCard', card: i }); }} aria-label={isMine && mineN != null ? `Tu turno: ${ORD(mineN)}` : `Carta ${i + 1}`}>
              <span className="face back"><span>JUZ</span></span>
              <span className="face front">{isMine ? (mineN != null ? ORD(mineN) : '…') : ''}<small>{isMine && mineN != null ? (mineN === 1 ? '¡Juzgas primero!' : 'tu turno') : ''}</small></span>
            </button>
          );
        })}
      </div>
      <p className={`waiting${picked ? ' on' : ''}`}>{picked ? `Esperando al resto… (${done}/${op.count})` : `${done} de ${op.count} ya han elegido`}</p>
    </div>
  );
}

/** Clasificación del orden: aparece 3 s al terminar el minijuego, mientras la partida se prepara detrás. */
export function OrderRanking({ onDone }: { onDone: () => void }) {
  const { snap } = useApp();
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }, [onDone]);
  const pub = snap!.public;
  return (
    <div className="scrim center" onClick={onDone}>
      <div className="ranking">
        <h3>Orden de jueces</h3>
        <ol>{pub.judgeOrderIds.map((id, i) => { const p = pub.players.find(x => x.id === id); return (
          <li key={id} style={{ animationDelay: `${i * 140}ms` }}><span className="pos">{ORD(i + 1)}</span><Avatar id={p?.avatar} judge={i === 0} crop="head" size={44} /><b>{p?.name}</b>{i === 0 && <em>juzga primero</em>}</li>
        ); })}</ol>
        <div className="bar"><i /></div>
      </div>
    </div>
  );
}

/* ================= RULETA ================= */
export function Roulette() {
  const { snap } = useApp();
  const pub = snap!.public, me = snap!.private!;
  const r = me.roulette;
  const [spinning, setSpinning] = useState(false);
  const pending = pub.roulette?.pending ?? [];
  return (
    <div>
      <h2>Ruleta</h2>
      <p className="lead">Cada 3 rondas todos tiran. Puede tocar un comodín, nada… o algo malo. Solo tú verás lo que te toca.</p>
      <Wheel slot={r ? r.slot : null} spinning={spinning} />
      <WheelLegend />
      {!r && <div className="dock"><div className="inner"><button className="btn primary" disabled={spinning} onClick={() => { setSpinning(true); act({ type: 'spin' }); }}>{spinning ? 'Girando…' : 'Girar la ruleta'}</button></div></div>}
      {r && <div className="banner">Has sacado <b>{r.label}</b>. {pending.length > 0 ? `Esperando a ${pending.map(p => nameOf(pub, p)).join(', ')}…` : ''}</div>}
      {r?.needsChoice && (
        <Sheet title="Solo puedes tener 2 comodines">
          <p>Te ha tocado <b>{COMODIN[r.offered!].name}</b>, pero ya tienes dos. Toca el que quieres <b>descartar</b>:</p>
          <div className="chips">{[...me.comodines, r.offered!].map((c, i) => <Chip key={c + i} c={c} onClick={() => act({ type: 'keepChoice', discard: c })} />)}</div>
        </Sheet>
      )}
    </div>
  );
}

/* ================= ADJETIVO ================= */
const PHRASES = ['Tu peor foto', 'Esto lo cociné yo', 'Prueba de que estuve en un sitio raro', 'Mi cara un lunes', 'Lo más random de mi galería', 'Una captura que no debería tener', 'Mi mejor momento', 'Algo que me dio vergüenza', 'La última foto de fiesta', 'Mi mascota (o algo parecido)'];
export function Adjective() {
  const { snap } = useApp();
  const pub = snap!.public, me = snap!.private!;
  const r = pub.round!;
  const [phrase, setPhrase] = useState('');
  const [golpeOpen, setGolpeOpen] = useState(false);
  useToolEvent('golpe', () => setGolpeOpen(true));
  const now = useNow(500);
  if (r.type === 'carrete') {
    return me.isJudge ? (
      <div>
        <h2>📸 Ronda de Carrete</h2>
        <p className="lead">Escribe una frase. Cada uno buscará en su galería la foto que mejor encaje.</p>
        <input className="input" value={phrase} maxLength={120} onChange={e => setPhrase(e.target.value)} placeholder="Ej.: Mi cara un lunes" />
        <div className="row" style={{ margin: '12px 0' }}>{PHRASES.map(p => <button key={p} className="badge" onClick={() => setPhrase(p)}>{p}</button>)}</div>
        <div className="dock"><div className="inner"><button className="btn primary" disabled={!phrase.trim()} onClick={() => act({ type: 'setPhrase', phrase })}>Lanzar la frase</button></div></div>
      </div>
    ) : <><Courtroom /><Waiting title="📸 Ronda de Carrete" text={`${nameOf(pub, r.judgeId)} está escribiendo la frase. Ve abriendo tu galería.`} /></>;
  }
  const wait = Math.ceil(((r.adjOpenAt ?? 0) - now) / 1000);
  if (me.golpeNow && me.adjOptions) return (
    <div>
      <div className="golpe-panel">
        <p><b>👑 ¡Tu Golpe de Estado!</b> Esta ronda eliges tú el adjetivo. Mira tus palabras y elige el que más te convenga. Nadie sabrá que has sido tú: disimula.</p>
        <div className="stack">{me.adjOptions.map((a, i) => <AdjCard key={a.a} a={a.a} s={a.s} onClick={() => act({ type: 'golpe', index: i })} />)}</div>
      </div>
      <h2 className="h-sm">Tus palabras</h2>
      <Hand cards={me.hand} selected={[]} onToggle={() => {}} readOnly />
    </div>
  );
  if (r.golpeArmed) return (
    <div>
      <Courtroom />
      <Waiting title="👑 ¡Golpe de Estado!" text={me.isJudge ? 'Su Señoría ha sido depuesta: esta ronda alguien elige el adjetivo por ti. Tú sigues juzgando.' : 'Su Señoría ha sido depuesta: alguien está eligiendo el adjetivo. ¿Quién habrá sido?'} />
      {!me.isJudge && <><h2 className="h-sm">Tus palabras · ve pensando</h2><Hand cards={me.hand} selected={[]} onToggle={() => {}} readOnly /></>}
    </div>
  );
  if (me.isJudge) return (
    <div>
      <Courtroom />
      <h2 className="h-sm">{wait > 0 ? `Barajando los adjetivos… ${wait}` : 'Elige el adjetivo y léelo en voz alta'}</h2>
      <div className={`stack${wait > 0 ? ' shuffling' : ''}`}>{me.adjOptions?.map((a, i) => wait > 0
        ? <div key={a.a} className="card adj back-adj">?</div>
        : <AdjCard key={a.a} a={a.a} s={a.s} onClick={() => act({ type: 'chooseAdjective', index: i })} />)}</div>
    </div>
  );
  const canGolpe = me.comodines.includes('golpe') && !me.usedComodin && !!me.adjOptions;
  return (
    <div>
      {canGolpe ? (
        <div className="golpe-panel">
          <p><b>👑 Tienes Golpe de Estado.</b> Si quieres, elige tú el adjetivo ahora, antes que el juez{wait > 0 ? ` (te quedan ${wait} s de ventaja)` : ''}. Nadie sabrá que has sido tú.</p>
          <div className="stack">{me.adjOptions!.map((a, i) => <AdjCard key={a.a} a={a.a} s={a.s} onClick={() => act({ type: 'golpe', index: i })} />)}</div>
        </div>
      ) : null}
      <Courtroom />
      {!canGolpe && <ComodinReminder />}
      <h2 className="h-sm">Tus palabras · ve pensando</h2>
      <Hand cards={me.hand} selected={[]} onToggle={() => {}} readOnly />
      {golpeOpen && me.adjOptions && (
        <Sheet title="👑 Golpe de Estado" onClose={() => setGolpeOpen(false)}>
          <p className="muted">Eliges tú el adjetivo. Nadie sabrá que has sido tú… si disimulas.</p>
          <div className="stack">{me.adjOptions.map((a, i) => <AdjCard key={a.a} a={a.a} s={a.s} onClick={() => { act({ type: 'golpe', index: i }); setGolpeOpen(false); }} />)}</div>
        </Sheet>
      )}
    </div>
  );
}

function Waiting({ title, text }: { title: string; text: string }) {
  return <div><h2>{title}</h2><p className="lead">{text}</p></div>;
}

function RoundHeader() {
  const { snap } = useApp();
  const pub = snap!.public; const r = pub.round!;
  return r.type === 'carrete'
    ? <div className="card adj table-adj"><span className="title" style={{ fontSize: 26 }}>📸 {r.phrase}</span>{r.golpe && <span className="syn">¡Golpe de Estado!</span>}</div>
    : r.adjective ? <AdjCard className="table-adj" a={r.adjective.a} s={r.adjective.s} /> : null;
}

/* ================= MANO ================= */
function Hand({ cards, selected, onToggle, readOnly }: { cards: { id: number; w: string; d: string }[]; selected: number[]; onToggle: (i: number) => void; readOnly?: boolean }) {
  const key = cards.map(c => c.id).join(',');
  return (
    <div className="hand-wrap">
      <div className="hand-scroll" key={key}>
        {cards.map((h, i) => (
          <WordCard key={h.id} id={h.id} no={i + 1} w={h.w} d={h.d} selected={selected.includes(i)} onClick={readOnly ? undefined : () => onToggle(i)} className="in-hand" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
      <p className="hand-count">{readOnly ? 'Podrás jugar cuando el juez dicte el adjetivo' : `Tus ${cards.length} palabras · desliza y toca una`}</p>
    </div>
  );
}

/* ================= JUGAR ================= */
const TOOLS: Comodin[] = ['cambio', 'nuevas', 'espia'];
export function Play() {
  const { snap } = useApp();
  const pub = snap!.public, me = snap!.private!;
  const r = pub.round!;
  const active = useActive(pub.roundNo);
  const [sel, setSel] = useState<number[]>([]);
  const [custom, setCustom] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const handKey = me.hand.map(h => h.id).join(',');
  useEffect(() => { setSel([]); }, [handKey, active]);

  if (me.manoAjenaTask) return (
    <div>
      <Courtroom />
      <h2>Mano Ajena</h2>
      <p className="lead">Elige a ciegas qué carta juega {me.manoAjenaTask.target}.</p>
      <div className="backs-grid">{Array.from({ length: me.manoAjenaTask.slots }, (_, i) => <CardBack key={i} onClick={() => act({ type: 'manoAjenaPick', slot: i })} label={`Carta ${i + 1}`} />)}</div>
    </div>
  );
  if (me.isJudge) return (
    <div>
      <Courtroom />
      {me.mustDiscard ? <>
        <h2 className="h-sm">Tira una palabra a la papelera</h2>
        <p className="muted" style={{ marginTop: 0 }}>Los demás gastan una carta al jugar; tú también, para que todos tengáis siempre las mismas.</p>
        <Hand cards={me.hand} selected={sel} onToggle={i => setSel([i])} />
        <div className="dock"><div className="inner"><button className="btn primary" disabled={sel.length !== 1} onClick={() => { act({ type: 'judgeDiscard', index: sel[0] }); setSel([]); }}>{sel.length ? `🗑️ Tirar «${me.hand[sel[0]]?.w}»` : 'Toca una palabra'}</button></div></div>
      </> : <Waiting title="Los demás están jugando" text="Cuando todos jueguen, destaparás las cartas una a una." />}
      <PlayedList />
    </div>
  );
  if (me.myPlayId || pub.players.find(p => p.id === me.id)?.skipped) return (
    <div>
      <Courtroom />
      {me.myPlayId && me.comodines.includes('espia') && !me.usedComodin && <SpyAfter />}
      {me.myPlayId && me.comodines.includes('abogado') && !me.usedComodin && <div className="combo-row"><p><b>⚖️ Aún puedes contratar Abogado</b> para tu carta: solo las cartas con abogado podrán defenderse.</p><button className="cchip" onClick={() => act({ type: 'lawyer' })}><b>Usar Abogado</b><small>Se anuncia a todos al destapar</small></button></div>}
      <Waiting title={me.myPlayId ? 'Carta jugada' : 'Esta ronda no juegas'} text={me.myPlayId ? (me.usedComodin ? `Con ${cLabel(me.usedComodin)}. ` : '') + 'Esperando al resto…' : 'Esperando al resto…'} />
      <PlayedList />
    </div>
  );
  if (me.manoAjenaMe) return (<div><Courtroom /><Waiting title="Mano Ajena" text="Otro jugador está eligiendo a ciegas tu carta." /></div>);

  const carrete = r.type === 'carrete';
  const isTool = !!active && TOOLS.includes(active);
  const need = active === 'doble' ? 2 : active === 'escribe' || carrete ? 0 : 1;
  const toggle = (i: number) => {
    if (active === 'nuevas') { setSel(s => s.includes(i) ? s.filter(x => x !== i) : [...s, i]); return; }
    if (active === 'cambio') { setSel([i]); return; }
    setSel(s => s.includes(i) ? s.filter(x => x !== i) : need === 2 ? [...s, i].slice(-2) : [i]);
  };
  const ready = carrete ? !!photo : active === 'escribe' ? custom.trim().length > 0 : sel.length === need;
  const onFile = async (f?: File) => {
    if (!f) return; setUploading(true);
    try { setPhoto(await uploadPhoto(f)); } catch { toast('No se pudo subir la foto. Prueba otra vez.'); } finally { setUploading(false); }
  };
  const others = pub.players.filter(p => !p.removed && p.id !== me.id && p.id !== r.judgeId);
  const stepNow = active ? (isTool ? (active === 'espia' ? 0 : sel.length ? 1 : 0) : active === 'escribe' ? (custom.trim() ? 1 : 0) : ready ? 1 : 0) : 0;

  return (
    <div>
      <Courtroom />
      {me.todoActive && <div className="banner warn">Todo o Nada: si ganas +2, si no −1.</div>}
      {!active && <ComboRow active={active} />}
      {active ? (
        <div className="active-combo">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <Chip c={active} on />
            <button className="badge" onClick={() => setActive(null, pub.roundNo)}>Quitar comodín</button>
          </div>
          <p style={{ margin: '8px 0 6px' }}>{COMODIN[active].desc}</p>
          <ol className="steps">{COMODIN[active].steps.map((s, i) => <li key={s} className={i < stepNow ? 'done' : i === stepNow ? 'now' : ''}>{s}</li>)}</ol>
        </div>
      ) : (
        carrete ? <h2 className="h-sm">Busca la foto que mejor encaje</h2> : null
      )}

      {active === 'espia' ? (
        <div className="stack" style={{ marginBottom: 14 }}>
          {others.map(p => <button key={p.id} className="btn" onClick={() => { act({ type: 'tool', comodin: 'espia', target: p.id }); setActive(null, pub.roundNo); }}>🕵️ Espiar a {p.name}<small style={{ display: 'block', fontWeight: 500, opacity: .75 }}>{p.played ? 'Ya ha jugado: lo verás al momento' : 'Aún no ha jugado: te avisamos en cuanto juegue'}</small></button>)}
        </div>
      ) : carrete ? (
        <div className="stack">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => onFile(e.target.files?.[0])} />
          {photo && <img className="photo-mini" src={photo} alt="Tu foto" />}
          <button className="btn block" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? 'Subiendo…' : photo ? 'Cambiar foto' : 'Elegir foto de la galería'}</button>
        </div>
      ) : active === 'escribe' ? (
        <div className="stack">
          <label className="field"><span>Tu palabra</span><input className="input" value={custom} maxLength={60} onChange={e => setCustom(e.target.value)} placeholder="La palabra perfecta" /></label>
          <label className="field"><span>Su descripción (la frase graciosa)</span><input className="input" value={customDesc} maxLength={120} onChange={e => setCustomDesc(e.target.value)} placeholder="Ej.: Lo que dice Sergio a las 4 de la mañana" /></label>
        </div>
      ) : (
        <Hand cards={me.hand} selected={sel} onToggle={toggle} />
      )}

      <div className="dock"><div className="inner">
        {active === 'nuevas' ? <button className="btn primary" disabled={!sel.length} onClick={() => { act({ type: 'tool', comodin: 'nuevas', handIndices: sel }); setActive(null, pub.roundNo); }}>Cambiar {sel.length || ''} por nuevas</button>
          : active === 'cambio' ? <button className="btn primary" disabled={sel.length !== 1} onClick={() => { act({ type: 'tool', comodin: 'cambio', handIndex: sel[0] }); setActive(null, pub.roundNo); }}>Soltar esta carta</button>
          : active === 'espia' ? <button className="btn" onClick={() => setActive(null, pub.roundNo)}>Cancelar espía</button>
          : <button className="btn primary" disabled={!ready || uploading} onClick={() => { act({ type: 'play', hand: sel, custom, customDesc, photo: photo ?? undefined, comodin: active ?? undefined }); setActive(null, pub.roundNo); }}>
              {active ? `Jugar con ${COMODIN[active].name}` : carrete ? 'Enviar foto' : sel.length ? `Jugar «${me.hand[sel[0]]?.w}»` : 'Toca una carta'}
            </button>}
      </div></div>
    </div>
  );
}

const PLAY_LIKE = new Set(['play', 'tool']);
function ComboRow({ active }: { active: Comodin | null }) {
  const { snap } = useApp();
  const pub = snap!.public, me = snap!.private!;
  if (me.usedComodin) return null;
  const list = me.comodines.filter(c => PLAY_LIKE.has(COMODIN[c].when) && availability(c, pub, me).can);
  if (!list.length) return null;
  return (
    <div className="combo-row">
      <p>¿Quieres usar un comodín en esta jugada? <span className="muted">Tócalo antes de elegir carta.</span></p>
      <div className="combo-chips">{list.map((c, i) => (
        <button key={c + i} className={`cchip${active === c ? ' on' : ''}`} onClick={() => setActive(active === c ? null : c, pub.roundNo)}>
          <b>{cLabel(c)}</b><small>{COMODIN[c].good}</small>
        </button>
      ))}</div>
    </div>
  );
}
function SpyAfter() {
  const { snap } = useApp();
  const pub = snap!.public, me = snap!.private!; const r = pub.round!;
  const others = pub.players.filter(p => !p.removed && p.id !== me.id && p.id !== r.judgeId);
  return (
    <div className="combo-row">
      <p><b>🕵️ Aún puedes usar Espía.</b> Elige a quién:</p>
      <div className="combo-chips">{others.map(p => <button key={p.id} className="cchip" onClick={() => act({ type: 'tool', comodin: 'espia', target: p.id })}><b>{p.name}</b><small>{p.played ? 'Ya ha jugado' : 'Te avisamos cuando juegue'}</small></button>)}</div>
    </div>
  );
}

function PlayedList() {
  const { snap, presence } = useApp();
  const pub = snap!.public; const r = pub.round!;
  const ps = pub.players.filter(p => !p.removed && p.id !== r.judgeId);
  return (
    <div className="players">
      {ps.map(p => (
        <div className="player" key={p.id}>
          <span className={`dot ${presence[p.id] || DEMO ? '' : 'off'}`} />
          <span className="name">{p.name}</span>
          <span className={`badge ${p.played ? 'y' : ''}`}>{p.played ? '✓ Ha jugado' : p.skipped ? 'Saltado' : pub.round?.manoAjena.includes(p.name) ? 'Mano Ajena' : 'Pensando…'}</span>
        </div>
      ))}
    </div>
  );
}

/* ================= JUZGAR ================= */
export function Judging() {
  const { snap } = useApp();
  const pub = snap!.public, me = snap!.private!;
  const r = pub.round!;
  const [actAsHost, setActAsHost] = useState(false);
  const canJudge = me.isJudge || (me.isHost && actAsHost);
  const [focus, setFocus] = useState<string | null>(null);
  const [debatePick, setDebatePick] = useState<string[] | null>(null);
  const [briberyShown, setBriberyShown] = useState(false);
  const [apostando, setApostando] = useState(false);
  useToolEvent('apuesta', () => setApostando(true));
  const nowJ = useNow(500);
  const [fining, setFining] = useState(false);
  const delib = Math.max(0, Math.ceil(((r.decideAt ?? 0) - nowJ) / 1000));
  const plays = r.plays;
  const allOpen = r.revealed >= r.total;
  const label = (id: string) => { const p = plays.find(x => x.id === id); return p ? (p.photo ? 'una foto' : p.words.map(w => w.w).join(' + ')) : '?'; };
  const carrete = r.type === 'carrete';

  return (
    <div>
      <Courtroom />
      {r.bribe && <div className="banner">💰 Hay un soborno sobre la mesa.{canJudge ? ' Verás la carta sobornada marcada con 💰: si la eliges, sumas +1… y todos sabrán que aceptaste.' : ' Prohibido hablar de ello.'}</div>}
      {r.lawyerCount > 0 && <div className="banner warn">⚖️ {r.lawyers.length ? <>Solo {r.lawyers.length > 1 ? 'las cartas' : 'la carta'} {r.lawyers.map(id => `«${label(id)}»`).join(' y ')} {r.lawyers.length > 1 ? 'tienen' : 'tiene'} derecho a defenderse.</> : 'Hay una carta con abogado: cuando se destape, solo ella podrá defenderse.'} El resto, silencio o −1 punto. Tranquilos: aunque no convenza al juez, cualquiera puede ganar.</div>}
      {!canJudge && me.myPlayId && me.comodines.includes('abogado') && !me.usedComodin && <button className="btn block" style={{ marginBottom: 10 }} onClick={() => act({ type: 'lawyer' })}>⚖️ Contratar Abogado para mi carta</button>}
      {r.debate && (
        <div className="banner">
          <p style={{ margin: '0 0 6px', fontWeight: 800 }}>Debate</p>
          {r.debate.order.map((id, i) => <p key={id} style={{ margin: '2px 0', opacity: i === r.debate!.turn ? 1 : .55 }}>{i === r.debate!.turn ? '🎤 ' : `${i + 1}. `}Defiende «{label(id)}»</p>)}
          {r.debate.turn >= r.debate.order.length && <p style={{ margin: '6px 0 0' }}>Todos han hablado. Juez, decide.</p>}
          {canJudge && <div className="row" style={{ marginTop: 8 }}>
            {r.debate.turn < r.debate.order.length && <button className="btn" onClick={() => act({ type: 'debateNext' })}>Siguiente</button>}
            <button className="btn ghost" onClick={() => act({ type: 'endDebate' })}>Cerrar debate</button>
          </div>}
        </div>
      )}
      <h2 className="h-sm">
        {!allOpen ? (canJudge ? `Destapa las cartas y léelas en voz alta (${r.revealed}/${r.total})` : `${nameOf(pub, r.judgeId)} está destapando las cartas (${r.revealed}/${r.total})`)
          : canJudge ? (debatePick ? 'Elige 2 o 3 cartas para el debate' : 'Toca una carta para descartarla o elegirla') : apostando ? 'Toca la carta que crees que ganará' : `${nameOf(pub, r.judgeId)} está decidiendo`}
      </h2>
      {!canJudge && <ComodinReminder />}
      <div className={`table-grid${carrete ? ' photos' : ''}`}>
        {plays.map((p, i) => {
          if (p.hidden) return <CardBack key={p.id} className={i === r.revealed && canJudge ? 'next' : ''} onClick={canJudge && i === r.revealed ? () => act({ type: 'flip' }) : undefined} />;
          const disc = r.discarded.includes(p.id);
          const mine = me.myPlayIds.includes(p.id);
          const inDebate = debatePick?.includes(p.id);
          const onClick = canJudge && allOpen ? () => {
            if (debatePick) setDebatePick(d => d!.includes(p.id) ? d!.filter(x => x !== p.id) : [...d!, p.id].slice(-3));
            else setFocus(p.id);
          } : apostando && !mine && !p.hidden ? () => { act({ type: 'apuesta', playId: p.id }); setApostando(false); } : undefined;
          const tag = mine ? 'La tuya' : me.myApuesta === p.id ? 'Tu apuesta' : me.bribedPlays.includes(p.id) ? '💰 Sobornada' : r.lawyers.includes(p.id) ? '⚖️ Abogado' : undefined;
          return carrete ? (
            <button key={p.id} className={`photo-card flipin${disc ? ' discarded' : ''}${inDebate ? ' selected' : ''}`} onClick={onClick}>
              {tag && <span className="tag">{tag}</span>}
              <img src={p.photo} alt="Foto jugada" loading="lazy" />
            </button>
          ) : (
            <WordCard key={p.id} id={p.words[0]?.id} no={i + 1} w={p.words.map(w => w.w).join(' + ')} d={p.words.map(w => w.d).join(' / ')} onClick={onClick}
              className={`flipin${disc ? ' discarded' : ''}`} selected={inDebate} tag={tag} />
          );
        })}
      </div>

      {fining && (
        <Sheet title="🔨 Multar −1" onClose={() => setFining(false)}>
          <p className="muted" style={{ marginTop: 0 }}>Para quien hable sin tener abogado (o se le escape algo del soborno). Le resta 1 punto.</p>
          <div className="stack">{pub.players.filter(p => !p.removed && p.id !== r.judgeId).map(p => <button key={p.id} className="btn" onClick={() => { act({ type: 'fine', playerId: p.id }); setFining(false); }}>Multar a {p.name}</button>)}</div>
        </Sheet>
      )}
      {false && canJudge && me.sobornos > 0 && !briberyShown && allOpen && (
        <Sheet title="🤫">
          <p style={{ fontSize: 20 }}>Alguien te quiere sobornar. No digas nada, puede que te interese…</p>
          <p className="muted">Si eliges la carta sobornada, tú también sumas 1 punto. No sabrás cuál es.</p>
          <button className="btn primary block" onClick={() => setBriberyShown(true)}>Entendido</button>
        </Sheet>
      )}

      {focus && canJudge && (
        <Sheet title={label(focus)} onClose={() => setFocus(null)}>
          <div className="stack">
            <button className="btn primary block" disabled={delib > 0} onClick={() => { act({ type: 'pickWinner', playId: focus }); setFocus(null); }}>{delib > 0 ? `Deliberando… podrás elegir en ${delib} s` : '🏆 Esta es la ganadora'}</button>
            <button className="btn block" onClick={() => { act({ type: 'discard', playId: focus }); setFocus(null); }}>{r.discarded.includes(focus) ? 'Recuperar' : 'Descartar'}</button>
          </div>
        </Sheet>
      )}

      <div className="dock"><div className="inner">
        {canJudge && !allOpen && <button className="btn primary" onClick={() => act({ type: 'flip' })}>Destapar carta {r.revealed + 1} de {r.total}</button>}
        {canJudge && allOpen && !debatePick && !r.mordaza && !r.debate && <button className="btn" onClick={() => setDebatePick([])}>Invocar debate</button>}
        {canJudge && debatePick && <>
          <button className="btn ghost" onClick={() => setDebatePick(null)}>Cancelar</button>
          <button className="btn primary" disabled={debatePick.length < 2} onClick={() => { act({ type: 'debate', playIds: debatePick }); setDebatePick(null); }}>Empezar debate</button>
        </>}
        {apostando && <button className="btn ghost" onClick={() => setApostando(false)}>Cancelar apuesta</button>}
        {!canJudge && !apostando && r.revealed > 0 && me.comodines.includes('apuesta') && !me.myApuesta && !me.usedComodin && <button className="btn primary" onClick={() => setApostando(true)}>🎲 Usar Apuesta: ¿cuál ganará?</button>}
        {canJudge && <button className="btn ghost" onClick={() => setFining(true)}>🔨 Multar −1</button>}
        {!me.isJudge && me.isHost && !DEMO && <button className="btn ghost" onClick={() => setActAsHost(a => !a)}>{actAsHost ? 'Dejar de actuar como juez' : 'Actuar como juez'}</button>}
      </div></div>
    </div>
  );
}

/* ================= VOTO PÚBLICO (CARRETE) ================= */
export function Vote() {
  const { snap } = useApp();
  const pub = snap!.public, me = snap!.private!;
  const r = pub.round!;
  const canVote = !me.isJudge && !!me.myPlayId;
  return (
    <div>
      <Courtroom />
      <h2>Premio del público</h2>
      <p className="lead">El juez ya ha elegido. Votad vuestra favorita (no la vuestra): la más votada suma medio punto.</p>
      <div className="table-grid photos">
        {r.plays.map(p => {
          const mine = me.myPlayIds.includes(p.id);
          return (
            <button key={p.id} className={`photo-card${me.myVote === p.id ? ' selected' : ''}${r.winner === p.id ? ' winner' : ''}`} disabled={!canVote || mine} onClick={() => act({ type: 'vote', playId: p.id })}>
              {r.winner === p.id && <span className="tag">🏆 Juez</span>}{mine && <span className="tag">La tuya</span>}
              <img src={p.photo} alt="Foto jugada" loading="lazy" />
            </button>
          );
        })}
      </div>
      <p className="muted">{r.votesIn} voto{r.votesIn === 1 ? '' : 's'} recibido{r.votesIn === 1 ? '' : 's'}.</p>
      {(me.isHost || me.isJudge) && <div className="dock"><div className="inner"><button className="btn" onClick={() => act({ type: 'closeVote' })}>Cerrar votación</button></div></div>}
    </div>
  );
}

/* ================= RESULTADO DE LA RONDA ================= */
export function Reveal() {
  const { snap } = useApp();
  const pub = snap!.public, me = snap!.private!;
  const r = pub.round!;
  const win = r.plays.find(p => p.id === r.winner);
  const gain = me.lastGain ?? 0;
  const notes = me.notices;
  const gi = notes.map(n => n.kind).lastIndexOf('gain');
  const prevGain = notes.slice(0, Math.max(0, gi)).map(n => n.kind).lastIndexOf('gain');
  const summary = notes.slice(prevGain + 1, gi >= 0 ? gi : notes.length).filter(n => n.kind === 'round');
  return (
    <div>
      <Courtroom />
      {win ? (
        <div className="winner-wrap">
          <p className="muted" style={{ margin: '0 0 8px' }}>Carta ganadora</p>
          {win.photo ? <img className="photo-win reveal-word" src={win.photo} alt="Foto ganadora" /> : <WordCard className="reveal-word win" id={win.words[0]?.id} w={win.words.map(w => w.w).join(' + ')} d={win.words.map(w => w.d).join(' / ')} />}
          {r.publicWinners.length > 0 && <p className="muted">Premio del público para {r.publicWinners.length > 1 ? 'un empate' : 'la más votada'}.</p>}
        </div>
      ) : <Waiting title="Ronda anulada" text="Nadie jugó carta." />}
      <div className="banner private-box">
        <p className="muted" style={{ margin: 0 }}>Solo lo ves tú</p>
        <p className="gain" style={{ color: gain > 0 ? 'var(--mustard)' : gain < 0 ? '#FF8A73' : 'var(--mist)' }}>{gain > 0 ? `+${gain}` : gain}</p>
        <p style={{ margin: 0 }}>{gain > 0 ? '¡Puntos para ti! Disimula.' : gain < 0 ? 'Mala suerte. Que no se note.' : 'Esta vez no.'}</p>
        {((notes[gi]?.data as { lines?: string[] } | undefined)?.lines ?? []).length > 0 && <ul className="summary why">{(notes[gi]!.data as { lines: string[] }).lines.map((l, i) => <li key={i} className={l.startsWith('-') ? 'bad' : ''}>{l}</li>)}</ul>}
        {summary.length > 0 && <ul className="summary">{summary.map(n => <li key={n.id} className={(n.data as { good?: boolean } | undefined)?.good === false ? 'bad' : ''}>{n.text}</li>)}</ul>}
      </div>
      {r.bribeOutcome && <div className={`banner ${r.bribeOutcome === 'accepted' ? 'warn' : ''}`}>{r.bribeOutcome === 'accepted' ? '💰 ⚖️ Su Señoría aceptó el soborno.' : '💰 Había un soborno… y Su Señoría lo rechazó. Juez honrado.'}</div>}
      {(me.isJudge || me.isHost) && <div className="dock"><div className="inner"><button className="btn primary" onClick={() => act({ type: 'next' })}>Siguiente ronda</button></div></div>}
    </div>
  );
}

/* ================= FINAL ================= */
