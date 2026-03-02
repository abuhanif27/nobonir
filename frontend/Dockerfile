# Use official Node image
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source
COPY . .

# Expose port (Vite default)
EXPOSE 5173

# Start dev server
CMD ["npm", "run", "dev", "--", "--host"]
