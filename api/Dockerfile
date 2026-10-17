FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 FACE_MODEL_ROOT=/models
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Bake face models into the image so cold starts never download them
RUN python -c "from insightface.app import FaceAnalysis; \
a=FaceAnalysis(name='buffalo_l', root='/models', providers=['CPUExecutionProvider'], allowed_modules=['detection','recognition']); \
a.prepare(ctx_id=-1, det_size=(640, 640))" \
    && rm -f /models/models/buffalo_l.zip /models/models/buffalo_l/1k3d68.onnx /models/models/buffalo_l/2d106det.onnx /models/models/buffalo_l/genderage.onnx
COPY app ./app
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1
