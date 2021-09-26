output "bucket_name" {
  description = "Name of the created bucket"
  value       = aws_s3_bucket.owned_bucket.bucket
}

output "access_key_id" {
  description = "ID of the key that has access to the bucket"
  value       = aws_iam_access_key.bucket_owner.id
}

output "access_secret_key" {
  description = "Secret key used to access the bucket"
  value       = aws_iam_access_key.bucket_owner.secret
}
