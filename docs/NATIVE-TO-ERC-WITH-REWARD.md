## Gas Consumption `NATIVE-TO-ERC` Bridge Mode with Reward contract on Home and Foreign networks

#### Deployment
##### Home
 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
EternalStorageProxy|deployment|378510|378510|378510
RewardableValidators|deployment|1615790|1615790|1615790
EternalStorageProxy|upgradeTo|35871|30924|30913
RewardableValidators|initialize|202711|423292|318008
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
EternalStorageProxy|deployment|378510|378510|378510
HomeBridgeNativeToErc|deployment|4841729|4841729|4841729
EternalStorageProxy|upgradeTo|35871|30924|30913
FeeManagerNativeToErc|deployment|1079956|1079956|1079956
HomeBridgeNativeToErc|rewardableInitialize|315276|315340|315304
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
Total| |8945530|9156281|9050939

##### Foreign
 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
ERC677BridgeToken|deployment|1463536|1464560|1464170
EternalStorageProxy|deployment|378510|378510|378510
RewardableValidators|deployment|1615790|1615790|1615790
EternalStorageProxy|upgradeTo|35871|30924|30913
RewardableValidators|initialize|202711|423292|318008
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
EternalStorageProxy|deployment|378510|378510|378510
ForeignBridgeNativeToErc|deployment|3931739|3931739|3931739
EternalStorageProxy|upgradeTo|35871|30924|30913
FeeManagerNativeToErc|deployment|1079956|1079956|1079956
ForeignBridgeNativeToErc|rewardableInitialize|329022|329086|329077
ERC677BridgeToken|setBridgeContract|29432|44432|39432
ERC677BridgeToken|transferOwnership|30860|30924|30913
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
Total| |9573114|9799953|9689237

#### Usage

##### Validators

 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
To sign at the Home (each validator)|
HomeBridgeNativeToErc|submitSignature|159880|287671|227125
To relay signatures from the Home to the Foreign (one validator)|
ForeignBridgeNativeToErc|executeSignatures|193143|374488|288553
To sign and relay from the Foreign to the Home (each validator)|
HomeBridgeNativeToErc|executeAffirmation|67313|206296|104845

##### Users

 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
To request transfer from the Home to the Foreign|
HomeBridgeNativeToErc|fallback|51199|51199|51199
To request transfer from the Foreign to the Home|
ERC677BridgeToken|transferAndCall|58676|166206|92613  



## Gas Consumption `NATIVE-TO-ERC` Bridge Mode with Reward contract on Home network

#### Deployment
##### Home
 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
EternalStorageProxy|deployment|378510|378510|378510
RewardableValidators|deployment|1615790|1615790|1615790
EternalStorageProxy|upgradeTo|35871|30924|30913
RewardableValidators|initialize|202711|423292|318008
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
EternalStorageProxy|deployment|378510|378510|378510
HomeBridgeNativeToErc|deployment|4841729|4841729|4841729
EternalStorageProxy|upgradeTo|35871|30924|30913
FeeManagerNativeToErcBothDirections|deployment|1004365|1004365|1004365
HomeBridgeNativeToErc|rewardableInitialize|315276|330680|325073
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
Total| |8869939|9096030|8985117

##### Foreign
 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
ERC677BridgeToken|deployment|1463536|1464560|1464170
EternalStorageProxy|deployment|378510|378510|378510
BridgeValidators|deployment|1351491|1351491|1351491
EternalStorageProxy|upgradeTo|35871|30924|30913
BridgeValidators|initialize|210762|306607|270900
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
EternalStorageProxy|deployment|378510|378510|378510
ForeignBridgeNativeToErc|deployment|3931739|3931739|3931739
EternalStorageProxy|upgradeTo|35871|30924|30913
ForeignBridgeNativeToErc|initialize|281275|281339|281328
ERC677BridgeToken|setBridgeContract|29432|44432|39432
ERC677BridgeToken|transferOwnership|30860|30924|30913
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
Total| |8189163|8291266|8250125

#### Usage

##### Validators

 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
To sign at the Home (each validator)|
HomeBridgeNativeToErc|submitSignature|159880|308541|219741
To relay signatures from the Home to the Foreign (one validator)|
ForeignBridgeNativeToErc|executeSignatures|99365|172087|138314
To sign and relay from the Foreign to the Home (each validator)|
HomeBridgeNativeToErc|executeAffirmation|67313|206445|104857

##### Users

 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
To request transfer from the Home to the Foreign|
HomeBridgeNativeToErc|fallback|51177,|51177,|51177,
To request transfer from the Foreign to the Home|
ERC677BridgeToken|transferAndCall|58676|166206|92613  
