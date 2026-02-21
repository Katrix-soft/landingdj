# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build -- --configuration production

# Stage 2: Serve
FROM nginx:alpine
# Copy built files from build stage
# Note: Angular 17+ builds to dist/[project-name]/browser by default
# Checking package.json name to be sure: "saavedra-landing"
COPY --from=build /app/dist/saavedra-landing/browser /usr/share/nginx/html

# Custom nginx config to handle Angular routing
RUN echo $'server { \n\
    listen 80; \n\
    location / { \n\
        root /usr/share/nginx/html; \n\
        index index.html index.htm; \n\
        try_files $uri $uri/ /index.html; \n\
    } \n\
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
