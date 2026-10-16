#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
cd -- "$(dirname "$0")"
LEXI_SERVER_IP=${1:-83.217.203.91}
[[ "$LEXI_SERVER_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || exit 2
[[ $EUID -eq 0 ]] || { echo 'Run this installer as root.'; exit 1; }
[[ -d /run/systemd/system ]] || { echo 'A server with systemd is required.'; exit 1; }
command -v apt-get >/dev/null || { echo 'This installer supports Debian and Ubuntu.'; exit 1; }
for item in app.tar.gz app.tar.gz.sha256 app.env access-password.txt RELEASE; do
  [[ -s "$item" ]] || { echo "Missing deployment file: $item"; exit 1; }
done
sha256sum --check app.tar.gz.sha256
LEXI_RELEASE=$(cat RELEASE)
[[ "$LEXI_RELEASE" =~ ^[a-f0-9]{7,40}$ ]] || exit 2
LEXI_ROOT=/opt/lexi
if [[ -d "$LEXI_ROOT" && ! -f "$LEXI_ROOT/.managed-by-lexi" ]]; then
  echo '/opt/lexi already exists and is not managed by this installer.'; exit 1
fi
if { systemctl cat lexi.service >/dev/null 2>&1 || [[ -e /etc/nginx/sites-available/lexi.conf || -e /etc/nginx/sites-enabled/lexi.conf ]]; } && [[ ! -f "$LEXI_ROOT/.managed-by-lexi" ]]; then
  echo 'An unmanaged Lexi service or nginx configuration already exists.'; exit 1
fi
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y --no-install-recommends ca-certificates curl openssl tar xz-utils iproute2 apache2-utils
if [[ -n "$(ss -H -ltn 'sport = :80 or sport = :443')" ]] && ! systemctl is-active --quiet nginx; then
  echo 'Ports 80/443 belong to another service. Nothing will be stopped.'; exit 1
fi
if ! command -v nginx >/dev/null; then apt-get install -y --no-install-recommends nginx; fi
nginx -t
install -d -m 755 "$LEXI_ROOT" "$LEXI_ROOT/releases" "$LEXI_ROOT/runtime"
touch "$LEXI_ROOT/.managed-by-lexi"
LEXI_NODE_VERSION=24.19.0
case $(uname -m) in x86_64) LEXI_ARCH=x64;; aarch64|arm64) LEXI_ARCH=arm64;; *) echo 'Unsupported CPU architecture.'; exit 1;; esac
LEXI_NODE_HOME="$LEXI_ROOT/runtime/node-v$LEXI_NODE_VERSION-linux-$LEXI_ARCH"
if [[ ! -x "$LEXI_NODE_HOME/bin/node" ]]; then
  LEXI_DOWNLOAD=$(mktemp -d)
  LEXI_NODE_FILE="node-v$LEXI_NODE_VERSION-linux-$LEXI_ARCH.tar.xz"
  curl -fsS --retry 2 "https://nodejs.org/dist/v$LEXI_NODE_VERSION/$LEXI_NODE_FILE" -o "$LEXI_DOWNLOAD/$LEXI_NODE_FILE"
  curl -fsS --retry 2 "https://nodejs.org/dist/v$LEXI_NODE_VERSION/SHASUMS256.txt" -o "$LEXI_DOWNLOAD/SHASUMS256.txt"
  (cd "$LEXI_DOWNLOAD"; awk -v file="$LEXI_NODE_FILE" '$2 == file {print}' SHASUMS256.txt > selected.sha256; [[ -s selected.sha256 ]]; sha256sum --check --strict selected.sha256)
  tar -xJf "$LEXI_DOWNLOAD/$LEXI_NODE_FILE" -C "$LEXI_ROOT/runtime"
  rm -rf -- "$LEXI_DOWNLOAD"
fi
export PATH="$LEXI_NODE_HOME/bin:$PATH"
if ! id lexi-app >/dev/null 2>&1; then useradd --system --create-home --home-dir /var/lib/lexi --shell /usr/sbin/nologin lexi-app; fi
install -d -m 750 -o lexi-app -g lexi-app /var/lib/lexi
install -d -m 700 /etc/lexi /etc/lexi/tls /var/lib/lexi-acme
install -d -m 755 /var/www/lexi-acme
LEXI_RELEASE_DIR="$LEXI_ROOT/releases/$LEXI_RELEASE"
install -d -m 755 "$LEXI_RELEASE_DIR"
tar -xzf app.tar.gz -C "$LEXI_RELEASE_DIR"
(cd "$LEXI_RELEASE_DIR"; npm ci --omit=dev --ignore-scripts --no-audit --no-fund)
chmod -R a+rX "$LEXI_RELEASE_DIR"
LEXI_PORT=
if [[ -f /etc/lexi/app.env ]] && systemctl is-active --quiet lexi; then
  LEXI_PORT=$(sed -n 's/^PORT=//p' /etc/lexi/app.env)
fi
if [[ ! "$LEXI_PORT" =~ ^[0-9]+$ ]]; then
  for candidate in $(seq 5173 5190); do
    if [[ -z "$(ss -H -ltn "sport = :$candidate")" ]]; then LEXI_PORT=$candidate; break; fi
  done
fi
[[ "$LEXI_PORT" =~ ^[0-9]+$ ]] || { echo 'No free backend port.'; exit 1; }
LEXI_BACKUP=$(mktemp -d /var/lib/lexi-backup-XXXXXX)
LEXI_OLD_RELEASE=$(readlink "$LEXI_ROOT/current" || true)
LEXI_SITE=/etc/nginx/sites-available/lexi.conf
for file in /etc/lexi/app.env /etc/lexi/htpasswd /etc/systemd/system/lexi.service /etc/systemd/system/lexi-certificate.service /etc/systemd/system/lexi-certificate.timer "$LEXI_SITE"; do
  if [[ -f "$file" ]]; then cp -a "$file" "$LEXI_BACKUP/$(basename "$file")"; fi
done
rollback() {
  local code=$?
  trap - ERR
  echo "Deployment failed. Restoring the previous release. Diagnostics: $LEXI_BACKUP"
  if [[ -n "$LEXI_OLD_RELEASE" ]]; then ln -sfnT "$LEXI_OLD_RELEASE" "$LEXI_ROOT/current"; else systemctl stop lexi 2>/dev/null || true; systemctl disable lexi 2>/dev/null || true; fi
  if [[ ! -f "$LEXI_BACKUP/lexi-certificate.timer" ]]; then systemctl disable --now lexi-certificate.timer 2>/dev/null || true; fi
  for file in /etc/lexi/app.env /etc/lexi/htpasswd /etc/systemd/system/lexi.service /etc/systemd/system/lexi-certificate.service /etc/systemd/system/lexi-certificate.timer "$LEXI_SITE"; do
    if [[ -f "$LEXI_BACKUP/$(basename "$file")" ]]; then cp -a "$LEXI_BACKUP/$(basename "$file")" "$file"; else rm -f -- "$file"; fi
  done
  if [[ ! -f "$LEXI_SITE" ]]; then rm -f /etc/nginx/sites-enabled/lexi.conf; fi
  systemctl daemon-reload
  if [[ -n "$LEXI_OLD_RELEASE" ]]; then systemctl restart lexi || true; fi
  if nginx -t; then systemctl reload nginx || true; fi
  exit "$code"
}
trap rollback ERR
install -m 600 app.env /etc/lexi/app.env
sed -i '/^PORT=/d; /^LEXI_HOST=/d; /^NODE_ENV=/d' /etc/lexi/app.env
printf '\nPORT=%s\nLEXI_HOST=127.0.0.1\nNODE_ENV=production\n' "$LEXI_PORT" >> /etc/lexi/app.env
htpasswd -i -B -c /etc/lexi/htpasswd lexi < access-password.txt >/dev/null
chmod 600 /etc/lexi/htpasswd
ln -sfnT "$LEXI_RELEASE_DIR" "$LEXI_ROOT/current"
cat > /etc/systemd/system/lexi.service <<UNIT
[Unit]
Description=Lexi English learning
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=lexi-app
Group=lexi-app
WorkingDirectory=/opt/lexi/current
EnvironmentFile=/etc/lexi/app.env
ExecStart=$LEXI_NODE_HOME/bin/node /opt/lexi/current/server.mjs
Restart=always
RestartSec=3
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/lib/lexi
UMask=0077
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl restart lexi
for attempt in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$LEXI_PORT/api/health" -o "$LEXI_BACKUP/health.json"; then break; fi
  sleep 1
done
node -e 'const fs=require("fs");const h=JSON.parse(fs.readFileSync(process.argv[1]));if(!h.ok||!h.aiAvailable)process.exit(1)' "$LEXI_BACKUP/health.json"
cat > "$LEXI_SITE" <<NGINX
server {
    listen 80;
    server_name $LEXI_SERVER_IP;
    location ^~ /.well-known/acme-challenge/ { root /var/www/lexi-acme; try_files \$uri =404; }
    location / { return 503; }
}
NGINX
ln -sfn "$LEXI_SITE" /etc/nginx/sites-enabled/lexi.conf
nginx -t
systemctl enable --now nginx
systemctl reload nginx
if command -v ufw >/dev/null && ufw status | grep -q '^Status: active'; then ufw allow 80/tcp; ufw allow 443/tcp; fi
LEXI_ACME="$LEXI_ROOT/acme.sh"
curl -fsS --retry 2 'https://raw.githubusercontent.com/acmesh-official/acme.sh/3688b094adffc1a52d3b994c586cd97caa2f0b85/acme.sh' -o "$LEXI_ACME"
printf '%s  %s\n' '5fe7e5ad82a612de8fded23644b2779110091631687632f871ed02db27146a54' "$LEXI_ACME" | sha256sum --check --strict
chmod 700 "$LEXI_ACME"
LEXI_CERT_STATUS=0
(umask 022; "$LEXI_ACME" --issue --home /var/lib/lexi-acme --server letsencrypt --certificate-profile shortlived --days 3 --keylength ec-256 -d "$LEXI_SERVER_IP" -w /var/www/lexi-acme) > "$LEXI_BACKUP/acme.log" 2>&1 || LEXI_CERT_STATUS=$?
[[ $LEXI_CERT_STATUS -eq 0 || $LEXI_CERT_STATUS -eq 2 ]] || { echo "Certificate issuance failed. See $LEXI_BACKUP/acme.log; inbound ports 80/443 must be open."; false; }
"$LEXI_ACME" --install-cert --home /var/lib/lexi-acme -d "$LEXI_SERVER_IP" --ecc --key-file /etc/lexi/tls/key.pem --fullchain-file /etc/lexi/tls/fullchain.pem --reloadcmd 'systemctl reload nginx' > "$LEXI_BACKUP/install-cert.log" 2>&1
chmod 600 /etc/lexi/tls/key.pem
cat > "$LEXI_SITE" <<NGINX
server {
    listen 80;
    server_name $LEXI_SERVER_IP;
    location ^~ /.well-known/acme-challenge/ { root /var/www/lexi-acme; try_files \$uri =404; }
    location / { return 308 https://$LEXI_SERVER_IP\$request_uri; }
}
server {
    listen 443 ssl;
    server_name $LEXI_SERVER_IP;
    ssl_certificate /etc/lexi/tls/fullchain.pem;
    ssl_certificate_key /etc/lexi/tls/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    auth_basic "Lexi";
    auth_basic_user_file /etc/lexi/htpasswd;
    client_max_body_size 32k;
    location / {
        proxy_pass http://127.0.0.1:$LEXI_PORT;
        proxy_set_header Host \$http_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 130s;
    }
}
NGINX
# Workers need to read only the password hash, not the application environment/key.
chown root:www-data /etc/lexi
chmod 750 /etc/lexi
chown root:www-data /etc/lexi/htpasswd
chmod 640 /etc/lexi/htpasswd
nginx -t
systemctl reload nginx
cat > /etc/systemd/system/lexi-certificate.service <<UNIT
[Unit]
Description=Renew Lexi TLS certificate
After=network-online.target
[Service]
Type=oneshot
ExecStart=/opt/lexi/acme.sh --cron --home /var/lib/lexi-acme
UNIT
cat > /etc/systemd/system/lexi-certificate.timer <<'UNIT'
[Unit]
Description=Check Lexi TLS certificate twice daily
[Timer]
OnCalendar=*-*-* 00,12:00:00
RandomizedDelaySec=1h
Persistent=true
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now lexi lexi-certificate.timer
curl -fsS -H 'Content-Type: application/json' -d '{"topic":"everyday","request":"Частые простые слова для повседневного общения","exclude":[]}' "http://127.0.0.1:$LEXI_PORT/api/materials/words" -o "$LEXI_BACKUP/ai-check.json"
node -e 'const fs=require("fs");const b=JSON.parse(fs.readFileSync(process.argv[1]));if(!Array.isArray(b.words)||!b.words.length)process.exit(1)' "$LEXI_BACKUP/ai-check.json"
printf 'machine %s\nlogin lexi\npassword %s\n' "$LEXI_SERVER_IP" "$(cat access-password.txt)" > "$LEXI_BACKUP/access.netrc"
curl -fsS --netrc-file "$LEXI_BACKUP/access.netrc" --resolve "$LEXI_SERVER_IP:443:127.0.0.1" "https://$LEXI_SERVER_IP/api/health" -o "$LEXI_BACKUP/external-health.json"
trap - ERR
printf '\nLexi deployed: https://%s\nLogin: lexi\nPassword is in your private ACCESS.txt file.\n' "$LEXI_SERVER_IP"
