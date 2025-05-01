FROM node:22.15.0-slim

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install

COPY . .
CMD yarn start
