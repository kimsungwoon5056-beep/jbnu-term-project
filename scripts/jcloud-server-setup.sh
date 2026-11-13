#!/usr/bin/env bash
# JCloud 서버에서 한 번만 실행하는 준비 스크립트.
# Nginx 설치, 방화벽 허용, 사이트 폴더 생성, 사이트 설정 연결까지 한다.
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
sudo apt-get install -y nginx ufw

# 방화벽을 켜기 전에 SSH를 먼저 허용해 접속이 끊기지 않게 한다.
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

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
