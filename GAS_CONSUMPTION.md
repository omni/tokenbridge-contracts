## Gas Consumption

### `NATIVE-TO-ERC` Bridge Mode

#### Deployment
##### Home
 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
EternalStorageProxy|deployment|378510|378510|378510
BridgeValidators|deployment|1144207|1144207|1144207
EternalStorageProxy|upgradeTo|35871|30924|30913
BridgeValidators|initialize|187738|280847|253949
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
EternalStorageProxy|deployment|378510|378510|378510
HomeBridgeNativeToErc|deployment|3327263|3327263|3327263
EternalStorageProxy|upgradeTo|35871|30924|30913
HomeBridgeNativeToErc|initialize|190051|190947|190755
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
Total| |5739327|5823438|5796326

##### Foreign
 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
ERC677BridgeToken|deployment|1498202|1499226|1498829
EternalStorageProxy|deployment|378510|378510|378510
BridgeValidators|deployment|1144207|1144207|1144207
EternalStorageProxy|upgradeTo|35871|30924|30913
BridgeValidators|initialize|187738|280847|253949
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
EternalStorageProxy|deployment|378510|378510|378510
ForeignBridgeNativeToErc|deployment|2768705|2768705|2768705
EternalStorageProxy|upgradeTo|35871|30924|30913
ForeignBridgeNativeToErc|initialize|213493|213557|213549
ERC677BridgeToken|setBridgeContract|29432|44432|39432
ERC677BridgeToken|transferOwnership|30860|30924|30913
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
Total| |6762705|6862072|6829736

#### Usage

##### Validators

 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
To sign at the Home (each validator)|
HomeBridgeNativeToErc|submitSignature|159362|275135|220127
To relay signatures from the Home to the Foreign (one validator)|
ForeignBridgeNativeToErc|executeSignatures|89201|146127|120917
To sign and relay from the Foreign to the Home (each validator)|
HomeBridgeNativeToErc|executeAffirmation|64314|107669|83596

##### Users

 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
To request transfer from the Home to the Foreign|
HomeBridgeNativeToErc|fallback|46982|46982|46982
To request transfer from the Foreign to the Home|
ERC677BridgeToken|transferAndCall|58370|166206|92399  


### `ERC-TO-ERC` Bridge Mode

#### Deployment
##### Home
 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
EternalStorageProxy|deployment|378510|378510|378510
BridgeValidators|deployment|1144207|1144207|1144207
EternalStorageProxy|upgradeTo|35871|30924|30913
BridgeValidators|initialize|187738|280847|253949
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
EternalStorageProxy|deployment|378510|378510|378510
HomeBridgeErcToErc|deployment|3528509|3528509|3528509
EternalStorageProxy|upgradeTo|35871|30924|30913
ERC677BridgeToken|deployment|1498202|1499226|1498829
ERC677BridgeToken|setBridgeContract|29432|44432|39432
ERC677BridgeToken|transferOwnership|30860|30924|30913
HomeBridgeErcToErc|initialize|212299|213195|213003
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
Total| |7521315|7621514|7588994

##### Foreign
 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
EternalStorageProxy|deployment|378510|378510|378510
BridgeValidators|deployment|1144207|1144207|1144207
EternalStorageProxy|upgradeTo|35871|30924|30913
BridgeValidators|initialize|187738|280847|253949
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
EternalStorageProxy|deployment|378510|378510|378510
ForeignBridgeErcToErc|deployment|2449436|2449436|2449436
EternalStorageProxy|upgradeTo|35871|30924|30913
ForeignBridgeErcToErc|initialize|150614|150614|150614
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
Total| |4822063|4905278|4878358

#### Usage

##### Validators

 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
To sign at the Home (each validator)|
HomeBridgeErcToErc|submitSignature|159386|275159|220171
To relay signatures from the Home to the Foreign (one validator)|
ForeignBridgeErcToErc|executeSignatures|73779|115769|93027
To sign and relay from the Foreign to the Home (each validator)|
HomeBridgeErcToErc|executeAffirmation|79336|134607|108215

##### Users

 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
To request transfer from the Home to the Foreign|
ERC677BridgeToken|transferAndCall|58370|166206|92399
To request transfer from the Foreign to the Home|
ERC677BridgeToken|transfer|37691|86589|55000  


### `ERC-TO-NATIVE` Bridge Mode

#### Deployment
##### Home
 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
EternalStorageProxy|deployment|378510|378510|378510
BridgeValidators|deployment|1144207|1144207|1144207
EternalStorageProxy|upgradeTo|35871|30924|30913
BridgeValidators|initialize|187738|280847|253949
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
EternalStorageProxy|deployment|378510|378510|378510
HomeBridgeErcToNative|deployment|3757420|3757420|3757420
EternalStorageProxy|upgradeTo|35871|30924|30913
HomeBridgeErcToNative|initialize|196910|213930|210795
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
Total| |6176343|6276578|6246523

##### Foreign
 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
EternalStorageProxy|deployment|378510|378510|378510
BridgeValidators|deployment|1144207|1144207|1144207
EternalStorageProxy|upgradeTo|35871|30924|30913
BridgeValidators|initialize|187738|280847|253949
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
EternalStorageProxy|deployment|378510|378510|378510
ForeignBridgeErcToNative|deployment|2449564|2449564|2449564
EternalStorageProxy|upgradeTo|35871|30924|30913
ForeignBridgeErcToNative|initialize|150614|150614|150614
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
Total| |

#### Usage

##### Validators

 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
To sign at the Home (each validator)|
HomeBridgeErcToNative|submitSignature|159428|275201|220206
To relay signatures from the Home to the Foreign (one validator)|
ForeignBridgeErcToNative|executeSignatures|73779|115769|92985
To sign and relay from the Foreign to the Home (each validator)|
HomeBridgeErcToNative|executeAffirmation|64380|140744|97562

##### Users

 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
To request transfer from the Home to the Foreign|
HomeBridgeErcToNative|fallback|80174|80174|80174
To request transfer from the Foreign to the Home|
ERC677BridgeToken|transfer|37691|86589|55000
