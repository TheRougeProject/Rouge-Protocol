
const ethUtil = require('ethereumjs-util')

const RGEToken = artifacts.require("./TestRGEToken.sol");
const Factory = artifacts.require("./RougeFactory.sol");
const SimpleRougeCampaign = artifacts.require("./SimpleRougeCampaign.sol");

const tare = 0.1 * 10**6;  /* tare price is 0.1 RGE in beta phase */
const gas = 6000778

contract('RougeFactory', function(accounts) {

  it("factory has correct parameters", async function() {

    const rge = await RGEToken.deployed();
    const factory = await Factory.deployed();

    const ftare = await factory.tare.call();
    assert.equal(ftare.toNumber(), tare, "tare price is set correctly in factory");
    
  });  

  it("create a simple Rouge campaign", async function() {

    const issuer = accounts[1];
    const tokens  = 1000 * 10**6; /* 1K RGE tokens */

    const issuance = 10;
    const deposit  = 50 * 10**6;

    const rge = await RGEToken.deployed();
    const factory = await Factory.deployed();

    const issuer_balance_before = await rge.balanceOf.call(issuer);
    assert.equal(issuer_balance_before.toNumber(), 0, "issuer has no rge tokens to start with");

    await rge.giveMeRGE(tokens, {from: issuer});

    const issuer_balance_post = await rge.balanceOf.call(issuer);
    assert.equal(issuer_balance_post.toNumber(), tokens, "issuer has receive tokens to create a campaign");

    const estimate = await rge.newCampaign.estimateGas(issuance, deposit, {from: issuer, gas: gas});
    // console.log('Base estimate newCampaign => ', estimate)

    const result = await rge.newCampaign(issuance, deposit, {from: issuer, gas: estimate + 90000, gasPrice: web3.toWei(1, "gwei")})

    assert.equal(result.receipt.cumulativeGasUsed, estimate, "cumulativeGasUsed correctly predict");

    const campaign_address = await factory.get_campaign.call(issuer, 0);

    const event_NewCampaign_sign = web3.sha3('NewCampaign(address,address,uint32)')
    // const event_Transfer_sign = web3.sha3('Transfer(address,address,uint256)')
    result.receipt.logs.forEach( function(e) {
      if (e.topics[0] === event_NewCampaign_sign) {
        // console.log(e)
        assert.equal(e.topics[1].slice(26, 66), issuer.substr(2), "issuer first data of NewCampaign event");
        assert.equal(e.topics[2].slice(26, 66), campaign_address.substr(2), "campaign address 2nd data of NewCampaign event");
        assert.equal(web3.toDecimal(e.data), issuance, "issuance 3nd data of NewCampaign event");
      }
    })
    
    const factory_version = await factory.version.call();
    const campaign = SimpleRougeCampaign.at(campaign_address);
    const campaign_version = await campaign.version.call();
    assert.equal(campaign_version, factory_version, "factory and campaign contract version are the same");

    const campaign_state = await campaign.getState.call();
    assert.equal(campaign_state, '0x0000000a00000000000000000000000000', "encoded state is correct");

    const issuer_balance_after = await rge.balanceOf.call(issuer);
    assert.equal(issuer_balance_after.toNumber(), tokens - deposit, "issuer has sent tokens as a deposit to the factory");

    const campaign_count = await factory.get_all_count.call();
    assert.equal(campaign_count.toNumber(), 1, "one campaign has been created");

    const factory_balance = await rge.balanceOf.call(factory.address);
    assert.equal(factory_balance.toNumber(), 0, "no tokens deposit in the factory");

    const campaign_balance = await rge.balanceOf.call(campaign_address);
    assert.equal(campaign_balance.toNumber(), deposit, "the tokens deposit is now in the new campaign contract");
    
  });  

  // todo create with zero notes

  
});

