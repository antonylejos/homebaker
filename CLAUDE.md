# HomeBaker — Project Guide

This file is the single source of truth for Claude Code. Read it fully before making any changes.

> **Maintenance rule**: Whenever a new problem is diagnosed and fixed, add it to [Problems Faced & Fixes Applied](#problems-faced--fixes-applied) before ending the session.

---

## Project Overview

A mobile-first PWA for home bakers to calculate true cake costs, set profit margins, and get exact selling prices. Deployed on **Google Kubernetes Engine (GKE)** via **GitHub Actions** and **Terraform**.

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, Tailwind CSS v4, PWA |
| Backend | Node.js 20 / Express on port 4001 |
| Database | Supabase (hosted PostgreSQL) |
| Container Registry | Google Artifact Registry |
| Orchestration | GKE (Google Kubernetes Engine) |
| IaC | Terraform (`hashicorp/google ~> 6.0`) |
| CI/CD | GitHub Actions with Workload Identity Federation |
| Monitoring | Google Cloud Managed Prometheus + Cloud Logging |
| GitOps | ArgoCD + Helm |

---

## Directory Structure

```
homebaker/
├── .github/workflows/
│   ├── infra.yml          # Terraform only — runs on terraform/** changes
│   ├── deploy.yml         # Build + deploy — runs on services/frontend/k8s changes
│   └── destroy.yml        # Manual destroy — requires typing "destroy" to confirm
│
├── frontend/nextjs-app/   # Next.js PWA app
│   ├── app/page.tsx       # Server component, fetches initial data via BAKER_SERVICE_URL
│   ├── app/ui/baker-dashboard.tsx  # Client component ~1800 lines, all UI logic
│   ├── app/globals.css    # Tailwind v4 + warm baker theme CSS
│   ├── public/manifest.json  # PWA manifest
│   └── Dockerfile
│
├── services/baker-service/
│   ├── server.js          # Express API — ingredients, overheads, recipes, calculator
│   ├── package.json       # Dependencies: express, cors, @supabase/supabase-js, prom-client, dotenv
│   └── Dockerfile
│
├── shared/supabase-client/
│   └── index.js           # Shared Supabase client (reference; baker-service uses inline client)
│
├── infrastructure/
│   ├── kubernetes/        # Raw K8s manifests (also used by deploy.yml via kustomize)
│   │   ├── namespace.yaml
│   │   ├── configmap.yaml
│   │   ├── baker-service.yaml       # replicas: 1, httpGet /health probes
│   │   ├── baker-service-service.yaml
│   │   ├── frontend.yaml            # replicas: 1
│   │   ├── frontend-service.yaml    # type: LoadBalancer
│   │   ├── pod-monitoring.yaml      # GMP PodMonitoring scrapes /metrics every 30s
│   │   └── kustomization.yaml
│   │
│   ├── terraform/
│   │   ├── environments/dev/        # Active dev environment
│   │   ├── environments/staging/    # Staging with scheduled scale-down
│   │   └── modules/
│   │       ├── networking/          # VPC + GKE subnet with secondary ranges
│   │       ├── artifact-registry/   # DOCKER repository (repo_id = "homebaker")
│   │       └── gke/                 # Cluster + node pool + GMP + optional scale-down
│   │
│   ├── argocd/
│   │   ├── application-dev.yaml     # Replace YOUR_GITHUB_USERNAME/YOUR_REPO_NAME
│   │   └── application-staging.yaml
│   │
│   └── scripts/
│       └── bootstrap-gcp-state.ps1  # One-time WIF + SA + bucket setup (Windows)
│
├── helm/homebaker/        # Helm chart used by ArgoCD
│   ├── Chart.yaml
│   ├── values.yaml
│   ├── values-staging.yaml
│   └── templates/
│
└── ansible/playbooks/
    ├── setup-workstation.yml
    ├── configure-kubectl.yml
    ├── bootstrap-supabase.yml     # Creates all DB tables
    ├── healthcheck.yml
    └── rotate-grafana-password.yml
```

---

## GitHub Actions Variables & Secrets

Set in **GitHub → Settings → Secrets and variables → Actions**.

### Variables (non-sensitive)
| Name | Example Value |
|---|---|
| `GCP_PROJECT_ID` | `homebaker-490301` |
| `GCP_REGION` | `us-central1` |
| `TF_STATE_BUCKET` | `homebaker-tfstate-XXXXX` (from bootstrap output) |
| `GCP_SERVICE_ACCOUNT` | `homebaker-cicd@<project>.iam.gserviceaccount.com` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/<num>/locations/global/workloadIdentityPools/github-actions-pool/providers/github-provider` |

### Secrets (sensitive)
| Name | Where to find it |
|---|---|
| `SUPABASE_URL` | supabase.com → project → Settings → API |
| `SUPABASE_KEY` | supabase.com → project → Settings → API (service_role key) |

---

## Deployment — Single Step

After one-time bootstrap, push to `main`. That's it.

### One-Time Bootstrap

```powershell
# Step 1: Bootstrap GCP (creates SA, WIF, GCS bucket, grants IAM roles)
.\infrastructure\scripts\bootstrap-gcp-state.ps1 `
    -ProjectId  "your-gcp-project-id" `
    -GitHubRepo "your-github-username/homebaker"

# Step 2: Set GitHub Actions variables from bootstrap output:
#   GCP_PROJECT_ID, GCP_REGION, TF_STATE_BUCKET,
#   GCP_SERVICE_ACCOUNT, GCP_WORKLOAD_IDENTITY_PROVIDER

# Step 3: Create Supabase project at supabase.com
# Step 4: Add GitHub secrets: SUPABASE_URL, SUPABASE_KEY

# Step 5: Push to main — pipelines run automatically
git push origin main
```

### infra.yml (Terraform)
1. WIF auth to GCP
2. `terraform init` with GCS backend
3. `terraform validate && plan && apply`
4. Creates: VPC, Artifact Registry, GKE cluster, alert policy

### deploy.yml (Build + Deploy)
1. **wait-for-infra**: Resolves correct image tag (SHA)
2. **read-infra**: Reads registry URL + cluster info from TF state (no apply)
3. **security-scan**: Trivy scan on both images (non-blocking, exit-code 0)
4. **build-and-push**: Docker build + push for baker-service and inventory-frontend
5. **deploy**:
   - `gcloud container clusters get-credentials`
   - Create namespace + upsert Supabase secret
   - `sed` replaces `YOUR_ACR_NAME.azurecr.io/...` placeholders
   - Wait for GMP PodMonitoring CRD (60s, non-blocking)
   - `kubectl apply -k infrastructure/kubernetes/`
   - `kubectl rollout status` for both deployments (5 min timeout)
   - On failure: prints pods, events, last 50 log lines
6. **bootstrap-argocd**: Installs/syncs ArgoCD (best-effort, continue-on-error)

---

## How to Access the App

```bash
kubectl get svc -n homebaker
```
Open `http://<EXTERNAL-IP>` from the `homebaker-frontend` LoadBalancer service.

---

## App Features

### Calculator Tab (main screen)
- Select ingredients, enter quantity → auto cost
- Labor: hours + minutes + hourly rate
- Extras: packaging, delivery, decorations (manual fields)
- Profit margin slider 0–80%
- Cost breakdown: Ingredients / Labor / Extras / **Overheads (auto)** / Total / Profit / **Selling Price**
- Insight: "You might be underpricing by ₹XXX" when overheads > 0
- Save as recipe template

### Ingredients Tab
- Add: name, purchase cost (₹), quantity, unit (g/kg/ml/l/pieces/tsp/tbsp/cup)
- Auto-calculates unit_cost = cost/quantity
- Edit + Delete

### Overheads & Settings Tab
- Monthly: electricity, rent, misc
- Equipment: name, cost, useful life → monthly depreciation shown
- Production: cakes per month
- **Overhead per Cake: ₹XX.XX** calculated prominently
- One-time setup → automatically applied in every calculation

### Recipes Tab
- Saved recipe cards with ingredient tag pills
- Load into calculator / Delete
- Empty state with CTA

---

## Supabase Schema

Create tables with Ansible:
```bash
ansible-playbook ansible/playbooks/bootstrap-supabase.yml \
  -e "supabase_url=https://xxx.supabase.co supabase_key=YOUR_SERVICE_ROLE_KEY"
```

| Table | Key columns |
|---|---|
| `ingredients` | id, user_id, name, cost, quantity, unit, unit_cost |
| `recipes` | id, user_id, name, description |
| `recipe_ingredients` | recipe_id, ingredient_id, quantity_used |
| `monthly_overheads` | id, user_id, electricity, rent, misc |
| `equipment` | id, user_id, name, cost, useful_life_months, monthly_cost |
| `production_settings` | id, user_id, cakes_per_month |
| `calculations` | id, user_id, recipe_id, ingredient_cost, labor_cost, extras_cost, overhead_cost, total_cost, profit_margin, selling_price |

---

## Calculation Engine

```
unit_cost           = ingredient.cost / ingredient.quantity
ingredient_cost     = Σ(unit_cost × quantity_used)
labor_cost          = hours × rate
extras_cost         = Σ(extra.cost)
equipment_monthly   = Σ(equipment.cost / equipment.useful_life_months)
overhead_per_cake   = (electricity + rent + misc + equipment_monthly) / cakes_per_month
total_cost          = ingredient_cost + labor_cost + extras_cost + overhead_per_cake
profit_amount       = total_cost × (profit_margin / 100)
selling_price       = total_cost × (1 + profit_margin / 100)
```

API endpoint: `POST /calculate` with body:
```json
{
  "ingredients": [{"ingredient_id": "...", "quantity_used": 250}],
  "labor_hours": 2,
  "labor_rate": 150,
  "extras": [{"name": "Packaging", "cost": 50}],
  "profit_margin": 40,
  "recipe_id": "optional-uuid-to-save"
}
```

---

## UI Design System

Defined in `frontend/nextjs-app/app/globals.css` (Tailwind v4, CSS custom properties).

- Background: warm cream `#fdf6f0` with radial gradients
- Primary accent: rose/pink `#e11d48`
- Secondary: amber `#f59e0b`
- Success: emerald `#059669`
- Panel: semi-transparent `rgba(255, 252, 248, 0.9)` with `backdrop-blur`
- Font: Inter (sans-serif)
- Icons: inline SVGs only — no icon library packages
- Bottom navigation bar on mobile (fixed, above safe area)
- Currency: ₹ formatted with `Intl.NumberFormat('en-IN')`
- Toasts replace `window.alert`/`window.confirm`

---

## Monitoring

- **GMP** — enabled in GKE Terraform module
- **PodMonitoring** — scrapes baker-service `/metrics` every 30s
- **Prometheus metrics** on baker-service: `http_requests_total`, `http_request_duration_seconds`, default Node.js metrics
- **Structured JSON logging** — `{ severity, message, timestamp, ... }` to stdout
- **CrashLoopBackOff alert** — `kubernetes.io/container/restart_count` > 3 (ALIGN_DELTA, 5 min)

---

## Build Notes (Local Development)

- `npm run dev` uses `--webpack` flag explicitly (do not remove)
- `npm run build` may OOM on low-memory machines — use `npx tsc --noEmit` for type checking
- Local frontend: `http://localhost:3000`
- Local baker-service: `http://localhost:4001`
- Set `SUPABASE_URL` and `SUPABASE_KEY` in a local `.env` file

---

## Key Architecture Decisions

### Same GCP stack as inventory-platform
All patterns reused from the reference project — see inline comments in files.

### PWA-ready
- `public/manifest.json` for install prompt
- Mobile-first with bottom nav and `env(safe-area-inset-bottom)`
- `output: "standalone"` in next.config.ts

### No auth (MVP)
User authentication is not implemented in the MVP. All records have `user_id = null`. Add Supabase Auth rows to the tables and JWT middleware to baker-service when needed.

### Image tag substitution
K8s YAML files contain placeholder `YOUR_ACR_NAME.azurecr.io/...`. The `deploy.yml` uses `sed -i` to replace with actual Artifact Registry URL + git SHA.

---

## Problems Faced & Fixes Applied

### Pre-emptive fixes applied at project creation (all learned from inventory-platform)

1. **`npm ci` without lock file** — Changed to `npm install` in both Dockerfiles since `package-lock.json` doesn't exist at project creation time.

2. **CRLF in GitHub Variables** — ALL variable usages in workflow shell commands use `tr -d '[:space:]'`.

3. **`Insufficient cpu` (replicas)** — `replicas: 1` in all K8s manifests and Helm values from day one.

4. **`kubernetes_version` not a valid argument on `google_container_cluster`** — Removed entirely. Omitting `min_master_version` defaults to latest GA. (`kubernetes_version` only exists on `google_container_node_pool`.)

5. **`WORKLOADS` in monitoring_config** — Only `["SYSTEM_COMPONENTS"]` in `monitoring_config`. (`WORKLOADS` is valid in `logging_config`.)

6. **Alert policy 404 (GMP metrics not yet scraped)** — Uses built-in `kubernetes.io/container/restart_count` metric (available as soon as cluster exists).

7. **Alert policy 403** — `roles/monitoring.alertPolicyEditor` granted in bootstrap script from the start.

8. **PodMonitoring CRD not ready at deploy time** — `kubectl wait --for=condition=Established crd/podmonitorings... --timeout=60s || echo "..."` step before `kubectl apply -k`.

9. **Frontend git submodule** — `frontend/nextjs-app/` is a plain directory with no nested `.git`.

10. **WIF org policy blocks SA keys** — WIF exclusively; no JSON key files anywhere.
