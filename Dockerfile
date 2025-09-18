# Railway Dockerfile for MCP Platform
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Expose port
EXPOSE 8080

# Set environment variables
ENV NODE_ENV=production

# Start the server
CMD ["node", "server.cjs"]