resource "google_artifact_registry_repository" "repo" {
  location      = var.region
  repository_id = var.repo_id
  format        = "DOCKER"
}
