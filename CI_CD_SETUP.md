# CI/CD Setup

## Workflows
- `ci.yml`: build + tests backend/frontend + docker build + integration flow tests.
- `cd-dev.yml`: build/push images to GHCR, deploy to Kubernetes (`sandaga-dev`) on `develop`.
- `cd-prod.yml`: build/push images to GHCR, deploy to Kubernetes (`sandaga-prod`) on `main`.

## Required GitHub Secrets

### Development
- `DEV_SSH_HOST`
- `DEV_SSH_USER`
- `DEV_SSH_KEY`
- `DEV_VITE_MAPBOX_TOKEN` (optional)

### Production
- `PROD_SSH_HOST`
- `PROD_SSH_USER`
- `PROD_SSH_KEY`
- `PROD_VITE_MAPBOX_TOKEN` (optional)

## Required GitHub Variables

### Development
- `DEV_VITE_API_URL` (frontend build arg, default `https://api-dev.lemaket.com`)
- `DEV_K8S_NAMESPACE` (default `sandaga-dev`)
- `DEV_K8S_BACKEND_NODEPORT` (default `32001`)

Note: development smoke tests in CI run on the VPS itself via SSH
(`http://localhost:${DEV_K8S_BACKEND_NODEPORT}`), so DNS for a public dev domain is not required.

### Production
- `PROD_VITE_API_URL` (frontend build arg, default `https://api.lemaket.com`)
- `PROD_K8S_NAMESPACE` (default `sandaga-prod`)
- `PROD_K8S_BACKEND_NODEPORT` (default `32100`)

Note: production smoke tests in CI run on the VPS itself via SSH
(`http://localhost:${PROD_K8S_BACKEND_NODEPORT}`), so DNS propagation does not block deploy validation.

## Remote server prerequisites
- k3s/Kubernetes installed and `kubectl` available for SSH user.
- Namespaces exist (or let scripts create them):
  - `sandaga-dev`
  - `sandaga-prod`
- Secret present in each namespace:
  - `sandaga-dev-env` in `sandaga-dev`
  - `sandaga-prod-env` in `sandaga-prod`
- Existing PostgreSQL/MinIO services reachable from app pods.
- NodePorts open locally on VPS:
  - dev: backend `32001`, frontend `32081`
  - prod: backend `32100`, frontend `32180`

## Kubernetes manifests
- Development app manifest: `deploy/k8s/dev/apps.yaml`
- Production app manifest: `deploy/k8s/prod/apps.yaml`
- Deploy scripts:
  - `scripts/deploy-k8s-dev.sh`
  - `scripts/deploy-k8s-prod.sh`

## GitHub Environments
- `development`
- `production` (recommended: required reviewers before deploy)

## Local smoke command
```bash
bash ./scripts/smoke.sh http://localhost:3000
```

## Data Sync Helper
- Script: `scripts/k8s-data-sync.sh`
- Run on VPS (or any host with kubectl access to this cluster).
- Modes:
  - `subset`: sync from dev to prod only these tables:
    - `categories`
    - admin users (`users` where `role='admin'`)
    - `form_steps`
    - `form_fields`
  - `all`: restore full dump into dev, then run `subset`

Examples:
```bash
bash ./scripts/k8s-data-sync.sh --mode subset
```

```bash
bash ./scripts/k8s-data-sync.sh --mode all --dev-dump /path/sandaga-full.dump
```

## Monitoring Helper
- Script: `scripts/k8s-monitor.sh`
- Checks:
  - `https://api-dev.lemaket.com/health`
  - `https://api.lemaket.com/health`
  - backend pod state in `sandaga-dev` and `sandaga-prod`
  - backend error-like logs (`--since=15m`)
  - disk usage on `/`
- Exit code:
  - `0` when no critical issue
  - `1` when at least one failure is detected
- Optional webhook alert:
  - set `ALERT_WEBHOOK_URL` (Slack/Discord compatible payload)
  - set `ALERT_ON_WARN=true` to notify warnings too

Run manually:
```bash
bash ./scripts/k8s-monitor.sh
```

Recommended cron (every 5 minutes):
```bash
mkdir -p /home/deploy/ops
cp scripts/k8s-monitor.sh /home/deploy/ops/k8s-monitor.sh
chmod +x /home/deploy/ops/k8s-monitor.sh
```

```bash
cat >/home/deploy/ops/monitor.env <<'EOF'
ALERT_WEBHOOK_URL=
ALERT_ON_WARN=false
DISK_WARN_PERCENT=85
DISK_CRIT_PERCENT=95
LOG_SINCE=15m
EOF
```

```bash
(crontab -l 2>/dev/null; echo "*/5 * * * * . /home/deploy/ops/monitor.env; /home/deploy/ops/k8s-monitor.sh >> /home/deploy/ops/monitor.log 2>&1") | crontab -
```

## Pro Monitoring Stack (Prometheus + Grafana + Loki + Alertmanager)
- Install script: `scripts/install-k8s-monitoring.sh`
- Optional alert webhook script: `scripts/configure-k8s-alert-webhook.sh`
- Kubernetes resources:
  - `deploy/k8s/monitoring/values-kube-prometheus-stack.yaml`
  - `deploy/k8s/monitoring/values-blackbox.yaml`
  - `deploy/k8s/monitoring/values-loki.yaml`
  - `deploy/k8s/monitoring/values-promtail.yaml`
  - `deploy/k8s/monitoring/probes.yaml`
  - `deploy/k8s/monitoring/service-monitors.yaml`
  - `deploy/k8s/monitoring/rules.yaml`
  - `deploy/k8s/monitoring/grafana-dashboard-sandaga-overview.yaml`
  - `deploy/k8s/monitoring/grafana-dashboard-sandaga-api-slo.yaml`
  - `deploy/k8s/monitoring/alertmanager-config.yaml`

Install:
```bash
chmod +x scripts/install-k8s-monitoring.sh
bash ./scripts/install-k8s-monitoring.sh
```

Optional webhook alerts:
```bash
chmod +x scripts/configure-k8s-alert-webhook.sh
ALERT_WEBHOOK_URL="https://<your-webhook>" bash ./scripts/configure-k8s-alert-webhook.sh
```

Quick checks:
```bash
sudo -n k3s kubectl -n monitoring get pods
sudo -n k3s kubectl -n monitoring get svc
```

Manual apply for new SLO metrics pipeline:
```bash
sudo -n k3s kubectl apply -f deploy/k8s/monitoring/service-monitors.yaml
sudo -n k3s kubectl apply -f deploy/k8s/monitoring/rules.yaml
sudo -n k3s kubectl apply -f deploy/k8s/monitoring/grafana-dashboard-sandaga-api-slo.yaml
```

Grafana integration:
- Go to `Alerting -> Alert rules` to see rule groups:
  - `sandaga.http`
  - `sandaga.k8s`
  - `sandaga.node`
- Go to `Dashboards` and open:
  - `Sandaga Overview`
  - `Sandaga API SLO`

Default NodePorts:
- Grafana: `32300`
- Prometheus: `32301`
- Alertmanager: `32303`

## OVH deployment runbook
- See `deploy/ovh/OVH_DEPLOY_PLAN.md`
- Env template: `deploy/ovh/.env.prod.example`
- Server bootstrap: `deploy/ovh/bootstrap-ubuntu.sh`
- DB backup script: `deploy/ovh/backup-postgres.sh`
