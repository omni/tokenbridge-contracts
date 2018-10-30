FROM node:8

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
