const fs = require('fs');
const assert = require('assert');
require('dotenv').config();
const Tx = require('ethereumjs-tx');

const HOME_RPC_URL = process.env.HOME_RPC_URL;
const HOME_PROXY_OWNER = process.env.HOME_PROXY_OWNER;
const HOME_PROXY_OWNER_PRIVATE_KEY = process.env.HOME_PROXY_OWNER_PRIVATE_KEY;
const homeProxyOwnerPrivateKey = Buffer.from(HOME_PROXY_OWNER_PRIVATE_KEY, 'hex')

const REQUIRED_NUMBER_OF_VALIDATORS = process.env.REQUIRED_NUMBER_OF_VALIDATORS;
const VALIDATORS = process.env.VALIDATORS.split(" ")

const HOME_DAILY_LIMIT = process.env.HOME_DAILY_LIMIT || '1000000000000000000' // 1 ether
const HOME_MAX_AMOUNT_PER_TX = process.env.HOME_MAX_AMOUNT_PER_TX || '100000000000000000' // 0.1 ether
const HOME_MIN_AMOUNT_PER_TX = process.env.HOME_MIN_AMOUNT_PER_TX || '10000000000000000' // 0.01 ether

const FOREIGN_RPC_URL = process.env.FOREIGN_RPC_URL;
const FOREIGN_PROXY_OWNER = process.env.FOREIGN_PROXY_OWNER;
const FOREIGN_PROXY_OWNER_PRIVATE_KEY = process.env.FOREIGN_PROXY_OWNER_PRIVATE_KEY;
const foreignProxyOwnerPrivateKey = Buffer.from(FOREIGN_PROXY_OWNER_PRIVATE_KEY, 'hex')

const FOREIGN_DAILY_LIMIT = process.env.FOREIGN_DAILY_LIMIT || '1000000000000000000' // 1 ether
const FOREIGN_MAX_AMOUNT_PER_TX = process.env.FOREIGN_MAX_AMOUNT_PER_TX || '100000000000000000' // 0.1 ether
const FOREIGN_MIN_AMOUNT_PER_TX = process.env.FOREIGN_MIN_AMOUNT_PER_TX || '10000000000000000' // 0.01 ether


const POA20 = require('../build/contracts/POA20.json');
const EternalStorageProxy = require('../build/contracts/EternalStorageProxy.json');
const BridgeValidators = require('../build/contracts/BridgeValidators.json')
const HomeBridge = require('../build/contracts/HomeBridge.json')
const ForeignBridge = require('../build/contracts/ForeignBridge.json')

const Web3 = require('web3');
const Web3Utils = require('web3-utils')
const homeProvider = new Web3.providers.HttpProvider(HOME_RPC_URL);
const web3Home = new Web3(homeProvider);

const foreignProvider = new Web3.providers.HttpProvider(FOREIGN_RPC_URL);
const web3Foreign = new Web3(foreignProvider);

const GAS_PRICE = Web3Utils.toWei(process.env.GAS_PRICE, 'gwei');
const GAS_LIMIT = '6700000';

async function deployHome(homeNonce) {
  console.log('deploying storage for home validators')
  const storageValidatorsHome = await deployContract(EternalStorageProxy, [], {from: HOME_PROXY_OWNER, nonce: homeNonce})
  console.log('[Home] BridgeValidators Storage: ', storageValidatorsHome.options.address)
  homeNonce++;

  console.log('\ndeploying implementation for home validators')
  let bridgeValidatorsHome = await deployContract(BridgeValidators, [], {from: HOME_PROXY_OWNER, nonce: homeNonce})
  console.log('[Home] BridgeValidators Implementation: ', bridgeValidatorsHome.options.address)
  homeNonce++;

  console.log('\nhooking up eternal storage to BridgeValidators')
  const upgradeToBridgeVHomeData = await storageValidatorsHome.methods.upgradeTo('1', bridgeValidatorsHome.options.address)
    .encodeABI({from: HOME_PROXY_OWNER});
  const txUpgradeToBridgeVHome = await sendRawTx({
    data: upgradeToBridgeVHomeData,
    nonce: homeNonce,
    to: storageValidatorsHome.options.address,
    privateKey: homeProxyOwnerPrivateKey,
    web3: web3Home
  })
  assert.equal(txUpgradeToBridgeVHome.status, '0x1', 'Transaction Failed');
  homeNonce++;
  console.log('[Home] TxHash: ' , txUpgradeToBridgeVHome.transactionHash)

  console.log('\ninitializing Home Bridge Validators with following parameters:')
  console.log(`\tREQUIRED_NUMBER_OF_VALIDATORS: ${REQUIRED_NUMBER_OF_VALIDATORS}, VALIDATORS: ${VALIDATORS}`)
  bridgeValidatorsHome.options.address = storageValidatorsHome.options.address
  const initializeData = await bridgeValidatorsHome.methods.initialize(
    REQUIRED_NUMBER_OF_VALIDATORS, VALIDATORS, HOME_PROXY_OWNER
  ).encodeABI({from: HOME_PROXY_OWNER})
  const txInitialize = await sendRawTx({
    data: initializeData,
    nonce: homeNonce,
    to: bridgeValidatorsHome.options.address,
    privateKey: homeProxyOwnerPrivateKey,
    web3: web3Home
  })
  homeNonce++;
  console.log('[Home] TxHash: ',txInitialize.transactionHash)

  console.log('\ndeploying homeBridge storage\n')
  const homeBridgeStorage = await deployContract(EternalStorageProxy, [], {from: HOME_PROXY_OWNER, nonce: homeNonce})
  homeNonce++;
  console.log('[Home] HomeBridge Storage: ', homeBridgeStorage.options.address)

  console.log('\ndeploying homeBridge implementation\n')
  const homeBridgeImplementation = await deployContract(HomeBridge, [], {from: HOME_PROXY_OWNER, nonce: homeNonce})
  homeNonce++;
  console.log('[Home] HomeBridge Implementation: ', homeBridgeImplementation.options.address)

  console.log('\nhooking up HomeBridge storage to HomeBridge implementation')
  const upgradeToHomeBridgeData = await homeBridgeStorage.methods.upgradeTo('1', homeBridgeImplementation.options.address)
    .encodeABI({from: HOME_PROXY_OWNER});
  const txUpgradeToHomeBridge = await sendRawTx({
    data: upgradeToHomeBridgeData,
    nonce: homeNonce,
    to: homeBridgeStorage.options.address,
    privateKey: homeProxyOwnerPrivateKey,
    web3: web3Home
  })
  assert.equal(txUpgradeToHomeBridge.status, '0x1', 'Transaction Failed');
  homeNonce++;
  console.log('[Home] TxHash: ' , txUpgradeToHomeBridge.transactionHash)

  console.log('\ninitializing Home Bridge with following parameters:')
  console.log(`\t Home Validators: ${storageValidatorsHome.options.address},
  HOME_DAILY_LIMIT : ${HOME_DAILY_LIMIT} which is ${Web3Utils.fromWei(HOME_DAILY_LIMIT)} in eth,
  HOME_MAX_AMOUNT_PER_TX: ${HOME_MAX_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(HOME_MAX_AMOUNT_PER_TX)} in eth,
  HOME_MIN_AMOUNT_PER_TX: ${HOME_MIN_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(HOME_MIN_AMOUNT_PER_TX)} in eth,
  `)
  homeBridgeImplementation.options.address = homeBridgeStorage.options.address
  const initializeHomeBridgeData = await homeBridgeImplementation.methods.initialize(
    storageValidatorsHome.options.address, HOME_DAILY_LIMIT, HOME_MAX_AMOUNT_PER_TX, HOME_MIN_AMOUNT_PER_TX
  ).encodeABI({from: HOME_PROXY_OWNER});
  const txInitializeHomeBridge = await sendRawTx({
    data: initializeHomeBridgeData,
    nonce: homeNonce,
    to: homeBridgeStorage.options.address,
    privateKey: homeProxyOwnerPrivateKey,
    web3: web3Home
  });
  assert.equal(txInitializeHomeBridge.status, '0x1', 'Transaction Failed');
  homeNonce++;
  console.log('[Home] TxHash: ',txInitializeHomeBridge.transactionHash)

  console.log('\nHome Deployment Bridge is complete\n')
  return {address: homeBridgeStorage.options.address, deployedBlockNumber: homeBridgeStorage.deployedBlockNumber}

}

async function deployForeign(foreignNonce) {
  console.log('========================================')
  console.log('deploying ForeignBridge')
  console.log('========================================\n')

  console.log('\n[Foreign] deploying POA20 token')
  const poa20foreign = await deployContract(POA20, ["POA ERC20 on Foundation", "POA20", 18], {from: FOREIGN_PROXY_OWNER, network: 'foreign', nonce: foreignNonce})
  foreignNonce++;
  console.log('[Foreign] POA20: ', poa20foreign.options.address)


  console.log('deploying storage for foreign validators')
  const storageValidatorsForeign = await deployContract(EternalStorageProxy, [], {from: FOREIGN_PROXY_OWNER, network: 'foreign', nonce: foreignNonce})
  foreignNonce++;
  console.log('[Foreign] BridgeValidators Storage: ', storageValidatorsForeign.options.address)

  console.log('\ndeploying implementation for foreign validators')
  let bridgeValidatorsForeign = await deployContract(BridgeValidators, [], {from: FOREIGN_PROXY_OWNER, network: 'foreign', nonce: foreignNonce})
  foreignNonce++;
  console.log('[Foreign] BridgeValidators Implementation: ', bridgeValidatorsForeign.options.address)

  console.log('\nhooking up eternal storage to BridgeValidators')
  const upgradeToBridgeVForeignData = await storageValidatorsForeign.methods.upgradeTo('1', bridgeValidatorsForeign.options.address)
    .encodeABI({from: FOREIGN_PROXY_OWNER});
  const txUpgradeToBridgeVForeign = await sendRawTx({
    data: upgradeToBridgeVForeignData,
    nonce: foreignNonce,
    to: storageValidatorsForeign.options.address,
    privateKey: foreignProxyOwnerPrivateKey,
    web3: web3Foreign
  });
  assert.equal(txUpgradeToBridgeVForeign.status, '0x1', 'Transaction Failed');
  foreignNonce++;
  console.log('[Foreign] TxHash: ' , txUpgradeToBridgeVForeign.transactionHash)

  console.log('\ninitializing Foreign Bridge Validators with following parameters:')
  console.log(`\tREQUIRED_NUMBER_OF_VALIDATORS: ${REQUIRED_NUMBER_OF_VALIDATORS}, VALIDATORS: ${VALIDATORS}`)
  bridgeValidatorsForeign.options.address = storageValidatorsForeign.options.address
  const initializeForeignData = await bridgeValidatorsForeign.methods.initialize(
    REQUIRED_NUMBER_OF_VALIDATORS, VALIDATORS, FOREIGN_PROXY_OWNER
  ).encodeABI({from: FOREIGN_PROXY_OWNER});
  const txInitializeForeign = await sendRawTx({
    data: initializeForeignData,
    nonce: foreignNonce,
    to: bridgeValidatorsForeign.options.address,
    privateKey: foreignProxyOwnerPrivateKey,
    web3: web3Foreign
  });
  assert.equal(txInitializeForeign.status, '0x1', 'Transaction Failed');
  foreignNonce++;
  console.log('[Foreign] TxHash: ',txInitializeForeign.transactionHash)


  console.log('\ndeploying foreignBridge storage\n')
  const foreignBridgeStorage = await deployContract(EternalStorageProxy, [], {from: FOREIGN_PROXY_OWNER, network: 'foreign', nonce: foreignNonce})
  foreignNonce++;
  console.log('[Foreign] ForeignBridge Storage: ', foreignBridgeStorage.options.address)

  console.log('\ndeploying foreignBridge implementation\n')
  const foreignBridgeImplementation = await deployContract(ForeignBridge, [], {from: FOREIGN_PROXY_OWNER, network: 'foreign', nonce: foreignNonce})
  foreignNonce++;
  console.log('[Foreign] ForeignBridge Implementation: ', foreignBridgeImplementation.options.address)

  console.log('\nhooking up ForeignBridge storage to ForeignBridge implementation')
  const upgradeToForeignBridgeData = await foreignBridgeStorage.methods.upgradeTo('1', foreignBridgeImplementation.options.address)
    .encodeABI({from: FOREIGN_PROXY_OWNER});
  const txUpgradeToForeignBridge = await sendRawTx({
    data: upgradeToForeignBridgeData,
    nonce: foreignNonce,
    to: foreignBridgeStorage.options.address,
    privateKey: foreignProxyOwnerPrivateKey,
    web3: web3Foreign
  });
  assert.equal(txUpgradeToForeignBridge.status, '0x1', 'Transaction Failed');
  foreignNonce++;
  console.log('[Foreign] TxHash: ' , txUpgradeToForeignBridge.transactionHash)

  console.log('\ninitializing Foreign Bridge with following parameters:')
  console.log(`\t Foreign Validators: ${storageValidatorsForeign.options.address},
  FOREIGN_DAILY_LIMIT : ${FOREIGN_DAILY_LIMIT} which is ${Web3Utils.fromWei(FOREIGN_DAILY_LIMIT)} in eth,
  FOREIGN_MAX_AMOUNT_PER_TX: ${FOREIGN_MAX_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(FOREIGN_MAX_AMOUNT_PER_TX)} in eth,
  FOREIGN_MIN_AMOUNT_PER_TX: ${FOREIGN_MIN_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(FOREIGN_MIN_AMOUNT_PER_TX)} in eth
  `)
  foreignBridgeImplementation.options.address = foreignBridgeStorage.options.address
  const initializeFBridgeData = await foreignBridgeImplementation.methods.initialize(
    storageValidatorsForeign.options.address, poa20foreign.options.address, FOREIGN_DAILY_LIMIT, FOREIGN_MAX_AMOUNT_PER_TX, FOREIGN_MIN_AMOUNT_PER_TX
  ).encodeABI({from: FOREIGN_PROXY_OWNER});
  const txInitializeBridge = await sendRawTx({
    data: initializeFBridgeData,
    nonce: foreignNonce,
    to: foreignBridgeStorage.options.address,
    privateKey: foreignProxyOwnerPrivateKey,
    web3: web3Foreign
  });
  assert.equal(txInitializeBridge.status, '0x1', 'Transaction Failed');
  foreignNonce++;
  console.log('[Foreign] TxHash: ',txInitializeBridge.transactionHash)

  console.log('transferring ownership of POA20 token to foreignBridge contract')
  const txOwnershipData = await poa20foreign.methods.transferOwnership(foreignBridgeStorage.options.address)
          .encodeABI({from: FOREIGN_PROXY_OWNER})
  const txOwnership = await sendRawTx({
    data: txOwnershipData,
    nonce: foreignNonce,
    to: poa20foreign.options.address,
    privateKey: foreignProxyOwnerPrivateKey,
    web3: web3Foreign
  });
  assert.equal(txOwnership.status, '0x1', 'Transaction Failed');
  foreignNonce++;
  console.log('[Foreign] TxHash: ', txOwnership.transactionHash)
  return {
    foreignBridge: {address: foreignBridgeStorage.options.address, deployedBlockNumber: foreignBridgeStorage.deployedBlockNumber},
    erc677: {address: poa20foreign.options.address}
  }
}

async function main() {
  let homeNonce = await web3Home.eth.getTransactionCount(HOME_PROXY_OWNER);
  let foreignNonce = await web3Foreign.eth.getTransactionCount(FOREIGN_PROXY_OWNER);
  const homeBridge = await deployHome(homeNonce)
  const {foreignBridge, erc677} = await deployForeign(foreignNonce);
  console.log("\nDeployment has been completed.\n\n")
  console.log('[   Home  ] HomeBridge: ', homeBridge.address)
  console.log('[ Foreign ] ForeignBridge: ', foreignBridge.address)
  console.log('[ Foreign ] POA20: ', erc677.address)
  fs.writeFileSync('./bridgeDeploymentResults.json', JSON.stringify({
    homeBridge: {
      ...homeBridge,
      bytecode: HomeBridge.bytecode.substr(2)
    },foreignBridge: {
      ...foreignBridge,
      bytecode: ForeignBridge.bytecode.substr(2)
    },erc677
  },null,4));
  console.log('Contracts Deployment have been saved to `bridgeDeploymentResults.json`')
}


async function deployContract(contractJson, args, {from, network, nonce}) {
  const {web3, privateKey} = network === 'foreign' ? {web3: web3Foreign, privateKey: foreignProxyOwnerPrivateKey}: {web3: web3Home, privateKey: homeProxyOwnerPrivateKey};
  const options = {
    from,
    gasPrice: GAS_PRICE,
    gas: GAS_LIMIT
  };
  let instance = new web3.eth.Contract(contractJson.abi, options);
  const result = await instance.deploy({
    data: contractJson.bytecode,
    arguments: args
  }).encodeABI()
  const tx = await sendRawTx({
    data: result,
    nonce: Web3Utils.toHex(nonce),
    to: null,
    privateKey,
    web3
  })
  if(tx.status !== '0x1'){
    throw new Error('Tx failed');
  }
  instance.options.address = tx.contractAddress;
  instance.deployedBlockNumber = tx.blockNumber
  return instance;
}

async function sendRawTx({data, nonce, to, privateKey, web3}) {
  var rawTx = {
    nonce,
    gasPrice: Web3Utils.toHex(GAS_PRICE),
    gasLimit:  Web3Utils.toHex('6700000'),
    to,
    data
  }
  var tx = new Tx(rawTx);
  tx.sign(privateKey);
  var serializedTx = tx.serialize();
  return await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'));
}
main()
