// Validações de item (inventário/equipamento/baú) ANTES de chamar a API.
// Regras:
//   - id obrigatório e > 0
//   - count > 0
//   - max_count >= count
//   - pos dentro da capacidade (0 ≤ pos < capacity)
//   - pos não duplicado dentro da mesma lista
//   - data: HEX válido OU string vazia
//   - proctype, expire_date, guid1, guid2, mask: 0 é válido (apenas precisa ser número finito)
import type { ClsItem } from "@/types/clsconfig";

export interface ItemValidationError {
  pos: number;
  /** Campo que falhou (ex: "id", "count", "max_count", "pos", "data"). */
  field: string;
  message: string;
}

const HEX_RE = /^[0-9a-fA-F]+$/;

const isHexOrEmpty = (s: unknown): boolean => {
  if (s == null) return true;
  const str = String(s);
  if (str.length === 0) return true;
  // Aceita strings hex pares ou ímpares — algumas serializações da VPS são ímpares.
  return HEX_RE.test(str);
};

const isFiniteNumber = (n: unknown): boolean =>
  typeof n === "number" && Number.isFinite(n);

export interface ValidateOptions {
  /** Capacidade máxima (exclusivo: pos < capacity). Use Infinity se não houver limite. */
  capacity: number;
  /** Rótulo para mensagens (ex: "Inventário", "Baú · Material"). */
  label: string;
  /** Se true, ignora itens vazios (id === 0) — útil quando a UI cria slots placeholder. */
  ignoreEmpty?: boolean;
}

export function validateItems(
  items: ClsItem[],
  opts: ValidateOptions,
): ItemValidationError[] {
  const errors: ItemValidationError[] = [];
  const seenPos = new Map<number, number>(); // pos → primeiro index visto
  const ignoreEmpty = opts.ignoreEmpty ?? true;

  items.forEach((it, idx) => {
    // Slot vazio (placeholder) — pula se configurado.
    if (ignoreEmpty && (it.id === 0 || it.id == null)) return;

    // id
    if (!isFiniteNumber(it.id) || it.id <= 0) {
      errors.push({ pos: it.pos, field: "id", message: `${opts.label} pos ${it.pos}: id obrigatório e > 0` });
    }
    // count
    if (!isFiniteNumber(it.count) || it.count <= 0) {
      errors.push({ pos: it.pos, field: "count", message: `${opts.label} pos ${it.pos}: count deve ser > 0` });
    }
    // max_count >= count
    if (!isFiniteNumber(it.max_count) || it.max_count < it.count) {
      errors.push({
        pos: it.pos,
        field: "max_count",
        message: `${opts.label} pos ${it.pos}: max_count (${it.max_count}) deve ser ≥ count (${it.count})`,
      });
    }
    // pos no range
    if (!isFiniteNumber(it.pos) || it.pos < 0 || it.pos >= opts.capacity) {
      errors.push({
        pos: it.pos,
        field: "pos",
        message: `${opts.label} pos ${it.pos} fora da capacidade (0..${opts.capacity - 1})`,
      });
    }
    // pos duplicado
    if (seenPos.has(it.pos)) {
      errors.push({
        pos: it.pos,
        field: "pos",
        message: `${opts.label} pos ${it.pos} duplicada (slots ${seenPos.get(it.pos)} e ${idx})`,
      });
    } else {
      seenPos.set(it.pos, idx);
    }
    // data hex
    if (!isHexOrEmpty(it.data)) {
      errors.push({
        pos: it.pos,
        field: "data",
        message: `${opts.label} pos ${it.pos}: data deve ser HEX válido ou vazio`,
      });
    }
    // 0 aceito para os opcionais — só rejeita não-finito
    for (const f of ["proctype", "expire_date", "guid1", "guid2", "mask"] as const) {
      if (!isFiniteNumber(it[f])) {
        errors.push({
          pos: it.pos,
          field: f,
          message: `${opts.label} pos ${it.pos}: ${f} deve ser número (0 é válido)`,
        });
      }
    }
  });

  return errors;
}

/** Valida todas as listas de um template e retorna a lista combinada de erros. */
export function validateTemplateItems(template: import("@/types/clsconfig").ClsTemplate): ItemValidationError[] {
  const errors: ItemValidationError[] = [];
  errors.push(
    ...validateItems(template.inventory.items, {
      capacity: Math.max(template.inventory.capacity || 0, 1),
      label: "Inventário",
    }),
  );
  // Equipamento: capacity efetiva = maior pos + 1, limitado a 256 para não travar.
  const eqCap = Math.max(...template.equipment.items.map((i) => i.pos + 1), 32);
  errors.push(...validateItems(template.equipment.items, { capacity: eqCap, label: "Equipamento" }));

  errors.push(
    ...validateItems(template.storehouse.items, {
      capacity: Math.max(template.storehouse.capacity || 0, 1),
      label: "Baú · Itens",
    }),
  );
  errors.push(
    ...validateItems(template.storehouse.dress, {
      capacity: Math.max(template.storehouse.dress.length, 16),
      label: "Baú · Dress",
    }),
  );
  errors.push(
    ...validateItems(template.storehouse.material, {
      capacity: Math.max(template.storehouse.material.length, 16),
      label: "Baú · Material",
    }),
  );
  errors.push(
    ...validateItems(template.storehouse.generalcard, {
      capacity: Math.max(template.storehouse.generalcard.length, 16),
      label: "Baú · General card",
    }),
  );
  return errors;
}
