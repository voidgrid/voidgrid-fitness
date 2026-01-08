# Stage 1: Build Frontend
FROM node:18-alpine as frontend-builder
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ .
RUN VITE_API_URL="" npm run build

# Stage 2: Final Image
FROM python:3.11-slim
WORKDIR /app

# Create a non-root user
RUN groupadd -g 1000 fituser && \
    useradd -r -u 1000 -g fituser fituser

RUN apt-get update && apt-get install -y gcc libpq-dev curl && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code and set ownership
COPY --chown=fituser:fituser backend/app ./app
COPY --from=frontend-builder --chown=fituser:fituser /build/dist ./app/static

# Switch to non-root user
USER fituser

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
