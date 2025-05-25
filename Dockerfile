# Build stage for client
FROM node:18-alpine as client-builder

WORKDIR /app/client

# Copy client package files
COPY client/package*.json ./

# Install client dependencies
RUN npm install

# Copy client source code
COPY client/ ./

# Set build-time environment variables for React
ARG REACT_APP_FIREBASE_API_KEY
ARG REACT_APP_FIREBASE_AUTH_DOMAIN
ARG REACT_APP_FIREBASE_PROJECT_ID
ARG REACT_APP_FIREBASE_STORAGE_BUCKET
ARG REACT_APP_FIREBASE_MESSAGING_SENDER_ID
ARG REACT_APP_FIREBASE_APP_ID
ARG REACT_APP_FIREBASE_MEASUREMENT_ID

# Build client with environment variables
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

# Set working directory to server
WORKDIR /app/server

# Cloud Run will set this environment variable
ENV PORT=8080

# Expose the port Cloud Run will use
EXPOSE 8080

# Add health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/api/health || exit 1

# Start the server
CMD ["npm", "start"] 