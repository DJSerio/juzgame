import { useState } from 'react';
import { Logo } from './screens';
import { DEFAULT_NAMES, endDemo, needsAction, resumeDemo, setAuto, startDemo, switchTo, useDemo } from '../demo';
import { leaveRoom } from '../api';
import { ConfirmButton } from './common';
import { AvatarPicker } from './avatar';

export function DemoSetup() {
  const [n, setN] = useState(6);
  const [names, setNames] = useState(DEFAULT_NAMES);
  const [auto, setA] = useState(true);
  const [picking, setPicking] = useState<number | null>(null);
  const [avs, setAvs] = useState<string[]>([]);
  const d = useDemo();
  const clean = names.slice(0, n).map(x => x.trim());
  if (picking !== null) {
    const last = auto ? 0 : n - 1;
    return (
      <main className="app" style={{ paddingTop: 20 }}>
        <p className="muted" style={{ margin: 0 }}>{auto ? 'Tu personaje' : `Personaje ${picking + 1} de ${n}`}</p>
        <h2 style={{ margin: '2px 0 4px' }}>{clean[picking]}, elige tu personaje</h2>
        <p className="lead">Así te verán los demás toda la partida. Cuando te toque juzgar, se pondrá la toga.{auto ? ' Los demás cogerán uno al azar.' : ''}</p>
        <AvatarPicker value={avs[picking]} taken={avs.filter((_, i) => i !== picking)} onPick={id => setAvs(a => { const b = [...a]; b[picking] = id; return b; })} />
        <div className="dock"><div className="inner">
          <button className="btn ghost" onClick={() => setPicking(picking === 0 ? null : picking - 1)}>Atrás</button>
          <button className="btn primary" disabled={!avs[picking]} onClick={() => picking < last ? setPicking(picking + 1) : startDemo(clean, auto, avs)}>{!avs[picking] ? 'Toca un personaje' : picking < last ? 'Siguiente jugador' : 'Entrar en la sala'}</button>
        </div></div>
      </main>
    );
  }
  return (
    <main className="app" style={{ paddingTop: 32 }}>
      <Logo />
      <p className="lead">Demo para probar el juego tú solo. Controlas a todos los jugadores y cambias entre ellos desde la barra de arriba. Si quieres, los demás juegan solos.</p>
      {d.code && <button className="btn block" style={{ marginBottom: 14 }} onClick={() => resumeDemo()}>Seguir la demo anterior</button>}
      <h2 className="h-sm">Jugadores</h2>
      <div className="seg" style={{ marginBottom: 12 }}>
        {[3, 4, 5, 6, 7].map(k => <button key={k} className={n === k ? 'on' : ''} onClick={() => setN(k)}>{k}</button>)}
      </div>
      <div className="stack">
        {names.slice(0, n).map((nm, i) => (
          <input key={i} className="input" value={nm} maxLength={20} onChange={e => setNames(a => a.map((x, j) => j === i ? e.target.value : x))} aria-label={`Jugador ${i + 1}`} />
        ))}
      </div>
      <div className="seg" style={{ margin: '14px 0' }}>
        <button className={auto ? 'on' : ''} onClick={() => setA(true)}>Los demás juegan solos<small>Tú solo juegas tu parte</small></button>
        <button className={!auto ? 'on' : ''} onClick={() => setA(false)}>Yo controlo a todos<small>Cambias de jugador</small></button>
      </div>
      <div className="dock"><div className="inner">
        <button className="btn primary" disabled={names.slice(0, n).some(x => !x.trim()) || new Set(names.slice(0, n).map(x => x.trim().toLowerCase())).size < n} onClick={() => setPicking(0)}>Siguiente: elegir personaje</button>
      </div></div>
    </main>
  );
}

export function DemoBar() {
  const d = useDemo();
  if (!d.code) return null;
  return (
    <div className="demobar">
      <div className="demobar-top">
        <span>Juegas como <b>{d.players[d.current]?.name}</b>{(() => { const w = d.players.filter((p, i) => i !== d.current && needsAction(p.token)); return w.length ? <> · <span className="need-txt">● toca a {w.map(p => p.name).join(', ')}</span></> : null; })()}</span>
        <button className={`demotab auto${d.auto ? ' on' : ''}`} onClick={() => setAuto(!d.auto)} aria-pressed={d.auto} title="Auto: los demás juegan solos">🤖 {d.auto ? 'Bots: sí' : 'Bots: no'}</button>
      </div>
      <div className="demotabs" role="tablist" aria-label="Jugador que controlas">
        {d.players.map((p, i) => {
          const need = needsAction(p.token);
          return (
            <button key={p.token} role="tab" aria-selected={i === d.current} className={`demotab${i === d.current ? ' on' : ''}`} onClick={() => switchTo(i)} title={need ?? ''}>
              {p.name}{need && <i className="needdot" aria-label={`Tiene que: ${need}`} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DemoMenuExtra({ onClose }: { onClose: () => void }) {
  return <ConfirmButton className="btn ghost block" label="Nueva demo" ask="¿Terminar esta demo? Toca otra vez" onConfirm={() => { endDemo(); leaveRoom(); onClose(); }} />;
}
