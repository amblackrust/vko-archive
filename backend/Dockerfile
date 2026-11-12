# Build context is the repository root: the seed reads the customer sources from info/.
FROM python:3.12-slim

# Tesseract (rus+kaz+eng) is the OCR engine for staff tools; curl is for the healthcheck.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-rus tesseract-ocr-kaz tesseract-ocr-eng curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ /app/backend/
COPY info/ /app/info/
RUN chmod +x docker-entrypoint.sh

EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=5s --retries=30 CMD curl -fs http://localhost:8000/api/health || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
