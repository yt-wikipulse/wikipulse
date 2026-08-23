# bookworm, а не slim по умолчанию: в Debian 13 пакета openjdk-17 уже нет,
# а гайд кластера требует именно Java 17.
FROM python:3.12-slim-bookworm

# Планировщик считает витрины через spark-submit, а тому нужна Java 17 —
# версия зафиксирована гайдом кластера (setup/spyt-env.md). Без неё scheduler
# падает с FileNotFoundError и уходит в цикл перезапусков.
# deb.debian.org из ru-central1 недоступен — apt уходит в таймаут. Ходим
# через зеркало Яндекса, на которое настроен и сам сервер.
RUN sed -i 's|http://deb.debian.org|http://mirror.yandex.ru|g' \
        /etc/apt/sources.list.d/debian.sources \
 && apt-get update \
 && apt-get install -y --no-install-recommends openjdk-17-jre-headless \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY bigdata/pyproject.toml bigdata/README.md ./
COPY bigdata/src src
RUN pip install --no-cache-dir . \
 && pip install --no-cache-dir "pyspark==4.2.0" "ytsaurus-spyt==2.11.0"

# Конфигурация SPYT: без неё spark-submit не понимает адрес кластера и падает
# с «Master must either be yarn or start with spark, k8s, or local».
ENV SPARK_CONF_DIR=/usr/local/lib/python3.12/site-packages/spyt/conf
