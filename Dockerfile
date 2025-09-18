# Railway Dockerfile - Ultra simple
FROM node:18-alpine

WORKDIR /app

# Just copy the debug server
COPY debug-server.js ./

# Start debug server directly
CMD ["node", "debug-server.js"]