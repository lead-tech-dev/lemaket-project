# OVH VPS Deployment Plan (J1 / J2 / J3)

This runbook is for:
- `sandaga-backend` (NestJS)
- `sandaga-frontend` (Vite static via nginx container)
- `docker-compose.deploy.yml`

Assumptions:
- VPS Ubuntu 22.04
- Domain names:
  - `app.example.com` (frontend)
  - `api.example.com` (backend)

## J1 - VPS bootstrap and security

### 1) Connect to VPS as root
```bash
ssh root@<VPS_IP>
```

### 2) Bootstrap server
```bash
mkdir -p /root/sandaga
cd /root/sandaga
# copy deploy/ovh/bootstrap-ubuntu.sh here, then:
sudo bash bootstrap-ubuntu.sh
```

### 3) Add your SSH key to deploy user
```bash
mkdir -p /home/deploy/.ssh
echo "<YOUR_PUBLIC_KEY>" >> /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

### 4) Reconnect as deploy
```bash
ssh deploy@<VPS_IP>
docker --version
docker compose version
```

## J2 - Application deployment (without TLS first)

### 1) Prepare app directory
```bash
sudo mkdir -p /opt/sandaga
sudo chown -R deploy:deploy /opt/sandaga
cd /opt/sandaga
```

### 2) Copy deployment files to VPS
Copy these files from your repo into `/opt/sandaga`:
- `docker-compose.deploy.yml`
- `deploy/ovh/.env.prod.example` (rename to `.env`)

Then:
```bash
cp .env.prod.example .env
```

### 3) Edit `.env` for first deploy
Set at minimum:
- `JWT_SECRET`
- `DATABASE_PASSWORD`
- `APP_PUBLIC_URL`
- `API_PUBLIC_URL`
- `FRONTEND_URL`

Important for reverse proxy later:
- `FRONTEND_PORT=8080`
- `BACKEND_PORT=3000`

### 4) Build images locally on VPS (first bootstrap path)
If you are not yet using GHCR images:
```bash
cd /opt/sandaga
git clone <YOUR_REPO_URL> src
cd src
docker build -t sandaga-backend:prod ./sandaga-backend
docker build -t sandaga-frontend:prod ./sandaga-frontend \
  --build-arg VITE_API_URL=https://api.example.com \
  --build-arg MAPBOX_PUBLIC_KEY="<MAPBOX_TOKEN>"
```

Update `/opt/sandaga/.env`:
```bash
BACKEND_IMAGE=sandaga-backend:prod
FRONTEND_IMAGE=sandaga-frontend:prod
```

### 5) Start stack
```bash
cd /opt/sandaga
docker compose -f docker-compose.deploy.yml up -d
docker compose -f docker-compose.deploy.yml ps
curl -fsS http://localhost:3000/health
```

## J3 - Domain + HTTPS + backups + operations

### 1) DNS (OVH)
Create A records:
- `app.example.com` -> `<VPS_IP>`
- `api.example.com` -> `<VPS_IP>`

### 2) Install Caddy (reverse proxy + auto TLS)
```bash
sudo apt-get update
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update
sudo apt-get install -y caddy
```

### 3) Configure Caddy
```bash
sudo tee /etc/caddy/Caddyfile >/dev/null <<'EOF'
app.example.com {
  reverse_proxy 127.0.0.1:8080
}

api.example.com {
  reverse_proxy 127.0.0.1:3000
}
EOF
sudo systemctl reload caddy
```

### 4) Smoke tests
```bash
curl -I https://app.example.com
curl -fsS https://api.example.com/health
```

### 5) Setup daily DB backups
Copy `deploy/ovh/backup-postgres.sh` to VPS and run:
```bash
chmod +x /opt/sandaga/backup-postgres.sh
/opt/sandaga/backup-postgres.sh
```

Add cron:
```bash
(crontab -l 2>/dev/null; echo "0 3 * * * APP_DIR=/opt/sandaga /opt/sandaga/backup-postgres.sh >> /var/log/sandaga-backup.log 2>&1") | crontab -
```

## CI/CD after manual bootstrap

Once stable, switch to image deployment from GHCR:
- Keep using `docker-compose.deploy.yml`
- Set in `.env`:
  - `BACKEND_IMAGE=ghcr.io/<owner>/sandaga-backend:<tag>`
  - `FRONTEND_IMAGE=ghcr.io/<owner>/sandaga-frontend:<tag>`
- Use existing scripts:
  - `scripts/deploy-dev.sh`
  - `scripts/deploy-prod.sh`

## Rollback (quick)
```bash
cd /opt/sandaga
# set previous image tags in .env
docker compose -f docker-compose.deploy.yml pull backend frontend
docker compose -f docker-compose.deploy.yml up -d backend frontend
```
