# StromDAO-BusinessObject - Messstellenbetrieb

Verwaltung und schreiben von Daten einer Messstelle (=Stromzähler) in der StromDAO Energy Blockchain. 

## Installation
```
npm install -g stromdao-bo-mpo
```

## Verwendung
```
stromdao-mp store meter_point_id value
 stromdao-mp retrieve meter_point_id
```

meter_point_id = Zählernummer

Jeder Messtelle wird auf Basis der angegebenen Meter_Point_Id eine eindeutige Adresse in der StromDAO Energy Blockchain zugewiesen. Diese Zuordnung erfoglt durch automatische Generierung eines Schlüsselpaares, welches lokal gespeichert wird. 

## Beispiele
```
# Setzen des Zählerstandes 100 für die Zählerkennung 1337
stromdao-mp store 1337 100

# Abruf des Zählerstandes für die Zählerkennung 1337
stromdao-mp retrieve 1337

# Setzen des Zählerstandes 100 für die Zählerkennung 1337 mit Verwendung eines Settlements via IPFS 
stromdao-mp store -a QmRroaKpLVJyLBWAAAjHzBEAEfQthj8ZrcRSpYyQe7uRyM 1337 100

# Setzen des Zählerstandes 100 für die Zählerkennung 1337 mit Verwendung eines Settlements via File basiertem Settlement und Tarifinfo für PLZ 69256
stromdao-mp store -f settlement_sample.js --de 69256 1337 100

```

## Feedback/Collaboration
- https://fury.network/
- https://stromdao.de/
- hhttps://gitter.im/stromdao/BusinessObject
