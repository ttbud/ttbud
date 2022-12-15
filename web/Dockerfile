FROM node:19

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install

COPY . .
CMD yarn start
