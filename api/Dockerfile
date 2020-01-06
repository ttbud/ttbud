FROM python:3.7

WORKDIR /app
RUN pip install watchgod
RUN pip install poetry
RUN poetry config virtualenvs.create false
ADD pyproject.toml .
RUN poetry install

ADD . .
EXPOSE 5000

#TODO: (#27) Serve this with a real production-grade server
# -u for unbuffered output so logs show immediately
CMD ["python", "-u", "src/main.py"]
