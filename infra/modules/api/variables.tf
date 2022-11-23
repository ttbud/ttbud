variable "app_name" {
  description = "Name of the app"
  type        = string
}

variable "organization" {
  description = "Heroku organization to deploy the app under"
  type        = string
}

variable "autoidle" {
  description = "Use the autoidle heroku addon to automatically spin up/down the api based on usage"
  type        = bool
}

variable "redis_plan" {
  description = "Heroku redis plan to use"
  type        = string
}

variable "env_name" {
  description = "App environment name"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.env_name)
    error_message = "Environment name must be one of: \"dev\", \"staging\", \"prod\"."
  }
}

variable "region" {
  description = "Heroku Region to deploy the app in"
  type        = string
}

variable "archive_bucket_aws_region" {
  description = "AWS Region the archive bucket lives in"
  type        = string
}

variable "archive_bucket_name" {
  description = "The name of the bucket to store archived rooms in"
  type        = string
}

variable "archive_bucket_access_key_id" {
  description = "Key ID for access to the archive bucket"
  type        = string
}

variable "archive_bucket_access_secret_key" {
  description = "Secret key for access to the archive bucket"
  type        = string
  sensitive   = true
}

variable "bypass_rate_limit_key" {
  description = "Key used for the load tester to bypass the rate-limiter"
  type        = string
  sensitive   = true
}

variable "deploy_tarball_url" {
  description = "URL pointing to a tarball of the source to deploy"
  type        = string
}

variable "commit_hash" {
  description = "Commit hash of the source being deployed"
  type        = string
}
