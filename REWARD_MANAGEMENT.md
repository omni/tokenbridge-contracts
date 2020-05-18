# Reward Management

## NATIVE-TO-ERC
Configuration:
```
HOME_REWARDABLE=ONE_DIRECTION
FOREIGN_REWARDABLE=ONE_DIRECTION
```
### Home to Foreign transfer
Fees are calculated and distributed on Foreign network. Validators will receive ERC20 tokens.
![native-erc-hometoforeign](https://user-images.githubusercontent.com/4614574/51607402-4bda6180-1ef3-11e9-91e3-50fe5d35d296.png)

### Foreign to Home transfer
Fees are calculated and distributed on Home network. Validators will receive native coins.
![native-erc-foreigntohome](https://user-images.githubusercontent.com/4614574/51607428-5d236e00-1ef3-11e9-8083-3669899c7252.png)

## NATIVE-TO-ERC - Fees collected on Home network only
Configuration:
```
HOME_REWARDABLE=BOTH_DIRECTIONS
FOREIGN_REWARDABLE=false
```
### Home to Foreign transfer
Fees are calculated and distributed on Home network. Validators will receive native coins.
![native-erc-homefee-hometoforeign](https://user-images.githubusercontent.com/4614574/53118155-43456d00-352b-11e9-80db-53e31494e09b.png)

### Foreign to Home transfer
Fees are calculated and distributed on Home network. Validators will receive native coins.
![native-erc-homefee-foreigntohome](https://user-images.githubusercontent.com/4614574/53118176-4b9da800-352b-11e9-8118-123f30e37d61.png)

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

## ERC-TO-ERC
Configuration:
```
HOME_REWARDABLE=BOTH_DIRECTIONS
FOREIGN_REWARDABLE=false
```
### Foreign to Home transfer
Fees are calculated and distributed on Home network. Validators will receive ERC20 tokens.
![ERC-ERC-ForeignToHome](https://user-images.githubusercontent.com/4614574/59939650-016ff900-942f-11e9-9593-9861455c7b62.png)

### Home to Foreign transfer
Fees are calculated and distributed on Home network. Validators will receive ERC20 tokens.
![ERC-ERC-HomeToForeign](https://user-images.githubusercontent.com/4614574/59939670-0cc32480-942f-11e9-9693-727125555c97.png)

## AMB-NATIVE-TO-ERC
Configuration:
```
HOME_REWARDABLE=ONE_DIRECTION
FOREIGN_REWARDABLE=ONE_DIRECTION
```
### Home to Foreign transfer
Fees are calculated and distributed on Foreign network. The reward accounts will receive ERC20 tokens.
![AMB-NATIVE-TO-ERC677-Home-Foreign](https://user-images.githubusercontent.com/4614574/74660965-dd0f1c80-5175-11ea-8d6c-51b8bd85f844.png)

### Foreign to Home transfer
Fees are calculated and distributed on Home network. The reward accounts will receive native tokens.
![AMB-NATIVE-TO-ERC677-Foreign-Home](https://user-images.githubusercontent.com/4614574/74660986-e6988480-5175-11ea-9216-7f008a6fdaf0.png)


