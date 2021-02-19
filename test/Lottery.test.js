const assert = require("assert");
const ganache = require("ganache-cli");
const Web3 = require("web3");
const web3 = new Web3(ganache.provider());
const compiled = require("../compile");

let accounts;
let lottery;

beforeEach(async () => {
  accounts = await web3.eth.getAccounts();

  lottery = await new web3.eth.Contract(compiled.abi)
    .deploy({
      data: compiled.evm.bytecode.object,
    })
    .send({ from: accounts[0], gas: "1000000" });
});

describe("Lottery contract", () => {
  it("deploys a contract", () => {
    assert.ok(lottery.options.address);
  });

  it("allows one account to enter", async () => {
    await lottery.methods.enter().send({
      from: accounts[0],
      value: web3.utils.toWei("0.02", "ether"),
    });

    const players = await lottery.methods.getPlayers().call({
      from: accounts[0],
    });

    assert.strictEqual(accounts[0], players[0]);
    assert.strictEqual(1, players.length);
  });

  it("allows multiple accounts to enter", async () => {
    await lottery.methods.enter().send({
      from: accounts[0],
      value: web3.utils.toWei("0.02", "ether"),
    });
    await lottery.methods.enter().send({
      from: accounts[1],
      value: web3.utils.toWei("0.02", "ether"),
    });
    await lottery.methods.enter().send({
      from: accounts[2],
      value: web3.utils.toWei("0.02", "ether"),
    });

    const players = await lottery.methods.getPlayers().call({
      from: accounts[0],
    });

    assert.strictEqual(accounts[0], players[0]);
    assert.strictEqual(accounts[1], players[1]);
    assert.strictEqual(accounts[2], players[2]);
    assert.strictEqual(3, players.length);
  });

  it("requires a minimum amount of ether to enter", async () => {
    try {
      await lottery.methods.enter().send({
        from: accounts[0],
        value: 0,
      });
    } catch (err) {
      assert(err);
      return;
    }
    assert(false);
  });

  it("rejects accounts other than the manager to call pickWinner function", async () => {
    try {
      // Enter at least one player into the array
      await lottery.methods.enter().send({
        from: accounts[0],
        value: web3.utils.toWei("5", "ether"),
      });

      // Attempt to call the pickWinner function using a non-manager account
      await lottery.methods.pickWinner().send({
        from: accounts[1],
      });
    } catch (err) {
      assert(err);
      return;
    }
    assert(false);
  });

  it("sends money to the winner and resets players", async () => {
    await lottery.methods.enter().send({
      from: accounts[1],
      value: web3.utils.toWei("2", "ether"),
    });

    const origBalance = await web3.eth.getBalance(accounts[1]);
    await lottery.methods.pickWinner().send({ from: accounts[0] });
    const finalBalance = await web3.eth.getBalance(accounts[1]);

    const winnings = finalBalance - origBalance;
    assert.strictEqual(+web3.utils.toWei("2", "ether"), winnings);

    const players = await lottery.methods
      .getPlayers()
      .call({ from: accounts[0] });
    assert.strictEqual(players.length, 0);

    const contractBalance = await web3.eth.getBalance(lottery.options.address);
    assert.strictEqual(+contractBalance, 0);
  });
});
