# Railway Dockerfile - Production
FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy all application files
COPY . .

# Start the production server
CMD ["node", "server.cjs"]