FROM node:8

WORKDIR /contracts

COPY package.json .
COPY package-lock.json .
RUN npm install

COPY ./deploy/package.json ./deploy/
COPY ./deploy/package-lock.json ./deploy/
RUN npm install deploy

COPY . .
RUN npm run compile

ENV PATH="/contracts/:${PATH}"
