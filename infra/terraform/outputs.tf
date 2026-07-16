output "cloudfront_url" {
  description = "SPA CloudFront URL"
  value       = "https://${aws_cloudfront_distribution.spa.domain_name}"
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.spa.id
}

output "spa_bucket_name" {
  value = aws_s3_bucket.spa.bucket
}

output "apprunner_url" {
  description = "App Runner service URL (empty until create_apprunner=true)"
  value       = var.create_apprunner ? "https://${aws_apprunner_service.api[0].service_url}" : ""
}

output "sqs_url" {
  value = aws_sqs_queue.jobs.url
}

output "sqs_dlq_url" {
  value = aws_sqs_queue.jobs_dlq.url
}

output "ecr_api_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "ecr_worker_repository_url" {
  value = aws_ecr_repository.worker.repository_url
}

output "lambda_function_name" {
  value = var.create_lambda ? aws_lambda_function.worker[0].function_name : ""
}

output "rds_endpoint" {
  description = "RDS endpoint (host:port)"
  value       = aws_db_instance.main.endpoint
}

output "rds_address" {
  description = "RDS hostname"
  value       = aws_db_instance.main.address
}
