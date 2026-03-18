variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "node_count" {
  description = "Number of nodes in the GKE node pool"
  type        = number
  default     = 1
}

variable "machine_type" {
  description = "Machine type for GKE nodes"
  type        = string
  default     = "e2-medium"
}

variable "min_node_count" {
  description = "Minimum number of nodes when autoscaling is enabled"
  type        = number
  default     = 1
}

variable "max_node_count" {
  description = "Maximum number of nodes when autoscaling is enabled"
  type        = number
  default     = 3
}

variable "autoscaling_enabled" {
  description = "Whether to enable cluster autoscaling"
  type        = bool
  default     = true
}

variable "alert_email" {
  description = "Email address for monitoring alert notifications (optional)"
  type        = string
  default     = ""
}
