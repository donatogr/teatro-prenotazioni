#!/bin/sh
set -e
export BACKEND_URL="${BACKEND_URL:-http://backend:5000}"
export PORT="${PORT:-80}"
envsubst '${BACKEND_URL} ${PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g "daemon off;"
