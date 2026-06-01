import os

# Worker class — gevent for async I/O (weather API, Anthropic API, DB calls)
worker_class = "gevent"
workers = int(os.environ.get("WEB_CONCURRENCY", 4))
worker_connections = 1000

# Binding
bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"

# Timeouts
timeout = 120          # long enough for Anthropic API calls
keepalive = 5
graceful_timeout = 30

# Logging
accesslog = "-"
errorlog = "-"
loglevel = os.environ.get("LOG_LEVEL", "info")

# Restart workers after this many requests to prevent memory leaks
max_requests = 1000
max_requests_jitter = 100
