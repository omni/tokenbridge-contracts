module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 7545,
      network_id: "*" // Match any network id
    },
    parity: {
      host: "localhost",
      port: "8591",
      network_id: "*",
      gas: 4700000,
      gasPrice: 1000000000
    }
  }
};
