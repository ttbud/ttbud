terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 3.0"
    }
  }
}

resource "aws_iam_user" "bucket_owner" {
  name = var.user_name
  path = var.user_path
}

resource "aws_iam_access_key" "bucket_owner" {
  user = aws_iam_user.bucket_owner.name
}

resource "aws_s3_bucket" "owned_bucket" {
  bucket = var.bucket_name
}

data "aws_iam_policy_document" "owned_bucket" {
  statement {
    principals {
      identifiers = [aws_iam_user.bucket_owner.arn]
      type        = "AWS"
    }
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.owned_bucket.arn]
    effect    = "Allow"
  }
  statement {
    principals {
      identifiers = [aws_iam_user.bucket_owner.arn]
      type        = "AWS"
    }
    actions = [
      "s3:DeleteObject",
      "s3:GetObject",
      "s3:PutObject"
    ]
    resources = ["${aws_s3_bucket.owned_bucket.arn}/*"]
    effect    = "Allow"
  }
}

resource "aws_s3_bucket_policy" "owned_bucket" {
  bucket = aws_s3_bucket.owned_bucket.bucket
  policy = data.aws_iam_policy_document.owned_bucket.json
}

resource "aws_s3_bucket_public_access_block" "owned_bucket" {
  bucket                  = aws_s3_bucket.owned_bucket.id
  ignore_public_acls      = true
  restrict_public_buckets = true
  block_public_acls       = true
  block_public_policy     = true
}
