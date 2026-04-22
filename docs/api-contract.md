# Contrato dos endpoints novos — `apicls/api_cls.php`

Estes 3 endpoints **ainda não existem** na VPS. Este documento define o
contrato request/response que o frontend já está preparado para consumir.
Implemente no PHP exatamente neste formato para que as features 4, 5 e 10
funcionem sem mudança no client.

Convenções gerais:

- Auth: header `x-sync-secret: <PW_API_SECRET>` (igual aos endpoints existentes).
- Content-Type: `application/json` em ambos sentidos.
- Erros: `{ "success": false, "error": "<mensagem humana>" }` com HTTP 4xx/5xx.
- Sucesso: `{ "success": true, ...payload }` com HTTP 200.
- `0` é valor válido em qualquer campo numérico — nunca usar `if ($v)`,
  sempre `isset()` / comparação explícita.

---

## 1. `GET ?action=getItemCatalog` — feature 4 (Buscar Item)

Catálogo completo de itens disponíveis no servidor (lido do `aitem.data` ou
do dump que vocês já mantêm).

**Request:** sem body.

**Query params opcionais:**

| Param  | Tipo    | Default | Descrição                                      |
|--------|---------|---------|------------------------------------------------|
| `q`    | string  | —       | Busca textual (id exato OU substring de nome). |
| `limit`| int     | 200     | Máximo de resultados (server-side).            |
| `offset`| int    | 0       | Paginação.                                     |

**Response 200:**

```json
{
  "success": true,
  "count": 1234,
  "items": [
    {
      "id": 11530,
      "name": "Token de Espírito",
      "icon_path": "img/items/token_espirito.png",
      "tier": 0,
      "stack_max": 999,
      "type": "consumable"
    }
  ]
}
```

Campos obrigatórios: `id`, `name`. Os demais são best-effort.

---

## 1.b `GET ?action=listBackups` — feature 5 (Listagem de backups)

Lista todos os backups existentes em `backups/clsconfig/...` (gerados
automaticamente por `saveClsconfigTemplate`).

**Query params opcionais:**

| Param   | Tipo | Default | Descrição                              |
|---------|------|---------|----------------------------------------|
| `roleid`| int  | —       | Filtra apenas backups deste roleid.    |

**Response 200:**

```json
{
  "success": true,
  "backups": [
    {
      "roleid": 31,
      "type": "role_json",
      "file": "/var/www/html/apicls/backups/clsconfig/roleid-31-20260422-002129-2d3bea53.json",
      "created_at": 1761091289,
      "size": 41523
    },
    {
      "roleid": 31,
      "type": "clsconfig_file",
      "file": "/var/www/html/apicls/backups/clsconfig/files/clsconfig-roleid-31-20260422-002129-34ced325",
      "created_at": 1761091289,
      "size": 2048
    }
  ]
}
```

`type` deve ser `"role_json"` ou `"clsconfig_file"`. `created_at` é epoch
em segundos. `size` em bytes (best-effort).

---

## 2. `POST ?action=restoreBackup` — feature 5 (Restaurar) ✅ implementado

Restaura um backup `role_json` previamente gerado. Apenas `type=role_json` é
restaurável no momento (`clsconfig_file` e `export_log` ficam desabilitados
no frontend).

**Request body — dry_run (validação prévia):**

```json
{
  "type": "role_json",
  "name": "roleid-31-20260422-002129-2d3bea53.json",
  "dry_run": true
}
```

**Request body — restore real (exige confirm string):**

```json
{
  "type": "role_json",
  "name": "roleid-31-20260422-002129-2d3bea53.json",
  "confirm": "RESTORE_ROLE_JSON"
}
```

**Response 200 (dry_run):**

```json
{ "success": true, "dry_run": true, "roleid": 31, "source": {}, "target": {} }
```

**Response 200 (real):**

```json
{
  "success": true,
  "roleid": 31,
  "restored": {
    "saved": {
      "verified": true,
      "backups": {
        "role_json": { "file": "/var/www/.../backups/clsconfig/roleid-31-...json" },
        "clsconfig_file": { "file": "/var/www/.../backups/clsconfig/files/clsconfig-roleid-31-..." }
      },
      "export": { "log_file": "/var/www/.../backups/clsconfig/exports/exportclsconfig-...log" }
    }
  }
}
```

**Response 4xx:** `{ "success": false, "error": "Backup inexistente" }`.

Regras (server-side):

- Antes de aplicar, gerar novo backup do estado atual (aparece em `restored.saved.backups`).
- Disparar `exportclsconfig` automaticamente após o write no `gamedbd`.
- `verified: true` apenas se a releitura do `gamedbd` bater com o conteúdo do backup.

---

## 3. `POST ?action=saveRoleEditable` — feature 10 (Personagem Existente)

**NÃO** confundir com `saveClsconfigTemplate`. Este endpoint edita o
**personagem real** já existente (registro do `gamedbd` indexado pelo
roleid REAL do char, não pelo roleid do template CLS).

Recomendação: o endpoint deve retornar erro se o personagem estiver
**online** (sessão ativa no gdeliveryd).

**Request body (todos os campos opcionais — só envia o que mudou):**

```json
{
  "roleid": 1024,
  "status": {
    "level": 105,
    "level2": 30,
    "reputation": 200000,
    "worldtag": 1,
    "posx": 1250.386,
    "posy": 219.618,
    "posz": 1145.902
  },
  "inventory": {
    "money": 1000000
  }
}
```

Aceitar os mesmos sub-payloads de `saveClsconfigTemplate` (`status`,
`inventory`, `equipment`, `storehouse`), com a mesma regra de não enviar
`status.cultivation` / `status.decoded` / `summary` / `class_info`.

**Response 200:**

```json
{
  "success": true,
  "roleid": 1024,
  "online": false,
  "applied": ["status.level", "status.reputation", "inventory.money"],
  "verified": true,
  "backups": {
    "role_json": { "file": "/var/www/html/apicls/backups/role/1024-...json" }
  }
}
```

**Response 409 (char online):**

```json
{ "success": false, "error": "Personagem online — kick antes de editar", "online": true }
```

---

## Resumo de prioridade de implementação

1. `getItemCatalog` — destrava o "Buscar Item" no frontend (item 4).
2. `saveRoleEditable` — destrava a aba "Personagem Existente" (item 10).
3. `restoreBackup` — destrava o botão "Restaurar" da tela de Backups (item 5).

Enquanto não estiverem prontos, o frontend mostra o estado vazio /
botão desabilitado com a mensagem **"endpoint ainda não implementado"**.
