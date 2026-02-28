# Stage 1: Build the React Application
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build (includes Carbon Code Splitting)
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx (Alpine)
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy Vite build output to Nginx HTML directory
COPY --from=builder /ui /usr/share/nginx/html

# Expose web port
EXPOSE 80

# Default Nginx command
CMD ["nginx", "-g", "daemon off;"]
