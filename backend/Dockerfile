# ---------------------------------------------------------------------------- #
# FastAPI backend
#
# Two targets:
#   dev  — uvicorn with --reload, for use with a bind mount (docker-compose.dev.yml)
#   prod — the default; no reloader, runs as a non-root user
# ---------------------------------------------------------------------------- #
FROM python:3.12-slim AS base

# PYTHONDONTWRITEBYTECODE: no .pyc clutter in the image / mounted volumes.
# PYTHONUNBUFFERED: send logs straight to the container's stdout.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Copy requirements alone first so the dependency layer is cached and only
# rebuilds when requirements.txt actually changes.
COPY requirements.txt ./
RUN pip install -r requirements.txt


# ------------------------------------------------------------------ dev ----- #
FROM base AS dev
ENV PORT=8000
EXPOSE 8000
# Source is bind-mounted in at runtime, so nothing is COPYed here.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --reload"]


# ----------------------------------------------------------------- prod ----- #
FROM base AS prod

COPY app ./app

# Run as an unprivileged user. Created with a fixed UID so bind-mounted files
# keep predictable ownership.
RUN useradd --create-home --uid 1000 appuser \
    && chown -R appuser:appuser /app
USER appuser

# Honour $PORT so the same image runs on Render / Fly / Cloud Run, which all
# inject it. `exec` keeps uvicorn as PID 1 so it receives SIGTERM directly.
ENV PORT=8000
EXPOSE 8000

# python -c beats curl here: the slim image ships no curl, and adding one just
# for a healthcheck would grow the image for nothing.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import os,urllib.request,sys; \
url='http://127.0.0.1:%s/api/health' % os.environ.get('PORT','8000'); \
sys.exit(0 if urllib.request.urlopen(url, timeout=4).status == 200 else 1)"

CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
