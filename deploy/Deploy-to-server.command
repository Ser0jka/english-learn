#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
cd -- "$(dirname "$0")"
LEXI_SERVER_IP=${LEXI_SERVER_IP:-83.217.203.91}
LEXI_SSH_PORT=${LEXI_SSH_PORT:-22}
[[ "$LEXI_SERVER_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || exit 2
[[ "$LEXI_SSH_PORT" =~ ^[0-9]+$ ]] || exit 2
for item in install-server.sh app.tar.gz app.tar.gz.sha256 app.env access-password.txt RELEASE; do
  [[ -s "$item" ]] || { echo "Missing private deployment file: $item"; exit 1; }
done
LEXI_TEMP=$(mktemp -d /tmp/lexi-deploy.XXXXXXXX)
LEXI_CONTROL="$LEXI_TEMP/ssh"
LEXI_REMOTE="/root/lexi-deploy-$(date +%s)-$$"
LEXI_SSH=(ssh -p "$LEXI_SSH_PORT" -o ControlPath="$LEXI_CONTROL" -o ServerAliveInterval=15 -o ServerAliveCountMax=3)
cleanup() {
  "${LEXI_SSH[@]}" -O exit "root@$LEXI_SERVER_IP" 2>/dev/null || true
  rm -rf -- "$LEXI_TEMP"
}
trap cleanup EXIT
echo 'Connecting to your server. Confirm its SSH fingerprint and enter the root password when prompted.'
"${LEXI_SSH[@]}" -M -N -f "root@$LEXI_SERVER_IP"
tar -czf "$LEXI_TEMP/upload.tar.gz" install-server.sh app.tar.gz app.tar.gz.sha256 app.env access-password.txt RELEASE
"${LEXI_SSH[@]}" "root@$LEXI_SERVER_IP" "umask 077; mkdir -m 700 '$LEXI_REMOTE'"
scp -P "$LEXI_SSH_PORT" -o ControlPath="$LEXI_CONTROL" "$LEXI_TEMP/upload.tar.gz" "root@$LEXI_SERVER_IP:$LEXI_REMOTE/upload.tar.gz"
"${LEXI_SSH[@]}" "root@$LEXI_SERVER_IP" "set -eu; cd '$LEXI_REMOTE'; tar -xzf upload.tar.gz; bash install-server.sh '$LEXI_SERVER_IP'; cd /root; rm -rf -- '$LEXI_REMOTE'"
echo 'Deployment completed. Open ACCESS.txt for the site address and login.'
if [[ -t 0 ]]; then read -r -p 'Press Enter to close.'; fi
