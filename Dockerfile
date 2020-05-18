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

COPY ./upgrade/package.json ./upgrade/
COPY ./upgrade/package-lock.json ./upgrade/
RUN cd ./upgrade; npm install; cd ..

COPY ./scripts ./scripts

COPY truffle-config.js truffle-config.js
COPY ./contracts ./contracts
RUN npm run compile

COPY flatten.sh flatten.sh
RUN bash flatten.sh

COPY .eslintignore .eslintignore
COPY .eslintrc .eslintrc
COPY .prettierrc .prettierrc

COPY ./upgrade ./upgrade
COPY deploy.sh deploy.sh
COPY ./deploy ./deploy
COPY .solhint.json .solhint.json
COPY codechecks.yml codechecks.yml
COPY ./test ./test

ENV PATH="/contracts/:${PATH}"
ENV NOFLAT=true
