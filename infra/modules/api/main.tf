terraform {
  required_providers {
    heroku = {
      source  = "heroku/heroku"
      version = "~> 4.0"
    }
  }
}

resource "heroku_app" "api" {
  name   = var.app_name
  region = "us"
  organization {
    name = var.organization
  }
  stack = "container"
  config_vars = {
    ENVIRONMENT = var.env_name
    AWS_BUCKET  = var.archive_bucket_name
    AWS_KEY_ID  = var.archive_bucket_access_key_id
    AWS_REGION  = var.archive_bucket_aws_region
    JSON_LOGS   = "true"
    # Heroku redis doesn't use valid certs :(
    REDIS_SSL_VALIDATION = "self_signed"
    LOG_LEVEL            = "INFO"
    SCOUT_MONITOR        = "true"
    SCOUT_LOG_LEVEL      = "WARN"
  }
  sensitive_config_vars = {
    BYPASS_RATE_LIMIT_KEY = var.bypass_rate_limit_key
    AWS_SECRET_KEY        = var.archive_bucket_access_secret_key
  }
  lifecycle {
    # Heroku adds extra config variables so that the app can access redis, scout, etc...
    # Those changes shouldn't be detected as drift
    ignore_changes = [all_config_vars]
  }
}

resource "heroku_build" "api" {
  app = heroku_app.api.name

  source {
    url     = var.deploy_tarball_url
    version = var.commit_hash
  }
  lifecycle {
    # The output_stream_url is time-dependent, and therefore changes every execution
    ignore_changes = [output_stream_url]
  }
}

resource "heroku_formation" "api" {
  app      = heroku_app.api.name
  quantity = 1
  size     = var.dyno_size
  type     = "web"

  depends_on = [heroku_build.api]
}

resource "heroku_addon" "scout" {
  app  = heroku_app.api.name
  plan = "scout:chair"
}

resource "heroku_addon" "sumologic" {
  app  = heroku_app.api.name
  plan = "sumologic:free"
}

resource "heroku_addon" "redis" {
  app  = heroku_app.api.name
  plan = "heroku-redis:${var.redis_plan}"
}

resource "heroku_addon" "autoidle" {
  count = 0
  app   = heroku_app.api.name
  plan  = "autoidle:hobby"
}
