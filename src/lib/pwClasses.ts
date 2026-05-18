// Mapeamentos de race/cls para o painel Lovable.
// Esta base acompanha o catalogo atual do api_cls.php, incluindo
// as classes extras da variante PWServer 1.7.8 local.

export interface RaceInfo {
  name: string;
  classes: Record<number, ClassInfo>;
}

export interface ClassInfo {
  name: string;
  color: string;
  short: string;
}

const C = {
  guerreiro: { color: "0 72% 55%", short: "GUE" },
  mago: { color: "260 78% 65%", short: "MAG" },
  espiritualista: { color: "200 70% 55%", short: "ESP" },
  feiticeira: { color: "320 65% 60%", short: "FEI" },
  barbaro: { color: "20 75% 55%", short: "BAR" },
  mercenario: { color: "280 50% 45%", short: "MER" },
  arqueiro: { color: "140 60% 50%", short: "ARQ" },
  sacerdote: { color: "45 95% 60%", short: "SAC" },
  arcano: { color: "30 80% 55%", short: "ARC" },
  mistico: { color: "150 55% 50%", short: "MIS" },
  retalhador: { color: "350 60% 45%", short: "RET" },
  tormentador: { color: "210 65% 55%", short: "TOR" },
  atirador: { color: "190 70% 52%", short: "ATI" },
  paladino: { color: "42 88% 58%", short: "PAL" },
  andarilho: { color: "95 58% 45%", short: "AND" },
} as const;

const RACES: Record<number, RaceInfo> = {
  0: {
    name: "Humano",
    classes: {
      0: { name: "Guerreiro", ...C.guerreiro },
      1: { name: "Mago", ...C.mago },
    },
  },
  1: {
    name: "Alada",
    classes: {
      6: { name: "Arqueiro", ...C.arqueiro },
      7: { name: "Sacerdote", ...C.sacerdote },
    },
  },
  2: {
    name: "Selvagem",
    classes: {
      3: { name: "Feiticeira", ...C.feiticeira },
      4: { name: "Barbaro", ...C.barbaro },
    },
  },
  3: {
    name: "Abissal",
    classes: {
      2: { name: "Espiritualista", ...C.espiritualista },
      5: { name: "Mercenario", ...C.mercenario },
    },
  },
  4: {
    name: "Guardiao",
    classes: {
      8: { name: "Arcano", ...C.arcano },
      9: { name: "Mistico", ...C.mistico },
    },
  },
  5: {
    name: "Sombria",
    classes: {
      10: { name: "Retalhador", ...C.retalhador },
      11: { name: "Tormentador", ...C.tormentador },
    },
  },
  6: {
    name: "Serafins",
    classes: {
      12: { name: "Atirador", ...C.atirador },
      13: { name: "Paladino", ...C.paladino },
    },
  },
  7: {
    name: "Andarilio",
    classes: {
      14: { name: "Andarilho", ...C.andarilho },
    },
  },
};

const FALLBACK_CLASS: ClassInfo = {
  name: "Desconhecida",
  color: "0 0% 50%",
  short: "???",
};

const FALLBACK_RACE = "Desconhecida";

export function getKnownRaceIds(): number[] {
  return Object.keys(RACES)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
}

export function getRaceName(race: number): string {
  return RACES[race]?.name ?? FALLBACK_RACE;
}

export function getClassInfo(race: number, cls: number): ClassInfo {
  return RACES[race]?.classes[cls] ?? FALLBACK_CLASS;
}

export function getGenderInfo(gender: number): { label: string; symbol: string } {
  if (gender === 0) return { label: "Masculino", symbol: "\u2642" };
  if (gender === 1) return { label: "Feminino", symbol: "\u2640" };
  return { label: "-", symbol: "\u2022" };
}

export function getInitials(name: string): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
