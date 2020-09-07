FROM node:10 as contracts

WORKDIR /contracts

COPY ./package.json .
COPY ./contracts/package.json ./contracts/
COPY ./yarn.lock .

RUN yarn install --frozen-lockfile

COPY ./contracts/truffle-config.js ./contracts/truffle-config.js
COPY ./contracts/contracts ./contracts/contracts/
COPY ./contracts/flatten.sh ./contracts/

RUN yarn build

FROM node:10

WORKDIR /contracts
COPY --from=contracts /contracts/contracts/build ./contracts/build
COPY --from=contracts /contracts/contracts/flats ./contracts/flats

COPY ./package.json .
COPY ./deploy/package.json ./deploy/
COPY ./upgrade/package.json ./upgrade/
COPY ./yarn.lock .

RUN yarn install --frozen-lockfile --production

COPY ./upgrade ./upgrade
COPY deploy.sh deploy.sh
COPY ./deploy ./deploy

ENV PATH="/contracts/:${PATH}"
ENV NOFLAT=true
