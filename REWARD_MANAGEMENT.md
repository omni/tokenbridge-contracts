# Reward Management

## ERC-TO-NATIVE - Fees distributed among bridge validators
Configuration:
```
HOME_REWARDABLE=BOTH_DIRECTIONS
FOREIGN_REWARDABLE=false
HOME_FEE_MANAGER_TYPE=BRIDGE_VALIDATORS_REWARD
```
### Foreign to Home transfer
Fees are calculated and distributed on Home network. Validators will receive native coins.
![erc-native-foreigntohome](https://user-images.githubusercontent.com/4614574/51607498-9065fd00-1ef3-11e9-8212-fc1ba16ae91a.png)

### Home to Foreign transfer
Fees are calculated and distributed on Home network. Validators will receive native coins.
![erc-native-hometoforeign](https://user-images.githubusercontent.com/4614574/51607508-96f47480-1ef3-11e9-93a1-0f1111793f2a.png)

## ERC-TO-NATIVE - Fees distributed among network validators
Configuration:
```
HOME_REWARDABLE=BOTH_DIRECTIONS
FOREIGN_REWARDABLE=false
HOME_FEE_MANAGER_TYPE=POSDAO_REWARD
```
### Foreign to Home transfer
Fees are calculated and distributed on Home network. Validators will receive native coins.
![POSDAO-ERC-Native-ForeignToHome](https://user-images.githubusercontent.com/4614574/59941961-ebfdcd80-9434-11e9-8c9a-433f75bd2c09.png)

### Home to Foreign transfer
Fees are calculated and distributed on Home network. Validators will receive native coins.
![POSDAO-ERC-Native-HomeToForeign](https://user-images.githubusercontent.com/4614574/59941982-f750f900-9434-11e9-8557-a90d9dfa6799.png)
