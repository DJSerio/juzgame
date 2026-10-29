# Generador de personajes JUZ GAME — estilo A (contorno suave)
O='#3A2A20'; W='#FFFFFF'
SKINS={'claro':('#F6C7A1','#E9AE86'),'medio':('#E2A577','#CC8C5E'),'moreno':('#B87A4B','#9E6538'),'oscuro':('#7A4E2D','#633D22')}
def st(w=3): return f'stroke="{O}" stroke-width="{w}" stroke-linejoin="round" stroke-linecap="round"'

# ---------- partes de la cara ----------
def brows(k, c=O):
    d={'normal':('M72 90 q10 -6 20 -2','M108 88 q10 -6 20 2'),
       'picaro':('M72 92 q10 -3 20 0','M108 84 q11 -9 21 -1'),
       'decidido':('M72 86 q10 2 20 6','M108 92 q10 -4 20 -6'),
       'tierno':('M72 88 q10 -6 20 0','M108 88 q10 -6 20 0'),
       'cool':('M72 92 h20','M108 92 h20'),
       'sorpresa':('M72 84 q10 -8 20 -2','M108 82 q10 -6 20 2')}[k]
    return f'<path d="{d[0]}" fill="none" stroke="{c}" stroke-width="4.5" stroke-linecap="round"/><path d="{d[1]}" fill="none" stroke="{c}" stroke-width="4.5" stroke-linecap="round"/>'
def eyes(k, col=O):
    if k=='panda':
        return '<circle cx="84" cy="108" r="6" fill="#fff"/><circle cx="116" cy="108" r="6" fill="#fff"/><circle cx="85" cy="109" r="3" fill="#2B2B33"/><circle cx="117" cy="109" r="3" fill="#2B2B33"/>'
    if k=='feliz':  # ojos cerrados sonrientes
        return f'<path d="M75 109 q8 -9 16 0" fill="none" stroke="{O}" stroke-width="4.5" stroke-linecap="round"/><path d="M110 109 q8 -9 16 0" fill="none" stroke="{O}" stroke-width="4.5" stroke-linecap="round"/>'
    dx={'lado':3,'arriba':0,'normal':0,'cool':0}.get(k,0); dy=-3 if k=='arriba' else 0
    s=f'<ellipse cx="83" cy="108" rx="8.5" ry="10.5" fill="{col}"/><ellipse cx="118" cy="108" rx="8.5" ry="10.5" fill="{col}"/>'
    s+=f'<circle cx="{86+dx}" cy="{104+dy}" r="3.2" fill="#fff"/><circle cx="{121+dx}" cy="{104+dy}" r="3.2" fill="#fff"/><circle cx="{81+dx}" cy="{112+dy}" r="1.5" fill="#fff"/><circle cx="{116+dx}" cy="{112+dy}" r="1.5" fill="#fff"/>'
    if k=='cool':  # párpados a media altura
        s+=f'<path d="M73 104 q10 -4 20 0 v-8 h-20 Z M108 104 q10 -4 20 0 v-8 h-20 Z" fill="var(--sk)"/><path d="M73 104 q10 -4 20 0 M108 104 q10 -4 20 0" fill="none" stroke="{O}" stroke-width="3.5" stroke-linecap="round"/>'
    return s
def lashes(): return f'<path d="M74 101 l-5 -4 M76 98 l-3 -5 M127 101 l5 -4 M125 98 l3 -5" stroke="{O}" stroke-width="3" stroke-linecap="round"/>'
def cheeks(o=.55): return f'<ellipse cx="70" cy="126" rx="9" ry="5.5" fill="#F08C7A" opacity="{o}"/><ellipse cx="131" cy="126" rx="9" ry="5.5" fill="#F08C7A" opacity="{o}"/>'
def nose(): return f'<path d="M96 120 q4 5 8 0" fill="none" {st(2.5)}/>'
def mouth(k):
    return {'sonrisa':f'<path d="M88 136 C94 146 110 147 116 134" fill="#8C2E22" {st()}/><path d="M91 137 C98 140 108 140 114 136 L113 139 C106 142 98 142 92 140 Z" fill="#fff"/>',
     'picara':f'<path d="M90 140 C100 144 110 141 118 132" fill="none" {st(3.5)}/><path d="M118 132 q4 -1 5 -5" fill="none" {st(3)}/>',
     'grande':f'<path d="M84 132 C88 152 114 152 118 132 Z" fill="#8C2E22" {st()}/><path d="M87 134 h28 l-1 5 h-26 Z" fill="#fff"/><path d="M94 146 q7 -5 14 0 q-7 4 -14 0" fill="#F07A8A"/>',
     'suave':f'<path d="M92 137 q8 6 16 0" fill="none" {st(3.5)}/>',
     'o':f'<ellipse cx="101" cy="139" rx="6" ry="7" fill="#8C2E22" {st()}/>',
     'decidida':f'<path d="M88 136 C96 142 108 142 116 136 C110 146 94 146 88 136 Z" fill="#8C2E22" {st()}/><path d="M90 137 h24 l-2 3 h-20 Z" fill="#fff"/>'}[k]

# ---------- pelo ----------
def hair(k,c,hl):
    back=front=''
    if k=='corto': front=f'<path d="M54 92 C50 54 74 34 102 36 C130 34 152 54 146 92 C140 70 126 62 110 64 C98 56 82 58 72 66 C62 70 56 80 54 92 Z" fill="{c}" {st()}/>'
    if k=='tupe': front=f'<path d="M54 90 C48 56 70 30 100 30 C112 18 140 22 138 40 C152 52 152 70 146 90 C140 72 126 64 112 66 C100 58 82 60 72 66 C62 72 56 80 54 90 Z" fill="{c}" {st()}/>'
    if k=='rapado': front=f'<path d="M54 88 C54 58 74 42 100 42 C126 42 146 58 146 88 C138 70 122 62 100 62 C78 62 62 70 54 88 Z" fill="{c}" opacity=".9" {st(2.5)}/>'
    if k=='rizado':
        front=f'<g fill="{c}" {st()}>'+''.join(f'<circle cx="{x}" cy="{y}" r="13"/>' for x,y in [(60,82),(62,62),(76,48),(94,40),(112,40),(128,48),(140,62),(142,82)])+f'</g><path d="M60 84 C70 66 130 66 140 84 C136 60 64 60 60 84 Z" fill="{c}"/>'
    if k=='largo':
        back=f'<path d="M50 96 C44 50 72 32 100 32 C128 32 156 50 150 96 L156 186 C140 196 60 196 44 186 Z" fill="{c}" {st()}/>'
        front=f'<path d="M54 100 C50 56 74 36 102 36 C130 36 152 56 146 100 C140 74 128 60 114 58 C104 72 80 78 62 80 C58 86 56 92 54 100 Z" fill="{c}" {st()}/>'
    if k=='melena':
        back=f'<path d="M48 100 C42 50 72 32 100 32 C128 32 158 50 152 100 L154 150 C140 158 60 158 46 150 Z" fill="{c}" {st()}/>'
        front=f'<path d="M54 96 C50 54 74 36 100 36 C126 36 150 54 146 96 C144 78 140 70 132 66 C112 72 88 72 68 66 C60 72 56 82 54 96 Z" fill="{c}" {st()}/>'
    if k=='mono':
        front=f'<circle cx="100" cy="28" r="16" fill="{c}" {st()}/><path d="M54 92 C50 54 74 38 100 38 C126 38 150 54 146 92 C140 70 124 60 100 60 C76 60 60 70 54 92 Z" fill="{c}" {st()}/>'
    if k=='coletas':
        back=f'<path d="M50 96 C30 104 28 150 40 170 C52 150 54 120 56 104 Z M150 96 C170 104 172 150 160 170 C148 150 146 120 144 104 Z" fill="{c}" {st()}/>'
        front=f'<path d="M54 94 C50 54 74 36 100 36 C126 36 150 54 146 94 C140 72 126 62 112 62 L100 54 L88 62 C74 62 60 72 54 94 Z" fill="{c}" {st()}/>'
    if k=='coleta':
        back=f'<path d="M140 70 C176 70 178 130 160 156 C162 120 150 100 140 92 Z" fill="{c}" {st()}/>'
        front=f'<path d="M54 92 C50 54 74 36 100 36 C126 36 150 54 146 92 C138 70 124 62 100 62 C76 62 62 70 54 92 Z" fill="{c}" {st()}/>'
    if hl and front: front+=f'<path d="M80 46 C96 38 116 40 128 48" fill="none" stroke="{hl}" stroke-width="5" stroke-linecap="round" opacity=".7"/>'
    return back,front

# ---------- cuerpo ----------
def body(skin, shirt, kind='camiseta', extra=''):
    sk=skin[0]
    s=f'<path d="M50 240 C52 212 64 194 84 188 L116 188 C136 194 148 212 150 240 Z" fill="{sk}" {st()}/>'
    if kind=='tirantes': s+=f'<path d="M68 240 L70 204 C74 196 80 192 86 190 C92 200 108 200 114 190 C120 192 126 196 130 204 L132 240 Z" fill="{shirt}" {st()}/>'
    else: s+=f'<path d="M50 240 C52 214 62 196 82 190 C90 198 110 198 118 190 C138 196 148 214 150 240 Z" fill="{shirt}" {st()}/>'
    s+=f'<path d="M88 160 h24 v28 c-8 6 -16 6 -24 0 Z" fill="{skin[1]}" {st()}/>'
    return s+extra

def human(skin, hk, hc, hl, br, ey, mo, shirt, kind='camiseta', torso='', head_acc='', face_acc='', prop='', girl=False):
    sk=SKINS[skin]; back,front=hair(hk,hc,hl)
    head=f'<circle cx="52" cy="104" r="10" fill="{sk[0]}" {st()}/><circle cx="148" cy="104" r="10" fill="{sk[0]}" {st()}/>'
    head+=f'<path d="M100 40 C132 40 150 62 150 98 C150 138 128 166 100 166 C72 166 50 138 50 98 C50 62 68 40 100 40 Z" fill="{sk[0]}" {st()}/>'
    face=brows(br, hc if hc not in ('#F2E3B3','#E9E2D0','#C9C9D1') else O)+eyes(ey)+(lashes() if girl and ey!='feliz' else '')+cheeks()+nose()+mouth(mo)+face_acc
    return dict(style=f'--sk:{sk[0]}', back=back, body=body(sk,shirt,kind,torso), head=head, face=face, hair=front, hat=head_acc, prop=prop, skin=sk[0])

def animal(fur, belly, ears, snout, br, ey, mo, shirt, extra_head='', torso='', hat='', prop=''):
    head=ears+f'<path d="M100 40 C134 40 152 64 152 100 C152 140 128 166 100 166 C72 166 48 140 48 100 C48 64 66 40 100 40 Z" fill="{fur}" {st()}/>'+extra_head
    face=brows(br)+eyes(ey)+cheeks(.45)+snout+mouth(mo)
    return dict(style=f'--sk:{fur}', back='', body=body((fur,belly),shirt,'camiseta',torso), head=head, face=face, hair='', hat=hat, prop=prop, skin=fur)

# ---------- accesorios ----------
def hand(x,y,c): return f'<circle cx="{x}" cy="{y}" r="8.5" fill="{c}" {st()}/>'
SUN=f'<g transform="rotate(-3 100 66)"><rect x="70" y="58" width="26" height="14" rx="7" fill="#2B2B33"/><rect x="104" y="58" width="26" height="14" rx="7" fill="#2B2B33"/><path d="M96 64 h8" stroke="#2B2B33" stroke-width="4"/><path d="M75 62 l7 0 M109 62 l7 0" stroke="#9FE0F5" stroke-width="2.5" stroke-linecap="round"/></g>'
def buoy(c): return f'<g transform="translate(148 224) rotate(12)"><ellipse rx="22" ry="19" fill="#F28C28" {st()}/><ellipse rx="9" ry="7" fill="#1B4A39" {st()}/><path d="M-15 -13 l6 5 M15 -13 l-6 5 M-15 13 l6 -5 M15 13 l-6 -5" stroke="#fff" stroke-width="6"/></g>'+hand(131,228,c)
CROSS='<path d="M100 214 v16 M92 222 h16" stroke="#fff" stroke-width="5" stroke-linecap="round"/>'
WHISTLE=f'<path d="M92 184 Q100 200 108 184" fill="none" stroke="{O}" stroke-width="2"/><rect x="94" y="196" width="13" height="8" rx="4" fill="#F5C518" {st(2.5)}/>'
TOQUE=f'<path d="M66 70 C52 60 56 30 76 34 C80 14 120 14 124 34 C144 30 148 60 134 70 Z" fill="#fff" {st()}/><rect x="66" y="62" width="68" height="14" rx="4" fill="#fff" {st()}/>'
BANDANA=f'<path d="M52 82 C52 46 148 46 148 82 C130 70 70 70 52 82 Z" fill="#D7362B" {st()}/><g fill="#fff"><circle cx="80" cy="62" r="3"/><circle cx="100" cy="56" r="3"/><circle cx="120" cy="62" r="3"/></g><path d="M146 78 l16 -4 l-4 14 Z" fill="#D7362B" {st()}/>'
PATCH=f'<path d="M58 92 L140 80" stroke="{O}" stroke-width="3"/><ellipse cx="118" cy="107" rx="12" ry="11" fill="#2B2420" {st()}/>'
COWBOY=f'<path d="M30 76 C50 86 150 86 170 76 C160 92 40 92 30 76 Z" fill="#9C6B3C" {st()}/><path d="M64 78 C62 40 76 30 88 38 C94 30 106 30 112 38 C124 30 138 40 136 78 Z" fill="#B47E48" {st()}/><path d="M64 70 h72" stroke="#5B3A1C" stroke-width="7"/>'
CAP=f'<path d="M56 78 C54 44 146 44 144 78 Z" fill="#2C2C38" {st()}/><path d="M138 70 C156 64 170 70 172 80 C160 80 148 80 140 78 Z" fill="#2C2C38" {st()}/><circle cx="100" cy="48" r="4" fill="#2C2C38" {st(2)}/>'
CHAIN=f'<path d="M80 192 Q100 222 120 192" fill="none" stroke="#E7B825" stroke-width="5"/><circle cx="100" cy="214" r="7" fill="#E7B825" {st(2.5)}/>'
FIRE=f'<path d="M52 82 C50 34 150 34 148 82 Z" fill="#D7362B" {st()}/><path d="M40 82 h120 c0 8 -120 8 -120 0 Z" fill="#B8281F" {st()}/><path d="M86 46 h28 v20 h-28 Z" fill="#F5C518" {st()}/><path d="M100 36 v46" stroke="#B8281F" stroke-width="4"/>'
TOPHAT=f'<path d="M46 80 C70 88 130 88 154 80 C150 92 50 92 46 80 Z" fill="#2B2B33" {st()}/><path d="M68 82 L72 22 H128 L132 82 Z" fill="#2B2B33" {st()}/><path d="M70 66 H130" stroke="#7B2FBE" stroke-width="8"/>'
WAND=f'<path d="M150 236 L174 186" stroke="#2B2B33" stroke-width="7" stroke-linecap="round"/><path d="M172 190 l4 -8" stroke="#fff" stroke-width="7" stroke-linecap="round"/>'+hand(156,224,'var(--sk)')
SALACOT=f'<path d="M36 80 C60 90 140 90 164 80 C158 94 42 94 36 80 Z" fill="#CDB078" {st()}/><path d="M58 80 C58 40 142 40 142 80 Z" fill="#DCC38E" {st()}/><path d="M60 72 H140" stroke="#8C6B3A" stroke-width="5"/>'
MASK=f'<path d="M64 98 C70 88 96 92 100 100 C104 92 130 88 136 98 C138 112 128 120 118 118 C110 116 104 110 100 110 C96 110 90 116 82 118 C72 120 62 112 64 98 Z" fill="#7B2FBE" {st()}/>'
CAPE='<path d="M54 196 C30 214 26 236 26 240 H174 C174 236 170 214 146 196 Z" fill="#7B2FBE" stroke="#3A2A20" stroke-width="3" stroke-linejoin="round"/>'
FLOWER=f'<g transform="translate(138 58)"><g fill="#E8503A" {st(2.5)}><circle cx="0" cy="-9" r="7"/><circle cx="9" cy="0" r="7"/><circle cx="0" cy="9" r="7"/><circle cx="-9" cy="0" r="7"/></g><circle r="5" fill="#F5C518" {st(2.5)}/></g>'
DOTS='<g fill="#fff"><circle cx="72" cy="214" r="4"/><circle cx="94" cy="228" r="4"/><circle cx="118" cy="212" r="4"/><circle cx="132" cy="232" r="4"/><circle cx="84" cy="236" r="3"/></g>'
GOGGLES=f'<g><path d="M52 82 H148" stroke="#3D6E8C" stroke-width="6"/><circle cx="80" cy="80" r="11" fill="#BFE6F2" {st()}/><circle cx="120" cy="80" r="11" fill="#BFE6F2" {st()}/></g>'
COAT=f'<path d="M50 240 C52 214 62 196 82 190 L96 240 Z M150 240 C148 214 138 196 118 190 L104 240 Z" fill="#fff" {st()}/>'
FLASK=f'<path d="M150 236 l6 -22 v-10 h10 v10 l10 22 Z" fill="#7EE2A8" {st()}/>'+hand(150,226,'var(--sk)')
JACKET=f'<path d="M50 240 C52 214 62 196 82 190 L94 240 Z M150 240 C148 214 138 196 118 190 L106 240 Z" fill="#2B2B33" {st()}/><circle cx="76" cy="220" r="3" fill="#C9C9D1"/>'
COOKIE=f'<circle cx="156" cy="218" r="16" fill="#D9A15B" {st()}/><g fill="#5B3A1C"><circle cx="150" cy="212" r="2.5"/><circle cx="160" cy="222" r="2.5"/><circle cx="162" cy="210" r="2"/></g>'+hand(140,226,'var(--sk)')
BAKER=f'<path d="M58 78 C52 52 70 40 84 46 C90 34 110 34 116 46 C130 40 148 52 142 78 Z" fill="#fff" {st()}/>'
DEER=f'<path d="M54 82 C52 40 148 40 146 82 Z" fill="#9C7A4E" {st()}/><path d="M56 82 C70 74 130 74 144 82" fill="none" stroke="#7A5C36" stroke-width="3"/><path d="M60 66 L44 82 L58 86 Z M140 66 L156 82 L142 86 Z" fill="#9C7A4E" {st()}/><path d="M60 60 L140 60 M58 70 L142 70" stroke="#7A5C36" stroke-width="2" opacity=".6"/>'
LUPA=f'<circle cx="164" cy="200" r="13" fill="#CFEAF5" {st()}/><path d="M156 210 l-12 16" stroke="#7A5C36" stroke-width="6" stroke-linecap="round"/>'+hand(146,226,'var(--sk)')
AVIATOR=f'<path d="M52 92 C48 46 152 46 148 92 L150 112 C140 114 140 96 136 86 C120 70 80 70 64 86 C60 96 60 114 50 112 Z" fill="#7A4B2A" {st()}/><circle cx="82" cy="68" r="11" fill="#9FD3E8" {st()}/><circle cx="118" cy="68" r="11" fill="#9FD3E8" {st()}/><path d="M93 68 h14" stroke="{O}" stroke-width="3"/>'
SCARF=f'<path d="M80 186 C90 196 110 196 120 186 L124 196 C112 206 88 206 76 196 Z" fill="#fff" {st()}/><path d="M118 196 l14 24 l-12 2 Z" fill="#fff" {st()}/>'
CROWN=f'<path d="M66 64 L70 36 L84 52 L100 30 L116 52 L130 36 L134 64 Z" fill="#F5C518" {st()}/><circle cx="100" cy="46" r="4" fill="#E8503A"/><circle cx="78" cy="56" r="3" fill="#3D9BE9"/><circle cx="122" cy="56" r="3" fill="#3D9BE9"/>'
WITCH=f'<path d="M34 82 C60 92 140 92 166 82 C160 96 40 96 34 82 Z" fill="#3B2A55" {st()}/><path d="M62 84 C70 60 90 40 96 12 C112 30 126 56 138 84 Z" fill="#3B2A55" {st()}/><path d="M64 76 C90 82 112 82 136 76" stroke="#F28C28" stroke-width="7" fill="none"/>'
FANGS=f'<path d="M93 138 l3 7 l3 -7 M103 138 l3 7 l3 -7" fill="#fff" {st(2)}/>'
VCOLLAR=f'<path d="M66 192 L48 160 L86 186 Z M134 192 L152 160 L114 186 Z" fill="#9E1C2A" {st()}/>'
MUMMY=f'<g stroke="#C9BFA6" stroke-width="3" fill="none"><path d="M52 64 C80 56 120 54 148 62"/><path d="M50 128 C80 136 120 132 150 122"/><path d="M54 150 C80 156 120 154 146 146"/></g>'
CYCLE=f'<path d="M54 80 C52 42 148 42 146 80 Z" fill="#3D9BE9" {st()}/><path d="M66 50 l10 26 M100 42 v34 M134 50 l-10 26" stroke="#fff" stroke-width="5"/>'
BALL=f'<circle cx="158" cy="220" r="17" fill="#fff" {st()}/><path d="M158 211 l7 5 l-3 8 h-8 l-3 -8 Z" fill="#2B2B33"/>'+hand(140,228,'var(--sk)')
HELMET_SPACE=f'<g transform="translate(152 214)"><circle r="20" fill="#E9EEF2" {st()}/><path d="M-12 -4 a12 9 0 0 1 24 0 v4 h-24 Z" fill="#7FC4E8" {st(2.5)}/></g>'+hand(134,226,'var(--sk)')
ANTENNA=f'<path d="M100 40 V22" {st()}/><circle cx="100" cy="18" r="6" fill="#E8503A" {st()}/>'
MIC=f'<path d="M156 228 l12 -24" stroke="#2B2B33" stroke-width="7" stroke-linecap="round"/><circle cx="170" cy="200" r="8" fill="#9AA0A8" {st()}/>'+hand(152,226,'var(--sk)')

H=lambda **k: human(**k)
C=[]
def add(id,name,cat,pers,d): d.update(id=id,name=name,cat=cat,pers=pers); C.append(d)
# ---- chicos ----
add('socorrista','El Socorrista','chico','Chulito playero',H(skin='claro',hk='corto',hc='#4A2E1C',hl='#6B4429',br='picaro',ey='normal',mo='sonrisa',shirt='#E8503A',kind='tirantes',torso=CROSS+WHISTLE,head_acc=SUN,prop=buoy('#F6C7A1')))
add('chef','El Chef','chico','Perfeccionista',H(skin='medio',hk='corto',hc='#2B1A10',hl='',br='decidido',ey='normal',mo='picara',shirt='#FFFFFF',torso=f'<path d="M92 196 l16 0 l-4 8 h-8 Z" fill="#E8503A" {st(2)}/><g fill="{O}"><circle cx="92" cy="216" r="2.5"/><circle cx="92" cy="230" r="2.5"/><circle cx="108" cy="216" r="2.5"/><circle cx="108" cy="230" r="2.5"/></g>',head_acc=TOQUE,face_acc=f'<path d="M86 128 C92 124 98 126 100 129 C102 126 108 124 114 128 C108 132 92 132 86 128 Z" fill="#2B1A10"/>'))
add('pirata','El Pirata','chico','Pillo',H(skin='moreno',hk='corto',hc='#1E1410',hl='',br='picaro',ey='lado',mo='picara',shirt='#F2E3B3',torso=f'<path d="M50 240 C52 214 62 196 82 190 L100 214 L118 190 C138 196 148 214 150 240 Z" fill="#F2E3B3" {st()}/><path d="M60 226 H140" stroke="#D7362B" stroke-width="9"/>',head_acc=BANDANA,face_acc=PATCH+f'<path d="M74 140 C80 168 120 168 126 140 C116 152 84 152 74 140 Z" fill="#1E1410" opacity=".85"/>'))
add('vaquero','El Vaquero','chico','Tranquilo',H(skin='claro',hk='corto',hc='#B5652B',hl='#D08546',br='cool',ey='cool',mo='suave',shirt='#3D7DB8',torso=f'<path d="M82 190 L100 212 L118 190" fill="#E8503A" {st()}/><circle cx="84" cy="224" r="6" fill="#F5C518" {st(2)}/>',head_acc=COWBOY))
add('rapero','El Rapero','chico','Flow',H(skin='oscuro',hk='rapado',hc='#1E1410',hl='',br='cool',ey='cool',mo='picara',shirt='#2C2C38',torso=CHAIN,head_acc=CAP,prop=MIC))
add('bombero','El Bombero','chico','Valiente',H(skin='medio',hk='corto',hc='#3B2A1C',hl='',br='decidido',ey='normal',mo='decidida',shirt='#2B2B33',torso='<path d="M58 214 H142 M58 230 H142" stroke="#F5C518" stroke-width="6"/>',head_acc=FIRE))
add('mago','El Mago','chico','Misterioso',H(skin='claro',hk='corto',hc='#2B1A10',hl='',br='picaro',ey='lado',mo='picara',shirt='#2B2B33',torso=f'<path d="M86 190 L100 204 L114 190 Z" fill="#fff" {st(2)}/><path d="M92 196 l8 4 l8 -4 v8 l-8 -4 l-8 4 Z" fill="#7B2FBE" {st(2)}/>',head_acc=TOPHAT,prop=WAND))
add('futbolista','El Futbolista','chico','Competitivo',H(skin='claro',hk='tupe',hc='#2B1A10',hl='#5A3A22',br='decidido',ey='normal',mo='grande',shirt='#FFFFFF',torso='<path d="M50 240 C52 214 62 196 82 190 L86 240 Z M150 240 C148 214 138 196 118 190 L114 240 Z" fill="#2B2B33" opacity=".85"/><text x="100" y="232" text-anchor="middle" font-family="system-ui" font-weight="900" font-size="22" fill="#2B2B33">10</text>',prop=BALL))
add('astronauta','El Astronauta','chico','Soñador',H(skin='moreno',hk='rizado',hc='#1E1410',hl='',br='tierno',ey='arriba',mo='sonrisa',shirt='#E9EEF2',torso=f'<rect x="84" y="206" width="32" height="20" rx="4" fill="#3D9BE9" {st(2.5)}/><circle cx="92" cy="216" r="3" fill="#E8503A"/><circle cx="104" cy="216" r="3" fill="#F5C518"/>',prop=HELMET_SPACE))
add('ciclista','El Ciclista','chico','Energético',H(skin='claro',hk='corto',hc='#C99A4A',hl='#E2B866',br='normal',ey='normal',mo='grande',shirt='#F5C518',torso='<path d="M50 222 C80 214 120 214 150 222" stroke="#3D9BE9" stroke-width="8" fill="none"/>',head_acc=CYCLE,face_acc='<rect x="68" y="98" width="64" height="18" rx="9" fill="#2B2B33" opacity=".0"/>'))
# ---- chicas ----
add('heroina','La Superheroína','chica','Justiciera',H(skin='medio',hk='coleta',hc='#2B1A10',hl='#5A3A22',br='decidido',ey='normal',mo='decidida',shirt='#3D9BE9',girl=True,torso=CAPE+f'<path d="M50 240 C52 214 62 196 82 190 C90 198 110 198 118 190 C138 196 148 214 150 240 Z" fill="#3D9BE9" {st()}/><path d="M88 214 L100 204 L112 214 L100 232 Z" fill="#F5C518" {st(2.5)}/>',face_acc=MASK))
add('flamenca','La Flamenca','chica','Con arte',H(skin='moreno',hk='mono',hc='#1E1410',hl='',br='picaro',ey='normal',mo='sonrisa',shirt='#E8503A',girl=True,torso=DOTS,head_acc=FLOWER))
add('cientifica','La Científica','chica','Curiosa',H(skin='claro',hk='melena',hc='#B5652B',hl='#D08546',br='sorpresa',ey='normal',mo='o',shirt='#7EBFA0',girl=True,torso=COAT,head_acc=GOGGLES,prop=FLASK))
add('rockera','La Rockera','chica','Rebelde',H(skin='claro',hk='largo',hc='#7B3FBF',hl='#9C67D6',br='cool',ey='cool',mo='picara',shirt='#2C2C38',girl=True,torso=JACKET+'<path d="M92 214 l8 -8 l8 8 l-8 14 Z" fill="#E8503A"/>'))
add('pastelera','La Pastelera','chica','Dulce',H(skin='medio',hk='melena',hc='#4A2E1C',hl='#6B4429',br='tierno',ey='feliz',mo='sonrisa',shirt='#F4A6C0',girl=True,torso=f'<path d="M70 240 L72 206 H128 L130 240 Z" fill="#fff" {st()}/>',head_acc=BAKER,prop=COOKIE))
add('detective','La Detective','chica','Lista',H(skin='oscuro',hk='rizado',hc='#1E1410',hl='',br='picaro',ey='lado',mo='picara',shirt='#9C7A4E',girl=True,torso=f'<path d="M50 240 C52 214 62 196 82 190 L100 220 L118 190 C138 196 148 214 150 240 Z" fill="#B8955F" {st()}/>',head_acc=DEER,prop=LUPA))
add('aviadora','La Aviadora','chica','Aventurera',H(skin='claro',hk='melena',hc='#E3B04B',hl='#F2CC77',br='normal',ey='normal',mo='grande',shirt='#6B4429',girl=True,torso=SCARF,head_acc=AVIATOR))
add('reina','La Reina','chica','Mandona',H(skin='medio',hk='largo',hc='#2B1A10',hl='#5A3A22',br='cool',ey='cool',mo='suave',shirt='#7B2FBE',girl=True,torso=f'<path d="M56 200 C80 210 120 210 144 200" stroke="#fff" stroke-width="9" fill="none" stroke-dasharray="2 8" stroke-linecap="round"/><circle cx="100" cy="214" r="6" fill="#F5C518" {st(2)}/>',head_acc=CROWN))
add('bruja','La Bruja','chica','Traviesa',H(skin='claro',hk='largo',hc='#E25A2A',hl='#F07A44',br='picaro',ey='lado',mo='picara',shirt='#3B2A55',girl=True,torso='<path d="M60 220 H140" stroke="#F28C28" stroke-width="6"/>',head_acc=WITCH))
add('vampira','La Vampira','chica','Elegante',H(skin='claro',hk='melena',hc='#1E1410',hl='#3A2A20',br='cool',ey='cool',mo='suave',shirt='#2B2B33',girl=True,torso=VCOLLAR+'<circle cx="100" cy="206" r="5" fill="#9E1C2A"/>',face_acc=FANGS))
# ---- indefinidos ----
add('gato','El Gato','otro','Indiferente',animal('#F2A65A','#F8D1A3',f'<path d="M56 74 L54 30 L88 52 Z M144 74 L146 30 L112 52 Z" fill="#F2A65A" {st()}/><path d="M60 62 L60 42 L76 54 Z M140 62 L140 42 L124 54 Z" fill="#F7C2C8"/>',f'<path d="M95 120 h10 l-5 6 Z" fill="#E87A8A" {st(2)}/><path d="M60 122 h-16 M60 130 h-16 M140 122 h16 M140 130 h16" stroke="{O}" stroke-width="2" stroke-linecap="round"/>','cool','cool','picara','#3D9BE9',extra_head=f'<path d="M80 46 l6 12 M100 42 v14 M120 46 l-6 12" stroke="#D9853A" stroke-width="5" stroke-linecap="round"/>'))
add('perro','El Perro','otro','Leal',animal('#C9965E','#EBD2B0',f'<path d="M56 64 C30 60 28 120 48 128 C56 110 58 86 62 74 Z M144 64 C170 60 172 120 152 128 C144 110 142 86 138 74 Z" fill="#7A5232" {st()}/>',f'<ellipse cx="100" cy="126" rx="18" ry="12" fill="#EBD2B0" {st(2.5)}/><ellipse cx="100" cy="119" rx="7" ry="5" fill="#2B2420"/>','tierno','normal','grande','#E8503A',extra_head=f'<ellipse cx="124" cy="96" rx="14" ry="16" fill="#7A5232" opacity=".6"/>',torso=f'<path d="M82 192 C90 200 110 200 118 192" stroke="#3D9BE9" stroke-width="7" fill="none"/><circle cx="100" cy="206" r="6" fill="#F5C518" {st(2)}/>'))
add('rana','La Rana','otro','Zen',animal('#7CC46A','#C8E8A0',f'<circle cx="74" cy="56" r="18" fill="#7CC46A" {st()}/><circle cx="126" cy="56" r="18" fill="#7CC46A" {st()}/>','','tierno','feliz','sonrisa','#F5C518'))
add('panda','El Panda','otro','Dormilón',animal('#F4F2EE','#FFFFFF',f'<circle cx="62" cy="52" r="15" fill="#2B2B33" {st()}/><circle cx="138" cy="52" r="15" fill="#2B2B33" {st()}/>',f'<ellipse cx="100" cy="122" rx="7" ry="5" fill="#2B2B33"/>','tierno','panda','suave','#7EBFA0',extra_head=f'<ellipse cx="82" cy="108" rx="15" ry="17" fill="#2B2B33" transform="rotate(-20 82 108)"/><ellipse cx="118" cy="108" rx="15" ry="17" fill="#2B2B33" transform="rotate(20 118 108)"/>'))
add('zorro','El Zorro','otro','Astuto',animal('#E9773A','#FBE6D2',f'<path d="M58 76 L50 26 L92 54 Z M142 76 L150 26 L108 54 Z" fill="#E9773A" {st()}/><path d="M62 62 L58 38 L80 54 Z M138 62 L142 38 L120 54 Z" fill="#2B2B33"/>',f'<path d="M64 112 C80 150 120 150 136 112 C126 128 74 128 64 112 Z" fill="#FBE6D2"/><ellipse cx="100" cy="122" rx="6" ry="4.5" fill="#2B2420"/>','picaro','lado','picara','#2E6E4E'))
add('robot','El Robot','otro','Calculador',dict(style='--sk:#B8C4CE',back='',body=body(('#9AA6B0','#7E8A94'),'#5C6B78','camiseta',f'<rect x="80" y="204" width="40" height="24" rx="4" fill="#2B2B33" {st(2.5)}/><circle cx="90" cy="216" r="4" fill="#7EE2A8"/><circle cx="102" cy="216" r="4" fill="#F5C518"/><circle cx="112" cy="216" r="4" fill="#E8503A"/>'),head=ANTENNA+f'<rect x="46" y="40" width="108" height="124" rx="26" fill="#B8C4CE" {st()}/><rect x="40" y="92" width="10" height="26" rx="4" fill="#9AA6B0" {st()}/><rect x="150" y="92" width="10" height="26" rx="4" fill="#9AA6B0" {st()}/>',face=f'<rect x="62" y="88" width="76" height="40" rx="14" fill="#2B2B33" {st()}/><rect x="74" y="100" width="16" height="14" rx="4" fill="#7FE7F2"/><rect x="110" y="100" width="16" height="14" rx="4" fill="#7FE7F2"/><path d="M84 144 h32" stroke="{O}" stroke-width="4" stroke-dasharray="5 4"/>',hair='',hat='',prop='',skin='#B8C4CE'))
add('alien','El Alien','otro','Curioso',animal('#9BE07A','#C9F0B0',f'<path d="M70 50 L58 18" {st()}/><circle cx="56" cy="14" r="6" fill="#F5C518" {st()}/><path d="M130 50 L142 18" {st()}/><circle cx="144" cy="14" r="6" fill="#F5C518" {st()}/>','','sorpresa','normal','o','#7B2FBE',extra_head=f'<ellipse cx="100" cy="74" rx="10" ry="6" fill="#7CC46A" opacity=".7"/>'))
add('fantasma','El Fantasma','otro','Tímido',dict(style='--sk:#F4F6FA',back='',body=f'<path d="M48 160 C48 120 152 120 152 160 V236 l-13 -10 l-13 10 l-13 -10 l-13 10 l-13 -10 l-13 10 l-13 -10 l-13 10 Z" fill="#F4F6FA" {st()}/>',head=f'<path d="M100 40 C134 40 152 66 152 104 V170 H48 V104 C48 66 66 40 100 40 Z" fill="#F4F6FA"/><path d="M48 170 V104 C48 66 66 40 100 40 C134 40 152 66 152 104 V170" fill="none" {st()}/>',face=brows('tierno')+eyes('normal')+cheeks(.7)+mouth('o'),hair='',hat='',prop='',skin='#F4F6FA'))
add('calabaza','La Calabaza','otro','Bromista',dict(style='--sk:#F28C28',back='',body=body(('#2E6E4E','#245A3F'),'#2E6E4E','camiseta','<path d="M100 196 C80 214 120 214 100 232" stroke="#7CC46A" stroke-width="5" fill="none"/>'),head=f'<path d="M100 44 C96 30 104 22 112 24" fill="none" stroke="#4E7A2E" stroke-width="7" stroke-linecap="round"/><ellipse cx="100" cy="106" rx="58" ry="58" fill="#F28C28" {st()}/><path d="M80 52 C66 80 66 132 80 160 M120 52 C134 80 134 132 120 160 M100 48 V164" fill="none" stroke="#D96F1A" stroke-width="3"/>',face=f'<path d="M72 96 L90 96 L81 82 Z M110 96 L128 96 L119 82 Z" fill="#3A1A08" {st(2.5)}/><path d="M74 126 C86 148 114 148 126 126 L118 132 L110 126 L100 134 L90 126 L82 132 Z" fill="#3A1A08" {st(2.5)}/>',hair='',hat='',prop='',skin='#F28C28'))
add('monstruo','El Monstruo','otro','Bonachón',animal('#4FB3C9','#A7E0EA',f'<path d="M62 60 L70 28 L84 52 Z M138 60 L130 28 L116 52 Z" fill="#F2EDE3" {st()}/>','','tierno','normal','grande','#F5C518',extra_head=f'<g fill="#3E97AB"><circle cx="70" cy="140" r="5"/><circle cx="134" cy="72" r="6"/><circle cx="62" cy="80" r="4"/></g>'))

# ---------- capa de juez ----------
def judge_parts(skin):
    toga=f'<path d="M44 240 C46 212 58 194 80 188 L94 190 L88 240 Z" fill="#1C1C24" {st()}/><path d="M156 240 C154 212 142 194 120 188 L106 190 L112 240 Z" fill="#1C1C24" {st()}/><path d="M90 182 L100 192 L110 182 L109 200 L100 194 L91 200 Z" fill="#FFFDF6" {st(2.5)}/>'
    wig=f'<path d="M50 102 C40 44 70 24 100 26 C130 24 160 44 150 102 C146 78 136 64 124 60 C108 52 92 52 76 60 C64 64 54 78 50 102 Z" fill="#F2EDE3" {st()}/><g fill="#F2EDE3" {st()}>'+''.join(f'<circle cx="{x}" cy="{y}" r="10.5"/>' for x,y in [(70,38),(90,30),(110,30),(130,38),(46,98),(44,120),(46,142),(52,162),(154,98),(156,120),(154,142),(148,162)])+'</g>'
    gavel=f'<g transform="rotate(-28 40 200)"><rect x="34" y="166" width="9" height="50" rx="3" fill="#8A5A32" {st()}/><rect x="17" y="148" width="43" height="23" rx="6" fill="#A86E3E" {st()}/><path d="M26 148 v23 M51 148 v23" stroke="{O}" stroke-width="2.5"/></g>'+hand(54,218,skin)
    return toga,wig,gavel

def svg(c, judge=False, vb='0 0 200 250', size=None, cls=''):
    style=c['style']
    if judge:
        toga,wig,gavel=judge_parts(c['skin'])
        inner=c['body']+toga+c['head']+c['face']+wig+gavel
    else:
        inner=c['back']+c['body']+c['prop']+c['head']+c['face']+c['hair']+c['hat']
    sz=f' width="{size}" height="{size*int(vb.split()[3])/int(vb.split()[2]):.0f}"' if size else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}"{sz} style="{style}" class="{cls}">{inner}</svg>'
