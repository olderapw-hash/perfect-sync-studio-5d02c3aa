# PW Admin - Instalacao da API na VPS (PW 1.5.5 e 1.7.8)

Esta base suporta os dois cenarios:
- `game_version 155` para servidores PW `1.5.5`
- `game_version 178` para servidores PW `1.7.8`

Tambem ha dois instaladores:
- `install-apicls-centos7.sh`
- `install-apicls-debian12.sh`

No instalador, escolha explicitamente a versao:

```bash
bash install-apicls-centos7.sh --secret SEU_SECRET --game-version 155
```

```bash
bash install-apicls-centos7.sh --secret SEU_SECRET --game-version 178
```

Se precisar ativar com token de licenca:

```bash
bash install-apicls-centos7.sh --secret SEU_SECRET --activation-token SEU_TOKEN --game-version 178
```

Este pacote instala a ponte HTTP que conecta sua VPS Perfect World ao PW Admin.

A API correta e a `api_cls.php` completa, que fala com o `gamedbd` em
`127.0.0.1:29400`, lista templates CLS, edita personagens reais, cria backups,
restaura backups, consulta catalogo de itens, envia correio e executa moderacao
basica (kick/ban/unban).

> Nao use a versao antiga baseada em `/home/gamedbd/clsconfig.data`. Ela retorna
> `count:0` / `classes:[]` e nao e compativel com o painel atual.

## Requisitos

- CentOS 7, Debian 12 ou equivalente proximo.
- Acesso SSH como `root`.
- Perfect World instalado em `/home/gamedbd`.
- Apache/httpd com PHP 7+ ou PHP 8.x. O instalador tenta instalar PHP 8.2 via Remi se o PHP estiver ausente ou antigo.
- Secret gerado no painel em `Servidores`.

## Instalacao automatica

Suba estes arquivos para a VPS:

- `api_cls.php`
- `install-apicls-centos7.sh`
- `install-apicls-debian12.sh` se a VPS for Debian 12

No seu computador:

```powershell
scp "api_cls.php" root@IP_DA_VPS:/root/api_cls.php
scp "install-apicls-centos7.sh" root@IP_DA_VPS:/root/install-apicls-centos7.sh
scp "install-apicls-debian12.sh" root@IP_DA_VPS:/root/install-apicls-debian12.sh
```

Na VPS:

```bash
bash /root/install-apicls-centos7.sh --secret SEU_SECRET --api-src /root/api_cls.php
```

Ou, em Debian 12:

```bash
bash /root/install-apicls-debian12.sh --secret SEU_SECRET --api-src /root/api_cls.php
```

O instalador faz automaticamente:

- Instala/ativa Apache e PHP quando necessario.
- Cria `/var/www/html/apicls`.
- Instala o `api_cls.php` com seu secret.
- Instala `/usr/local/sbin/exportclsconfig-api.sh`.
- Instala `/usr/local/sbin/backupgamedbd-api.sh`.
- Instala `/usr/local/bin/pw_send_mail.php`.
- Instala `/usr/local/sbin/sendreward-api.sh`.
- Configura `/etc/sudoers.d/apicls-pwadmin`.
- Cria pastas de backup.
- Ajusta permissoes.
- Reinicia o Apache.
- Testa `getClasses`.
- Testa a rota `sendMailGold`.
- Testa `backupGamedbd`.

Ao finalizar, ele imprime:

- URL local.
- URL para cadastrar no painel.
- Secret usado.
- Usuario web detectado.

## Comando recomendado

```bash
bash /root/install-apicls-centos7.sh --secret SEU_SECRET --api-src /root/api_cls.php
```

Se quiser que o instalador gere um secret novo:

```bash
bash /root/install-apicls-centos7.sh --api-src /root/api_cls.php
```

Depois cadastre o secret gerado em `PW Admin -> Servidores`.

## Testes manuais

Na VPS:

```bash
php -l /var/www/html/apicls/api_cls.php
```

```bash
curl -s -H "x-sync-secret: SEU_SECRET" \
"http://127.0.0.1/apicls/api_cls.php?action=getClasses"
```

```bash
curl -s -H "x-sync-secret: SEU_SECRET" \
"http://127.0.0.1/apicls/api_cls.php?action=getClsconfigDebug" \
| head -c 3000
```

```bash
curl -s -X POST -H "x-sync-secret: SEU_SECRET" -H "Content-Type: application/json" \
-d '{"reason":"manual-test","force":true}' \
"http://127.0.0.1/apicls/api_cls.php?action=backupGamedbd"
```

Resultado esperado do backup:

```json
{"success":true,"backup":{"type":"gamedbd_backup","file":"...gamedbd-backup-....tgz"}}
```

Teste rapido do correio com validacao local:

```bash
curl -s -X POST -H "x-sync-secret: SEU_SECRET" -H "Content-Type: application/json" \
-d '{"roleid":1024,"title":"Teste","message":"Dry run","money":1,"dry_run":true}' \
"http://127.0.0.1/apicls/api_cls.php?action=sendMailGold"
```

Resultado esperado:

```json
{"success":true,"delivery":{"success":true,"dry_run":true}}
```

Teste rapido de moderacao sem aplicar:

```bash
curl -s -X POST -H "x-sync-secret: SEU_SECRET" -H "Content-Type: application/json" \
-d '{"roleid":1024,"reason":"Teste dry run","dry_run":true}' \
"http://127.0.0.1/apicls/api_cls.php?action=kickRole"
```

```bash
curl -s -X POST -H "x-sync-secret: SEU_SECRET" -H "Content-Type: application/json" \
-d '{"roleid":1024,"reason":"Teste ban temp","duration_seconds":60,"dry_run":true}' \
"http://127.0.0.1/apicls/api_cls.php?action=banAccount"
```

Para banir a conta e derrubar a sessao atual do personagem no mesmo fluxo:

```bash
curl -s -X POST -H "x-sync-secret: SEU_SECRET" -H "Content-Type: application/json" \
-d '{"userid":1024,"roleid":1024,"reason":"Teste ban com kick","duration_seconds":60,"kick_online":true,"kick_seconds":10}' \
"http://127.0.0.1/apicls/api_cls.php?action=banAccount"
```

```bash
curl -s -X POST -H "x-sync-secret: SEU_SECRET" -H "Content-Type: application/json" \
-d '{"roleid":1024,"reason":"Teste unban","dry_run":true}' \
"http://127.0.0.1/apicls/api_cls.php?action=unbanAccount"
```

Para `clearRolePk`, comece pelo dry-run:

```bash
curl -s -X POST -H "x-sync-secret: SEU_SECRET" -H "Content-Type: application/json" \
-d '{"roleid":1024,"reason":"Teste clear PK","dry_run":true}' \
"http://127.0.0.1/apicls/api_cls.php?action=clearRolePk"
```

Aplicacao real:

```bash
curl -s -X POST -H "x-sync-secret: SEU_SECRET" -H "Content-Type: application/json" \
-d '{"roleid":1024,"reason":"Teste clear PK"}' \
"http://127.0.0.1/apicls/api_cls.php?action=clearRolePk"
```

Se o personagem estiver online e voce quiser forcar o recarregamento do estado em memoria logo apos a limpeza persistida, use:

```bash
curl -s -X POST -H "x-sync-secret: SEU_SECRET" -H "Content-Type: application/json" \
-d '{"roleid":1024,"reason":"Teste clear PK","kick_online":true,"kick_seconds":10}' \
"http://127.0.0.1/apicls/api_cls.php?action=clearRolePk"
```

No legado atual, isso e o caminho mais seguro para fazer o estado limpo reaparecer no cliente quando o personagem estava online no momento da operacao.

Em servidores legados como `game_version 101`, `banAccount` e `unbanAccount` usam automaticamente a tabela MySQL `forbid`. Em versoes mais novas, a API tenta o caminho via `gamedbd`. Quando um `roleid` e informado no `unbanAccount`, a API tambem tenta limpar o `base.forbid` do personagem e notifica `gamedbd` e `gdeliveryd` para soltar o bloqueio de login em memoria.

No legado validado, o menor refresh que realmente soltou o login apos o unban foi `authd + gdeliveryd`. Exemplo:

```bash
curl -s -X POST -H "x-sync-secret: SEU_SECRET" -H "Content-Type: application/json" \
-d '{"userid":1024,"roleid":1024,"reason":"cleanup","refresh_services":["authd","gdeliveryd"]}' \
"http://127.0.0.1/apicls/api_cls.php?action=unbanAccount"
```

`refresh_login_cache=true` continua disponivel, mas ele reinicia apenas o `authd` e pode nao bastar no legado. `glinkd` deve ficar so como escalada de emergencia, porque tem impacto maior sobre jogadores online.

Para `reviveRole`, faca primeiro o dry-run para inspecionar `hp`, `mp`, `dead_flag` e `resurrect_state` persistidos:

```bash
curl -s -X POST -H "x-sync-secret: SEU_SECRET" -H "Content-Type: application/json" \
-d '{"roleid":1024,"reason":"Teste revive","dry_run":true}' \
"http://127.0.0.1/apicls/api_cls.php?action=reviveRole"
```

Aplicacao real:

```bash
curl -s -X POST -H "x-sync-secret: SEU_SECRET" -H "Content-Type: application/json" \
-d '{"roleid":1024,"reason":"Teste revive"}' \
"http://127.0.0.1/apicls/api_cls.php?action=reviveRole"
```

No retorno, confira `gm_action.revive.before`, `gm_action.revive.after`, `gm_action.revive.revived` e `gm_action.revive.changed`. Se o personagem ja estiver vivo, a API deve retornar `revived=true` e `changed=false`.

## GM Commander V2 - Fase A

O backend agora tambem entrega a fundacao real da Fase A do `GM Commander V2`:

- `searchPlayerDirectory`
- `getPlayerTargetProfile`
- `resolveBulkTargets`
- `previewBulkTargets`
- `queueBulkCommand`
- `getBulkCommandJob`
- `getBulkCommandJobs`
- `gm-queue-worker.php`

Na pratica, esta Fase A e a base real para **premiacao em massa** no servidor:

- preview de audiencia
- resolucao de alvos
- fila de execucao
- worker backend
- auditoria local

Ou seja: o painel ja consegue preparar e disparar recompensas em lote com backend real, sem depender de acao manual personagem por personagem.

Essa fundacao usa armazenamento file-based em:

```text
/var/www/html/apicls/backups/gm-commander-v2/
```

Teste rapido de busca:

```bash
curl -s -H "x-sync-secret: SEU_SECRET" \
"http://127.0.0.1/apicls/api_cls.php?action=searchPlayerDirectory&online_only=1&limit=20"
```

Preview de bulk para item:

```bash
curl -s -X POST -H "x-sync-secret: SEU_SECRET" -H "Content-Type: application/json" \
-d '{"command_key":"sendMailItem","selection":{"names":["Criador"]},"item_id":12980,"count":1,"title":"Evento","message":"Premio"}' \
"http://127.0.0.1/apicls/api_cls.php?action=previewBulkTargets"
```

Preview de bulk por guild:

```bash
curl -s -X POST -H "x-sync-secret: SEU_SECRET" -H "Content-Type: application/json" \
-d '{"command_key":"sendMailGold","selection":{"guild_ids":[1234]},"money":1000,"title":"Guild Reward","message":"Entrega por guild"}' \
"http://127.0.0.1/apicls/api_cls.php?action=previewBulkTargets"
```

Observacao de seguranca:

- `grantMallCash` em `queueBulkCommand` e `scheduleBulkCommand` exige `confirm:"GRANT_MALL_CASH"`
- sem esse token o backend agora rejeita a criacao do job/schedule antes de entrar em retry

Preview de bulk por classe:

```bash
curl -s -X POST -H "x-sync-secret: SEU_SECRET" -H "Content-Type: application/json" \
-d '{"command_key":"sendMailGold","selection":{"class_ids":[4],"online_only":true},"money":1000,"title":"Class Reward","message":"Entrega por classe"}' \
"http://127.0.0.1/apicls/api_cls.php?action=previewBulkTargets"
```

Preview de bulk por faixa de level:

```bash
curl -s -X POST -H "x-sync-secret: SEU_SECRET" -H "Content-Type: application/json" \
-d '{"command_key":"sendMailGold","selection":{"level_min":100,"level_max":105,"online_only":true},"money":1000,"title":"Level Reward","message":"Entrega por level"}' \
"http://127.0.0.1/apicls/api_cls.php?action=previewBulkTargets"
```

## Templates operacionais de bulk

O backend agora tambem suporta **templates operacionais** para reaproveitar comandos bulk prontos com seguranca.

Endpoints disponiveis:

- `saveBulkTemplate`
- `getBulkTemplate`
- `getBulkTemplates`
- `updateBulkTemplate`
- `deleteBulkTemplate`
- `previewBulkTemplate`
- `executeBulkTemplate`

Categorias homologadas nesta fase:

- `evento`
- `punicao`
- `recompensa`
- `broadcast`

Escopo inicial:

- templates para os comandos bulk ja homologados
- armazenamento file-based
- selecao canonica salva no template
- payload padrao salvo no template
- preview real por template
- execucao por template em modo `queue`
- execucao por template em modo `schedule`

Salvar template de reward por guild:

```bash
curl -s -X POST -H "x-sync-secret: SEU_SECRET" -H "Content-Type: application/json" \
-d '{"template_key":"guild-gold-oldpw","label":"Gold semanal OldPw","category":"recompensa","command_key":"sendMailGold","selection":{"guild_ids":[1]},"money":1000,"title":"Guild Reward","message":"Entrega por template","requires_preview":true}' \
"http://127.0.0.1/apicls/api_cls.php?action=saveBulkTemplate"
```

Preview do template:

```bash
curl -s -X POST -H "x-sync-secret: SEU_SECRET" -H "Content-Type: application/json" \
-d '{"template_key":"guild-gold-oldpw"}' \
"http://127.0.0.1/apicls/api_cls.php?action=previewBulkTemplate"
```

Executar template em fila:

```bash
curl -s -X POST -H "x-sync-secret: SEU_SECRET" -H "Content-Type: application/json" \
-d '{"template_key":"guild-gold-oldpw","mode":"queue"}' \
"http://127.0.0.1/apicls/api_cls.php?action=executeBulkTemplate"
```

Executar template como schedule semanal:

```bash
curl -s -X POST -H "x-sync-secret: SEU_SECRET" -H "Content-Type: application/json" \
-d '{"template_key":"guild-gold-oldpw","mode":"schedule","name":"Guild Reward semanal","weekdays":[3],"time_of_day":"22:30","timezone":"America/Sao_Paulo","enabled":true}' \
"http://127.0.0.1/apicls/api_cls.php?action=executeBulkTemplate"
```

Observacao importante:

- `grantMallCash` salvo em template tambem exige `confirm:"GRANT_MALL_CASH"` no payload padrao
- o execute do template reaproveita os mesmos validadores de bulk e de schedule

Enfileirar job:

```bash
curl -s -X POST -H "x-sync-secret: SEU_SECRET" -H "Content-Type: application/json" \
-d '{"command_key":"sendMailGold","selection":{"all_online":true},"money":1000,"title":"Evento","message":"Entrega em lote"}' \
"http://127.0.0.1/apicls/api_cls.php?action=queueBulkCommand"
```

Listar jobs:

```bash
curl -s -H "x-sync-secret: SEU_SECRET" \
"http://127.0.0.1/apicls/api_cls.php?action=getBulkCommandJobs&limit=20"
```

Executar o worker manualmente:

```bash
php /var/www/html/apicls/gm-queue-worker.php
```

Limitacoes atuais desta fase:

- busca por `userid` sem `roleid` ainda fica limitada a alvo de conta
- selecao de guild confiavel nesta fase usa `guild_id` ou `guild_ids`
- `sendSystemMessage` continua global e nao respeita filtros de alvo

Seletores ja homologados nesta fase:

- `roleids`
- `names` exatos
- `online_only`
- `all_online`
- `guild_id` / `guild_ids`
- `class_ids`
- `level_min` / `level_max`
- `ranking_key`
- `ranking_limit`

`ranking_key` suportados nesta VPS:

- `pvp_points`
- `level`
- `level2`
- `exp`
- `reputation`
- `lastlogin_time`
- `create_time`

Implementacao atual do ranking:

- `pvp_points` usa a mesma fonte do fluxo atual em [reward_pvp.php](C:/Files%20pw%20old/rankpvp/reward_pvp.php): tabela `pw_ranking.pvp_ranking`
- `pvp_points` replica a ordenacao real da entrega automatica: `ORDER BY points DESC, last_kill_at DESC`
- `pvp_points` consulta MySQL via wrapper privilegiado `gmv2-ranking-api.sh` usando `/root/.my.cnf`
- usa leitura real das tabelas `base` e `status` do `gamedbd`
- tenta primeiro dump local via `db_dump`
- faz fallback para `getRawTable` quando necessario
- aplica `ranking_limit` depois da resolucao e dos filtros restantes

## Ranking PvP premiado

O backend agora tambem expõe um fluxo dedicado para **TOP PvP com premiacao por
posicao** e **reset do ranking ao final da entrega**.

Endpoints disponiveis:

- `getPvpRankingLeaderboard`
- `previewPvpRankingRewards`
- `executePvpRankingRewards`
- `getPvpRankingRewardHistory`
- `getPvpRankingRewardSchedule`
- `getPvpRankingRewardSchedules`
- `savePvpRankingRewardSchedule`
- `deletePvpRankingRewardSchedule`

O objetivo dessa camada e permitir que o painel:

- veja a tabela real do TOP 3
- monte a recompensa do 1o, 2o e 3o colocados
- execute a entrega manualmente
- agende a entrega automatica pelo worker de schedules
- zere `pw_ranking.pvp_ranking` quando a rodada terminar

Modelo de recompensa por posicao:

```json
{
  "rewards": [
    {
      "position": 1,
      "item_id": 51231,
      "count": 1,
      "money": 1000000,
      "title": "Campeao do Ranking PvP",
      "message": "Parabens, {player_name}! Voce ficou em {position}o lugar com {points} pontos."
    },
    {
      "position": 2,
      "money": 500000,
      "title": "Vice-Campeao do Ranking PvP",
      "message": "Parabens, {player_name}! Voce ficou em {position}o lugar."
    },
    {
      "position": 3,
      "money": 250000,
      "title": "Top 3 do Ranking PvP",
      "message": "Parabens, {player_name}! Voce ficou em {position}o lugar."
    }
  ],
  "reset_ranking": true,
  "reset_only_on_full_success": true
}
```

Observacoes:

- o leaderboard dedicado usa `pvp_points`
- a premiacao usa o mesmo backend real de correio do `GM Commander`
- o reset do ranking usa o wrapper privilegiado `gmv2-ranking-api.sh`
- o worker `gm-schedule-worker.php` agora tambem processa schedules de
  premiacao do ranking PvP
- a execucao grava historico file-based em:

```text
/var/www/html/apicls/backups/gm-commander-v2/pvp-ranking/history.log
```

## Agendamento semanal de bulk rewards

O backend agora tambem traz a base real para **agendamento semanal** de recompensas em massa.

Endpoints disponiveis:

- `scheduleBulkCommand`
- `getBulkSchedules`
- `getBulkSchedule`
- `updateBulkSchedule`
- `deleteBulkSchedule`
- `runDueBulkSchedules`
- `gm-schedule-worker.php`

Arquitetura:

- o frontend cria/edita o schedule
- a API persiste a regra
- o scheduler cria um job normal da fila no horario devido
- o `gm-queue-worker.php` continua sendo o executor real dos alvos

Escopo atual:

- selecionar `weekdays`
- aceitar `every_day=true` como atalho para `weekdays=[1,2,3,4,5,6,7]`
- selecionar `time_of_day`
- definir `timezone`
- ativar/pausar com `enabled`
- permitir `sendMailItem`, `sendMailGold`, `grantMallCash` e `sendSystemMessage`
- suportar os seletores da Fase A ja homologados
- registrar criacao, alteracao, disparo e falha no log de auditoria

Observacao importante:

- `grantMallCash` agendado tambem exige `confirm:"GRANT_MALL_CASH"` no payload salvo
- o scheduler nao deve criar jobs de cash sem essa confirmacao explicita
- `sendSystemMessage` agendado continua global e ignora filtros de alvo

- `name` nesse endpoint e o nome do agendamento
- para selecionar jogador por nome, use `selection.names`

Exemplo de criacao de schedule semanal:

```bash
curl -s -X POST -H "x-sync-secret: SEU_SECRET" -H "Content-Type: application/json" \
-d '{"name":"Gold semanal da guild","command_key":"sendMailGold","selection":{"guild_ids":[1]},"money":1000,"title":"Guild Reward","message":"Entrega semanal","weekdays":[1],"time_of_day":"21:00","timezone":"America/Sao_Paulo","enabled":true}' \
"http://127.0.0.1/apicls/api_cls.php?action=scheduleBulkCommand"
```

Exemplo de schedule para todos os dias:

```bash
curl -s -X POST -H "x-sync-secret: SEU_SECRET" -H "Content-Type: application/json" \
-d '{"name":"Broadcast diario","command_key":"sendSystemMessage","message":"Evento diario ativo","kind":"system","priority":"normal","every_day":true,"time_of_day":"21:00","timezone":"America/Sao_Paulo","enabled":true}' \
"http://127.0.0.1/apicls/api_cls.php?action=scheduleBulkCommand"
```

Listar schedules:

```bash
curl -s -H "x-sync-secret: SEU_SECRET" \
"http://127.0.0.1/apicls/api_cls.php?action=getBulkSchedules&limit=20"
```

Executar schedules vencidos manualmente:

```bash
curl -s -X POST -H "x-sync-secret: SEU_SECRET" -H "Content-Type: application/json" \
-d '{}' \
"http://127.0.0.1/apicls/api_cls.php?action=runDueBulkSchedules"
```

Rodar o worker CLI:

```bash
php /var/www/html/apicls/gm-schedule-worker.php
```

Exemplo de cron para execucao automatica a cada minuto:

```cron
* * * * * root /usr/bin/php /var/www/html/apicls/gm-schedule-worker.php >/dev/null 2>&1
```

## Permissoes por operador

O backend agora suporta uma camada separada de permissao do painel, sem
misturar com a permissao GM dentro do jogo.

### Modo de operacao

Configuracoes em `api_cls.php`:

- `operator_permissions_mode`
  - `off`: desabilita a camada
  - `audit`: calcula e audita, mas nao bloqueia
  - `enforce`: bloqueia com `403 Forbidden`
- `operator_permissions_registry_file`
- `operator_permissions_allow_request_role`
- `operator_permissions_require_known_operator`
- `operator_permissions_default_role`

Padrao atual:

- `operator_permissions_mode: "audit"`
- nao quebra a operacao homologada existente
- permite integrar o Lovable primeiro e virar `enforce` depois

### Headers aceitos

O painel pode enviar:

- `x-operator-id`
- `x-operator-email`
- `x-operator-name`
- `x-operator-role`

Para evitar colisao com payloads de negocio, os headers acima sao a fonte
preferencial da identidade do operador autenticado.

### Perfis suportados

- `viewer`
- `gm_operator`
- `gm_supervisor`
- `gm_admin`
- `super_admin`

Aliases aceitos:

- `operator` -> `gm_operator`
- `supervisor` -> `gm_supervisor`
- `admin` -> `gm_admin`

### Arquivo de registry

Por padrao:

```text
/var/www/html/apicls/backups/gm-commander-v2/operators.json
```

Exemplo:

```json
{
  "updated_at": "2026-05-07T00:00:00Z",
  "operators": [
    {
      "id": "lovable-admin",
      "email": "admin@seudominio.com",
      "name": "Lovable Admin",
      "role": "gm_admin",
      "enabled": true
    },
    {
      "id": "lovable-ops",
      "email": "ops@seudominio.com",
      "name": "Lovable Ops",
      "role": "gm_operator",
      "enabled": true
    }
  ]
}
```

Modelo pronto no workspace:

- [operators.example.json](/C:/Files%20pw%20old/home/apicls/operators.example.json)
- [api_cls.local.example.php](/C:/Files%20pw%20old/home/apicls/api_cls.local.example.php)

Para manter configuracoes locais da VPS entre deploys, crie
`/var/www/html/apicls/api_cls.local.php`. Esse arquivo retorna um array PHP
com overrides do `$CONFIG` principal, por exemplo:

```php
<?php
return [
    'operator_permissions_mode' => 'enforce',
    'operator_permissions_allow_request_role' => false,
    'operator_permissions_require_known_operator' => true,
    'operator_permissions_default_role' => 'viewer',
];
```

Assim, um novo deploy do `api_cls.php` nao desfaz o modo `enforce`.

### Endpoints de suporte

- `getOperatorPermissionCatalog`
- `getOperatorPermissionState`
- `getOperatorRegistry`
- `saveOperatorRegistryEntry`
- `deleteOperatorRegistryEntry`

Exemplo:

```bash
curl -s -H "x-sync-secret: SEU_SECRET" \
-H "x-operator-id: lovable-admin" \
-H "x-operator-email: admin@seudominio.com" \
"http://127.0.0.1/apicls/api_cls.php?action=getOperatorPermissionState"
```

Gerenciamento do registry pelo painel:

```bash
curl -s -X POST -H "x-sync-secret: SEU_SECRET" \
-H "x-operator-id: SEU_SUPER_ADMIN" \
-H "x-operator-email: admin@seudominio.com" \
-H "Content-Type: application/json" \
-d '{
  "id": "11cfed69-0997-4baa-ae1a-0329b5742feb",
  "email": "admin@seudominio.com",
  "name": "Seu Nome",
  "role": "super_admin",
  "enabled": true
}' \
"http://127.0.0.1/apicls/api_cls.php?action=saveOperatorRegistryEntry"
```

Os endpoints de registry:

- exigem `super_admin`
- escrevem direto em `/var/www/html/apicls/backups/gm-commander-v2/operators.json`
- suportam `enabled` e `allowed_ips`
- impedem apagar/desabilitar o ultimo `super_admin`
- impedem o proprio `super_admin` logado de remover o proprio acesso pelo painel

### Minimos aplicados pelo backend

- `viewer`
  - leitura, historico e status
- `gm_operator`
  - `sendMailItem`
  - `sendMailGold`
  - bulk/schedule/template dessas recompensas
- `gm_supervisor`
  - `sendSystemMessage`
  - `kickRole`
  - `muteRole`
  - `clearRolePk`
  - `reviveRole`
  - `teleportRole`
- `gm_admin`
  - `grantMallCash`
  - `grantGmPermission`
  - `revokeGmPermission`
  - `banAccount`
  - `unbanAccount`
  - `muteAccount`
  - operacao de servicos, manutencao e watchdog
- `super_admin`
  - `restoreNow`
  - `restoreBackup`
  - `saveRoleEditable`
  - `saveClsconfigTemplate`
  - `getOperatorRegistry`
  - `saveOperatorRegistryEntry`
  - `deleteOperatorRegistryEntry`

### Auditoria

Quando houver contexto de operador, jobs, schedules, templates e auditoria do
GM V2 passam a registrar:

- `actor_user_id`
- `actor_email`
- `actor_role`
- `actor_ip`

## Cadastro no painel

No PW Admin:

1. Abra `Servidores`.
2. Adicione ou edite a VPS.
3. URL da API:

```text
http://IP_DA_VPS/apicls/api_cls.php
```

4. Secret: o mesmo usado no instalador.
5. Clique em `Testar conexao`.
6. Ative esse servidor.

As chamadas do painel devem usar o servidor ativo em `Servidores`, nao a conexao
legada da tela de Configuracoes.

## Backups automaticos

A API cria backup completo antes das operacoes sensiveis:

- `saveRoleEditable`
- `saveClsconfigTemplate`
- `restoreBackup`
- `exportClsconfig`

As acoes de moderacao tambem geram log local em:

```text
/var/www/html/apicls/backups/security-logs/security-AAAA-MM-DD.jsonl
```

O backup fica em:

```text
/var/www/html/apicls/backups/gamedbd/
```

Ele inclui, quando existirem:

- `/home/gamedbd/gamesys.conf`
- `/home/gamedbd/clsconfig`
- `/home/gamedbd/dbdata`
- `/home/gamedbd/dblogs`
- `/home/gamedbd/dbhome`
- `/home/gamedbd/backup`

Durante aplicacoes em massa, a API reutiliza backup recente por alguns minutos
para nao lotar o disco.

## Sudoers instalado

O instalador cria `/etc/sudoers.d/apicls-pwadmin` com:

```text
apache ALL=(root) NOPASSWD: /usr/local/sbin/exportclsconfig-api.sh
apache ALL=(root) NOPASSWD: /usr/local/sbin/backupgamedbd-api.sh
apache ALL=(root) NOPASSWD: /usr/local/sbin/sendreward-api.sh
```

Se sua VPS usa outro usuario web (`nginx` ou `www-data`), rode:

```bash
bash /root/install-apicls-centos7.sh --secret SEU_SECRET --api-src /root/api_cls.php --web-user nginx
```

## Solucao de problemas

| Sintoma | Causa provavel | Como resolver |
|---|---|---|
| `Unauthorized` | Secret errado no painel ou no PHP | Compare o secret em `/var/www/html/apicls/api_cls.php` com `Servidores` |
| `classes: []` | API antiga ou secret/servidor errado | Garanta que `api_cls.php` contem `backupGamedbd` e `CLASS_INFO` |
| `count:0` com classes preenchidas | `gamedbd` nao respondeu ou `clsconfig` vazio | Rode `getClsconfigDebug` |
| `Connection refused 127.0.0.1:29400` | `gamedbd` desligado | Inicie o `gamedbd` e teste `ss -lntp | grep 29400` |
| `Backup gamedbd falhou` | sudoers/permissao faltando | Rode `visudo -cf /etc/sudoers.d/apicls-pwadmin` |
| Tela usa VPS errada | Painel lendo configuracao legada | Usar `Servidores` e servidor ativo |

## Atualizacao futura

Para atualizar a API:

```powershell
scp "api_cls.php" root@IP_DA_VPS:/root/api_cls.php
scp "install-apicls-centos7.sh" root@IP_DA_VPS:/root/install-apicls-centos7.sh
```

Na VPS:

```bash
bash /root/install-apicls-centos7.sh --secret SEU_SECRET --api-src /root/api_cls.php
```

O instalador cria backup da instalacao anterior em `/root/apicls-before-install-*.tgz`.
