const HomeAMB = artifacts.require("HomeAMB.sol");

contract('HomeAMB', async () => {
  describe('getBridgeMode', () => {
    it('should return arbitrary message bridging mode', async () => {
      const homeContract = await HomeAMB.new()
      const bridgeModeHash = '0x2544fbb9' // 4 bytes of keccak256('arbitrary-message-bridge-core')
      const bridgeMode = await homeContract.getBridgeMode()
      bridgeMode.should.be.equal(bridgeModeHash)
    })
  })
})
