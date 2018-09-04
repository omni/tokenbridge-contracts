const Web3Utils = require('web3-utils');
const HomeBridge = artifacts.require("HomeBridgeErcToErc.sol");
const EternalStorageProxy = artifacts.require("EternalStorageProxy.sol");
const BridgeValidators = artifacts.require("BridgeValidators.sol");
const ERC677BridgeToken = artifacts.require("ERC677BridgeToken.sol");
const {ERROR_MSG, ZERO_ADDRESS} = require('../setup');
const {createMessage, sign, signatureToVRS} = require('../helpers/helpers');
const minPerTx = web3.toBigNumber(web3.toWei(0.01, "ether"));
const requireBlockConfirmations = 8;
const gasPrice = Web3Utils.toWei('1', 'gwei');
const oneEther = web3.toBigNumber(web3.toWei(1, "ether"));
const halfEther = web3.toBigNumber(web3.toWei(0.5, "ether"));


contract('HomeBridge_AMB', async (accounts) => {
  let homeContract, validatorContract, authorities, owner, token;
  before(async () => {
    validatorContract = await BridgeValidators.new()
    authorities = [accounts[1]];
    owner = accounts[0]
    await validatorContract.initialize(1, authorities, owner)
  })
})
