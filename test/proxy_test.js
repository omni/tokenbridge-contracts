const POA20 = artifacts.require("./POA20.sol");
const BridgeValidators = artifacts.require("./BridgeValidators.sol");
const HomeBridge = artifacts.require("./HomeBridge.sol");
const ForeignBridge = artifacts.require("./ForeignBridge.sol");
const EternalStorageProxy = artifacts.require('EternalStorageProxy')

const {ERROR_MSG, ERROR_MSG_OPCODE, ZERO_ADDRESS} = require('./setup');

contract('EternalStorageProxy', async ([owner, investor, stranger, trusted, validator1]) => {
  let eternalStorageProxy;

  beforeEach(async () => {
    eternalStorageProxy = await EternalStorageProxy.new();
  })

  it('can\'t send ETH to storage proxy if implementation is not set', async () => {
    await eternalStorageProxy.sendTransaction({
      from: stranger,
      value: 1
    }).should.be.rejectedWith(ERROR_MSG);
  })

  it('proxy ownership can be transferred', async () => {
    assert.equal(await eternalStorageProxy.proxyOwner(), owner);
    await eternalStorageProxy.transferProxyOwnership(trusted, { from: owner });
    assert.equal(await eternalStorageProxy.proxyOwner(), trusted);
  })

  it('only the proxy owner can transfer proxy ownership', async () => {
    assert.equal(await eternalStorageProxy.proxyOwner(), owner);
    await eternalStorageProxy.transferProxyOwnership(stranger, { from: stranger }).should.be.rejectedWith(ERROR_MSG);
    assert.equal(await eternalStorageProxy.proxyOwner(), owner);
  })

  it('can\'t accidentally transfer proxy ownership to null address', async () => {
    assert.equal(await eternalStorageProxy.proxyOwner(), owner);
    await eternalStorageProxy.transferProxyOwnership(0x0, { from: owner }).should.be.rejectedWith(ERROR_MSG);
    assert.equal(await eternalStorageProxy.proxyOwner(), owner);
  })

  it('can\'t upgrade the implementation of bridge validator to the current implementation', async () => {
    let bridgeValidator = await BridgeValidators.new({ from: trusted });
    await eternalStorageProxy.upgradeTo('1', bridgeValidator.address);
    await eternalStorageProxy.upgradeTo('2', bridgeValidator.address).should.be.rejectedWith(ERROR_MSG);
  })

  it('upgradeToAndCall function can only be called by the proxy owner', async () => {
    let bridgeValidator = await BridgeValidators.new();
    let initData = await bridgeValidator.contract.initialize.getData(1, [validator1], trusted);
    await eternalStorageProxy.upgradeToAndCall('1', bridgeValidator.address, initData, { from: stranger }).should.be.rejectedWith(ERROR_MSG);
  })

  it('upgradeToAndCall function calls the fallback function', async () => {
    let bridgeValidator = await BridgeValidators.new();
    let initData = await bridgeValidator.contract.initialize.getData(1, [validator1], owner);
    await eternalStorageProxy.upgradeToAndCall('1', bridgeValidator.address, initData);
  })

  describe('#initialize', async () => {
    let bridgeValidator;

    beforeEach(async () => {
      bridgeValidator = await BridgeValidators.new({ from: trusted });
      await bridgeValidator.initialize(1, [validator1], trusted, { from: trusted });
      await eternalStorageProxy.upgradeTo('1', bridgeValidator.address);
    })

    it('version should return as expected', async () => {
      assert.equal(await eternalStorageProxy.version.call(), '1');
    })

    it('bridgeValidator has owner set correctly should return as expected', async () => {
      assert.equal(await bridgeValidator.owner.call(), trusted);
    })

    it('bridgeValidator can have ownership transferred', async () => {
      assert.equal(await bridgeValidator.owner.call(), trusted);
      await bridgeValidator.transferOwnership(owner, { from: trusted })
      assert.equal(await bridgeValidator.owner.call(), owner);
    })

    it('bridgeValidator can\'t transfer ownership to the null address', async () => {
      assert.equal(await bridgeValidator.owner.call(), trusted);
      await bridgeValidator.transferOwnership(0x0, { from: trusted }).should.be.rejectedWith(ERROR_MSG);
      assert.equal(await bridgeValidator.owner.call(), trusted);
    })

    it('bridgeValidator can only have ownership transferred by the owner', async () => {
      assert.equal(await bridgeValidator.owner.call(), trusted);
      await bridgeValidator.transferOwnership(owner, { from: stranger }).should.be.rejectedWith(ERROR_MSG);
      assert.equal(await bridgeValidator.owner.call(), trusted);
    })


  })
})
