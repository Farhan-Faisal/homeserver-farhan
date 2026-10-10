#!/usr/bin/env bash
# serverdash installer. Run from the repo folder:  sudo ./install.sh
# Safe to run again: it updates the code and the page, and never touches your config.json.
#
# Where everything goes:
#   /opt/serverdash/lib/serverdash/        the collector (Python package)
#   /usr/local/bin/serverdash-collector    the command that runs it
#   /etc/systemd/system/serverdash-collector.service
#   /etc/serverdash/config.json            your settings and keys (created once, root-only)
#   /opt/serverdash/www/                   the page, plus status.json written every 10 s
#   /var/lib/serverdash/history.json       chart history, survives restarts
#   ~/stacks/serverdash/                   nginx container serving the page on port 8090
set -euo pipefail

if [[ $EUID -ne 0 ]]; then echo "Run with sudo: sudo ./install.sh"; exit 1; fi
cd "$(dirname "$0")"
OWNER="${SUDO_USER:-root}"
STACK="$(getent passwd "$OWNER" | cut -d: -f6)/stacks/serverdash"

echo "==> Tools the probes use"
apt-get install -y -qq lm-sensors smartmontools iw >/dev/null

echo "==> Collector"
rm -rf /opt/serverdash/lib/serverdash
install -d /opt/serverdash/lib /opt/serverdash/www /var/lib/serverdash
cp -r serverdash /opt/serverdash/lib/serverdash
find /opt/serverdash/lib -name __pycache__ -prune -exec rm -rf {} +
install -m 755 deploy/serverdash-collector /usr/local/bin/serverdash-collector

echo "==> Settings"
install -d -m 700 /etc/serverdash
if [[ ! -f /etc/serverdash/config.json ]]; then
  install -m 600 config.example.json /etc/serverdash/config.json
  echo "    created /etc/serverdash/config.json: add your API keys there"
fi

echo "==> Web page"
rm -rf /opt/serverdash/www/css /opt/serverdash/www/js
cp -r web/css web/js web/index.html /opt/serverdash/www/
chmod -R a+rX /opt/serverdash/www

echo "==> Service"
install -m 644 deploy/serverdash-collector.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable serverdash-collector >/dev/null
systemctl restart serverdash-collector

echo "==> Web server (nginx in Docker, port 8090)"
install -d -o "$OWNER" -g "$OWNER" "$STACK"
install -m 644 -o "$OWNER" -g "$OWNER" deploy/docker-compose.yml deploy/nginx.conf "$STACK/"
if [[ ! -f "$STACK/allowed-networks.conf" ]]; then  # yours to edit: never overwritten
  install -m 644 -o "$OWNER" -g "$OWNER" deploy/allowed-networks.conf "$STACK/"
fi
(cd "$STACK" && docker compose up -d && docker compose restart serverdash >/dev/null)

sleep 15
if [[ -s /opt/serverdash/www/status.json ]]; then
  echo "==> Collector is writing data"
else
  echo "!!  No data yet. Check: sudo journalctl -u serverdash-collector -n 30"
fi
echo "Done. Open http://$(hostname):8090 from a network listed in $STACK/allowed-networks.conf"
