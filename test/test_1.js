var Migrations = artifacts.require("Migrations");
contract('Migrations', async function(accounts) {
  it("should deploy contract", async function() {
    let m = await Migrations.new();
    console.log(m);
    assert.equal(true, true);
  })
})