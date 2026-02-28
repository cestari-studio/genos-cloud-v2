FROM node:20-alpine

WORKDIR /app

# Install dependencies separately to leverage Docker cache
COPY package.json package-lock.json ./
RUN npm ci

# Copy application source code
COPY . .

# Build step if applicable (e.g., if using TypeScript)
RUN npm run build || true

# Expose API port
EXPOSE 3001

# Start the secure Express server
CMD ["npm", "start"]
