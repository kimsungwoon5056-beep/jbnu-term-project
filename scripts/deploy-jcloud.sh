#!/usr/bin/env bash
# 로컬에서 빌드한 dist를 JCloud 서버 Nginx 폴더에 올린다.
#
# 접속 정보는 저장소에 넣지 않고 실행할 때 환경 변수로만 받는다.
#   JCLOUD_HOST  서버 주소 (필수)
#   JCLOUD_KEY   SSH 개인 키 파일 경로 (필수)
#   JCLOUD_PORT  SSH 포트 (기본 22)
#   JCLOUD_USER  SSH 계정 (기본 ubuntu)
#   JCLOUD_URL   배포 후 안내할 웹 주소 (선택)
#   JCLOUD_KNOWN_HOSTS  서버 호스트 키를 저장한 파일 (기본 $HOME/.ssh/known_hosts)
#
# 사용:
#   bash scripts/deploy-jcloud.sh --setup   서버 첫 준비(Nginx 설치·설정, sudo 비밀번호를 물을 수 있음)
#   bash scripts/deploy-jcloud.sh           빌드 후 업로드
set -euo pipefail

cd "$(dirname "$0")/.."

SITE=jbnu-term-project
WEB_ROOT=/var/www/$SITE
: "${JCLOUD_HOST:?JCLOUD_HOST에 서버 주소를 넣어 주세요.}"
: "${JCLOUD_KEY:?JCLOUD_KEY에 SSH 키 파일 경로를 넣어 주세요.}"
PORT="${JCLOUD_PORT:-22}"
LOGIN="${JCLOUD_USER:-ubuntu}@$JCLOUD_HOST"

if [ ! -f "$JCLOUD_KEY" ]; then
  echo "SSH 키 파일을 찾을 수 없습니다: $JCLOUD_KEY" >&2
  exit 1
fi

# 호스트 키 파일 경로를 직접 알려 준다. Windows Git Bash의 ssh는 사용자 폴더 이름이 한글이면
# 기본 경로(~/.ssh/known_hosts)를 깨진 글자로 찾아 "Host key verification failed"가 난다.
# 키 확인 자체는 그대로 한다(처음 보는 서버는 지금처럼 물어본다).
KNOWN_HOSTS="${JCLOUD_KNOWN_HOSTS:-$HOME/.ssh/known_hosts}"
SSH_OPTS=(-i "$JCLOUD_KEY" -p "$PORT" -o "UserKnownHostsFile=$KNOWN_HOSTS")
SCP_OPTS=(-i "$JCLOUD_KEY" -P "$PORT" -o "UserKnownHostsFile=$KNOWN_HOSTS")

if [ "${1:-}" = "--setup" ]; then
  ssh "${SSH_OPTS[@]}" "$LOGIN" "mkdir -p ~/$SITE-setup"
  scp "${SCP_OPTS[@]}" scripts/jcloud-server-setup.sh "deploy/nginx-$SITE.conf" "$LOGIN:~/$SITE-setup/"
  ssh -t "${SSH_OPTS[@]}" "$LOGIN" "bash ~/$SITE-setup/jcloud-server-setup.sh && rm -rf ~/$SITE-setup"
  exit 0
fi

# Firebase 설정값이 빠진 채 빌드하면 화면에 설정 안내만 나온다.
if [ ! -f .env.local ]; then
  echo ".env.local이 없습니다. README의 Firebase 설정을 먼저 해 주세요." >&2
  exit 1
fi

npm run build

# 예전 빌드 파일을 지운 뒤 새 빌드를 올린다.
ssh "${SSH_OPTS[@]}" "$LOGIN" "find $WEB_ROOT -mindepth 1 -delete"
scp "${SCP_OPTS[@]}" -r dist/. "$LOGIN:$WEB_ROOT/"

echo "배포 완료: ${JCLOUD_URL:-http://$JCLOUD_HOST}"
