module "networking" {
  source     = "../../modules/networking"
  project_id = var.project_id
  region     = var.region
}

module "artifact_registry" {
  source     = "../../modules/artifact-registry"
  project_id = var.project_id
  region     = var.region
  repo_id    = "homebaker-staging"
}

module "gke" {
  source     = "../../modules/gke"
  depends_on = [module.networking]

  project_id          = var.project_id
  region              = var.region
  zone                = "${var.region}-a"
  network             = module.networking.network_name
  subnet              = module.networking.subnet_name
  pods_range_name     = module.networking.pods_range_name
  services_range_name = module.networking.services_range_name

  node_count          = var.node_count
  machine_type        = var.machine_type
  min_node_count      = var.min_node_count
  max_node_count      = var.max_node_count
  autoscaling_enabled = var.autoscaling_enabled

  enable_scheduled_scaledown = var.enable_scheduled_scaledown
  scaledown_schedule         = "0 20 * * 1-5"
  scaleup_schedule           = "0 8 * * 1-5"
}

# CrashLoopBackOff alert — uses built-in GKE metric available from cluster creation.
# Does NOT use prometheus.googleapis.com metrics (those require pods to be running and scraped first).
resource "google_monitoring_alert_policy" "baker_service_restart" {
  display_name = "homebaker-staging baker-service CrashLoopBackOff"
  combiner     = "OR"

  conditions {
    display_name = "baker-service container restart rate (staging)"

    condition_threshold {
      filter = join(" AND ", [
        "resource.type = \"k8s_container\"",
        "resource.labels.cluster_name = \"${module.gke.cluster_name}\"",
        "metric.type = \"kubernetes.io/container/restart_count\"",
        "resource.labels.container_name = \"baker-service\""
      ])

      comparison      = "COMPARISON_GT"
      threshold_value = 3
      duration        = "0s"

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_DELTA"
      }
    }
  }

  notification_channels = []

  alert_strategy {
    auto_close = "1800s"
  }
}
