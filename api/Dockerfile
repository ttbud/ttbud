ARG BUILD_ENV="prod"

FROM python:3.12.10-slim AS base
RUN useradd --create-home appuser
WORKDIR /home/appuser/app
RUN chown appuser:appuser /home/appuser/app
USER appuser
WORKDIR /home/appuser

FROM base AS builder

USER root
RUN apt-get update \
    && apt-get install -y \
    g++ \
    gcc \
    libffi-dev \
    libsasl2-dev \
    && rm -rf /var/lib/apt/lists/*
USER appuser

COPY --from=ghcr.io/astral-sh/uv:0.7.2 /uv /uvx /bin/

ARG BUILD_ENV

# Not using run mounts because heroku docker image builder doesn't support
# docker buildkit :(. Once it does, we can use the commented-out strategy
# instead for faster local builds
COPY --chown=appuser:appuser pyproject.toml uv.lock ./
RUN uv sync --locked --no-cache --no-install-project $(test "$BUILD_ENV" != "dev" && echo "--no-dev --no-editable")

# RUN --mount=type=cache,target=/root/.cache/uv \
#     --mount=type=bind,source=uv.lock,target=uv.lock \
#     --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
#     uv sync --locked --no-install-project $(test "$BUILD_ENV" != "dev" && echo "--no-dev --no-editable")

COPY --chown=appuser:appuser . ./

# Same here, waiting for heroku to update their docker version to use the
# faster version with run mounts
RUN uv sync --locked --no-cache $(test "$BUILD_ENV" != "dev" && echo "--no-dev --no-editable")
# RUN --mount=type=cache,target=/root/.cache/uv \
#     uv sync --locked $(test "$BUILD_ENV" != "dev" && echo "--no-dev --no-editable")

FROM base

COPY --chown=appuser:appuser --from=builder /home/appuser/ /home/appuser/

ENV PATH=/home/appuser/.venv/bin:$PATH
EXPOSE 5000
CMD ["gunicorn", "-c", "gunicorn.conf.py", "main:app"]
