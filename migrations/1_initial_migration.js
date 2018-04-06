var Migrations = artifacts.require("./Migrations.sol");

module.exports = async function(deployer, network, accounts) {
  const PROXY_OWNER = process.env.PROXY_OWNER || accounts[0];
  await deployer.deploy(Migrations, {from: PROXY_OWNER});
};
