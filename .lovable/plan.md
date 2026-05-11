
# Alinhamento do Admin com o contrato real da VPS

Esta rodada toca 8 áreas independentes do frontend. Sem mudanças no backend. Vou organizar por arquivo/área para minimizar risco.

---

## 1. Bulk Schedule Manager — hidratação completa antes de editar/toggle
**Arquivo:** `src/components/admin/BulkScheduleManager.tsx`

- No clique de **Editar** e no **toggle ativar/pausar**, chamar `getBulkSchedule(id)` para obter o objeto completo.
- O formulário de edição passa a hidratar a partir do `command_payload` real (item_id, money, amount, message, target selection).
- Bloquear `saveBulkSchedule` em modo edição se o payload completo não tiver `command_payload` válido — abortar com toast de erro.
- Remover qualquer fallback do tipo `summary.command_payload ?? {}`.

## 2. Eventos ingame — remover promessa de premiação automática
**Arquivos:** `src/pages/admin/IngameEventsPage.tsx`, componentes relacionados.

- Não há entrega real via VPS hoje. Vou:
  - Remover textos "sortear vencedores e disparar premiação por correio".
  - Substituir por aviso explícito: "Esta tela registra participantes/vencedores localmente. A entrega de prêmios ainda não está integrada à VPS — execute manualmente via Mail/Bulk."
  - Manter botões de sorteio/registro, mas sem prometer mail automático.

## 3. Permissões por operador em Control Center / Server Ops / Instances
**Arquivos:** `src/pages/admin/ControlCenterPage.tsx`, `src/pages/admin/ServerOpsPage.tsx`, `src/pages/admin/InstancesPage.tsx`.

- Adicionar `useOperatorPermissions` + `canAction(...)` para gating das ações reais (start/stop/restart, system message, etc).
- Bloquear leitura quando `require_known_operator=true` e operador não está em `operators.json` (estado já vem do `useOperatorPermissions`).
- Mostrar banner amigável quando bloqueado por enforce/known_operator.
- Manter `useServerPermissions` como camada Supabase (não remover); somar a checagem de operador.

## 4. Mail History — deixar claro que é histórico LOCAL
**Arquivo:** `src/pages/admin/MailHistoryPage.tsx`

- Adicionar banner no topo: "Histórico local do painel. Envios realizados diretamente pela VPS, bulk jobs ou Rank PvP backend-first não aparecem aqui."
- Renomear título da página/aba para "Histórico de envios (local)".
- Sem integração nova com VPS nesta rodada.

## 5. Security History — deixar claro que é audit_logs LOCAL
**Arquivo:** `src/pages/admin/SecurityHistoryPage.tsx`

- Banner: "Trilha local do painel (audit_logs). Para a trilha autoritativa da VPS, use GM Commander → histórico."
- Renomear título para "Histórico local de moderação".
- Sem chamada nova a `getGmActionHistory` (apenas link/CTA para a página GM).

## 6. Rank PVP — botão salvar rewards + remover fallback no toggle
**Arquivo:** `src/pages/admin/RankPvpPage.tsx`

- Verificar estado atual (rodadas anteriores já adicionaram parte disso). Garantir:
  - Botão explícito "Salvar recompensas no agendamento":
    - Se `linkedSchedule` existe → salva no schedule atual (mantém days/time, atualiza rewards).
    - Se não → abre fluxo de criação pré-preenchido com rewards.
  - No `toggleActive` do `ScheduleManager`: remover qualquer `full.rewards ?? rewards`. Se `full.rewards` ausente/vazio → abortar com erro, sem salvar.

## 7. Server Actions — esconder seção de reload (endpoint não existe)
**Arquivo:** `src/pages/admin/ServerActionsPage.tsx`

- Remover/ocultar o card de "reload" enquanto `reloadService` não existir no backend homologado.
- Não deixar UI cair em `EndpointMissingNotice` para esse card.

## 8. Gestão de Operadores — ampliar contrato de getOperatorRegistry
**Arquivos:** `src/lib/pwApiActions.ts`, `src/pages/admin/OperatorManagementPage.tsx`

- Estender o tipo de retorno de `getOperatorRegistry` para incluir:
  - `roles: OperatorRole[]`
  - `role_meta: Record<OperatorRole, { label: string; rank: number; description?: string }>`
  - `invalid_entries: Array<{ raw: unknown; error: string }>`
  - `registry_file: string`
  - `updated_at: string`
- Na tela:
  - Mostrar seção "Entradas inválidas" se `invalid_entries.length > 0`.
  - Usar `role_meta[role].label` em vez de label hardcoded.
  - Mostrar `registry_file` + `updated_at` no header.

---

## Ordem de execução

1. Ler todos os arquivos-alvo em paralelo (várias leituras grandes).
2. Aplicar edits área por área (8 grupos), começando pelas mais isoladas (4, 5, 7) e fechando com as mais complexas (1, 3, 8).
3. Verificar build no final.

## Notas técnicas

- Nada muda no backend nem em edge functions.
- Tipos novos em `pwApiActions.ts` são aditivos (campos opcionais) para não quebrar consumidores existentes.
- `canAction` já existe em `useOperatorPermissions`; só precisa ser cabeado nas 3 páginas operacionais.
- Para o item 6, parte já foi feita em rodadas anteriores; vou apenas verificar e completar o que faltar (sem reescrever).
