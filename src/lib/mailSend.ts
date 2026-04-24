// Helper que orquestra: envio na VPS + persistência do log no Supabase.
// Sempre grava em mail_send_log (success / error / endpoint_missing /
// pending) e no audit_logs — independente do resultado, para que o
// histórico seja confiável.
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/lib/auditLog";
import {
  EndpointMissingError,
  pwApi,
  type SendMailGoldPayload,
  type SendMailItemPayload,
  type SendMailResponse,
} from "@/lib/pwApiActions";
import type {
  MailGoldPayload,
  MailItemPayload,
  MailSendStatus,
} from "@/lib/mailTemplates";

interface BaseSendArgs {
  tenantId: string;
  userId: string;
  templateId?: string | null;
  targetRoleid: number;
  targetName?: string | null;
  subject?: string | null;
  body?: string | null;
}

export interface SendMailItemArgs extends BaseSendArgs {
  payload: MailItemPayload;
}

export interface SendMailGoldArgs extends BaseSendArgs {
  payload: MailGoldPayload;
}

export interface SendMailResult {
  status: MailSendStatus;
  response: SendMailResponse | null;
  errorMessage: string | null;
  logId: string | null;
}

async function persistLog(args: {
  tenantId: string;
  userId: string;
  templateId: string | null;
  kind: "item" | "gold";
  targetRoleid: number;
  targetName: string | null;
  subject: string | null;
  body: string | null;
  payload: MailItemPayload | MailGoldPayload;
  status: MailSendStatus;
  errorMessage: string | null;
  response: unknown;
}): Promise<string | null> {
  const { data, error } = await supabase
    .from("mail_send_log")
    .insert({
      tenant_id: args.tenantId,
      user_id: args.userId,
      template_id: args.templateId,
      kind: args.kind,
      target_roleid: args.targetRoleid,
      target_name: args.targetName,
      subject: args.subject,
      body: args.body,
      payload: args.payload as never,
      status: args.status,
      error_message: args.errorMessage,
      response: (args.response ?? null) as never,
    })
    .select("id")
    .single();
  if (error) {
    console.warn("[mail] failed to persist send log", error);
    return null;
  }
  return (data as { id: string }).id;
}

export async function sendMailItem(args: SendMailItemArgs): Promise<SendMailResult> {
  const requestPayload: SendMailItemPayload = {
    roleid: args.targetRoleid,
    subject: args.subject ?? undefined,
    body: args.body ?? undefined,
    item: {
      item_id: args.payload.item_id,
      count: args.payload.count,
      max_count: args.payload.max_count,
      proctype: args.payload.proctype,
      expire_date: args.payload.expire_date,
      mask: args.payload.mask,
      guid1: args.payload.guid1,
      guid2: args.payload.guid2,
      data: args.payload.data,
    },
  };

  let status: MailSendStatus = "success";
  let response: SendMailResponse | null = null;
  let errorMessage: string | null = null;

  try {
    response = await pwApi.sendMailItem(requestPayload);
    if (!response?.success) {
      status = "error";
      errorMessage = response?.error || "Falha desconhecida no envio";
    } else if (response.delivered === false) {
      status = "pending";
    }
  } catch (e) {
    if (e instanceof EndpointMissingError) {
      status = "endpoint_missing";
      errorMessage = e.message;
    } else {
      status = "error";
      errorMessage = e instanceof Error ? e.message : String(e);
    }
  }

  const logId = await persistLog({
    tenantId: args.tenantId,
    userId: args.userId,
    templateId: args.templateId ?? null,
    kind: "item",
    targetRoleid: args.targetRoleid,
    targetName: args.targetName ?? null,
    subject: args.subject ?? null,
    body: args.body ?? null,
    payload: args.payload,
    status,
    errorMessage,
    response,
  });

  await logAuditEvent({
    action: "mail.send_item",
    tenantId: args.tenantId,
    target: String(args.targetRoleid),
    status: status === "success" ? "ok" : "error",
    error: errorMessage,
    metadata: {
      item_id: args.payload.item_id,
      count: args.payload.count,
      template_id: args.templateId ?? null,
      result: status,
    },
  });

  return { status, response, errorMessage, logId };
}

export async function sendMailGold(args: SendMailGoldArgs): Promise<SendMailResult> {
  const requestPayload: SendMailGoldPayload = {
    roleid: args.targetRoleid,
    subject: args.subject ?? undefined,
    body: args.body ?? undefined,
    amount: args.payload.amount,
  };

  let status: MailSendStatus = "success";
  let response: SendMailResponse | null = null;
  let errorMessage: string | null = null;

  try {
    response = await pwApi.sendMailGold(requestPayload);
    if (!response?.success) {
      status = "error";
      errorMessage = response?.error || "Falha desconhecida no envio";
    } else if (response.delivered === false) {
      status = "pending";
    }
  } catch (e) {
    if (e instanceof EndpointMissingError) {
      status = "endpoint_missing";
      errorMessage = e.message;
    } else {
      status = "error";
      errorMessage = e instanceof Error ? e.message : String(e);
    }
  }

  const logId = await persistLog({
    tenantId: args.tenantId,
    userId: args.userId,
    templateId: args.templateId ?? null,
    kind: "gold",
    targetRoleid: args.targetRoleid,
    targetName: args.targetName ?? null,
    subject: args.subject ?? null,
    body: args.body ?? null,
    payload: args.payload,
    status,
    errorMessage,
    response,
  });

  await logAuditEvent({
    action: "mail.send_gold",
    tenantId: args.tenantId,
    target: String(args.targetRoleid),
    status: status === "success" ? "ok" : "error",
    error: errorMessage,
    metadata: {
      amount: args.payload.amount,
      template_id: args.templateId ?? null,
      result: status,
    },
  });

  return { status, response, errorMessage, logId };
}
