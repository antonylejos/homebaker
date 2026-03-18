variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "zone" {
  description = "GCP zone for the zonal GKE cluster"
  type        = string
  default     = "us-central1-a"
}

variable "network" {
  description = "Self-link of the VPC network"
  type        = string
}

variable "subnet" {
  description = "Self-link of the GKE subnet"
  type        = string
}

variable "pods_range_name" {
  description = "Name of the secondary IP range for pods"
  type        = string
}

variable "services_range_name" {
  description = "Name of the secondary IP range for services"
  type        = string
}

variable "node_count" {
  description = "Number of nodes (used when autoscaling is disabled)"
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
  description = "Whether to enable cluster autoscaling on the node pool"
  type        = bool
  default     = true
}

variable "enable_scheduled_scaledown" {
  description = "Whether to create Cloud Scheduler jobs for weekday scale-down/scale-up"
  type        = bool
  default     = false
}

variable "scaledown_schedule" {
  description = "Cron schedule for scaling the cluster down (default: 8pm weekdays)"
  type        = string
  default     = "0 20 * * 1-5"
}

variable "scaleup_schedule" {
  description = "Cron schedule for scaling the cluster back up (default: 8am weekdays)"
  type        = string
  default     = "0 8 * * 1-5"
}
