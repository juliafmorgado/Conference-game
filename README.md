# Conference Games

Interactive conference games web application for engaging audiences during presentations and events.

## Project Structure

This is a monorepo containing:

- `frontend/` - React TypeScript application built with Vite
- `backend/` - Node.js Express API with TypeScript

## Development Setup

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

```bash
# Install all dependencies
npm install

# Install frontend dependencies only
npm install --workspace=frontend

# Install backend dependencies only
npm install --workspace=backend
```

### Development Scripts

```bash
# Start both frontend and backend in development mode
npm run dev

# Start frontend only
npm run dev:frontend

# Start backend only
npm run dev:backend

# Build both applications
npm run build

# Lint all code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check code formatting
npm run format:check
```

## Features

- Interactive sentence completion games
- Acronym guessing games
- Real-time audience participation
- Configurable game settings
- Timer functionality

## Tech Stack

### Frontend
- React 18
- TypeScript
- Vite
- React Router

### Backend
- Node.js
- Express
- TypeScript
- CORS, Helmet, Compression middleware

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Start development servers: `npm run dev`
4. Frontend will be available at `http://localhost:3000`
5. Backend API will be available at `http://localhost:3001`