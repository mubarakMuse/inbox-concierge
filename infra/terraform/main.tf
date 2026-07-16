# Lean AWS stack for Inbox Concierge:
# - App Runner (Express API Docker image) with VPC connector to private RDS
# - SQS + Lambda (classify/recategorize jobs) in private subnets
# - S3 + CloudFront (SPA)
# - RDS Postgres 16 (private, single-AZ, lean)
#
# Apply in two steps if images are not yet in ECR:
# 1) terraform apply -var='create_apprunner=false' -var='create_lambda=false'
# 2) push images, then terraform apply -var='create_apprunner=true' -var='create_lambda=true'
#
# Apply schema after RDS exists (from a host with VPC access, or briefly set db_publicly_accessible=true):
#   psql "$DATABASE_URL" -f server/db/schema.sql
