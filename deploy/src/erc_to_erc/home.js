const Web3Utils = require('web3-utils')
require('dotenv').config({
  path: __dirname + '../../.env'
});

const assert = require('assert');

const {deployContract, privateKeyToAddress, sendRawTx} = require('../deploymentUtils');
const {web3Home, deploymentPrivateKey, HOME_RPC_URL} = require('../web3');

const EternalStorageProxy = require('../../../build/contracts/EternalStorageProxy.json');
const BridgeValidators = require('../../../build/contracts/BridgeValidators.json')
const HomeBridge = require('../../../build/contracts/HomeBridgeErcToErc.json')
const ERC677BridgeToken = require('../../../build/contracts/ERC677BridgeToken.json');

const VALIDATORS = process.env.VALIDATORS.split(" ")
const HOME_GAS_PRICE =  Web3Utils.toWei(process.env.HOME_GAS_PRICE, 'gwei');

const {
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  REQUIRED_NUMBER_OF_VALIDATORS,
  HOME_OWNER_MULTISIG,
  HOME_UPGRADEABLE_ADMIN_VALIDATORS,
  HOME_UPGRADEABLE_ADMIN_BRIDGE,
  HOME_DAILY_LIMIT,
  HOME_MAX_AMOUNT_PER_TX,
  HOME_MIN_AMOUNT_PER_TX,
  HOME_REQUIRED_BLOCK_CONFIRMATIONS,
  HOME_BRIDGEABLE_TOKEN_NAME,
  HOME_BRIDGEABLE_TOKEN_SYMBOL,
  HOME_BRIDGEABLE_TOKEN_DECIMALS,

} = process.env;

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function deployHome()
{
  let homeNonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS);
  console.log('deploying storage for home validators')
  const storageValidatorsHome = await deployContract(EternalStorageProxy, [], {from: DEPLOYMENT_ACCOUNT_ADDRESS, nonce: homeNonce})
  console.log('[Home] BridgeValidators Storage: ', storageValidatorsHome.options.address)
  homeNonce++;

  console.log('\ndeploying implementation for home validators')
  let bridgeValidatorsHome = await deployContract(BridgeValidators, [], {from: DEPLOYMENT_ACCOUNT_ADDRESS, nonce: homeNonce})
  console.log('[Home] BridgeValidators Implementation: ', bridgeValidatorsHome.options.address)
  homeNonce++;

  console.log('\nhooking up eternal storage to BridgeValidators')
  const upgradeToBridgeVHomeData = await storageValidatorsHome.methods.upgradeTo('1', bridgeValidatorsHome.options.address)
    .encodeABI({from: DEPLOYMENT_ACCOUNT_ADDRESS});
  const txUpgradeToBridgeVHome = await sendRawTx({
    data: upgradeToBridgeVHomeData,
    nonce: homeNonce,
    to: storageValidatorsHome.options.address,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  })
  assert.equal(txUpgradeToBridgeVHome.status, '0x1', 'Transaction Failed');
  homeNonce++;

  console.log('\ninitializing Home Bridge Validators with following parameters:\n')
  console.log(`REQUIRED_NUMBER_OF_VALIDATORS: ${REQUIRED_NUMBER_OF_VALIDATORS}, VALIDATORS: ${VALIDATORS}`)
  bridgeValidatorsHome.options.address = storageValidatorsHome.options.address
  const initializeData = await bridgeValidatorsHome.methods.initialize(
    REQUIRED_NUMBER_OF_VALIDATORS, VALIDATORS, HOME_OWNER_MULTISIG
  ).encodeABI({from: DEPLOYMENT_ACCOUNT_ADDRESS})
  const txInitialize = await sendRawTx({
    data: initializeData,
    nonce: homeNonce,
    to: bridgeValidatorsHome.options.address,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  })
  assert.equal(txInitialize.status, '0x1', 'Transaction Failed');
  const validatorOwner = await bridgeValidatorsHome.methods.owner().call();
  assert.equal(validatorOwner.toLocaleLowerCase(), HOME_OWNER_MULTISIG.toLocaleLowerCase());
  homeNonce++;

  console.log('transferring proxy ownership to multisig for Validators Proxy contract');
  const proxyDataTransfer = await storageValidatorsHome.methods.transferProxyOwnership(HOME_UPGRADEABLE_ADMIN_VALIDATORS).encodeABI();
  const txProxyDataTransfer = await sendRawTx({
    data: proxyDataTransfer,
    nonce: homeNonce,
    to: storageValidatorsHome.options.address,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  })
  assert.equal(txProxyDataTransfer.status, '0x1', 'Transaction Failed');
  const newProxyOwner = await storageValidatorsHome.methods.proxyOwner().call();
  assert.equal(newProxyOwner.toLocaleLowerCase(), HOME_UPGRADEABLE_ADMIN_VALIDATORS.toLocaleLowerCase());
  homeNonce++;

  console.log('\ndeploying homeBridge storage\n')
  const homeBridgeStorage = await deployContract(EternalStorageProxy, [], {from: DEPLOYMENT_ACCOUNT_ADDRESS, nonce: homeNonce})
  homeNonce++;
  console.log('[Home] HomeBridge Storage: ', homeBridgeStorage.options.address)

  console.log('\ndeploying homeBridge implementation\n')
  const homeBridgeImplementation = await deployContract(HomeBridge, [], {from: DEPLOYMENT_ACCOUNT_ADDRESS, nonce: homeNonce})
  homeNonce++;
  console.log('[Home] HomeBridge Implementation: ', homeBridgeImplementation.options.address)

  console.log('\nhooking up HomeBridge storage to HomeBridge implementation')
  const upgradeToHomeBridgeData = await homeBridgeStorage.methods.upgradeTo('1', homeBridgeImplementation.options.address)
    .encodeABI({from: DEPLOYMENT_ACCOUNT_ADDRESS});
  const txUpgradeToHomeBridge = await sendRawTx({
    data: upgradeToHomeBridgeData,
    nonce: homeNonce,
    to: homeBridgeStorage.options.address,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  })
  assert.equal(txUpgradeToHomeBridge.status, '0x1', 'Transaction Failed');
  homeNonce++;

  console.log('\n[Home] deploying Bridgeble token')
  const erc677token = await deployContract(ERC677BridgeToken,
    [HOME_BRIDGEABLE_TOKEN_NAME, HOME_BRIDGEABLE_TOKEN_SYMBOL, HOME_BRIDGEABLE_TOKEN_DECIMALS],
    {from: DEPLOYMENT_ACCOUNT_ADDRESS, network: 'home', nonce: homeNonce}
  )
  homeNonce++;
  console.log('[Home] Bridgeble Token: ', erc677token.options.address)

  console.log('transferring ownership of Bridgeble token to homeBridge contract')
  const txOwnershipData = await erc677token.methods.transferOwnership(homeBridgeStorage.options.address)
          .encodeABI({from: DEPLOYMENT_ACCOUNT_ADDRESS})
  const txOwnership = await sendRawTx({
    data: txOwnershipData,
    nonce: homeNonce,
    to: erc677token.options.address,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  });
  assert.equal(txOwnership.status, '0x1', 'Transaction Failed');
  homeNonce++;

  console.log('\ninitializing Home Bridge with following parameters:\n')
  console.log(`Home Validators: ${storageValidatorsHome.options.address},
  HOME_DAILY_LIMIT : ${HOME_DAILY_LIMIT} which is ${Web3Utils.fromWei(HOME_DAILY_LIMIT)} in eth,
  HOME_MAX_AMOUNT_PER_TX: ${HOME_MAX_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(HOME_MAX_AMOUNT_PER_TX)} in eth,
  HOME_MIN_AMOUNT_PER_TX: ${HOME_MIN_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(HOME_MIN_AMOUNT_PER_TX)} in eth,
  HOME_GAS_PRICE: ${HOME_GAS_PRICE}, HOME_REQUIRED_BLOCK_CONFIRMATIONS : ${HOME_REQUIRED_BLOCK_CONFIRMATIONS}
  `)
  homeBridgeImplementation.options.address = homeBridgeStorage.options.address
  const initializeHomeBridgeData = await homeBridgeImplementation.methods.initialize(
    storageValidatorsHome.options.address,
    HOME_DAILY_LIMIT,
    HOME_MAX_AMOUNT_PER_TX,
    HOME_MIN_AMOUNT_PER_TX,
    HOME_GAS_PRICE,
    HOME_REQUIRED_BLOCK_CONFIRMATIONS,
    erc677token.options.address
  ).encodeABI({from: DEPLOYMENT_ACCOUNT_ADDRESS});
  const txInitializeHomeBridge = await sendRawTx({
    data: initializeHomeBridgeData,
    nonce: homeNonce,
    to: homeBridgeStorage.options.address,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  });
  assert.equal(txInitializeHomeBridge.status, '0x1', 'Transaction Failed');
  homeNonce++;

  console.log('transferring proxy ownership to multisig for Home bridge Proxy contract');
  const homeBridgeProxyData = await homeBridgeStorage.methods.transferProxyOwnership(HOME_UPGRADEABLE_ADMIN_BRIDGE).encodeABI();
  const txhomeBridgeProxyData = await sendRawTx({
    data: homeBridgeProxyData,
    nonce: homeNonce,
    to: homeBridgeStorage.options.address,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  })
  assert.equal(txhomeBridgeProxyData.status, '0x1', 'Transaction Failed');
  const newProxyBridgeOwner = await homeBridgeStorage.methods.proxyOwner().call();
  assert.equal(newProxyBridgeOwner.toLocaleLowerCase(), HOME_UPGRADEABLE_ADMIN_BRIDGE.toLocaleLowerCase());
  homeNonce++;

  console.log('\nHome Deployment Bridge is complete\n')
  return {
    homeBridgeAddress: homeBridgeStorage.options.address,
    erc677tokenAddress: erc677token.options.address,
    deployedBlockNumber: Web3Utils.hexToNumber(homeBridgeStorage.deployedBlockNumber)
  }

}
module.exports = deployHome;
