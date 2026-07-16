variable "project_name" {
  description = "Short name used for resource naming"
  type        = string
  default     = "inbox-concierge"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "frontend_domain" {
  description = "Optional custom domain for CloudFront (unused in lean starter)"
  type        = string
  default     = ""
}

variable "api_image_tag" {
  description = "Tag for App Runner API image in ECR"
  type        = string
  default     = "latest"
}

variable "worker_image_tag" {
  description = "Tag for Lambda worker image in ECR"
  type        = string
  default     = "latest"
}

variable "db_username" {
  description = "RDS master username"
  type        = string
  default     = "inbox"
}

variable "db_password" {
  description = "RDS master password"
  type        = string
  sensitive   = true
}

variable "db_name" {
  description = "RDS database name"
  type        = string
  default     = "inbox"
}

variable "db_instance_class" {
  description = "RDS instance class (lean default)"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_publicly_accessible" {
  description = "If true, RDS is reachable from the internet (use briefly for schema apply; keep false in prod)"
  type        = bool
  default     = false
}

variable "google_client_id" {
  type      = string
  default   = ""
  sensitive = true
}

variable "google_client_secret" {
  type      = string
  default   = ""
  sensitive = true
}

variable "openai_api_key" {
  type      = string
  default   = ""
  sensitive = true
}

variable "cookie_secret" {
  type      = string
  default   = ""
  sensitive = true
}

variable "frontend_url" {
  description = "CloudFront / SPA origin for CORS and cookies"
  type        = string
  default     = ""
}

variable "oauth_redirect_uri" {
  description = "Google OAuth callback on App Runner (set after first apply if unknown)"
  type        = string
  default     = ""
}

variable "openai_model" {
  type    = string
  default = "gpt-4o-mini"
}

variable "create_apprunner" {
  description = "Create App Runner service (requires an image already pushed to ECR)"
  type        = bool
  default     = false
}

variable "create_lambda" {
  description = "Create Lambda from ECR image (requires worker image pushed)"
  type        = bool
  default     = false
}
