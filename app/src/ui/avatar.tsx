import { useMemo } from 'react';
import { AVATARS, JUDGE, type AvatarDef } from '../avatars';

export const avatarById = (id?: string | null): AvatarDef | undefined => AVATARS.find(a => a.id === id);

function inner(a: AvatarDef, judge: boolean) {
  if (!judge) return a.back + a.body + a.prop + a.head + a.face + a.hair + a.hat;
  const sk = a.skin;
  return a.body + JUDGE.toga + a.head + a.face + JUDGE.wig + JUDGE.gavel.split('__SKIN__').join(sk);
}

/** Personaje. crop="head" para las caritas pequeñas; judge=true le pone toga, peluca y mazo. */
export function Avatar({ id, judge = false, crop = 'full', size = 48, className = '', title }: { id?: string | null; judge?: boolean; crop?: 'full' | 'head' | 'bust'; size?: number; className?: string; title?: string }) {
  const a = avatarById(id);
  const html = useMemo(() => (a ? inner(a, judge) : ''), [a, judge]);
  const vb = crop === 'head' ? (judge ? '28 14 144 144' : '34 20 132 132') : crop === 'bust' ? '10 0 180 200' : '0 0 200 250';
  const [, , w, h] = vb.split(' ').map(Number);
  if (!a) return <span className={`avatar-empty ${className}`} style={{ width: size, height: size * h / w }} aria-hidden />;
  return (
    <svg className={`avatar crop-${crop} ${className}`} viewBox={vb} width={size} height={size * h / w} style={a.style ? Object.fromEntries(a.style.split(';').filter(Boolean).map(kv => kv.split(':'))) as React.CSSProperties : undefined}
      role="img" aria-label={title ?? a.name} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

export function AvatarPicker({ value, taken = [], onPick }: { value?: string; taken?: string[]; onPick: (id: string) => void }) {
  return (
    <div className="avatar-grid" role="radiogroup" aria-label="Elige tu personaje">
      {AVATARS.map(a => {
        const busy = taken.includes(a.id) && a.id !== value;
        return (
          <button key={a.id} role="radio" aria-checked={value === a.id} disabled={busy} className={`avatar-opt${value === a.id ? ' on' : ''}`} onClick={() => onPick(a.id)} title={busy ? 'Ya lo ha cogido otro' : a.pers}>
            <Avatar id={a.id} crop="bust" size={76} />
            <b>{a.name.replace(/^(El|La) /, '')}</b>
            <small>{busy ? 'Cogido' : a.pers}</small>
          </button>
        );
      })}
    </div>
  );
}

export const randomAvatars = (n: number) => [...AVATARS].sort(() => Math.random() - 0.5).slice(0, n).map(a => a.id);
