# Dependencies
```bash
npm install
```

# To Deploy
Check `truffle.js` for networks and their ports
```bash
NETWORK=sokol npm run deploy
```

# Manual Deployment  steps

## Home Deployment(Sokol)

1. Deploy [EternalStorageProxy contract](https://github.com/poanetwork/poa-parity-bridge-contracts/blob/upgradable/flats/EternalStorageProxy_flat.sol#L218) (Example address: '0x01')
that will be used as Home Bridge Validators Proxy contract
2. Deploy [BridgeValidators contract](https://github.com/poanetwork/poa-parity-bridge-contracts/blob/upgradable/flats/BridgeValidators_flat.sol#L197) (Example address: '0x02')
3. Call `upgradeTo` of EternalStorageProxy that is used as  Home Bridge Validators with 2 parameters:
- 0 - version of implementation contract
- address of implementation which is the address of step#2 BridgeValidators deployed contract (`0x02`)
4. Call `initialize` method at Home Bridge Validators Proxy(`0x01`) with 2 parameters:
- REQUIRED_NUMBER_OF_VALIDATORS. Example: `1`
- Array of validators. Example `["0x0039F22efB07A647557C7C5d17854CFD6D489eF3", "0xf052d236b8076879d86c9e4c116a068a0d420c55"]`
5. Deploy [Home Bridge](https://github.com/poanetwork/poa-parity-bridge-contracts/blob/upgradable/flats/HomeBridge_flat.sol#L289). Example address: `0x03`
6. Deploy [EternalStorageProxy contract](https://github.com/poanetwork/poa-parity-bridge-contracts/blob/upgradable/flats/EternalStorageProxy_flat.sol#L218)
that will be used as Home Bridge Proxy contract.  Example address: `0x04`
7. Call `upgradeTo` of EternalStorageProxy that is used as  Home Bridge Proxy(step#6) with 2 parameters:
- 0 - version of implementation contract
- address of implementation which is the address of step#5 HomeBridge deployed contract. (`0x03`)
8. Call `initialize` method at Home Bridge Proxy address with 2 parameters:
- address of Home Bridge **Validators** address Proxy ( step# 1) `0x01`
- Daily Limit in wei: Example `1000000000000000000` == 1 ether

=====
## Foreign Deployment on Kovan
=====

9. Deploy [POA20 contract](https://github.com/poanetwork/poa-parity-bridge-contracts/blob/upgradable/flats/POA20_flat.sol#L448) Example(`0x05`)
10. Deploy [EternalStorageProxy contract](https://github.com/poanetwork/poa-parity-bridge-contracts/blob/upgradable/flats/EternalStorageProxy_flat.sol#L218)
that will be used as Foreign Bridge Validators Proxy contract. Example `0x06`
11. Deploy [BridgeValidators contract](https://github.com/poanetwork/poa-parity-bridge-contracts/blob/upgradable/flats/BridgeValidators_flat.sol#L197) Example `0x07`
12. Call `upgradeTo` of EternalStorageProxy(`0x06`) that is used as  Foreign Bridge Validators Proxy(step#10) with 2 parameters:
- 0 - version of implementation contract
- address of implementation which is the address of step#11 Foreign BridgeValidators deployed contract. (`0x07`)
13. Call `initialize` method at Foreign Bridge Validators Proxy(`0x06`) with 2 parameters:
- REQUIRED_NUMBER_OF_VALIDATORS. Example: `1`
- Array of validators. Example `["0x0039F22efB07A647557C7C5d17854CFD6D489eF3", "0xf052d236b8076879d86c9e4c116a068a0d420c55"]`
14. Deploy [EternalStorageProxy contract](https://github.com/poanetwork/poa-parity-bridge-contracts/blob/upgradable/flats/EternalStorageProxy_flat.sol#L218)
that will be used as Foreign Bridge Proxy contract. Example `0x08`
15. Deploy [Foreign Bridge contract](https://github.com/poanetwork/poa-parity-bridge-contracts/blob/upgradable/flats/ForeignBridge_flat.sol#L345) Example `0x09`
16. Call `upgradeTo` of EternalStorageProxy(`0x08`) that is used as  Foreign Bridge Proxy(step#14) with 2 parameters:
- 0 - version of implementation contract
- address of implementation which is the address of step#15 Foreign Bridge deployed contract. (`0x09`)
17. Call `initialize` method at Foreign Bridge Proxy(`0x08`) address with 2 parameters:
- address of Foreign Bridge **Validators** address Proxy ( step# 10) `0x06`
- address of POA20 token contract. Step#9 `0x05`
- Daily Limit in wei: Example `1000000000000000000` == 1 ether
18. Call `transferOwnership` of POA20 contract(0x05) with 1 parameter:
- address of Foreign Bridge Proxy (`0x08`) from step#14


# To Flatten
```bash
npm run flatten
```
