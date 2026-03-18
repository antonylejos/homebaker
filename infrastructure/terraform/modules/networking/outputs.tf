output "network_name" {
  description = "Self-link of the VPC network"
  value       = google_compute_network.vpc.self_link
}

output "subnet_name" {
  description = "Self-link of the GKE subnet"
  value       = google_compute_subnetwork.gke_subnet.self_link
}

output "pods_range_name" {
  description = "Name of the secondary range used for pods"
  value       = "pods"
}

output "services_range_name" {
  description = "Name of the secondary range used for services"
  value       = "services"
}
