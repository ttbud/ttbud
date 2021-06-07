FROM python:3.9

RUN pip install poetry

RUN useradd --create-home appuser
RUN mkdir /app
RUN chown appuser:appuser /app
WORKDIR /app
USER appuser

ENV PATH="/home/appuser/.local/bin:${PATH}"

RUN poetry config virtualenvs.create false
ADD pyproject.toml .

ARG DEV=false
RUN if [ ${DEV} = "true" ]; then poetry install; else poetry install --no-dev; fi

ADD . .
EXPOSE 5000

CMD ["gunicorn", "-c", "gunicorn.conf.py", "main:app"]
