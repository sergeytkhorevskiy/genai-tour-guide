FROM python:3.11-slim

# Встановлюємо системні залежності
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Встановлюємо робочу директорію
WORKDIR /app

# Копіюємо файл залежностей
COPY requirements.txt .

# Встановлюємо Python залежності
RUN pip install --no-cache-dir -r requirements.txt

# Копіюємо код додатку
COPY app/ ./app/

# Відкриваємо порт
EXPOSE 8000

# Запускаємо додаток
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
