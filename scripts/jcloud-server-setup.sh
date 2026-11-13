#!/usr/bin/env bash
# JCloud 서버에서 한 번만 실행하는 준비 스크립트.
# Nginx 설치, 사이트 폴더 생성, 사이트 설정 연결까지 한다.
# 사용: sudo가 되는 계정으로 서버에서 `bash jcloud-server-setup.sh`
set -euo pipefail

SITE=jbnu-term-project
WEB_ROOT=/var/www/$SITE
CONF_SRC="$(dirname "$0")/nginx-$SITE.conf"
DEPLOY_USER="${SUDO_USER:-$(id -un)}"

if [ ! -f "$CONF_SRC" ]; then
  echo "사이트 설정 파일이 없습니다: $CONF_SRC" >&2
  exit 1
fi

sudo apt-get update
sudo apt-get install -y nginx

# 바깥에서 들어오는 포트는 JCloud가 연결·관리하므로 서버 방화벽은 새로 켜지 않는다.
# JCloud 서버의 SSH는 22번이 아니라 7777번이라, OpenSSH(22)만 허용하고 켜면 접속이 끊긴다.
# 이미 켜져 있다면 지금 접속 중인 SSH 포트와 Nginx를 허용해 둔다.
if command -v ufw >/dev/null && sudo ufw status | grep -q '^Status: active'; then
  SSH_PORT="${SSH_PORT:-$(echo "${SSH_CONNECTION:-}" | awk '{print $4}')}"
  sudo ufw allow "${SSH_PORT:-22}/tcp"
  sudo ufw allow 'Nginx Full'
fi

# 배포 계정이 sudo 없이 업로드할 수 있도록 폴더 주인을 배포 계정으로 둔다.
sudo install -d -o "$DEPLOY_USER" -g www-data -m 755 "$WEB_ROOT"

sudo install -m 644 "$CONF_SRC" "/etc/nginx/sites-available/$SITE"
sudo ln -sf "/etc/nginx/sites-available/$SITE" "/etc/nginx/sites-enabled/$SITE"
# 기본 사이트도 default_server라 함께 켜 두면 충돌한다.
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx

echo "준비 완료: $WEB_ROOT (주인 $DEPLOY_USER)"
