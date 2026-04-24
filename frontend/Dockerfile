# Frontend image (Vite dev server)
FROM node:20-alpine

WORKDIR /app

# Install deps first for cache-friendly layers
COPY package.json package-lock.json* ./
RUN npm ci

# Copy the entire project (no .dockerignore — everything ships)
COPY . .

EXPOSE 5173

# --host 0.0.0.0 is required so the port is reachable outside the container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
