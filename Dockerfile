# Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build frontend
RUN npm run build

# Build Rust backend
FROM rust:1.83-bookworm AS backend-builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace files
COPY Cargo.lock cargo.toml ./
COPY app/ ./app/
COPY migration/ ./migration/

# Build release binary
RUN cargo build --release --package slacker

# Runtime image
FROM debian:bookworm-slim AS runtime

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Copy the binary
COPY --from=backend-builder /app/target/release/slacker /app/slacker

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist /app/static

# Copy default files (workspaces.yaml will be mounted or created at runtime)
COPY workspaces.example.yaml /app/workspaces.example.yaml
COPY slack-app-manifest.yaml /app/static/slack-app-manifest.yaml

# Set environment variables
ENV STATIC_DIR=/app/static
ENV SERVER_IP=0.0.0.0
ENV PORT=3000

# Expose port
EXPOSE 3000

# Run the binary
CMD ["/app/slacker"]
