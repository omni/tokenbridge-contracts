## Gas Consumption `NATIVE-TO-ERC` Bridge Mode

#### Deployment
##### Home
 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
EternalStorageProxy|deployment|378510|378510|378510
BridgeValidators|deployment|1351491|1351491|1351491
EternalStorageProxy|upgradeTo|35871|30924|30913
BridgeValidators|initialize|210762|306607|270900
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
EternalStorageProxy|deployment|378510|378510|378510
HomeBridgeNativeToErc|deployment|4841729|4841729|4841729
EternalStorageProxy|upgradeTo|35871|30924|30913
HomeBridgeNativeToErc|initialize|257416|258312|258003
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
Total| |7551466|7638313|7602275

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
HomeBridgeNativeToErc|submitSignature|159816|275743|221116
To relay signatures from the Home to the Foreign (one validator)|
ForeignBridgeNativeToErc|executeSignatures|99365|172087|138314
To sign and relay from the Foreign to the Home (each validator)|
HomeBridgeNativeToErc|executeAffirmation|67313|133052|102046

##### Users

 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
To request transfer from the Home to the Foreign|
HomeBridgeNativeToErc|fallback|47848|47848|47848
To request transfer from the Foreign to the Home|
ERC677BridgeToken|transferAndCall|58676|166206|92613  
