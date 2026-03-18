<#
.SYNOPSIS
    One-time bootstrap for the homebaker GCP project.
    Creates the GCS state bucket, CI/CD service account, Workload Identity Federation
    pool/provider, and all required IAM bindings.

.DESCRIPTION
    Safe to re-run (idempotent). Each gcloud command is wrapped so that
    "already exists" errors are suppressed.

    Prerequisites:
      - gcloud CLI installed and authenticated: gcloud auth login
      - Logged in as project owner or an account with resourcemanager.projects.setIamPolicy

.PARAMETER ProjectId
    GCP project ID (e.g. "homebaker-490301")

.PARAMETER GitHubRepo
    GitHub repository in "owner/repo" format (e.g. "alice/homebaker")

.EXAMPLE
    .\infrastructure\scripts\bootstrap-gcp-state.ps1 `
        -ProjectId  "homebaker-490301" `
        -GitHubRepo "alice/homebaker"
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [Parameter(Mandatory = $true)]
    [string]$GitHubRepo
)

# Normalize GitHubRepo: strip https://github.com/ prefix and .git suffix
# Accepts "owner/repo", "https://github.com/owner/repo", or "https://github.com/owner/repo.git"
$GitHubRepo = $GitHubRepo -replace '^https?://github\.com/', '' -replace '\.git$', ''
if ($GitHubRepo -notmatch '^[^/]+/[^/]+$') {
    Write-Error "GitHubRepo must be in 'owner/repo' format. Got: $GitHubRepo"
    exit 1
}
Write-Host "Using GitHub repo: $GitHubRepo" -ForegroundColor Cyan

Set-StrictMode -Version Latest
# Use Continue so gcloud stderr output (even on success) does not abort the script.
# We check $LASTEXITCODE manually for real failures.
$ErrorActionPreference = "Continue"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Invoke-GcloudIdempotent {
    param([string[]]$GcloudArgs)

    $cmd = "gcloud " + ($GcloudArgs -join " ")
    Write-Host "    $cmd" -ForegroundColor DarkGray

    # Redirect stderr to stdout so gcloud progress messages don't trip PowerShell.
    $output = & gcloud @GcloudArgs 2>&1
    $exitCode = $LASTEXITCODE

    if ($exitCode -ne 0) {
        $outputStr = ($output | Out-String)
        if ($outputStr -match "already exists" -or $outputStr -match "ALREADY_EXISTS") {
            Write-Host "    (already exists - skipping)" -ForegroundColor Yellow
        } else {
            Write-Host "    ERROR (exit $exitCode): $outputStr" -ForegroundColor Red
            throw "gcloud command failed: $cmd"
        }
    } else {
        Write-Host "    OK" -ForegroundColor DarkGray
    }
}

# ---------------------------------------------------------------------------
# Derived values
# ---------------------------------------------------------------------------

$BucketName      = "${ProjectId}-tfstate-homebaker"
$SaName          = "homebaker-cicd"
$SaEmail         = "${SaName}@${ProjectId}.iam.gserviceaccount.com"
$WifPoolId       = "github-actions-pool"
$WifProviderId   = "github-provider"

# Roles required by the CI/CD service account
$Roles = @(
    "roles/container.admin",
    "roles/storage.admin",
    "roles/artifactregistry.admin",
    "roles/iam.serviceAccountAdmin",
    "roles/iam.workloadIdentityPoolAdmin",
    "roles/monitoring.alertPolicyEditor",
    "roles/compute.networkAdmin",
    "roles/logging.admin",
    "roles/cloudscheduler.admin",
    "roles/iam.serviceAccountUser"
)

# ---------------------------------------------------------------------------
# Step 1 - Enable required APIs
# ---------------------------------------------------------------------------

Write-Step "Enabling required GCP APIs"

$Apis = @(
    "container.googleapis.com",
    "artifactregistry.googleapis.com",
    "storage.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "cloudscheduler.googleapis.com",
    "compute.googleapis.com"
)

foreach ($api in $Apis) {
    Invoke-GcloudIdempotent @("services", "enable", $api, "--project=$ProjectId")
}

# ---------------------------------------------------------------------------
# Step 2 - Create GCS bucket for Terraform state
# ---------------------------------------------------------------------------

Write-Step "Creating GCS bucket for Terraform state: gs://$BucketName"

Invoke-GcloudIdempotent @(
    "storage", "buckets", "create",
    "gs://$BucketName",
    "--project=$ProjectId",
    "--location=us-central1",
    "--uniform-bucket-level-access"
)

# Enable versioning so Terraform state history is preserved
Write-Host "    Enabling versioning on gs://$BucketName" -ForegroundColor DarkGray
& gcloud storage buckets update "gs://$BucketName" --versioning 2>&1 | Out-Null

# ---------------------------------------------------------------------------
# Step 3 - Create CI/CD service account
# ---------------------------------------------------------------------------

Write-Step "Creating CI/CD service account: $SaEmail"

Invoke-GcloudIdempotent @(
    "iam", "service-accounts", "create", $SaName,
    "--display-name=Homebaker CI/CD Service Account",
    "--project=$ProjectId"
)

# ---------------------------------------------------------------------------
# Step 4 - Grant IAM roles to the service account
# ---------------------------------------------------------------------------

Write-Step "Granting IAM roles to $SaEmail"

foreach ($role in $Roles) {
    Write-Host "    Binding $role" -ForegroundColor DarkGray
    Invoke-GcloudIdempotent @(
        "projects", "add-iam-policy-binding", $ProjectId,
        "--member=serviceAccount:$SaEmail",
        "--role=$role",
        "--condition=None"
    )
}

# ---------------------------------------------------------------------------
# Step 5 - Create Workload Identity Federation pool
# ---------------------------------------------------------------------------

Write-Step "Creating Workload Identity Federation pool: $WifPoolId"

Invoke-GcloudIdempotent @(
    "iam", "workload-identity-pools", "create", $WifPoolId,
    "--location=global",
    "--display-name=GitHub Actions Pool",
    "--description=Allows GitHub Actions to authenticate to GCP without SA keys",
    "--project=$ProjectId"
)

# ---------------------------------------------------------------------------
# Step 6 - Create WIF OIDC provider for GitHub
# ---------------------------------------------------------------------------

Write-Step "Creating WIF OIDC provider: $WifProviderId"

Invoke-GcloudIdempotent @(
    "iam", "workload-identity-pools", "providers", "create-oidc", $WifProviderId,
    "--workload-identity-pool=$WifPoolId",
    "--location=global",
    "--issuer-uri=https://token.actions.githubusercontent.com",
    "--attribute-mapping=google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.actor=assertion.actor,attribute.ref=assertion.ref",
    "--attribute-condition=assertion.repository=='$GitHubRepo'",
    "--project=$ProjectId"
)

# ---------------------------------------------------------------------------
# Step 7 - Bind WIF pool to service account for the specific GitHub repo
# ---------------------------------------------------------------------------

Write-Step "Binding WIF pool to $SaEmail for repo: $GitHubRepo"

$ProjectNumber = & gcloud projects describe $ProjectId --format="value(projectNumber)"
$WifMember = "principalSet://iam.googleapis.com/projects/${ProjectNumber}/locations/global/workloadIdentityPools/${WifPoolId}/attribute.repository/${GitHubRepo}"

Invoke-GcloudIdempotent @(
    "iam", "service-accounts", "add-iam-policy-binding", $SaEmail,
    "--role=roles/iam.workloadIdentityUser",
    "--member=$WifMember",
    "--project=$ProjectId"
)

# ---------------------------------------------------------------------------
# Step 8 - Retrieve WIF provider resource name for GitHub Actions config
# ---------------------------------------------------------------------------

Write-Step "Fetching WIF provider resource name"

$WifProviderResource = "projects/${ProjectNumber}/locations/global/workloadIdentityPools/${WifPoolId}/providers/${WifProviderId}"

# ---------------------------------------------------------------------------
# Output summary
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " Bootstrap complete! Add these to GitHub Actions:" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host " Settings > Secrets and variables > Actions > Variables:" -ForegroundColor White
Write-Host ""
Write-Host "  GCP_PROJECT_ID                 = $ProjectId" -ForegroundColor Yellow
Write-Host "  GCP_REGION                     = us-central1" -ForegroundColor Yellow
Write-Host "  TF_STATE_BUCKET                = $BucketName" -ForegroundColor Yellow
Write-Host "  GCP_SERVICE_ACCOUNT            = $SaEmail" -ForegroundColor Yellow
Write-Host "  GCP_WORKLOAD_IDENTITY_PROVIDER = $WifProviderResource" -ForegroundColor Yellow
Write-Host ""
Write-Host " Settings > Secrets and variables > Actions > Secrets:" -ForegroundColor White
Write-Host ""
Write-Host "  SUPABASE_URL  = (from supabase.com project Settings > API)" -ForegroundColor Yellow
Write-Host "  SUPABASE_KEY  = (service_role key - keep this secret!)" -ForegroundColor Yellow
Write-Host ""
Write-Host " terraform.tfvars - update YOUR_PROJECT_ID to: $ProjectId" -ForegroundColor White
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
