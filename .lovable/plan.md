## Redesign do /admin — Sistema de Cards Premium

Refatoração visual completa da área `/admin` mantendo **100% da lógica, rotas, hooks, permissões, APIs e autenticação intactos**. Foco: padronizar todos os cards e criar uma identidade NOC/Game Server Control Center.

---

### Fase 1 — Fundação (design tokens + primitivos)

**`src/index.css`** — adicionar novas utilitárias (sem quebrar as existentes):
- `.admin-card` — fundo glass dark, borda fina bronze/grafite, sombra com profundidade
- `.admin-card-hover` — brilho sutil vermelho/dourado no hover
- `.admin-card-danger` — variante para ações destrutivas (borda vinho)
- `.admin-card-header-grid` — header com ícone + título + badge alinhados
- `.admin-stat-number` — tipografia premium para KPIs
- `.admin-divider-bronze` — divisor ornamental
- Novos tokens: `--admin-surface`, `--admin-surface-elevated`, `--admin-border-subtle`, `--admin-glow-crimson`, `--admin-glow-gold`

**Componentes novos em `src/components/admin/ui/`**:
- `AdminCard.tsx` — base (variantes: `default | elevated | danger | success`)
- `AdminCardHeader.tsx` — ícone + título + subtítulo + slot direito (badge/ação)
- `AdminStatCard.tsx` — KPI (label, valor grande, trend, ícone)
- `AdminStatusCard.tsx` — serviço/recurso com pill de status
- `AdminActionCard.tsx` — card com CTA primário
- `AdminTableCard.tsx` — wrapper para tabelas com toolbar embutida
- `AdminSectionCard.tsx` — agrupamento de formulários/configs com seções
- `AdminDangerCard.tsx` — operações sensíveis com confirmação visual
- `EmptyStateCard.tsx` — vazio elegante (ícone bronze + título + descrição + ação opcional)
- `PageHeader.tsx` — título de página + breadcrumb + ações
- `StatusBadge.tsx` — variantes (online/offline/warning/maintenance/critical)
- `ActionButton.tsx` — botão padronizado (primary/ghost/danger/gold)
- `DataPanel.tsx` — painel compacto tipo "linha de serviço" (Serviço | Status | Processos | Ação)
- `SectionCard.tsx` — alias semântico de AdminSectionCard

Todos usando **apenas tokens semânticos do design system** (sem cores hardcoded).

---

### Fase 2 — Layout geral

**`src/components/admin/layout/AdminLayout.tsx`**:
- Header superior premium: nome do servidor, status global (dot + label), última sincronização, botão refresh, badge de permissão do operador, quick actions
- Manter SidebarProvider e estrutura de roteamento existentes

**`src/components/admin/AdminSidebar.tsx`**:
- Reagrupar itens em: Dashboard / Servidor / GM Commander / Personagens / Eventos / Segurança / Site / Conta
- Item ativo com glow vermelho discreto + barra lateral bronze
- Badges pequenos (contadores, "novo")
- Logo Orphea Core no topo
- Drawer no mobile (já suportado pelo shadcn sidebar)

---

### Fase 3 — Migração das páginas (apenas wrapping/visual)

Substituir `<Card>` / divs genéricas por `AdminCard` + primitivos nas páginas, **sem tocar em lógica/handlers/hooks**:

- `ControlCenterPage` → KPIs com `AdminStatCard`, serviços com `DataPanel` (linha compacta), não cards gigantes
- `GmCommanderPage` → `AdminActionCard` para comunicação/moderação/recompensas; `AdminDangerCard` para ações perigosas
- `SecurityOverviewPage`, `SecurityHistoryPage`, `SecurityModerationPage`, `SecuritySettingsPage` → `AdminCard` + `AdminTableCard`
- `ServerLogsPage`, `ServerHistoryPage`, `MailHistoryPage` → `AdminTableCard` com estética de terminal/auditoria
- `RankPvpPage` → leaderboard com destaque TOP 3 (bronze/prata/dourado discreto)
- `RolesPage`, `RolesHistoryPage`, `RolesBackupsPage` → `AdminCard` compactos + busca padronizada
- `MailTemplatesPage`, `ServerMessagesPage` → cards editoriais com preview
- `AccountSettingsPage`, `SitePage` → `AdminSectionCard` agrupando toggles/forms
- Demais páginas admin → wrapping consistente
- Substituir todos os estados vazios por `EmptyStateCard`

---

### Fase 4 — Padronização final

- `PageHeader` em todas as páginas
- `StatusBadge` substitui badges ad-hoc
- `ActionButton` para CTAs principais
- Espaçamentos (`p-5`, `gap-4`), tipografia e tamanhos de ícone uniformes

---

### Garantias

- **Nenhuma alteração** em: rotas, hooks (`useAuth`, `useOperatorPermissions`, `useClsconfig`, etc.), libs de API (`pwApiActions`, `mailSend`, etc.), Supabase client, edge functions, schemas, lógica de permissão, formulários, handlers
- Build sem erros
- Apenas arquivos UI/JSX tocados; props e contratos dos componentes funcionais preservados
- Todas as cores via tokens HSL semânticos

---

### Detalhes técnicos

```text
src/
├── index.css                              (+ tokens e utilitárias .admin-*)
├── components/admin/
│   ├── ui/                                NOVO
│   │   ├── AdminCard.tsx
│   │   ├── AdminCardHeader.tsx
│   │   ├── AdminStatCard.tsx
│   │   ├── AdminStatusCard.tsx
│   │   ├── AdminActionCard.tsx
│   │   ├── AdminTableCard.tsx
│   │   ├── AdminSectionCard.tsx
│   │   ├── AdminDangerCard.tsx
│   │   ├── EmptyStateCard.tsx
│   │   ├── PageHeader.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── ActionButton.tsx
│   │   ├── DataPanel.tsx
│   │   └── SectionCard.tsx
│   ├── AdminSidebar.tsx                   (visual + agrupamento)
│   └── layout/AdminLayout.tsx             (header premium)
└── pages/admin/*.tsx                       (substituição de Card → AdminCard, sem mexer em lógica)
```

### Escopo desta entrega

Devido ao tamanho (~25 páginas admin), proponho entregar em **duas etapas dentro desta sessão**:

1. **Agora**: Fundação completa (Fase 1 + 2) + migração das páginas mais visíveis (ControlCenter, GmCommander, SecurityOverview, RankPvp, RolesPage, MailHistory, ServerLogs, AccountSettings).
2. **Próxima mensagem (se aprovado)**: Migração das páginas restantes seguindo o mesmo padrão.

Confirma que posso seguir assim?
