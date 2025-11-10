# --- build ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Steuerung über Build-Args
ARG VITE_API_BASE_URL
ARG BUILD_MODE=production  # "development" für dev
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN node -e "console.log('> build mode =', process.env.BUILD_MODE || 'production')"
RUN node -e "console.log('> VITE_API_BASE_URL =', process.env.VITE_API_BASE_URL || '(unset)')"

RUN npm run build -- --mode ${BUILD_MODE}

# --- serve ---
FROM nginx:alpine
WORKDIR /usr/share/nginx/html
COPY --from=build /app/dist ./
RUN printf 'server { \
  listen 80; \
  root /usr/share/nginx/html; \
  index index.html; \
  location / { \
    try_files $uri /index.html; \
    add_header Cache-Control "no-store, no-cache, must-revalidate" always; \
    add_header Pragma "no-cache" always; \
  } \
}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx","-g","daemon off;"]
