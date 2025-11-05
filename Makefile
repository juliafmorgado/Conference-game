# Conference Games Docker Management
.PHONY: help build up down logs clean restart frontend backend db

# Default target
help:
	@echo "Available commands:"
	@echo "  build     - Build all Docker images"
	@echo "  up        - Start all services"
	@echo "  down      - Stop all services"
	@echo "  logs      - Show logs from all services"
	@echo "  clean     - Remove all containers, volumes, and images"
	@echo "  restart   - Restart all services"
	@echo "  frontend  - Build and run only frontend"
	@echo "  backend   - Build and run only backend"
	@echo "  db        - Start only database"

# Build all images
build:
	docker-compose build

# Start all services
up:
	docker-compose up -d

# Stop all services
down:
	docker-compose down

# Show logs
logs:
	docker-compose logs -f

# Clean up everything
clean:
	docker-compose down -v --rmi all --remove-orphans
	docker system prune -f

# Restart services
restart: down up

# Frontend only
frontend:
	docker-compose up -d frontend

# Backend only (includes database)
backend:
	docker-compose up -d postgres backend

# Database only
db:
	docker-compose up -d postgres

# Development setup
dev-setup: build up
	@echo "Development environment is ready!"
	@echo "Frontend: http://localhost:3000"
	@echo "Backend API: http://localhost:3001"
	@echo "Full app (via nginx): http://localhost:8080"