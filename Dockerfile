# Build stage for client
FROM node:18-alpine as client-builder

WORKDIR /app/client

# Copy client package files
COPY client/package*.json ./

# Install client dependencies
RUN npm install

# Copy client source code
COPY client/ ./

# Build client
RUN npm run build

# Build stage for server
FROM node:18-alpine as server-builder

WORKDIR /app/server

# Copy server package files
COPY server/package*.json ./

# Install server dependencies
RUN npm install

# Copy server source code
COPY server/ ./

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy built client files
COPY --from=client-builder /app/client/build ./client/build

# Copy server files and dependencies
COPY --from=server-builder /app/server ./server
COPY --from=server-builder /app/server/node_modules ./server/node_modules

# Copy environment files
COPY .env ./server/.env
COPY client/.env ./client/.env

# Set working directory to server
WORKDIR /app/server

# Expose server port
EXPOSE 3001

# Start the server
CMD ["npm", "start"] 