# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build -- --configuration production

# Stage 2: Serve
FROM nginx:alpine

# Copy built files
COPY --from=build /app/dist/saavedra-landing/browser /usr/share/nginx/html

# Custom nginx config using a more reliable method
RUN printf "server {\n\
    listen 80;\n\
    server_name localhost;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / {\n\
    try_files \$uri \$uri/ /index.html;\n\
    }\n\
    }\n" > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
