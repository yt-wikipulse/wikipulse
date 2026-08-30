FROM python:3.12-slim-bookworm

ARG DEBIAN_MIRROR=http://deb.debian.org

RUN sed -i "s|http://deb.debian.org|${DEBIAN_MIRROR}|g" \
        /etc/apt/sources.list.d/debian.sources \
 && apt-get update \
 && apt-get install -y --no-install-recommends openjdk-17-jre-headless \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY bigdata/pyproject.toml bigdata/README.md ./
COPY bigdata/src src
RUN pip install --no-cache-dir . \
 && pip install --no-cache-dir "pyspark==4.2.0" "ytsaurus-spyt==2.11.0"

ENV SPARK_CONF_DIR=/usr/local/lib/python3.12/site-packages/spyt/conf

RUN useradd --system --create-home --uid 10001 --shell /usr/sbin/nologin app
ENV HOME=/home/app
USER 10001
