resource "google_container_cluster" "primary" {
  name     = "${var.project_id}-gke"
  location = var.zone

  network    = var.network
  subnetwork = var.subnet

  # Remove the default node pool immediately after creation.
  # The separately managed node pool below is used instead.
  remove_default_node_pool = true
  initial_node_count       = 1

  # Omitting min_master_version lets GKE automatically use the latest GA release.
  # Do NOT set it to a specific version (e.g. "1.30") — LTS versions require explicit opt-in.

  ip_allocation_policy {
    cluster_secondary_range_name  = var.pods_range_name
    services_secondary_range_name = var.services_range_name
  }

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # SYSTEM_COMPONENTS only — "WORKLOADS" is a deprecated/invalid value in the GKE API.
  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS"]
    managed_prometheus {
      enabled = true
    }
  }

  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }

  deletion_protection = false
}

resource "google_container_node_pool" "primary_nodes" {
  name     = "${var.project_id}-node-pool"
  cluster  = google_container_cluster.primary.name
  location = var.zone

  # When autoscaling is enabled, node_count is managed by the autoscaler.
  node_count = var.autoscaling_enabled ? null : var.node_count

  dynamic "autoscaling" {
    for_each = var.autoscaling_enabled ? [1] : []
    content {
      min_node_count = var.min_node_count
      max_node_count = var.max_node_count
    }
  }

  node_config {
    machine_type = var.machine_type

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    workload_metadata_config {
      mode = "GKE_METADATA"
    }
  }
}
