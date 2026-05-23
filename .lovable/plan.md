# Validação de licença por dispositivo

Vincular cada dispositivo (navegador) a uma licença no primeiro acesso ao painel `/admin`, com limite por plano e gestão dupla (usuário e superadmin).

## Como funciona

1. No primeiro carregamento de `/admin`, o front gera/recupera um `device_id` (UUID em `localStorage`) e o envia para a edge function `check-device`.
2. Se o dispositivo já estiver registrado → libera o painel e atualiza `last_seen_at`.
3. Se não estiver → abre um modal **bloqueante** "Validar este dispositivo", pedindo o **token da licença**. O usuário pode copiar o token na própria tela (mostramos via RPC `ensure_my_vps_activation_token`).
4. Ao colar e confirmar, chama `register-device`, que valida o token, confere o limite do plano e insere a linha em `account_devices`. Em sucesso, o painel libera.

## Limite por plano

| Plano    | Máx. dispositivos |
| -------- | ----------------- |
| Free/Trial | 1               |
| Pro      | 3                 |
| Ultimate | Ilimitado         |

Se o limite for atingido, o modal mostra a lista de dispositivos atuais e oferece revogar um para liberar espaço.

## Gestão

- **Minha Conta** (`/admin/account`): nova seção "Dispositivos autorizados" listando os do próprio usuário (nome inferido do user-agent, IP mascarado, último acesso, token usado mascarado). Botão "Revogar" em cada item. O dispositivo atual fica marcado e não pode revogar a si mesmo sem confirmação extra.
- **Licenças** (`/admin/licenses`, só superadmin): nova aba/coluna "Dispositivos" por licença, com lista global (usuário, dispositivo, IP, último acesso) e botão de revogar qualquer dispositivo.

## Detalhes técnicos

**Tabela nova `account_devices`**
- `id`, `user_id`, `license_id` (FK licenses), `device_id` (UUID do client), `device_label` (ex.: "Chrome em Windows"), `user_agent`, `ip_address`, `last_seen_at`, `created_at`, `revoked_at`
- Único por (`user_id`, `device_id`)
- RLS: usuário lê/deleta os próprios; superadmin lê/deleta todos; insert apenas via service role (edge function)

**Edge functions (todas com `verify_jwt = true` para usar `auth.uid()`)**
- `check-device` → recebe `device_id`; retorna `{ status: "ok" | "needs_validation", license_token?, devices_count?, max_devices?, plan? }`
- `register-device` → recebe `{ device_id, license_key, label }`; valida o token (deve pertencer ao próprio usuário ou ser válido global), confere limite, insere, retorna `{ ok: true }` ou `{ error, max_devices, devices: [...] }`
- `revoke-device` → recebe `device_id`; usuário pode revogar os próprios, superadmin pode revogar qualquer um

**RPC**
- `get_user_plan_limits(user_id)` → retorna `{ plan, max_devices }` a partir de `subscriptions`

**Componente novo `DeviceValidationGate`**
- Envolto em `AdminLayout` (antes do `<Outlet/>`)
- Roda `check-device` uma vez por sessão; enquanto retorna `needs_validation`, renderiza modal bloqueante em vez do painel
- Usa `react-query` com cache de 5min e refetch ao logar

**Arquivos a criar/editar**
- `supabase/migrations/<timestamp>_account_devices.sql` — tabela, RLS, RPC `get_user_plan_limits`
- `supabase/functions/check-device/index.ts`
- `supabase/functions/register-device/index.ts`
- `supabase/functions/revoke-device/index.ts`
- `supabase/config.toml` — registra as 3 funções (sem `verify_jwt = false`)
- `src/hooks/useDeviceId.ts` — gera/lê UUID em `localStorage`
- `src/hooks/useDeviceValidation.ts` — react-query para `check-device`
- `src/components/admin/DeviceValidationGate.tsx` — wrapper + modal
- `src/components/admin/DeviceList.tsx` — lista reutilizável
- `src/components/admin/layout/AdminLayout.tsx` — envolve `<Outlet/>` com o gate
- `src/pages/admin/AccountSettingsPage.tsx` — nova seção "Dispositivos"
- `src/pages/admin/LicensesPage.tsx` — nova coluna/aba "Dispositivos"

## Fora de escopo

- Notificação por e-mail quando um novo dispositivo é validado (pode ser adicionado depois).
- Geolocalização de IP.
- Bloqueio de IPs/países.
