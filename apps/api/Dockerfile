# NagarikAI API — Cloud Run Dockerfile
# Builds a slim Python 3.12 image; deps come from requirements.txt.
# Cloud Run injects PORT; we default to 8080 locally.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# System deps for psycopg3 (libpq), Pillow (zlib/jpeg), and a couple of
# transitive C extensions. Keep this list short — every package balloons
# the image.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
        libjpeg62-turbo \
        zlib1g \
        ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Then the code. Alembic + scripts ship too so we can run migrations
# from the container (handy for one-off ops).
COPY . .

# Cloud Run sets PORT; honour it. 0.0.0.0 so the container is reachable.
ENV PORT=8080
EXPOSE 8080

# Use uvicorn directly (FastAPI's recommended ASGI server). Workers stay
# at 1 because Cloud Run handles horizontal scaling; multiple processes
# would just duplicate work.
CMD ["sh", "-c", "uvicorn nagarik.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1"]
