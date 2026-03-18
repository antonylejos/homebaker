# Scheduled scale-down/scale-up jobs for cost savings in non-production environments.
# Enabled only when var.enable_scheduled_scaledown = true (set in staging, not dev).
#
# The jobs call the GKE API to update the node pool autoscaling bounds:
#   - Scale-down: sets min/max to 0 (drains all nodes at 8pm weekdays)
#   - Scale-up:   restores min/max to original values (at 8am weekdays)
#
# Requires the CI/CD SA to have roles/cloudscheduler.admin and roles/container.admin.

locals {
  node_pool_resource = "projects/${var.project_id}/locations/${var.zone}/clusters/${var.project_id}-gke/nodePools/${var.project_id}-node-pool"
}

resource "google_cloud_scheduler_job" "scale_down" {
  count    = var.enable_scheduled_scaledown ? 1 : 0
  name     = "${var.project_id}-gke-scale-down"
  schedule = var.scaledown_schedule
  region   = var.region

  description = "Scale GKE node pool to 0 nodes at end of business day (weekdays)"

  http_target {
    uri         = "https://container.googleapis.com/v1/${local.node_pool_resource}"
    http_method = "PUT"

    body = base64encode(jsonencode({
      update = {
        desiredNodePoolAutoscaling = {
          enabled      = true
          minNodeCount = 0
          maxNodeCount = 0
        }
      }
    }))

    headers = {
      "Content-Type" = "application/json"
    }

    oauth_token {
      service_account_email = "homebaker-cicd@${var.project_id}.iam.gserviceaccount.com"
    }
  }
}

resource "google_cloud_scheduler_job" "scale_up" {
  count    = var.enable_scheduled_scaledown ? 1 : 0
  name     = "${var.project_id}-gke-scale-up"
  schedule = var.scaleup_schedule
  region   = var.region

  description = "Restore GKE node pool autoscaling at start of business day (weekdays)"

  http_target {
    uri         = "https://container.googleapis.com/v1/${local.node_pool_resource}"
    http_method = "PUT"

    body = base64encode(jsonencode({
      update = {
        desiredNodePoolAutoscaling = {
          enabled      = true
          minNodeCount = var.min_node_count
          maxNodeCount = var.max_node_count
        }
      }
    }))

    headers = {
      "Content-Type" = "application/json"
    }

    oauth_token {
      service_account_email = "homebaker-cicd@${var.project_id}.iam.gserviceaccount.com"
    }
  }
}
