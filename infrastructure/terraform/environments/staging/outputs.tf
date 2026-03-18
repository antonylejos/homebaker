output "registry_url" {
  value = module.artifact_registry.registry_url
}

output "cluster_name" {
  value = module.gke.cluster_name
}

output "cluster_zone" {
  value = module.gke.cluster_zone
}

output "cluster_region" {
  value = var.region
}
