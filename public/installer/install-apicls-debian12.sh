#!/bin/bash
# Instala a bridge PW Admin / api_cls.php em Debian 12 para servidores PW 1.5.5 e 1.7.8.
#
# Este instalador reutiliza a logica principal do install-apicls-centos7.sh
# e aplica apenas as adaptacoes necessarias para Debian 12 / apache2 / apt.

set -Eeuo pipefail

INSTALL_DIR="/var/www/html/apicls"
API_SRC=""
API_URL=""
SECRET="${PW_API_SECRET:-}"
ACTIVATION_TOKEN="${PW_ACTIVATION_TOKEN:-}"
GAME_VERSION="${PW_GAME_VERSION:-178}"
WEB_USER="${PW_WEB_USER:-www-data}"
OPEN_FIREWALL=1
INSTALL_PACKAGES=1
BACKUP_EXISTING=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CENTOS_INSTALLER="$SCRIPT_DIR/install-apicls-centos7.sh"

log() {
  printf '\033[1;32m[OK]\033[0m %s\n' "$*"
}

warn() {
  printf '\033[1;33m[AVISO]\033[0m %s\n' "$*" >&2
}

die() {
  printf '\033[1;31m[ERRO]\033[0m %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Instalador PW Admin API CLS para Debian 12

Opcoes:
  --secret VALOR             Secret da VPS gerado no painel. Se omitir, gera um novo.
  --activation-token TOKEN   Token de ativacao da licenca (opcional).
  --game-version VER         Versao do servidor PW. Suporta: 101, 155, 178. Default: 178.
  --api-src CAMINHO          Caminho local do api_cls.php. Default: ./api_cls.php.
  --api-url URL              Baixa api_cls.php desta URL.
  --web-user USUARIO         Usuario do Apache/PHP. Default: www-data.
  --install-dir DIR          Default: /var/www/html/apicls
  --no-apt                   Nao tenta instalar apache2/php/curl/sudo.
  --no-firewall              Nao abre porta HTTP no ufw.
  --no-backup-existing       Nao cria copia do /var/www/html/apicls existente.
  -h, --help                 Mostra esta ajuda.

Exemplo:
  bash install-apicls-debian12.sh --secret 8f74c4d4e7fbe1d0f3e420ef85a0a --game-version 178
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --secret)
      SECRET="${2:-}"
      shift 2
      ;;
    --activation-token)
      ACTIVATION_TOKEN="${2:-}"
      shift 2
      ;;
    --game-version)
      GAME_VERSION="${2:-}"
      shift 2
      ;;
    --api-src)
      API_SRC="${2:-}"
      shift 2
      ;;
    --api-url)
      API_URL="${2:-}"
      shift 2
      ;;
    --web-user)
      WEB_USER="${2:-}"
      shift 2
      ;;
    --install-dir)
      INSTALL_DIR="${2:-}"
      shift 2
      ;;
    --no-apt)
      INSTALL_PACKAGES=0
      shift
      ;;
    --no-firewall)
      OPEN_FIREWALL=0
      shift
      ;;
    --no-backup-existing)
      BACKUP_EXISTING=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Opcao desconhecida: $1"
      ;;
  esac
done

[ "$(id -u)" = "0" ] || die "Execute como root."
[ -f "$CENTOS_INSTALLER" ] || die "Nao encontrei $CENTOS_INSTALLER. O pacote do instalador esta incompleto."

if [ -r /etc/os-release ]; then
  . /etc/os-release
  if [ "${ID:-}" != "debian" ]; then
    warn "Este instalador foi desenhado para Debian 12, mas o sistema reporta ID='${ID:-desconhecido}'."
  fi
  if [ "${VERSION_ID:-}" != "12" ]; then
    warn "Esperado Debian 12, mas o sistema reporta VERSION_ID='${VERSION_ID:-desconhecido}'. Vou continuar."
  fi
fi

if [ -z "$SECRET" ]; then
  if command -v openssl >/dev/null 2>&1; then
    SECRET="$(openssl rand -hex 20)"
  else
    SECRET="$(tr -dc 'a-zA-Z0-9' </dev/urandom 2>/dev/null | head -c 40 || true)"
  fi
  [ -n "$SECRET" ] || die "Nao foi possivel gerar secret automaticamente."
  warn "Nenhum --secret informado. Gerei um novo secret para cadastrar no painel."
fi

case "$SECRET" in
  *"'"*|*'"'*|*" "*)
    die "Secret invalido: nao use aspas ou espacos."
    ;;
esac

if [ "${#SECRET}" -lt 8 ]; then
  die "Secret muito curto. Use pelo menos 8 caracteres."
fi

case "$GAME_VERSION" in
  101|155|178)
    ;;
  *)
    die "game_version invalida: '$GAME_VERSION'. Use 101, 155 ou 178."
    ;;
esac

if [ "$INSTALL_PACKAGES" = "1" ]; then
  command -v apt-get >/dev/null 2>&1 || die "apt-get nao encontrado. Rode com --no-apt apenas se o ambiente ja estiver preparado."
  export DEBIAN_FRONTEND=noninteractive
  log "Atualizando indice do apt"
  apt-get update -y
  log "Instalando pacotes base do Debian 12"
  apt-get install -y \
    apache2 \
    curl \
    sudo \
    tar \
    gzip \
    ca-certificates \
    php \
    libapache2-mod-php \
    php-cli \
    php-mbstring \
    php-xml
fi

command -v php >/dev/null 2>&1 || die "php nao encontrado. Instale PHP 7.4/8.x ou rode sem --no-apt."
command -v sudo >/dev/null 2>&1 || die "sudo nao encontrado."
command -v tar >/dev/null 2>&1 || die "tar nao encontrado."
id "$WEB_USER" >/dev/null 2>&1 || die "Usuario web '$WEB_USER' nao existe. Use --web-user."

mkdir -p /etc/httpd/conf.d

INNER_ARGS=(
  --secret "$SECRET"
  --game-version "$GAME_VERSION"
  --web-user "$WEB_USER"
  --install-dir "$INSTALL_DIR"
  --no-yum
  --no-remi
  --no-firewall
)

if [ -n "$ACTIVATION_TOKEN" ]; then
  INNER_ARGS+=(--activation-token "$ACTIVATION_TOKEN")
fi

if [ -n "$API_URL" ]; then
  INNER_ARGS+=(--api-url "$API_URL")
else
  if [ -z "$API_SRC" ]; then
    API_SRC="$SCRIPT_DIR/api_cls.php"
  fi
  INNER_ARGS+=(--api-src "$API_SRC")
fi

if [ "$BACKUP_EXISTING" = "0" ]; then
  INNER_ARGS+=(--no-backup-existing)
fi

log "Executando instalador base com adaptacao Debian 12"
bash "$CENTOS_INSTALLER" "${INNER_ARGS[@]}"

HTTPD_CONF="/etc/httpd/conf.d/apicls-security.conf"
APACHE2_CONF="/etc/apache2/conf-available/apicls-security.conf"

if [ -f "$HTTPD_CONF" ]; then
  install -m 644 -o root -g root "$HTTPD_CONF" "$APACHE2_CONF"
fi

if command -v a2enconf >/dev/null 2>&1; then
  a2enconf apicls-security >/dev/null 2>&1 || warn "Nao consegui habilitar a conf apicls-security no apache2."
fi

if command -v systemctl >/dev/null 2>&1; then
  systemctl enable apache2 >/dev/null 2>&1 || true
  systemctl restart apache2 >/dev/null 2>&1 || systemctl start apache2 >/dev/null 2>&1 || warn "Nao consegui iniciar/reiniciar apache2 via systemctl."
else
  service apache2 restart >/dev/null 2>&1 || service apache2 start >/dev/null 2>&1 || warn "Nao consegui iniciar/reiniciar apache2."
fi

if [ "$OPEN_FIREWALL" = "1" ] && command -v ufw >/dev/null 2>&1; then
  if ufw status 2>/dev/null | grep -qi "Status: active"; then
    ufw allow 80/tcp >/dev/null 2>&1 || warn "Nao consegui abrir 80/tcp no ufw."
  fi
fi

PUBLIC_IP="$(curl -fsS --max-time 3 https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || true)"
BASE_URL="http://127.0.0.1/apicls/api_cls.php"

cat <<EOF

============================================================
Adaptacao Debian 12 concluida.

URL local:   $BASE_URL
URL painel:  http://${PUBLIC_IP:-SEU_IP}/apicls/api_cls.php
Secret:      $SECRET
Versao PW:   $GAME_VERSION
Usuario web: $WEB_USER

Observacao:
  O core da instalacao foi aplicado pelo install-apicls-centos7.sh,
  com pacote Debian, apache2 e ufw configurados nesta camada Debian 12.
============================================================
EOF
