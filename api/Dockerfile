FROM python:3.7

WORKDIR /app
RUN pip install watchgod
ADD requirements.txt .
RUN pip install -r requirements.txt

ADD . .
EXPOSE 5000

#TODO: (#27) Serve this with a real production-grade server
# -u for unbuffered output so logs show immediately
CMD ["python", "-u", "src/main.py"]
