# Railway Dockerfile for MCP Platform
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production || npm install --only=production

# Copy all application files
COPY . .

# Expose port (Railway will override this)
EXPOSE 8080

# Dynamic healthcheck that honors $PORT (falls back to 8080 locally)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const p=process.env.PORT||8080; require('http').get(\`http://127.0.0.1:\${p}/health\`, r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Start the server
CMD ["node", "server.cjs"]