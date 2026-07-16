locals {
  api_image_uri = "${aws_ecr_repository.api.repository_url}:${var.api_image_tag}"
}

resource "aws_apprunner_vpc_connector" "api" {
  vpc_connector_name = "${var.project_name}-api"
  subnets            = aws_subnet.private[*].id
  security_groups    = [aws_security_group.apprunner.id]
}

resource "aws_apprunner_service" "api" {
  count = var.create_apprunner ? 1 : 0

  service_name = "${var.project_name}-api"

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_ecr.arn
    }

    image_repository {
      image_identifier      = local.api_image_uri
      image_repository_type = "ECR"

      image_configuration {
        port = "8080"

        runtime_environment_variables = {
          NODE_ENV               = "production"
          QUEUE_DRIVER           = "sqs"
          PORT                   = "8080"
          AWS_REGION             = var.aws_region
          SQS_QUEUE_URL          = aws_sqs_queue.jobs.url
          STORAGE_DRIVER         = "pg"
          DATABASE_URL           = local.database_url
          DATABASE_SSL           = "true"
          GOOGLE_CLIENT_ID       = var.google_client_id
          GOOGLE_CLIENT_SECRET   = var.google_client_secret
          OAUTH_REDIRECT_URI     = var.oauth_redirect_uri
          OPENAI_API_KEY         = var.openai_api_key
          OPENAI_MODEL           = var.openai_model
          COOKIE_SECRET          = var.cookie_secret
          FRONTEND_URL           = var.frontend_url != "" ? var.frontend_url : "https://${aws_cloudfront_distribution.spa.domain_name}"
        }
      }
    }

    auto_deployments_enabled = false
  }

  instance_configuration {
    cpu               = "256"
    memory            = "512"
    instance_role_arn = aws_iam_role.apprunner_instance.arn
  }

  network_configuration {
    egress_configuration {
      egress_type       = "VPC"
      vpc_connector_arn = aws_apprunner_vpc_connector.api.arn
    }
  }

  health_check_configuration {
    protocol            = "HTTP"
    path                = "/api/health"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 5
  }

  depends_on = [aws_iam_role_policy_attachment.apprunner_ecr]
}
