const POA20 = artifacts.require("POA20.sol");
const ERC677ReceiverTest = artifacts.require("ERC677ReceiverTest.sol")
const {ERROR_MSG} = require('./setup');

contract('POA20', async (accounts) => {
  let token
  let owner = accounts[0]
  const user = accounts[1];
  beforeEach(async () => {
    token = await POA20.new("POA ERC20 Foundation", "POA20", 18);
  })
  it('default values', async () => {

    const symbol = await token.symbol()
    assert.equal(symbol, 'POA20')

    const decimals = await token.decimals()
    assert.equal(decimals, 18)

    const name = await token.name()
    assert.equal(name, "POA ERC20 Foundation")

    const totalSupply = await token.totalSupply();
    assert.equal(totalSupply, 0);

    const mintingFinished = await token.mintingFinished();
    assert.equal(mintingFinished, false);

  })
  describe('#mint', async() => {
    it('can mint by owner', async () => {
      (await token.totalSupply()).should.be.bignumber.equal(0);
      await token.mint(user, 1, {from: owner }).should.be.fulfilled;
      (await token.totalSupply()).should.be.bignumber.equal(1);
      (await token.balanceOf(user)).should.be.bignumber.equal(1);
    })

    it('no one can call finishMinting', async () => {
      await token.finishMinting().should.be.rejectedWith(ERROR_MSG)
    })

    it('cannot mint by non-owner', async () => {
      (await token.totalSupply()).should.be.bignumber.equal(0);
      await token.mint(user, 1, {from: user }).should.be.rejectedWith(ERROR_MSG);
      (await token.totalSupply()).should.be.bignumber.equal(0);
      (await token.balanceOf(user)).should.be.bignumber.equal(0);
    })

    it('can stop minting by owner', async () => {
      await token.finishMinting({from: user}).should.be.rejectedWith(ERROR_MSG);
      await token.finishMinting({from: owner}).should.be.fulfilled;
      await token.finishMinting({from: owner}).should.be.rejectedWith(ERROR_MSG);
      (true).should.be.equal(await token.mintingFinished());
      await token.mint(user, 1, {from: owner }).should.be.rejectedWith(ERROR_MSG);
    })
  })

  describe('#transfer', async() => {
    it('sends tokens to recipient', async () => {
      await token.mint(user, 1, {from: owner }).should.be.fulfilled;
      await token.transfer(user, 1, {from: owner}).should.be.rejectedWith(ERROR_MSG);
      const {logs} = await token.transfer(owner, 1, {from: user}).should.be.fulfilled;
      (await token.balanceOf(owner)).should.be.bignumber.equal(1);
      (await token.balanceOf(user)).should.be.bignumber.equal(0);
      logs[0].event.should.be.equal("Transfer")
      logs[0].args.should.be.deep.equal({
        from: user,
        to: owner,
        value: new web3.BigNumber(1)
      })
    })
  })

  describe("#burn", async () => {
    it('can burn', async() => {
      await token.burn(100, {from: owner}).should.be.rejectedWith(ERROR_MSG);
      await token.mint(user, 1, {from: owner }).should.be.fulfilled;
      await token.burn(1, {from: user}).should.be.fulfilled;
      (await token.totalSupply()).should.be.bignumber.equal(0);
      (await token.balanceOf(user)).should.be.bignumber.equal(0);
    })
  })

  describe('#transferAndCall', () => {
    it('calls contractFallback', async () => {
      const receiver = await ERC677ReceiverTest.new();
      (await receiver.from()).should.be.equal('0x0000000000000000000000000000000000000000');
      (await receiver.value()).should.be.bignumber.equal('0');
      (await receiver.data()).should.be.equal('0x');
      (await receiver.someVar()).should.be.bignumber.equal('0');

      var ERC677ReceiverTestWeb3 = web3.eth.contract(ERC677ReceiverTest.abi);
      var ERC677ReceiverTestWeb3Instance = ERC677ReceiverTestWeb3.at(receiver.address);
      var callDoSomething123 = ERC677ReceiverTestWeb3Instance.doSomething.getData(123);

      await token.mint(user, 1, {from: owner }).should.be.fulfilled;
      await token.transferAndCall(token.address, 1, callDoSomething123, {from: user}).should.be.rejectedWith(ERROR_MSG);
      await token.transferAndCall('0x0000000000000000000000000000000000000000', 1, callDoSomething123, {from: user}).should.be.rejectedWith(ERROR_MSG);
      await token.transferAndCall(receiver.address, 1, callDoSomething123, {from: user}).should.be.fulfilled;
      (await token.balanceOf(receiver.address)).should.be.bignumber.equal(1);
      (await token.balanceOf(user)).should.be.bignumber.equal(0);
      (await receiver.from()).should.be.equal(user);
      (await receiver.value()).should.be.bignumber.equal(1);
      (await receiver.data()).should.be.equal(callDoSomething123);
      (await receiver.someVar()).should.be.bignumber.equal('123');
    })
  })
})
