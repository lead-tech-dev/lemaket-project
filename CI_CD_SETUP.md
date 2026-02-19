# CI/CD Setup

## Workflows
- `ci.yml`: build + tests backend/frontend + docker build + integration flow tests.
- `cd-dev.yml`: build/push images to GHCR, deploy to development server on `develop`.
- `cd-prod.yml`: build/push images to GHCR, deploy to production server on `main`.

## Required GitHub Secrets

### Development
- `DEV_SSH_HOST`
- `DEV_SSH_USER`
- `DEV_SSH_KEY`
- `DEV_ENV_FILE` (optional, full remote `.env` content to auto-provision on deploy)
- `DEV_VITE_MAPBOX_TOKEN` (optional)

If `DEV_ENV_FILE` is not set and remote `.env` is missing, `deploy-dev.sh` bootstraps
an initial `.env` from `deploy/ovh/.env.prod.example` and generates a random
`JWT_SECRET`. You should review and update that file on the server after first deploy.

### Production
- `PROD_SSH_HOST`
- `PROD_SSH_USER`
- `PROD_SSH_KEY`
- `PROD_VITE_MAPBOX_TOKEN` (optional)

## Required GitHub Variables

### Development
- `DEV_APP_DIR` (default `/opt/sandaga-dev`)
- `DEV_API_BASE_URL` (for smoke tests)
- `DEV_VITE_API_URL` (frontend build arg)

### Production
- `PROD_APP_DIR` (default `/opt/sandaga`)
- `PROD_API_BASE_URL` (for smoke tests)
- `PROD_VITE_API_URL` (frontend build arg)

## Remote server prerequisites
- Docker + Docker Compose installed.
- A `.env` file present in `${DEV_APP_DIR}` / `${PROD_APP_DIR}` with app secrets:
  - DB credentials
  - `JWT_SECRET`
  - storage settings
  - payment settings
  - optional `PLATFORM_WALLET_USER_ID`
- Open ports:
  - API: `3000` (or `BACKEND_PORT`)
  - Frontend: `80` (or `FRONTEND_PORT`)

## Deploy compose file
- `docker-compose.deploy.yml` is copied by deploy scripts to remote target dir.
- Images are injected with:
  - `BACKEND_IMAGE`
  - `FRONTEND_IMAGE`

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
