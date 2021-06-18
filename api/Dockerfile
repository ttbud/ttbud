FROM python:3.9-slim as base
RUN useradd --create-home appuser
USER appuser

WORKDIR /home/appuser/app

FROM base as builder

USER root
RUN apt-get update \
    && apt-get install -y \
        g++ \
        gcc \
        libffi-dev \
    && rm -rf /var/lib/apt/lists/*
USER appuser

ENV PATH="/home/appuser/.local/bin:${PATH}" \
    # We're always going to use the version built into the docker image
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    # pip cache is useless in a docker build because we always only ever run
    # the install once
    PIP_NO_CACHE_DIR=1

RUN pip install --user poetry
# Create a venv so it's easy to copy everything over to the final image
# Creating our own venv instead of letting poetry create one automatically
# lets us dictate the venv location
RUN python -m venv /home/appuser/venv

COPY --chown=appuser:appuser pyproject.toml poetry.lock ./
ARG DEV=false
RUN . /home/appuser/venv/bin/activate && \
    poetry install --no-root --no-interaction --no-ansi $(test "$DEV" != "true" && echo "--no-dev")

COPY --chown=appuser:appuser . ./

FROM base

COPY --chown=appuser:appuser --from=builder /home/appuser/venv /home/appuser/venv/
COPY --chown=appuser:appuser --from=builder /home/appuser/app /home/appuser/app/

ENV PATH=/home/appuser/venv/bin:$PATH
EXPOSE 5000
CMD ["gunicorn", "-c", "gunicorn.conf.py", "main:app"]
