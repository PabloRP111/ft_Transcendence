# Image
FROM nginx:1.25.5-alpine

# OpenSSL
RUN apk add --no-cache openssl

# Auto self firmated certificate
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/server.key \
    -out /etc/ssl/certs/server.crt \
    -subj "/C=ES/ST=Andalucia/L=Malaga/O=42/OU=ft_transcendence/CN=localhost" \
    -addext "subjectAltName = DNS:localhost,IP:127.0.0.1"

# Copy configuration file
COPY nginx.conf /etc/nginx/nginx.conf

ARG HOST_NAME=localhost
RUN sed -i "s|\[hostname\]|${HOST_NAME}|g" /etc/nginx/nginx.conf

# Port 443
EXPOSE 80 443
