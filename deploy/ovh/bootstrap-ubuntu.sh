#!/usr/bin/env bash

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/ovh/bootstrap-ubuntu.sh" >&2
  exit 1
fi

DEPLOY_USER="${DEPLOY_USER:-deploy}"
DEPLOY_GROUP="${DEPLOY_GROUP:-deploy}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/sandaga}"

apt-get update
apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg lsb-release ufw fail2ban git jq

if ! id -u "${DEPLOY_USER}" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "${DEPLOY_USER}"
fi
usermod -aG sudo "${DEPLOY_USER}"

install -m 0755 -d /etc/apt/keyrings
if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
fi

cat >/etc/apt/sources.list.d/docker.list <<EOF
deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable
EOF

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
usermod -aG docker "${DEPLOY_USER}"

mkdir -p "${DEPLOY_DIR}"
chown -R "${DEPLOY_USER}:${DEPLOY_GROUP}" "${DEPLOY_DIR}"

ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw --force enable

systemctl enable docker
systemctl restart docker
systemctl enable fail2ban
systemctl restart fail2ban

echo "Bootstrap completed."
echo "Next: reconnect as ${DEPLOY_USER} and deploy from ${DEPLOY_DIR}"
