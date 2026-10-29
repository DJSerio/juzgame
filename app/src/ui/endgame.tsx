import { useEffect, useMemo, useState } from 'react';
import { act, fetchLeague, type LeagueGame } from '../api';
import { COMODIN, useApp, useNow } from './common';
import { Avatar } from './avatar';

type Hist = NonNullable<NonNullable<ReturnType<typeof useApp>['snap']>['public']['history']>;
const STEP = 3200, DRUM = 3600, TAIL = 2600;

/* ================= FIN DE PARTIDA ================= */
export function End() {
  const { snap } = useApp();
  const now = useNow(250);
  const pub = snap!.public, me = snap!.private!;
  const rv = pub.reveal!;
  const players = pub.players.filter(p => !p.removed);

  if (!rv.startedAt) {
    const imReady = rv.ready.includes(me.id);
    return (
      <div className="scrim center">
        <div className="ready-card">
          <p className="kicker">⚖️ Se levanta la sesión</p>
          <h3>El juego ha llegado a su fin.</h3>
          <p className="lead">¿Queréis saber el ganador? Cuando estéis todos listos, empieza el veredicto.</p>
          <div className="ready-list">
            {players.map(p => (
              <div key={p.id} className={`ready-p${rv.ready.includes(p.id) ? ' ok' : ''}`}>
                <Avatar id={p.avatar} crop="head" size={44} />
                <span>{p.id === me.id ? 'Tú' : p.name}</span>
                <i>{rv.ready.includes(p.id) ? '✓ Listo' : 'Falta'}</i>
              </div>
            ))}
          </div>
          <button className="btn primary block" disabled={imReady} onClick={() => act({ type: 'endReady' })}>{imReady ? `Esperando al resto… (${rv.ready.length}/${players.length})` : 'Listo'}</button>
          {me.isHost && imReady && <button className="btn ghost block" onClick={() => act({ type: 'endStart' })}>Empezar sin esperar</button>}
        </div>
      </div>
    );
  }

  const ranking = rv.ranking; // del último al primero
  const n = ranking.length;
  const posOf = (pts: number) => 1 + ranking.filter(x => x.points > pts).length;
  const t = now - rv.startedAt;
  const winnerAt = (n - 1) * STEP + DRUM;
  const shown = t < 0 ? 0 : t >= winnerAt ? n : Math.min(n - 1, Math.floor(t / STEP) + 1);
  const drum = shown === n - 1 && t >= (n - 1) * STEP;
  const done = t >= winnerAt + TAIL;

  if (!done) {
    const cur = shown > 0 ? ranking[shown - 1] : null;
    const isWinner = shown === n;
    return (
      <div className="cine">
        <p className="cine-kicker">El veredicto</p>
        {drum ? (
          <div className="cine-drum"><span>🥁</span><p>Y el ganador del juicio es…</p></div>
        ) : cur ? (
          <div key={cur.id} className={`cine-card${isWinner ? ' winner' : ''}`}>
            <span className="cine-pos">{posOf(cur.points)}º</span>
            <Avatar id={cur.avatar} judge={isWinner} crop="bust" size={isWinner ? 200 : 160} />
            <b>{cur.name}</b>
            <span className="cine-pts">{cur.points} {cur.points === 1 ? 'punto' : 'puntos'}</span>
            {isWinner && <span className="cine-crown">¡Su Señoría Suprema!</span>}
          </div>
        ) : <div className="cine-drum"><p>Del último al primero…</p></div>}
        <div className="cine-list">
          {ranking.slice(0, Math.min(shown, n)).filter((_, i) => i < shown - 1 || drum).map(p => (
            <span key={p.id}><Avatar id={p.avatar} crop="head" size={28} />{posOf(p.points)}º {p.name}</span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2>¡Fin de la partida!</h2>
      <div className="podium">
        {[...ranking].reverse().map(p => (
          <div key={p.id} className={`rank${posOf(p.points) === 1 ? ' first' : ''}`}>
            <span className="pos">{posOf(p.points)}º</span>
            <Avatar id={p.avatar} judge={posOf(p.points) === 1} crop="head" size={40} />
            <span className="n">{p.name}{p.id === me.id ? ' (tú)' : ''}</span>
            <span className="pts">{p.points}</span>
          </div>
        ))}
      </div>
      <p className="muted">✓ Partida guardada en la liga.</p>
      {pub.history && <Behind history={pub.history} names={ranking.map(r => r.name)} />}
      {pub.history && <Chronology history={pub.history} />}
    </div>
  );
}

/* ---- lo que pasó por detrás: estadísticas ---- */
function Behind({ history, names }: { history: Hist; names: string[] }) {
  const rows = names.map(name => {
    const won = history.filter(h => h.plays.some(p => p.winner && p.player === name)).length;
    const judged = history.filter(h => h.judge === name).length;
    const coms = history.flatMap(h => h.plays.filter(p => p.player === name && p.comodin).map(p => p.comodin!));
    const gained = history.reduce((a, h) => a + (h.gains[name] ?? 0), 0);
    return { name, won, judged, coms: [...new Set(coms)], gained };
  }).reverse();
  const best = history.flatMap(h => h.plays.filter(p => p.winner).map(p => ({ adj: h.adjective ?? h.phrase, w: p.words.join(' + '), who: p.player })));
  return (
    <>
      <h2>Las cuentas del juicio</h2>
      <div className="behind">
        <div className="bh-row head"><span>Jugador</span><span>Rondas ganadas</span><span>Veces juez</span><span>Comodines</span></div>
        {rows.map(r => (
          <div key={r.name} className="bh-row"><span>{r.name}</span><span>{r.won}</span><span>{r.judged}</span><span>{r.coms.map(c => COMODIN[c].icon).join(' ') || '—'}</span></div>
        ))}
      </div>
      {best.length > 0 && <>
        <h3 className="h-sm">Palabras ganadoras</h3>
        <div className="wins">{best.map((b, i) => <span key={i}><i>{b.adj}</i> → <b>{b.w}</b> <small>({b.who})</small></span>)}</div>
      </>}
    </>
  );
}

export function Chronology({ history }: { history: Hist }) {
  return (
    <>
      <h2>Lo que pasó de verdad</h2>
      <div className="timeline">
        {history.map(h => (
          <div key={h.no} className="tl-item">
            <h4>Ronda {h.no} · {h.type === 'carrete' ? `📸 «${h.phrase}»` : h.adjective}{h.final ? ' · final' : ''}</h4>
            <p className="muted" style={{ margin: '0 0 6px' }}>Juez: {h.judge}{h.golpeBy ? ` · 👑 golpe de Estado de ${h.golpeBy}` : ''}</p>
            {h.plays.map((p, i) => (
              <div key={i} className={`tl-play${p.winner ? ' win' : ''}`}>
                <span>{p.winner ? '🏆' : '·'}</span>
                <span><b>{p.player}</b>: {p.photo ? <a href={p.photo} target="_blank" rel="noreferrer">foto</a> : p.words.join(' + ')}{p.comodin ? ` (${COMODIN[p.comodin].icon} ${COMODIN[p.comodin].name})` : ''}{p.votes ? ` · ${p.votes} voto${p.votes > 1 ? 's' : ''}` : ''}</span>
              </div>
            ))}
            {Object.keys(h.gains).length > 0 && <p className="muted" style={{ margin: '6px 0 0' }}>Puntos: {Object.entries(h.gains).map(([nm, g]) => `${nm} ${g > 0 ? '+' : ''}${g}`).join(', ')}</p>}
            {h.events.length > 0 && <ul>{h.events.map((e, i) => <li key={i}>{e}</li>)}</ul>}
          </div>
        ))}
      </div>
    </>
  );
}

/* ================= LIGA (en el inicio) ================= */
export function League() {
  const [games, setGames] = useState<LeagueGame[] | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { void fetchLeague().then(setGames); }, []);
  const table = useMemo(() => {
    const m = new Map<string, { name: string; avatar: string; league: number; points: number; played: number; wins: number }>();
    for (const g of games ?? []) for (const p of g.players) {
      const k = p.name.trim().toLowerCase();
      const row = m.get(k) ?? { name: p.name, avatar: p.avatar, league: 0, points: 0, played: 0, wins: 0 };
      row.league += p.league; row.points += p.points; row.played += 1; if (p.pos === 1) row.wins += 1;
      m.set(k, row);
    }
    return [...m.values()].sort((a, b) => b.league - a.league || b.points - a.points || b.wins - a.wins);
  }, [games]);
  if (!games || !games.length) return (
    <section className="league empty"><h3>🏛️ La Liga</h3><p className="muted">Aún no hay partidas terminadas. Cada partida suma puntos de liga: 1º 10 · 2º 7 · 3º 5 · 4º 3 · 5º 2 · 6º 1.</p></section>
  );
  return (
    <section className="league">
      <h3>🏛️ La Liga <small>{games.length} {games.length === 1 ? 'partida' : 'partidas'}</small></h3>
      <div className="lg-row head"><span>#</span><span>Jugador</span><span title="Puntos de liga">Liga</span><span title="Partidas ganadas">🏆</span><span title="Puntos hechos en partida">Pts</span></div>
      {table.map((r, i) => (
        <div key={r.name} className={`lg-row${i === 0 ? ' lead' : ''}`}>
          <span>{i + 1}</span>
          <span className="lg-name"><Avatar id={r.avatar} judge={i === 0} crop="head" size={28} />{r.name}</span>
          <span className="lg-pts">{r.league}</span><span>{r.wins}</span><span>{r.points}</span>
        </div>
      ))}
      <button className="btn ghost block" onClick={() => setOpen(o => !o)}>{open ? 'Ocultar partidas' : 'Ver partidas anteriores'}</button>
      {open && <div className="lg-games">{games.map((g, i) => (
        <div key={i} className="lg-game">
          <small>{new Date(g.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} · sala {g.code}</small>
          <span>{[...g.players].sort((a, b) => a.pos - b.pos).map(p => `${p.pos}º ${p.name} (${p.points})`).join(' · ')}</span>
        </div>
      ))}</div>}
    </section>
  );
}
