# ----- STAGE 1: Build the React App -----
FROM node:18-alpine AS build

WORKDIR /app

# Accept build argument for API base URL (optional, defaults to value in vite.config.ts)
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Copy package.json and package-lock.json
COPY package.json ./
COPY package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the source code
COPY . .

# Build the app, creating a 'dist' folder (Vite uses 'dist' by default, not 'build')
RUN npm run build

# ----- STAGE 2: Serve with Nginx -----
FROM nginx:1.25-alpine

# Copy the static files from the 'build' stage
# Vite builds to 'dist' directory, not 'build'
COPY --from=build /app/dist /usr/share/nginx/html

# Copy our custom Nginx config file
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 (as specified in your DEPLOYMENT.md)
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]