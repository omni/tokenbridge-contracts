FROM node:10

RUN apt-get update
RUN apt-get install -y netcat
RUN apt-get clean

WORKDIR /contracts

COPY package.json .
COPY package-lock.json .
RUN npm install

COPY ./deploy/package.json ./deploy/
COPY ./deploy/package-lock.json ./deploy/
RUN cd ./deploy; npm install; cd ..

COPY . .
RUN npm run compile
RUN bash flatten.sh

ENV PATH="/contracts/:${PATH}"
