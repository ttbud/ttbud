FROM python:3.9

WORKDIR /app
RUN pip install poetry
RUN poetry config virtualenvs.create false
ADD pyproject.toml .

ARG DEV=false
RUN if [ ${DEV} = "true" ]; then poetry install; else poetry install --no-dev; fi

ADD . .
EXPOSE 5000

CMD ["python", "main.py"]
