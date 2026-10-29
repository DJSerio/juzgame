export type Comodin =
  | 'x2' | 'x3' | 'cambio' | 'nuevas' | 'escribe' | 'soborno' | 'abogado'
  | 'doble' | 'golpe' | 'espia' | 'apuesta' | 'escudo' | 'ladron' | 'carrete' | 'pareja';

export type RouletteItem =
  | { kind: 'comodin'; comodin: Comodin }
  | { kind: 'vacia' }
  | { kind: 'mano_ajena' }
  | { kind: 'todo_nada' }
  | { kind: 'robin_hood' };

export type Phase = 'lobby' | 'order' | 'roulette' | 'adjective' | 'play' | 'judging' | 'vote' | 'reveal' | 'end';

export interface Config {
  target: number;          // 8 | 10 | 12
  finalDouble: boolean;    // vuelta final vale doble
  handMode: 'refill' | 'deplete';
  handSize: number;        // 7
}

export interface Player {
  id: string;
  uid: string;
  name: string;
  avatar: string;
  hand: number[];
  comodines: Comodin[];
  points: number;
  removed: boolean;
  pending: { todo: boolean; manoAjena: boolean };
  notices: Notice[];
  joinedAt: number;
}

export interface Notice { id: string; text: string; at: number; kind?: string; data?: unknown }

export interface PlayWord { wordId?: number; custom?: string }

export interface Play {
  id: string;
  playerId: string;
  words: PlayWord[];
  photo?: string;
  comodin?: Comodin;
  forced?: boolean; // mano ajena
}

export interface Prompt {
  id: string;
  to: string;            // player id that may use escudo
  kind: 'ladron' | 'cambio' | 'mano_ajena';
  from?: string;         // attacker
  deadline: number;
  payload: Record<string, unknown>;
}

export interface ManoAjenaTask { target: string; chooser: string; deadline: number }

export interface Round {
  judgeDiscarded?: boolean;
  handStart?: Record<string, number>;
  no: number;
  type: 'normal' | 'carrete';
  judgeId: string;
  adjOptions: number[];
  adjective: number | null;
  phrase: string | null;
  adjDeadline: number;
  playDeadline: number;
  revealed: number;
  golpeBy: string | null;
  plays: Play[];
  order: string[];               // shuffled play ids for judging
  comodinUsed: Record<string, Comodin>;
  skipped: string[];
  discarded: string[];
  debate: { playIds: string[]; order: string[]; turn: number } | null;
  mordaza: string | null;        // play id con abogado
  pareja: { by: string; pairs: [string, string][] } | null;
  apuestas: Record<string, string>;
  votes: Record<string, string>;
  winner: string | null;
  publicWinners: string[];
  todoActive: string[];
  manoAjena: ManoAjenaTask[];
  events: string[];
  gains: Record<string, number>;
}

export interface HistoryEntry {
  no: number;
  type: 'normal' | 'carrete';
  judge: string;
  adjective: string | null;
  phrase: string | null;
  golpeBy: string | null;
  plays: { player: string; words: string[]; photo?: string; comodin?: Comodin; winner: boolean; votes?: number }[];
  gains: Record<string, number>;
  events: string[];
  final: boolean;
}

export interface Report { id: string; by: string; accused: string; votes: Record<string, boolean>; round: number }

export interface ReclaimRequest { id: string; uid: string; name: string; at: number }

export interface State {
  id: string;
  code: string;
  hostId: string;
  config: Config;
  phase: Phase;
  players: Player[];
  judgeOrder: string[];
  judgeIdx: number;
  roundNo: number;
  deck: number[];
  discard: number[];
  adjDeck: number[];
  round: Round | null;
  nextCarrete: string | null;     // player id que activó carrete
  roulette: {
    pending: string[];
    results: Record<string, { label: string; item: RouletteItem; slot: number; hint: string; needsChoice: boolean; offered?: Comodin }>;
  } | null;
  roundsSinceRoulette: number;
  countdown: { active: boolean; queue: string[]; finalLen: number; triggeredBy?: number } ;
  finalVuelta: boolean;
  prompts: Prompt[];
  report: Report | null;
  reclaims: ReclaimRequest[];
  history: HistoryEntry[];
  feed: string[];                 // eventos públicos recientes (anónimos)
  orderPick: { cards: number[]; picks: Record<string, number> } | null;
  reveal: { ranking: { id: string; name: string; points: number }[]; shown: number } | null;
  processed: string[];
  seq: number;
  createdAt: number;
}

export type Action =
  | { type: 'join'; name: string; avatar?: string }
  | { type: 'setAvatar'; avatar: string }
  | { type: 'judgeDiscard'; index: number }
  | { type: 'config'; config: Partial<Config> }
  | { type: 'start' }
  | { type: 'pickCard'; card: number }
  | { type: 'spin' }
  | { type: 'keepChoice'; discard: Comodin }
  | { type: 'skipRoulette'; playerId: string }
  | { type: 'chooseAdjective'; index: number }
  | { type: 'setPhrase'; phrase: string }
  | { type: 'golpe'; index: number }
  | { type: 'play'; hand?: number[]; custom?: string; photo?: string; comodin?: Comodin }
  | { type: 'tool'; comodin: 'cambio' | 'nuevas' | 'espia'; handIndex?: number; handIndices?: number[]; target?: string }
  | { type: 'manoAjenaPick'; slot: number }
  | { type: 'shield'; promptId: string; use: boolean }
  | { type: 'discard'; playId: string }
  | { type: 'flip' }
  | { type: 'debate'; playIds: string[] }
  | { type: 'debateNext' }
  | { type: 'endDebate' }
  | { type: 'apuesta'; playId: string }
  | { type: 'pickWinner'; playId: string }
  | { type: 'vote'; playId: string }
  | { type: 'closeVote' }
  | { type: 'next' }
  | { type: 'tick' }
  | { type: 'skipPlayer'; playerId: string }
  | { type: 'passJudge' }
  | { type: 'removePlayer'; playerId: string }
  | { type: 'transferHost'; playerId: string }
  | { type: 'claimHost' }
  | { type: 'undo' }
  | { type: 'report'; accused: string }
  | { type: 'reportVote'; yes: boolean }
  | { type: 'cancelReport' }
  | { type: 'reclaim'; name: string }
  | { type: 'approveReclaim'; requestId: string; playerId: string }
  | { type: 'rejectReclaim'; requestId: string }
  | { type: 'revealNext' }
  | { type: 'dismissNotice'; noticeId: string };
