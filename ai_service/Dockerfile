FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py ./app.py
ENV AI_PORT=8788
EXPOSE 8788
CMD ["gunicorn", "--bind", "0.0.0.0:8788", "app:app"]