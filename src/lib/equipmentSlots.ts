// Mapeamento real dos slots de equipamento do Perfect World (referência: roleid
// 1024 full equipado). Inclui slots clássicos 0..15 + slots especiais altos
// (26, 29, 32, 33) que aparecem no payload.
//
// Regras de uso:
//  - Lookup é SEMPRE por item.pos (nunca pelo índice do array equipment.items).
//  - Itens com pos não mapeada NUNCA são removidos. A UI mostra
//    "Slot desconhecido (pos X)" / seção "Slots especiais detectados".
//  - O payload salvo continua usando apenas pos numérico — esta tabela é só
//    UX/validação. Servidores customizados podem editar este arquivo (fonte
//    única de verdade) sem mexer em mais nada.

export type EquipmentSlotCategory =
  | "weapon"
  | "armor"
  | "accessory"
  | "consumable"
  | "special"
  | "avatar";

export type EquipmentSlotDef = {
  pos: number;
  key: string;
  label: string;
  shortLabel: string;
  category: EquipmentSlotCategory;
  /** Ordem visual no paper-doll/listagens. Não é o pos. */
  visualOrder: number;
  /** Observação opcional pra UI/tooltip. */
  note?: string;
};

export const PW_EQUIPMENT_SLOTS: EquipmentSlotDef[] = [
  { pos: 0,  key: "weapon",     label: "Arma",            shortLabel: "Arma",     category: "weapon",     visualOrder: 10 },
  { pos: 1,  key: "helmet",     label: "Elmo",            shortLabel: "Elmo",     category: "armor",      visualOrder: 1 },
  { pos: 2,  key: "necklace",   label: "Colar",           shortLabel: "Colar",    category: "accessory",  visualOrder: 4 },
  { pos: 3,  key: "cape",       label: "Manto",           shortLabel: "Manto",    category: "armor",      visualOrder: 2 },
  { pos: 4,  key: "armor",      label: "Armadura",        shortLabel: "Armad.",   category: "armor",      visualOrder: 3 },
  { pos: 5,  key: "belt",       label: "Cinto",           shortLabel: "Cinto",    category: "accessory",  visualOrder: 11 },
  { pos: 6,  key: "pants",      label: "Calças",          shortLabel: "Calças",   category: "armor",      visualOrder: 12 },
  { pos: 7,  key: "boots",      label: "Botas",           shortLabel: "Botas",    category: "armor",      visualOrder: 13 },
  { pos: 8,  key: "bracers",    label: "Braçadeiras",     shortLabel: "Braç.",    category: "armor",      visualOrder: 8 },
  { pos: 9,  key: "ring_left",  label: "Anel Esq.",       shortLabel: "Anel E.",  category: "accessory",  visualOrder: 7 },
  { pos: 10, key: "ring_right", label: "Anel Dir.",       shortLabel: "Anel D.",  category: "accessory",  visualOrder: 14 },
  { pos: 11, key: "ammo",       label: "Munição",         shortLabel: "Munição",  category: "consumable", visualOrder: 18 },
  { pos: 12, key: "flyer",      label: "Voo / Montaria",  shortLabel: "Voo",      category: "special",    visualOrder: 19 },
  { pos: 13, key: "hp_charm",   label: "Hierograma HP",   shortLabel: "Hiero HP", category: "consumable", visualOrder: 20 },
  { pos: 14, key: "mp_charm",   label: "Hierograma MP",   shortLabel: "Hiero MP", category: "consumable", visualOrder: 21 },
  { pos: 15, key: "tome",       label: "Tomo",            shortLabel: "Tomo",     category: "special",    visualOrder: 17 },
  { pos: 26, key: "special_26", label: "Especial 26",     shortLabel: "Esp. 26",  category: "special",    visualOrder: 26 },
  { pos: 29, key: "special_29", label: "Especial 29",     shortLabel: "Esp. 29",  category: "special",    visualOrder: 29 },
  { pos: 32, key: "avatar_1",   label: "Carta/Avatar 1",  shortLabel: "Avatar 1", category: "avatar",     visualOrder: 32 },
  { pos: 33, key: "avatar_2",   label: "Carta/Avatar 2",  shortLabel: "Avatar 2", category: "avatar",     visualOrder: 33 },
];

const BY_POS = new Map<number, EquipmentSlotDef>(
  PW_EQUIPMENT_SLOTS.map((s) => [s.pos, s]),
);
const BY_KEY = new Map<string, EquipmentSlotDef>(
  PW_EQUIPMENT_SLOTS.map((s) => [s.key, s]),
);

export function getEquipmentSlotDef(pos: number): EquipmentSlotDef | undefined {
  if (pos == null || !Number.isFinite(Number(pos))) return undefined;
  return BY_POS.get(Number(pos));
}

export function getEquipmentSlotDefByKey(key: string): EquipmentSlotDef | undefined {
  return BY_KEY.get(key);
}

/**
 * Devolve o label legível do slot. Se a pos não tem mapeamento, devolve
 * "Slot desconhecido (X)" — nunca lança/quebra a UI.
 */
export function getEquipmentSlotLabel(pos: number, opts?: { short?: boolean }): string {
  const def = getEquipmentSlotDef(pos);
  if (!def) return `Slot desconhecido (${Number.isFinite(pos) ? pos : "?"})`;
  return opts?.short ? def.shortLabel : def.label;
}

/** True quando essa pos NÃO está no mapa conhecido. */
export function isUnknownEquipmentPos(pos: number): boolean {
  return !getEquipmentSlotDef(pos);
}

/**
 * Ordena por `visualOrder`. Itens com pos desconhecida vão pro final, ordenados
 * pelo próprio pos (estável).
 */
export function sortEquipmentBySlot<T extends { pos?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ap = Number(a?.pos ?? 9999);
    const bp = Number(b?.pos ?? 9999);
    const aDef = getEquipmentSlotDef(ap);
    const bDef = getEquipmentSlotDef(bp);
    const aKey = aDef?.visualOrder ?? 1000 + ap; // unknowns vão pro final
    const bKey = bDef?.visualOrder ?? 1000 + bp;
    return aKey - bKey;
  });
}

/** Lista de pos conhecidas. Útil pra dropdowns/autocomplete. */
export function getKnownEquipmentPositions(): number[] {
  return PW_EQUIPMENT_SLOTS.map((s) => s.pos);
}

export const KNOWN_EQUIPMENT_POS: number[] = getKnownEquipmentPositions();

/**
 * Garante pos íntegro e remove duplicatas mantendo o item com id>0 quando há
 * conflito. Não cria slots vazios automaticamente, e PRESERVA pos desconhecidas.
 */
export function normalizeEquipmentSlots<T extends { pos: number; id: number }>(
  items: T[],
): T[] {
  const out = new Map<number, T>();
  for (const raw of items) {
    const pos = Number.isFinite(Number(raw?.pos)) ? Math.trunc(Number(raw.pos)) : -1;
    if (pos < 0) continue;
    const next = { ...raw, pos };
    const prev = out.get(pos);
    if (!prev) {
      out.set(pos, next);
      continue;
    }
    const prevHas = (prev.id ?? 0) > 0;
    const nextHas = (next.id ?? 0) > 0;
    if (!prevHas && nextHas) out.set(pos, next);
  }
  return Array.from(out.values()).sort((a, b) => a.pos - b.pos);
}
