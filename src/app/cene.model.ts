// Oblik public/data/cene.json. Pravi ga scripts/fetch-prices.mjs. Cene su u $ za 1 milion tokena.

export interface Promena {
  ulaz: number | null;
  izlaz: number | null;
}

export interface ModelCena {
  id: string;
  naziv: string;
  provajder: string;
  ulaz: number;
  izlaz: number;
  objavljen: string;
  kontekst: number | null;
}

export interface PraceniModel extends ModelCena {
  kesUlaz: number | null;
  promena7: Promena | null;
  promena30: Promena | null;
  prethodnik: { naziv: string; ulaz: number; izlaz: number; razlikaUlaz: number | null; razlikaIzlaz: number | null } | null;
}

export interface Cene {
  datum: string;
  azurirano: string;
  izvor: { naziv: string; url: string };
  pratimoOd: string;
  grupe: { id: string; naziv: string; opis: string; modeli: PraceniModel[] }[];
  promene: { id: string; naziv: string; provajder: string; datum: string; ulazPre: number; izlazPre: number; ulaz: number; izlaz: number }[];
  noviModeli: ModelCena[];
}

export const PROVAJDERI: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  deepseek: 'DeepSeek',
  'x-ai': 'xAI',
  'meta-llama': 'Meta',
  mistralai: 'Mistral',
  qwen: 'Alibaba Qwen',
  moonshotai: 'Moonshot',
  'z-ai': 'Z.ai',
  minimax: 'MiniMax',
  amazon: 'Amazon',
  microsoft: 'Microsoft',
  nvidia: 'NVIDIA',
  cohere: 'Cohere',
};

/** $12.5 → „$12,50“ (sr) ili „$12.50“ (en) */
export function formatCena(n: number, lokal: string): string {
  return `$${n.toLocaleString(lokal, { minimumFractionDigits: 2, maximumFractionDigits: n < 0.1 ? 3 : 2 })}`;
}
