# Deploy Inbox Concierge on lean AWS

Cheap production shape:

| Piece | Service |
|-------|---------|
| API | **App Runner** (Docker, Express) |
| Classify / recategorize jobs | **SQS + Lambda** (container image) |
| SPA | **S3 + CloudFront** |
| Database | **RDS Postgres 16** (private, single-AZ, `db.t4g.micro`) |

Local and CI use `QUEUE_DRIVER=local` so jobs run in-process without AWS. Local DB: Docker Compose + `server/db/schema.sql`.

---

## 1. Database schema

### Local

```bash
docker compose up -d
# schema.sql is applied via docker-entrypoint-initdb.d on first start
```

Set in `server/.env`:

```
STORAGE_DRIVER=pg
DATABASE_URL=postgres://postgres:postgres@localhost:5434/inbox_concierge
DATABASE_SSL=false
```

### RDS (after Terraform creates the instance)

RDS is private by default. Apply schema from a host that can reach the VPC, **or** briefly set `db_publicly_accessible = true` in `terraform.tfvars`, apply, migrate, then set it back to `false`:

```bash
# From a host with VPC access, or temporarily set db_publicly_accessible=true
export DATABASE_URL="postgresql://inbox:PASSWORD@RDS_ADDRESS:5432/inbox?sslmode=require"
psql "$DATABASE_URL" -f server/db/schema.sql
```

Alternatives: SSM bastion / CloudShell jump host, or a one-off App Runner/ECS task with the schema file.

For existing Supabase projects migrating data, export/import tables yourself; the app schema is in `server/db/schema.sql` (includes `jobs`).

---

## 2. Terraform (infra)

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# set db_password and other secrets
terraform init
# First apply: VPC, RDS, ECR, SQS, S3, CloudFront (no App Runner / Lambda yet)
terraform apply -var='create_apprunner=false' -var='create_lambda=false'
```

Note outputs: `ecr_api_repository_url`, `ecr_worker_repository_url`, `sqs_url`, `cloudfront_url`, `spa_bucket_name`, `rds_endpoint`, `rds_address`.

Apply schema (see above), then continue.

---

## 3. Build and push images

```bash
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGION=us-east-1
API_REPO=<ecr_api_repository_url>
WORKER_REPO=<ecr_worker_repository_url>

aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$AWS_ACCOUNT.dkr.ecr.$REGION.amazonaws.com"

docker build -t inbox-api ./server
docker tag inbox-api:latest "$API_REPO:latest"
docker push "$API_REPO:latest"

docker build -f server/Dockerfile.lambda -t inbox-worker ./server
docker tag inbox-worker:latest "$WORKER_REPO:latest"
docker push "$WORKER_REPO:latest"
```

Then create compute:

```bash
terraform apply -var='create_apprunner=true' -var='create_lambda=true'
```

Set `oauth_redirect_uri` and `frontend_url` in `terraform.tfvars` to the App Runner and CloudFront URLs, then apply again.

---

## 4. Google OAuth

In Google Cloud Console → Credentials → OAuth client:

- **Authorized redirect URI:** `https://<APPRUNNER_URL>/api/auth/callback`
- **Authorized JavaScript origins:** App Runner URL and CloudFront URL

---

## 5. Build and sync SPA

```bash
cd client
VITE_API_BASE=https://<APPRUNNER_URL> npm run build
aws s3 sync dist s3://<spa_bucket_name> --delete
aws cloudfront create-invalidation --distribution-id <id> --paths "/*"
```

---

## 6. Environment variables

### App Runner (API) / Lambda (worker)

Terraform sets:

| Variable | Value |
|----------|--------|
| `NODE_ENV` | `production` |
| `PORT` | `8080` (API only) |
| `QUEUE_DRIVER` | `sqs` |
| `SQS_QUEUE_URL` | Terraform `sqs_url` |
| `STORAGE_DRIVER` | `pg` |
| `DATABASE_URL` | RDS connection string (`sslmode=require`) |
| `DATABASE_SSL` | `true` |
| `FRONTEND_URL` | CloudFront URL (API) |
| `OAUTH_REDIRECT_URI` | `https://<apprunner>/api/auth/callback` |
| `GOOGLE_*` / `OPENAI_*` / `COOKIE_SECRET` | From tfvars |

App Runner uses a VPC connector (private subnets) to reach RDS. Lambda runs in the same private subnets.

### Local / .env

```
STORAGE_DRIVER=pg
DATABASE_URL=postgres://postgres:postgres@localhost:5434/inbox_concierge
DATABASE_SSL=false
QUEUE_DRIVER=local
```

Optional legacy: `STORAGE_DRIVER=supabase` with `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.

---

## 7. CI

`.github/workflows/deploy-aws.yml`:

- Runs server + client tests on push to `main` / `feat/aws-lean-production`
- Always builds Docker images
- Pushes to ECR / syncs S3 when AWS secrets are configured
- Optional `workflow_dispatch` input `apply_infra` runs Terraform apply

Required GitHub secrets (for full deploy): `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `ECR_API_REPOSITORY`, `ECR_WORKER_REPOSITORY`, `SPA_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`, `DB_PASSWORD`, plus Google/OpenAI/`COOKIE_SECRET` for Terraform. Repo vars: `VITE_API_BASE`, optional `FRONTEND_URL`, `OAUTH_REDIRECT_URI`, `DB_USERNAME`, `DB_NAME`, `DB_INSTANCE_CLASS`.

---

## Railway + Netlify (legacy)

See [DEPLOY.md](./DEPLOY.md) for the previous Railway + Netlify path.
