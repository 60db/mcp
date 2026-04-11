# QLabs MCP Server - Deployment Guide

This guide covers deploying the QLabs MCP Server to various environments including local development, production, and containerized deployments.

## Table of Contents

1. [Environment Setup](#environment-setup)
2. [Local Development](#local-development)
3. [Production Deployment](#production-deployment)
4. [Docker Deployment](#docker-deployment)
5. [Cloud Deployment](#cloud-deployment)
6. [Monitoring and Logging](#monitoring-and-logging)

## Environment Setup

### Required Environment Variables

```bash
# Authentication (REQUIRED - one of these)
QLABS_API_KEY=sk_your_api_key_here
# OR
QLABS_JWT_TOKEN=your_jwt_token_here

# Optional Configuration
QLABS_API_BASE_URL=https://api.qlabs.com  # Default: http://localhost:3000
NODE_ENV=production                        # Default: development
```

### Getting API Credentials

1. **API Key**: Generate from QLabs Dashboard → Settings → API Keys
2. **JWT Token**: Obtain by logging into QLabs and extracting the token from browser storage

## Local Development

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Access to QLabs API (local instance or staging)

### Setup Steps

1. **Clone the repository** (if applicable):
   ```bash
   git clone https://github.com/qlabs/qlabs-mcp-server.git
   cd qlabs-mcp-server
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set environment variables**:
   ```bash
   export QLABS_API_KEY=sk_your_api_key_here
   export QLABS_API_BASE_URL=http://localhost:3000
   ```

4. **Run in development mode**:
   ```bash
   npm run dev
   ```

5. **Test the server**:
   ```bash
   # In another terminal
   echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
   ```

### Development Workflow

```bash
# Watch mode with auto-reload
npm run dev

# Type checking
npm run type-check

# Clean build artifacts
npm run clean

# Production build
npm run build
```

## Production Deployment

### Build for Production

```bash
# Build the project
npm run build

# Verify the build
ls -la dist/
# Should show: index.js, tools/, services/, types/, schemas/
```

### Systemd Service (Linux)

Create `/etc/systemd/system/qlabs-mcp.service`:

```ini
[Unit]
Description=QLabs MCP Server
After=network.target

[Service]
Type=simple
User=qlabs
WorkingDirectory=/opt/qlabs-mcp-server
ExecStart=/usr/bin/node /opt/qlabs-mcp-server/dist/index.js
Restart=always
RestartSec=10
Environment=QLABS_API_KEY=sk_production_key_here
Environment=QLABS_API_BASE_URL=https://api.qlabs.com
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable qlabs-mcp
sudo systemctl start qlabs-mcp
sudo systemctl status qlabs-mcp
```

### PM2 Process Manager

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start dist/index.js --name qlabs-mcp \
  --QLABS_API_KEY=sk_production_key_here \
  --QLABS_API_BASE_URL=https://api.qlabs.com

# Configure for auto-start
pm2 startup
pm2 save

# Monitor
pm2 logs qlabs-mcp
pm2 monit
```

## Docker Deployment

### Dockerfile

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Production image
FROM node:18-alpine

WORKDIR /app

# Copy built files
COPY --from=builder /app/dist ./dist
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Set environment variables
ENV NODE_ENV=production
ENV QLABS_API_BASE_URL=https://api.qlabs.com

# Create non-root user
RUN addgroup -g 1001 -S qlabs && \
    adduser -S qlabs -u 1001 && \
    chown -R qlabs:qlabs /app
USER qlabs

# Expose is not needed for stdio transport
# Expose only if using HTTP transport
# EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  qlabs-mcp:
    build: .
    container_name: qlabs-mcp-server
    restart: unless-stopped
    environment:
      - QLABS_API_KEY=${QLABS_API_KEY}
      - QLABS_API_BASE_URL=https://api.qlabs.com
      - NODE_ENV=production
    # For HTTP transport (if implemented):
    # ports:
    #   - "3000:3000"
```

### Build and Run

```bash
# Build image
docker build -t qlabs-mcp-server:latest .

# Run container
docker run -d \
  --name qlabs-mcp \
  -e QLABS_API_KEY=sk_production_key_here \
  -e QLABS_API_BASE_URL=https://api.qlabs.com \
  qlabs-mcp-server:latest

# View logs
docker logs -f qlabs-mcp

# Stop container
docker stop qlabs-mcp
```

## Cloud Deployment

### AWS ECS (Fargate)

Task Definition:
```json
{
  "family": "qlabs-mcp-server",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "qlabs-mcp",
      "image": "your-ecr-repo/qlabs-mcp-server:latest",
      "essential": true,
      "secrets": [
        {
          "name": "QLABS_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:qlabs-api-key"
        }
      ],
      "environment": [
        {
          "name": "QLABS_API_BASE_URL",
          "value": "https://api.qlabs.com"
        },
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/qlabs-mcp",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### Google Cloud Run

```bash
# Build and push image
gcloud builds submit --tag gcr.io/PROJECT_ID/qlabs-mcp-server

# Deploy to Cloud Run
gcloud run deploy qlabs-mcp-server \
  --image gcr.io/PROJECT_ID/qlabs-mcp-server \
  --platform managed \
  --region us-central1 \
  --set-env-vars QLABS_API_BASE_URL=https://api.qlabs.com \
  --set-secrets QLABS_API_KEY=qlabs-api-key:latest \
  --memory 512Mi \
  --cpu 1
```

### Azure Container Instances

```bash
# Create resource group
az group create --name qlabs-mcp-rg --location eastus

# Create container
az container create \
  --resource-group qlabs-mcp-rg \
  --name qlabs-mcp-server \
  --image your-registry/qlabs-mcp-server:latest \
  --cpu 1 \
  --memory 0.5 \
  --secure-environment-variables QLABS_API_KEY=$QLABS_API_KEY \
  --environment-variables QLABS_API_BASE_URL=https://api.qlabs.com
```

## Monitoring and Logging

### Logging

Logs are written to stderr (stdio is reserved for MCP protocol):

```bash
# Systemd service logs
sudo journalctl -u qlabs-mcp -f

# PM2 logs
pm2 logs qlabs-mcp

# Docker logs
docker logs -f qlabs-mcp
```

### Health Monitoring

The server doesn't expose HTTP endpoints by default (stdio transport). Monitor process health:

```bash
# Systemd
systemctl is-active qlabs-mcp

# PM2
pm2 status qlabs-mcp

# Docker
docker inspect qlabs-mcp --format='{{.State.Status}}'
```

### Metrics to Monitor

- Process uptime and restarts
- Memory usage (expect ~100-200MB baseline)
- CPU usage (expect <5% when idle)
- Error rates in logs
- API response times (check QLabs dashboard)

### Error Tracking

Integrate with error tracking services:

```typescript
// In src/index.ts
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
});

main().catch(Sentry.captureException);
```

## Security Considerations

1. **API Key Storage**: Use secret management services
   - AWS Secrets Manager / Parameter Store
   - Google Secret Manager
   - Azure Key Vault
   - HashiCorp Vault

2. **Network Security**:
   - Use HTTPS for API_BASE_URL
   - Restrict outbound network access if possible
   - Implement rate limiting at infrastructure level

3. **Process Isolation**:
   - Run as non-root user
   - Use container isolation
   - Restrict file system access

## Troubleshooting

### Common Issues

1. **"Authentication required" error**:
   - Verify QLABS_API_KEY or QLABS_JWT_TOKEN is set
   - Check credentials are valid
   - Ensure API_BASE_URL is correct

2. **High memory usage**:
   - Monitor for memory leaks
   - Restart process periodically
   - Consider increasing container memory limits

3. **Slow response times**:
   - Check QLabs API status
   - Verify network connectivity
   - Review rate limiting headers

4. **Process crashes**:
   - Check logs for error messages
   - Verify environment variables
   - Test with MCP Inspector locally

## Upgrade Procedure

```bash
# Pull latest code
git pull origin main

# Install new dependencies
npm install

# Build
npm run build

# Restart service
sudo systemctl restart qlabs-mcp
# OR
pm2 restart qlabs-mcp
# OR
docker restart qlabs-mcp
```

## Support

For deployment issues:
- Check logs: `journalctl -u qlabs-mcp -n 100`
- Test locally: `npm run dev`
- Review configuration: Verify all environment variables
- Contact QLabs support: support@qlabs.com
