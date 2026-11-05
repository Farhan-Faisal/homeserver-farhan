#!/usr/bin/env bash
# Installs or updates the collector only. Run:  sudo bash collector/install.sh
# Safe to run again: it replaces the code, and never touches your config.json or the database.
#
# Where everything goes:
#   /opt/serverdash/lib/collector/            the Python package
#   /usr/local/bin/serverdash-collector       the command that runs it
#   /etc/systemd/system/serverdash-collector.service
#   /etc/serverdash/config.json               your settings and keys (created once, root-only)
#   /var/lib/serverdash/serverdash.db         the database it writes (path set in config.json)
set -euo pipefail

if [[ $EUID -ne 0 ]]; then echo "Run with sudo: sudo bash $0"; exit 1; fi
cd "$(dirname "$0")"  # the collector folder, wherever this was run from

echo "==> Tools the probes use, and sqlite3 for looking inside the database"
apt-get install -y -qq lm-sensors smartmontools iw sqlite3 >/dev/null

echo "==> Code"
rm -rf /opt/serverdash/lib/collector /opt/serverdash/lib/serverdash  # this version, and the old name
install -d /opt/serverdash/lib/collector /var/lib/serverdash
cp ./*.py /opt/serverdash/lib/collector/              # only the Python: not deploy/, this script or the README
cp -r probes utils /opt/serverdash/lib/collector/
find /opt/serverdash/lib -name __pycache__ -prune -exec rm -rf {} +
install -m 755 deploy/serverdash-collector /usr/local/bin/serverdash-collector

echo "==> Settings"
install -d -m 700 /etc/serverdash
if [[ ! -f /etc/serverdash/config.json ]]; then
  install -m 600 config.example.json /etc/serverdash/config.json
  echo "    created /etc/serverdash/config.json: add your API keys there"
fi

echo "==> Service"
install -m 644 deploy/serverdash-collector.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable serverdash-collector >/dev/null
systemctl restart serverdash-collector

sleep 15
if systemctl is-active --quiet serverdash-collector; then
  echo "==> Collector is running. Check the data with:  sudo serverdash-collector --once | head"
else
  echo "!!  Collector isn't running. See why:  sudo journalctl -u serverdash-collector -n 30"
fi
