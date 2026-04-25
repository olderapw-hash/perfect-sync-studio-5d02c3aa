// Tipos e helpers do módulo Sorteios (Eventos > Sorteios).
//
// Reaproveita o conceito de payload misto (itens + gold) já usado nos
// kits/templates de mail. Mantém o nome `reward_payload_json` por
// alinhamento com a especificação do produto (campo no banco).
import type { MailItemAttachment } from "@/lib/pwApiActions";

export type RaffleStatus = "draft" | "active" | "closed";
export type RaffleDeliveryStatus =
  | "pending"
  | "sent"
  | "error"
  | "duplicate_blocked";
export type RaffleParticipantSource = "manual" | "import" | "auto";

/** Item incluído no prêmio. Espelha o shape esperado por sendMailItem. */
export interface RaffleRewardItem extends MailItemAttachment {
  /** Nome do item (snapshot p/ exibir no preview/histórico). */
  item_name?: string;
  icon_path?: string;
}

export interface RaffleRewardPayload {
  /** Lista de itens (pode ser vazia se for só gold). */
  items: RaffleRewardItem[];
  /** Total em moedas de cobre. 0 = sem gold. */
  gold: number;
}

export interface RaffleEvent {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  status: RaffleStatus;
  starts_at: string | null;
  ends_at: string | null;
  winners_count: number;
  reward_title: string | null;
  reward_message: string | null;
  reward_payload_json: RaffleRewardPayload;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RaffleParticipant {
  id: string;
  raffle_id: string;
  tenant_id: string;
  roleid: number;
  role_name: string | null;
  userid: number | null;
  source: RaffleParticipantSource;
  added_by: string;
  created_at: string;
}

export interface RaffleWinner {
  id: string;
  raffle_id: string;
  tenant_id: string;
  roleid: number;
  role_name: string | null;
  userid: number | null;
  drawn_by: string;
  drawn_at: string;
}

export interface RaffleRewardDelivery {
  id: string;
  raffle_id: string;
  tenant_id: string;
  roleid: number;
  role_name: string | null;
  userid: number | null;
  reward_payload_json: RaffleRewardPayload;
  idempotency_key: string;
  status: RaffleDeliveryStatus;
  mail_log_ids: string[];
  response_json: unknown;
  error_message: string | null;
  sent_by: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

/* -------------------------------------------------------------------------- */
/* Helpers de validação / formatação                                          */
/* -------------------------------------------------------------------------- */

/** Mapeia o status para um rótulo PT-BR. */
export function raffleStatusLabel(s: RaffleStatus): string {
  switch (s) {
    case "draft":
      return "Rascunho";
    case "active":
      return "Ativo";
    case "closed":
      return "Encerrado";
  }
}

export function deliveryStatusLabel(s: RaffleDeliveryStatus): string {
  switch (s) {
    case "pending":
      return "Pendente";
    case "sent":
      return "Entregue";
    case "error":
      return "Erro";
    case "duplicate_blocked":
      return "Duplicada (bloqueada)";
  }
}

/** Normaliza um payload vindo do banco para o shape tipado. */
export function normalizeRewardPayload(input: unknown): RaffleRewardPayload {
  const fallback: RaffleRewardPayload = { items: [], gold: 0 };
  if (!input || typeof input !== "object") return fallback;
  const o = input as Record<string, unknown>;
  const itemsRaw = Array.isArray(o.items) ? o.items : [];
  const items: RaffleRewardItem[] = [];
  for (const raw of itemsRaw) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const item_id = Number(r.item_id);
    const count = Number(r.count);
    if (!Number.isFinite(item_id) || item_id <= 0) continue;
    if (!Number.isFinite(count) || count <= 0) continue;
    items.push({
      item_id,
      count,
      max_count: typeof r.max_count === "number" ? r.max_count : undefined,
      proctype: typeof r.proctype === "number" ? r.proctype : undefined,
      expire_date: typeof r.expire_date === "number" ? r.expire_date : undefined,
      mask: typeof r.mask === "number" ? r.mask : undefined,
      guid1: typeof r.guid1 === "number" ? r.guid1 : undefined,
      guid2: typeof r.guid2 === "number" ? r.guid2 : undefined,
      data: typeof r.data === "string" ? r.data : undefined,
      item_name: typeof r.item_name === "string" ? r.item_name : undefined,
      icon_path: typeof r.icon_path === "string" ? r.icon_path : undefined,
    });
  }
  const gold = typeof o.gold === "number" && Number.isFinite(o.gold) && o.gold > 0
    ? Math.floor(o.gold)
    : 0;
  return { items, gold };
}

/** Validação leve: precisa ter pelo menos 1 item OU gold > 0. */
export function isRewardPayloadValid(p: RaffleRewardPayload): boolean {
  return p.items.length > 0 || p.gold > 0;
}

/**
 * Hash determinístico do payload de prêmio. Usado como parte da
 * idempotency_key da entrega (raffle_id + roleid + reward_hash).
 * Não precisa ser criptográfico — só estável para o mesmo conteúdo.
 */
export function rewardPayloadHash(p: RaffleRewardPayload): string {
  const items = [...p.items]
    .map((i) => ({
      item_id: i.item_id,
      count: i.count,
      mask: i.mask ?? 0,
      guid1: i.guid1 ?? 0,
      guid2: i.guid2 ?? 0,
    }))
    .sort((a, b) => a.item_id - b.item_id || a.count - b.count);
  const stable = JSON.stringify({ items, gold: p.gold });
  let hash = 0;
  for (let i = 0; i < stable.length; i++) {
    hash = (hash << 5) - hash + stable.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/** Gera a idempotency_key padronizada. */
export function buildDeliveryKey(
  raffleId: string,
  roleid: number,
  payload: RaffleRewardPayload,
): string {
  return `${raffleId}:${roleid}:${rewardPayloadHash(payload)}`;
}
