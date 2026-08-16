FROM python:3.12-slim
WORKDIR /src
COPY bigdata/pyproject.toml bigdata/README.md ./
COPY bigdata/src src
RUN pip install --no-cache-dir .
