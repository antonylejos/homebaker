output "registry_url" {
  description = "Base URL for pushing/pulling Docker images"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${var.repo_id}"
}
