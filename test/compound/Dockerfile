FROM node:13

RUN wget https://github.com/ethereum/solidity/releases/download/v0.5.16/solc-static-linux -O /usr/local/bin/solc
RUN chmod +x /usr/local/bin/solc

RUN git clone https://github.com/compound-finance/compound-protocol.git

WORKDIR /compound-protocol

RUN yarn
RUN cd scenario && yarn

RUN yarn compile
RUN scenario/script/tsc

COPY entrypoint.scen ./

ENV PROVIDER='http://ganache:8545'
ENV NO_TSC=1

ENTRYPOINT ["yarn", "repl"]
CMD ["-s", "entrypoint.scen", "c", "t"]
