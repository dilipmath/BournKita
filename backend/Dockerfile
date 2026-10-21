FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.11.7 /uv /bin/uv
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_NO_DEV=1
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project
COPY src ./src
RUN uv sync --frozen
RUN useradd --system --no-create-home kita
USER kita
EXPOSE 8000
CMD ["/app/.venv/bin/uvicorn", "kita.main:app", "--host", "0.0.0.0", "--port", "8000"]
