# Railway Dockerfile - Simplified
FROM node:18-alpine

WORKDIR /app

# Copy and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application
COPY . .

# Start server
CMD ["node", "server.cjs"]