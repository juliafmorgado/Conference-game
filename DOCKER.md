# Docker Setup for Conference Games

This document describes how to run the Conference Games application using Docker and Docker Compose.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- Make (optional, for convenience commands)

## Quick Start

### Using Make (Recommended)

```bash
# Build and start all services
make dev-setup

# Or step by step
make build
make up
```

### Using Docker Compose Directly

```bash
# Build all images
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

## Services

The development environment includes:

- **Frontend** (React + Vite): http://localhost:3000
- **Backend** (Node.js + Express): http://localhost:3001
- **Database** (PostgreSQL): localhost:5432
- **Nginx Proxy**: http://localhost:8080 (full app)

## Development Workflow

### Hot Reload

Both frontend and backend support hot reload in development mode:

- Frontend: Vite dev server with HMR
- Backend: tsx watch mode for TypeScript compilation

### Database Access

Connect to PostgreSQL:
```bash
# Using docker-compose
docker-compose exec postgres psql -U postgres -d conference_games_dev

# Using local psql client
psql -h localhost -U postgres -d conference_games_dev
```

### Logs

View logs for specific services:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

## Production Builds

### Frontend Production Image

```bash
cd frontend
docker build -t conference-games-frontend:latest .
```

### Backend Production Image

```bash
cd backend
docker build -t conference-games-backend:latest .
```

## Environment Variables

### Backend Environment Variables

- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: 3001)
- `DATABASE_URL`: PostgreSQL connection string
- `TIMER_DEFAULT_SECONDS`: Default timer duration
- `HISTORY_SIZE`: Number of items to track in history

### Frontend Environment Variables

- `VITE_API_URL`: Backend API URL

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 3000, 3001, 5432, and 8080 are available
2. **Permission issues**: On Linux, you may need to run with `sudo`
3. **Volume mounting**: Ensure Docker has access to the project directory

### Reset Everything

```bash
# Stop and remove everything
make clean

# Or using docker-compose
docker-compose down -v --rmi all --remove-orphans
docker system prune -f
```

### Database Issues

```bash
# Reset database
docker-compose down postgres
docker volume rm conference-games_postgres_dev_data
docker-compose up -d postgres
```

## Health Checks

All services include health checks:

- Frontend: `GET /health` (nginx)
- Backend: `GET /health` (Express)
- Database: `pg_isready` command

Check service health:
```bash
docker-compose ps
```

## Performance Optimization

### Image Size Optimization

- Multi-stage builds reduce final image size
- `.dockerignore` files exclude unnecessary files
- Production images use Alpine Linux base

### Build Cache

Docker layer caching is optimized by:
- Copying package files before source code
- Installing dependencies in separate layers
- Using specific COPY commands for better cache hits

## Security

### Non-root Users

All production containers run as non-root users:
- Frontend: `nextjs` user (UID 1001)
- Backend: `nodejs` user (UID 1001)

### Security Headers

Nginx configuration includes security headers:
- X-Frame-Options
- X-XSS-Protection
- X-Content-Type-Options
- Content-Security-Policy