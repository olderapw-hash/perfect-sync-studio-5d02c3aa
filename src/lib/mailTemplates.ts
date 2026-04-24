// Tipos e helpers para mail_templates / mail_send_log.
// O conteúdo concreto (item / gold) é tipado via union discriminada
// pelo campo `kind`, espelhando a CHECK constraint da tabela.
import type { MailItemAttachment } from "@/lib/pwApiActions";

export type MailKind = "item" | "gold";
export type MailVisibility = "server" | "private";

export interface MailItemPayload extends MailItemAttachment {
  /** Nome do item (snapshot — usado no preview do template/histórico). */
  item_name?: string;
  icon_path?: string;
}

export interface MailGoldPayload {
  /** Inteiro > 0 — no menor denominador (PW = moedas de cobre). */
  amount: number;
}

export type MailPayload = MailItemPayload | MailGoldPayload;

export interface MailTemplate {
  id: string;
  tenant_id: string;
  created_by: string;
  name: string;
  description: string | null;
  kind: MailKind;
  visibility: MailVisibility;
  subject: string | null;
  body: string | null;
  payload: MailPayload;
  created_at: string;
  updated_at: string;
}

export type MailSendStatus = "success" | "error" | "endpoint_missing" | "pending";

export interface MailSendLogRow {
  id: string;
  tenant_id: string;
  user_id: string;
  template_id: string | null;
  kind: MailKind;
  target_roleid: number;
  target_name: string | null;
  subject: string | null;
  body: string | null;
  payload: MailPayload;
  status: MailSendStatus;
  http_status: number | null;
  error_message: string | null;
  response: unknown;
  created_at: string;
}

/** Validação leve do payload conforme o kind. Usada antes de salvar. */
export function isValidMailPayload(kind: MailKind, p: unknown): p is MailPayload {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  if (kind === "gold") {
    return typeof o.amount === "number" && Number.isFinite(o.amount) && o.amount > 0;
  }
  // item
  return (
    typeof o.item_id === "number" &&
    Number.isFinite(o.item_id) &&
    o.item_id > 0 &&
    typeof o.count === "number" &&
    Number.isFinite(o.count) &&
    o.count > 0
  );
}

/** Formata "moedas de cobre" como string amigável (ex.: 12g 34s 56c). */
export function formatGold(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "0";
  const gold = Math.floor(amount / 10000);
  const silver = Math.floor((amount % 10000) / 100);
  const copper = amount % 100;
  const parts: string[] = [];
  if (gold > 0) parts.push(`${gold.toLocaleString("pt-BR")}g`);
  if (silver > 0) parts.push(`${silver}s`);
  if (copper > 0) parts.push(`${copper}c`);
  return parts.join(" ") || `${amount}`;
}

export function statusLabel(s: MailSendStatus): string {
  switch (s) {
    case "success":
      return "Entregue";
    case "error":
      return "Erro";
    case "endpoint_missing":
      return "Endpoint ausente";
    case "pending":
      return "Pendente";
  }
}
