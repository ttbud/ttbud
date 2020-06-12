FROM python:3.8

WORKDIR /app
RUN pip install poetry
RUN poetry config virtualenvs.create false
ADD pyproject.toml .

ARG DEV=false
RUN if [ ${DEV} = "true" ]; then poetry install; else poetry install --no-dev; fi

ADD . .
EXPOSE 5000

#TODO: (#27) Serve this with a real production-grade server
# -u for unbuffered output so logs show immediately
CMD ["python", "-u", "main.py"]
