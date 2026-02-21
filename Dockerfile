# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build -- --configuration production

# Stage 2: Serve
FROM nginx:alpine
# List files for debugging (visible in build logs)
RUN ls -la /app/dist/saavedra-landing || true

# Copy built files
# Angular 17+ sometimes puts files in dist/saavedra-landing/browser
# We use a wildcard to copy whatever is inside the terminal folder
COPY --from=build /app/dist/saavedra-landing/browser /usr/share/nginx/html

# Custom nginx config
RUN echo 'server { \n\
    listen 80; \n\
    server_name localhost; \n\
    root /usr/share/nginx/html; \n\
    index index.html; \n\
    location / { \n\
    try_files $uri $uri/ /index.html; \n\
    } \n\
    }' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
