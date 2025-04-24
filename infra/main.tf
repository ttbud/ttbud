terraform {
  backend "remote" {
    organization = "ttbud"

    workspaces {
      prefix = "ttbud-"
    }
  }

  required_providers {
    heroku = {
      source  = "heroku/heroku"
      version = "~> 5.0"
    }
    netlify = {
      source  = "ttbud/netlify"
      version = "~> 1.0.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 3.0"
    }
  }
}


locals {
  short_env  = trimprefix(var.TFC_WORKSPACE_NAME, "ttbud-")
  aws_region = "us-east-1"
  is_prod    = local.short_env == "prod"
}

provider "aws" {
  region = local.aws_region
}

provider "heroku" {}

variable "TFC_WORKSPACE_NAME" {
  description = "Name of the environment being deployed"
  type        = string
}

variable "bypass_rate_limit_key" {
  description = "Key that can be used to bypass the backend rate limiter"
  type        = string
  sensitive   = true
}

variable "api_deploy_tarball_url" {
  description = "URL pointing to api tarball to be deployed"
  type        = string
}

variable "web_deploy_tarball_url" {
  description = "URL pointing to web tarball to be deployed"
  type        = string
}

variable "commit_hash" {
  description = "The commit hash of the version being released"
  type        = string
}

module "api_archive_bucket" {
  source    = "./modules/owned-bucket"
  providers = { aws = aws }

  bucket_name = "${local.short_env}.ttbud"
  user_name   = "${local.short_env}-api"
  user_path   = "/ttbud/"
}

module "api" {
  source    = "./modules/api"
  providers = { heroku = heroku }

  app_name                         = var.TFC_WORKSPACE_NAME
  organization                     = "ttbud"
  autoidle                         = !local.is_prod
  redis_plan                       = "mini"
  region                           = "us"
  env_name                         = local.short_env
  deploy_tarball_url               = var.api_deploy_tarball_url
  commit_hash                      = var.commit_hash
  bypass_rate_limit_key            = var.bypass_rate_limit_key
  archive_bucket_aws_region        = local.aws_region
  archive_bucket_access_key_id     = module.api_archive_bucket.access_key_id
  archive_bucket_access_secret_key = module.api_archive_bucket.access_secret_key
  archive_bucket_name              = module.api_archive_bucket.bucket_name
}

resource "netlify_site" "web" {
  name          = var.TFC_WORKSPACE_NAME
  custom_domain = local.is_prod ? "ttbud.app" : null
  source_url    = var.web_deploy_tarball_url
}
