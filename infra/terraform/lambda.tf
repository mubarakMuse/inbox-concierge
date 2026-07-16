locals {
  worker_image_uri = "${aws_ecr_repository.worker.repository_url}:${var.worker_image_tag}"
}

resource "aws_lambda_function" "worker" {
  count = var.create_lambda ? 1 : 0

  function_name = "${var.project_name}-worker"
  role          = aws_iam_role.lambda_worker.arn
  package_type  = "Image"
  image_uri     = local.worker_image_uri
  timeout       = 900
  memory_size   = 1024

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      NODE_ENV             = "production"
      QUEUE_DRIVER         = "sqs"
      SQS_QUEUE_URL        = aws_sqs_queue.jobs.url
      STORAGE_DRIVER       = "pg"
      DATABASE_URL         = local.database_url
      DATABASE_SSL         = "true"
      GOOGLE_CLIENT_ID     = var.google_client_id
      GOOGLE_CLIENT_SECRET = var.google_client_secret
      OAUTH_REDIRECT_URI   = var.oauth_redirect_uri
      OPENAI_API_KEY       = var.openai_api_key
      OPENAI_MODEL         = var.openai_model
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic,
    aws_iam_role_policy_attachment.lambda_vpc,
    aws_iam_role_policy.lambda_sqs,
  ]
}

resource "aws_lambda_event_source_mapping" "jobs" {
  count = var.create_lambda ? 1 : 0

  event_source_arn = aws_sqs_queue.jobs.arn
  function_name    = aws_lambda_function.worker[0].arn
  batch_size       = 1
  enabled          = true
}
