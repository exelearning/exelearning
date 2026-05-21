FROM alpine:3.20
RUN apk add --no-cache nginx \
    && mkdir -p /run/nginx /etc/nginx/certs \
    && rm -f /etc/nginx/http.d/default.conf
COPY nginx/exelearning.conf /etc/nginx/http.d/exelearning.conf
COPY nginx/locations.inc /etc/nginx/exelearning-locations.inc
COPY certs/ /etc/nginx/certs/
EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
