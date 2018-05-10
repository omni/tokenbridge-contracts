const Web3Utils = require('web3-utils');
const HomeBridge = artifacts.require("HomeBridge.sol");
const EternalStorageProxy = artifacts.require("EternalStorageProxy.sol");
const BridgeValidators = artifacts.require("BridgeValidators.sol");
const {ERROR_MSG, ZERO_ADDRESS} = require('./setup');
const {createMessage, sign, signatureToVRS} = require('./helpers/helpers');
const minPerTx = web3.toBigNumber(web3.toWei(0.01, "ether"));
const requireBlockConfirmations = 8;
const gasPrice = Web3Utils.toWei('1', 'gwei');

contract('HomeBridge', async (accounts) => {
  let homeContract, validatorContract, authorities, owner;
  before(async () => {
    validatorContract = await BridgeValidators.new()
    authorities = [accounts[1]];
    owner = accounts[0]
    await validatorContract.initialize(1, authorities, owner)
  })
  describe('#initialize', async() => {
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
    })
    it('sets variables', async () => {
      ZERO_ADDRESS.should.be.equal(await homeContract.validatorContract())
      '0'.should.be.bignumber.equal(await homeContract.deployedAtBlock())
      '0'.should.be.bignumber.equal(await homeContract.homeDailyLimit())
      '0'.should.be.bignumber.equal(await homeContract.maxPerTx())
      false.should.be.equal(await homeContract.isInitialized())
      await homeContract.initialize(validatorContract.address, '3', '2', '1', gasPrice, requireBlockConfirmations).should.be.fulfilled;
      true.should.be.equal(await homeContract.isInitialized())
      validatorContract.address.should.be.equal(await homeContract.validatorContract());
      (await homeContract.deployedAtBlock()).should.be.bignumber.above(0);
      '3'.should.be.bignumber.equal(await homeContract.homeDailyLimit())
      '2'.should.be.bignumber.equal(await homeContract.maxPerTx())
      '1'.should.be.bignumber.equal(await homeContract.minPerTx())
    })
    it('cant set maxPerTx > homeDailyLimit', async () => {
      false.should.be.equal(await homeContract.isInitialized())
      await homeContract.initialize(validatorContract.address, '1', '2', '1', gasPrice, requireBlockConfirmations).should.be.rejectedWith(ERROR_MSG);
      await homeContract.initialize(validatorContract.address, '3', '2', '2', gasPrice, requireBlockConfirmations).should.be.rejectedWith(ERROR_MSG);
      false.should.be.equal(await homeContract.isInitialized())
    })

    it('can be deployed via upgradeToAndCall', async () => {
      let storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      let data = homeContract.initialize.request(validatorContract.address, "3", "2", "1", gasPrice, requireBlockConfirmations).params[0].data
      await storageProxy.upgradeToAndCall('1', homeContract.address, data).should.be.fulfilled;
      let finalContract = await HomeBridge.at(storageProxy.address);
      true.should.be.equal(await finalContract.isInitialized());
      validatorContract.address.should.be.equal(await finalContract.validatorContract())
      "3".should.be.bignumber.equal(await finalContract.homeDailyLimit())
      "2".should.be.bignumber.equal(await finalContract.maxPerTx())
      "1".should.be.bignumber.equal(await finalContract.minPerTx())
    })
  })

  describe('#fallback', async () => {
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
      await homeContract.initialize(validatorContract.address, '3', '2', '1', gasPrice, requireBlockConfirmations)
    })
    it('should accept POA', async () => {
      const currentDay = await homeContract.getCurrentDay()
      '0'.should.be.bignumber.equal(await homeContract.totalSpentPerDay(currentDay))
      const {logs} = await homeContract.sendTransaction({
        from: accounts[1],
        value: 1
      }).should.be.fulfilled
      '1'.should.be.bignumber.equal(await homeContract.totalSpentPerDay(currentDay))
      await homeContract.sendTransaction({
        from: accounts[1],
        value: 3
      }).should.be.rejectedWith(ERROR_MSG);
      logs[0].event.should.be.equal('Deposit')
      logs[0].args.should.be.deep.equal({
        recipient: accounts[1],
        value: new web3.BigNumber(1)
      })
      await homeContract.setHomeDailyLimit(4).should.be.fulfilled;
      await homeContract.sendTransaction({
        from: accounts[1],
        value: 1
      }).should.be.fulfilled
      '2'.should.be.bignumber.equal(await homeContract.totalSpentPerDay(currentDay))
    })

    it('doesnt let you send more than max amount per tx', async () => {
      await homeContract.sendTransaction({
        from: accounts[1],
        value: 1
      }).should.be.fulfilled
      await homeContract.sendTransaction({
        from: accounts[1],
        value: 3
      }).should.be.rejectedWith(ERROR_MSG)
      await homeContract.setMaxPerTx(100).should.be.rejectedWith(ERROR_MSG);
      await homeContract.setHomeDailyLimit(100).should.be.fulfilled;
      await homeContract.setMaxPerTx(99).should.be.fulfilled;
      //meets max per tx and daily limit
      await homeContract.sendTransaction({
        from: accounts[1],
        value: 99
      }).should.be.fulfilled
      //above daily limit
      await homeContract.sendTransaction({
        from: accounts[1],
        value: 1
      }).should.be.rejectedWith(ERROR_MSG)

    })

    it('should not let to deposit less than minPerTx', async () => {
      const newDailyLimit = 100;
      const newMaxPerTx = 50;
      const newMinPerTx = 20;
      await homeContract.setHomeDailyLimit(newDailyLimit).should.be.fulfilled;
      await homeContract.setMaxPerTx(newMaxPerTx).should.be.fulfilled;
      await homeContract.setMinPerTx(newMinPerTx).should.be.fulfilled;

      await homeContract.sendTransaction({
        from: accounts[1],
        value: newMinPerTx
      }).should.be.fulfilled
      await homeContract.sendTransaction({
        from: accounts[1],
        value: newMinPerTx - 1
      }).should.be.rejectedWith(ERROR_MSG)
    })
  })
  // describe('#withdraw', async () => {
  //   beforeEach(async () => {
  //     homeContract = await HomeBridge.new()
  //     const oneEther = web3.toBigNumber(web3.toWei(1, "ether"));
  //     const halfEther = web3.toBigNumber(web3.toWei(0.5, "ether"));
  //     await homeContract.initialize(validatorContract.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations);
  //     oneEther.should.be.bignumber.equal(await homeContract.homeDailyLimit());
  //     await homeContract.sendTransaction({
  //       from: accounts[1],
  //       value: halfEther
  //     }).should.be.fulfilled
  //   })
  //   it('should allow to withdraw', async () => {
  //     var recipientAccount = accounts[3];
  //     const balanceBefore = await web3.eth.getBalance(recipientAccount)
  //     const homeBalanceBefore = await web3.eth.getBalance(homeContract.address)
  //     var value = web3.toBigNumber(web3.toWei(0.5, "ether"));
  //     var homeGasPrice = web3.toBigNumber(0);
  //     var transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
  //     var message = createMessage(recipientAccount, value, transactionHash, homeGasPrice);
  //     var signature = await sign(authorities[0], message)
  //     var vrs = signatureToVRS(signature);
  //     false.should.be.equal(await homeContract.withdraws(transactionHash))
  //     const {logs} = await homeContract.withdraw([vrs.v], [vrs.r], [vrs.s], message).should.be.fulfilled
  //     logs[0].event.should.be.equal("Withdraw")
  //     logs[0].args.recipient.should.be.equal(recipientAccount)
  //     logs[0].args.value.should.be.bignumber.equal(value)
  //     logs[0].args.transactionHash.should.be.equal(transactionHash);
  //     const balanceAfter = await web3.eth.getBalance(recipientAccount)
  //     const homeBalanceAfter = await web3.eth.getBalance(homeContract.address)
  //     balanceAfter.should.be.bignumber.equal(balanceBefore.add(value))
  //     homeBalanceAfter.should.be.bignumber.equal(homeBalanceBefore.sub(value))
  //     true.should.be.equal(await homeContract.withdraws(transactionHash))
  //   })
  //   it('should allow second withdraw with different transactionHash but same recipient and value', async ()=> {
  //     var recipientAccount = accounts[3];
  //     const balanceBefore = await web3.eth.getBalance(recipientAccount)
  //     const homeBalanceBefore = await web3.eth.getBalance(homeContract.address)
  //     // tx 1
  //     var value = web3.toBigNumber(web3.toWei(0.25, "ether"));
  //     var homeGasPrice = web3.toBigNumber(0);
  //     var transactionHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
  //     var message = createMessage(recipientAccount, value, transactionHash, homeGasPrice);
  //     var signature = await sign(authorities[0], message)
  //     var vrs = signatureToVRS(signature);
  //     false.should.be.equal(await homeContract.withdraws(transactionHash))
  //     await homeContract.withdraw([vrs.v], [vrs.r], [vrs.s], message).should.be.fulfilled
  //     // tx 2
  //     var transactionHash2 = "0x77a496628a776a03d58d7e6059a5937f04bebd8ba4ff89f76dd4bb8ba7e291ee";
  //     var message2 = createMessage(recipientAccount, value, transactionHash2, homeGasPrice);
  //     var signature2 = await sign(authorities[0], message2)
  //     var vrs2 = signatureToVRS(signature2);
  //     false.should.be.equal(await homeContract.withdraws(transactionHash2))
  //     const {logs} = await homeContract.withdraw([vrs2.v], [vrs2.r], [vrs2.s], message2).should.be.fulfilled

  //     logs[0].event.should.be.equal("Withdraw")
  //     logs[0].args.recipient.should.be.equal(recipientAccount)
  //     logs[0].args.value.should.be.bignumber.equal(value)
  //     logs[0].args.transactionHash.should.be.equal(transactionHash2);
  //     const balanceAfter = await web3.eth.getBalance(recipientAccount)
  //     const homeBalanceAfter = await web3.eth.getBalance(homeContract.address)
  //     balanceAfter.should.be.bignumber.equal(balanceBefore.add(value.mul(2)))
  //     homeBalanceAfter.should.be.bignumber.equal(0)
  //     true.should.be.equal(await homeContract.withdraws(transactionHash))
  //     true.should.be.equal(await homeContract.withdraws(transactionHash2))
  //   })

  //   it('should not allow if there are not enough funds in the contract', async () => {
  //     var recipientAccount = accounts[3];
  //     const balanceBefore = await web3.eth.getBalance(recipientAccount)
  //     const homeBalanceBefore = await web3.eth.getBalance(homeContract.address)
  //     // tx 1
  //     var value = web3.toBigNumber(web3.toWei(1.01, "ether"));
  //     var homeGasPrice = web3.toBigNumber(0);
  //     var transactionHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
  //     var message = createMessage(recipientAccount, value, transactionHash, homeGasPrice);
  //     var signature = await sign(authorities[0], message)
  //     var vrs = signatureToVRS(signature);
  //     false.should.be.equal(await homeContract.withdraws(transactionHash))
  //     await homeContract.withdraw([vrs.v], [vrs.r], [vrs.s], message).should.be.rejectedWith(ERROR_MSG)

  //   })
  //   it('should not allow second withdraw (replay attack) with same transactionHash but different recipient', async () => {
  //     var recipientAccount = accounts[3];
  //     const balanceBefore = await web3.eth.getBalance(recipientAccount)
  //     const homeBalanceBefore = await web3.eth.getBalance(homeContract.address)
  //     // tx 1
  //     var value = web3.toBigNumber(web3.toWei(0.5, "ether"));
  //     var homeGasPrice = web3.toBigNumber(0);
  //     var transactionHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
  //     var message = createMessage(recipientAccount, value, transactionHash, homeGasPrice);
  //     var signature = await sign(authorities[0], message)
  //     var vrs = signatureToVRS(signature);
  //     false.should.be.equal(await homeContract.withdraws(transactionHash))
  //     await homeContract.withdraw([vrs.v], [vrs.r], [vrs.s], message).should.be.fulfilled
  //     // tx 2
  //     var message2 = createMessage(accounts[4], value, transactionHash, homeGasPrice);
  //     var signature2 = await sign(authorities[0], message2)
  //     var vrs = signatureToVRS(signature2);
  //     true.should.be.equal(await homeContract.withdraws(transactionHash))
  //     await homeContract.withdraw([vrs.v], [vrs.r], [vrs.s], message2).should.be.rejectedWith(ERROR_MSG)
  //   })
  // })

  // describe('#withdraw with 2 minimum signatures', async () => {
  //   let multisigValidatorContract, twoAuthorities, ownerOfValidatorContract, homeContractWithMultiSignatures
  //   beforeEach(async () => {
  //     multisigValidatorContract = await BridgeValidators.new()
  //     twoAuthorities = [accounts[0], accounts[1]];
  //     ownerOfValidatorContract = accounts[3]
  //     const halfEther = web3.toBigNumber(web3.toWei(0.5, "ether"));
  //     await multisigValidatorContract.initialize(2, twoAuthorities, ownerOfValidatorContract, {from: ownerOfValidatorContract})
  //     homeContractWithMultiSignatures = await HomeBridge.new()
  //     const oneEther = web3.toBigNumber(web3.toWei(1, "ether"));
  //     await homeContractWithMultiSignatures.initialize(multisigValidatorContract.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, {from: ownerOfValidatorContract});
  //     await homeContractWithMultiSignatures.sendTransaction({
  //       from: accounts[1],
  //       value: halfEther
  //     }).should.be.fulfilled
  //   })
  //   it('withdraw should fail if not enough signatures are provided', async () => {

  //     var recipientAccount = accounts[4];
  //     const balanceBefore = await web3.eth.getBalance(recipientAccount)
  //     const homeBalanceBefore = await web3.eth.getBalance(homeContractWithMultiSignatures.address)
  //     // msg 1
  //     var value = web3.toBigNumber(web3.toWei(0.5, "ether"));
  //     var homeGasPrice = web3.toBigNumber(0);
  //     var transactionHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
  //     var message = createMessage(recipientAccount, value, transactionHash, homeGasPrice);
  //     var signature = await sign(twoAuthorities[0], message)
  //     var vrs = signatureToVRS(signature);
  //     false.should.be.equal(await homeContractWithMultiSignatures.withdraws(transactionHash))
  //     await homeContractWithMultiSignatures.withdraw([vrs.v], [vrs.r], [vrs.s], message).should.be.rejectedWith(ERROR_MSG)
  //     // msg 2
  //     var signature2 = await sign(twoAuthorities[1], message)
  //     var vrs2 = signatureToVRS(signature2);
  //     const {logs} = await homeContractWithMultiSignatures.withdraw([vrs.v, vrs2.v], [vrs.r, vrs2.r], [vrs.s, vrs2.s], message).should.be.fulfilled;

  //     logs[0].event.should.be.equal("Withdraw")
  //     logs[0].args.recipient.should.be.equal(recipientAccount)
  //     logs[0].args.value.should.be.bignumber.equal(value)
  //     logs[0].args.transactionHash.should.be.equal(transactionHash);
  //     const balanceAfter = await web3.eth.getBalance(recipientAccount)
  //     const homeBalanceAfter = await web3.eth.getBalance(homeContractWithMultiSignatures.address)
  //     balanceAfter.should.be.bignumber.equal(balanceBefore.add(value))
  //     homeBalanceAfter.should.be.bignumber.equal(homeBalanceBefore.sub(value))
  //     true.should.be.equal(await homeContractWithMultiSignatures.withdraws(transactionHash))

  //   })
  //   it('withdraw should fail if duplicate signature is provided', async () => {
  //     var recipientAccount = accounts[4];
  //     const balanceBefore = await web3.eth.getBalance(recipientAccount)
  //     const homeBalanceBefore = await web3.eth.getBalance(homeContractWithMultiSignatures.address)
  //     // msg 1
  //     var value = web3.toBigNumber(web3.toWei(0.5, "ether"));
  //     var homeGasPrice = web3.toBigNumber(0);
  //     var transactionHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
  //     var message = createMessage(recipientAccount, value, transactionHash, homeGasPrice);
  //     var signature = await sign(twoAuthorities[0], message)
  //     var vrs = signatureToVRS(signature);
  //     false.should.be.equal(await homeContractWithMultiSignatures.withdraws(transactionHash))
  //     await homeContractWithMultiSignatures.withdraw([vrs.v, vrs.v], [vrs.r, vrs.r], [vrs.s, vrs.s], message).should.be.rejectedWith(ERROR_MSG)
  //   })
  // })
  describe('#setting limits', async () => {
    let homeContract;
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
      await homeContract.initialize(validatorContract.address, '3', '2', '1', gasPrice, requireBlockConfirmations)
    })
    it('#setMaxPerTx allows to set only to owner and cannot be more than daily limit', async () => {
      await homeContract.setMaxPerTx(2, {from: authorities[0]}).should.be.rejectedWith(ERROR_MSG);
      await homeContract.setMaxPerTx(2, {from: owner}).should.be.fulfilled;

      await homeContract.setMaxPerTx(3, {from: owner}).should.be.rejectedWith(ERROR_MSG);
    })

    it('#setMinPerTx allows to set only to owner and cannot be more than daily limit and should be less than maxPerTx', async () => {
      await homeContract.setMinPerTx(1, {from: authorities[0]}).should.be.rejectedWith(ERROR_MSG);
      await homeContract.setMinPerTx(1, {from: owner}).should.be.fulfilled;

      await homeContract.setMinPerTx(2, {from: owner}).should.be.rejectedWith(ERROR_MSG);
    })
  })
})
