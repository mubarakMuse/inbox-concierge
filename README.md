# Inbox Concierge

Gmail inbox sorted into buckets with OpenAI. React + Express + Postgres on AWS.

## Stack

- Frontend: React (Vite) → S3 + CloudFront
- API: Express → App Runner
- Jobs: SQS + Lambda
- DB: RDS Postgres

## Local setup

1. `docker compose up -d`
2. `cp server/.env.example server/.env` (fill Google + OpenAI)
3. `cd server && npm i && npm run dev`
4. `cd client && npm i && npm run dev`
5. Open http://localhost:5173

## Scripts

```bash
cd server && npm test && npm run lint
cd client && npm test && npm run lint
```

## Deploy

See [DEPLOY-AWS.md](./DEPLOY-AWS.md)

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md)
