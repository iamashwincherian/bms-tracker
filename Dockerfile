# ---- Frontend build stage ----
FROM node:20-slim AS frontend-builder
WORKDIR /frontend
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
RUN npm run build

# ---- Backend + runtime stage ----
FROM python:3.11-slim
WORKDIR /app

# Install curl (used by the Docker healthcheck)
RUN apt-get update && \
    apt-get install -y curl && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers
RUN playwright install --with-deps chromium

# Copy application files
COPY main.py .
COPY bms.py .
COPY browser.py .
COPY send_email.py .
COPY cities.py .
COPY db.py .
COPY models.py .
COPY worker.py .
COPY worker_service.py .

# Built frontend, served as static files by main.py
COPY --from=frontend-builder /frontend/dist ./static

# Persist the tracked-shows SQLite DB across container recreations
VOLUME ["/app/data"]

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Run the API (see docker-compose.yml for the separate worker service,
# which reuses this same image with a different command)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
