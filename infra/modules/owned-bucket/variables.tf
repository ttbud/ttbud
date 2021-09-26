variable "bucket_name" {
  description = "Name of the s3 bucket"
  type        = string
}

variable "user_name" {
  description = "Name of the user to be created with access to the bucket"
  type        = string
}

variable "user_path" {
  description = "IAM User Path"
  type        = string
}
