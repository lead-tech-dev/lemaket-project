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

## OVH deployment runbook
- See `deploy/ovh/OVH_DEPLOY_PLAN.md`
- Env template: `deploy/ovh/.env.prod.example`
- Server bootstrap: `deploy/ovh/bootstrap-ubuntu.sh`
- DB backup script: `deploy/ovh/backup-postgres.sh`
