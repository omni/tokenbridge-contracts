module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 7545,
      network_id: "*",
      gasPrice: 1000000000
    },
    test: {
      host: "localhost",
      port: 7545,
      network_id: "*",
      gasPrice: 1000000000
    },
    parity: {
      host: "localhost",
      port: "8591",
      network_id: "*",
      gas: 4700000,
      gasPrice: 1000000000
    },
    core: {
      host: "localhost",
      port: "8777",
      network_id: "*",
      gas: 4700000,
      gasPrice: 1000000000
    },
    sokol: {
      host: "localhost",
      port: "8545",
      network_id: "*",
      gas: 4700000,
      gasPrice: 1000000000
    }
  }
};
