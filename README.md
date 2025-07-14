# DHT different implementations/tests
## dht-2topics-db-rpc / swarm-2topics-db-rpc / swarm-protomux-db-rpc Projects

A set of example projects demonstrating decentralized data replication and RPC over Hypercore and Hyperswarm/HyperDHT networks, showcasing different ways to organize topics and multiplex protocols.

---

## Core Concepts & Rules

- **Hypercore replication requires peers to share the same *discoveryKey***.  
  Each Hypercore instance has a `discoveryKey` derived from its public key — this acts as a topic for peer discovery and replication.

- **Hyperswarm uses the Hypercore `discoveryKey` as the topic key**.  
  This means that any peers joining the swarm with the same discoveryKey will find each other and replicate the same Hypercore feed.

- **RPC communications must use a separate topic from the Hypercore replication topic**.  
  This is because Hypercore replication strictly depends on the discoveryKey topic and cannot be multiplexed with other protocols on the same topic without extra multiplexing.

- **RPC server nodes must run in `server` mode and announce themselves on the DHT topic**.  
  RPC clients lookup and connect to these servers by joining the same RPC topic in `client` mode.

- **Using `Protomux`, you can multiplex both Hypercore replication and RPC calls over the *same* Hyperswarm connection and topic**, simplifying connection management and reducing overhead.

---

## Project Descriptions

### 1. `dht-2topics-db-rpc`

- Uses **raw HyperDHT** (no Hyperswarm) to manage peer discovery.  
- Uses **two separate topics**:  
  - One topic for Hypercore replication (using Hypercore's discoveryKey).  
  - One topic for the RPC server/client communication.  
- Demonstrates pure DHT-based replication + RPC, split cleanly across topics.

### 2. `swarm-2topics-db-rpc`

- Uses **Hyperswarm** for discovery and connections.  
- Like above, uses **two separate topics**:  
  - One for Hypercore replication.  
  - One for RPC server/client communication.  
- Shows standard Hyperswarm usage where RPC and replication run on separate topics.

### 3. `swarm-protomux-db-rpc`

- Uses **Hyperswarm** for discovery.  
- Uses **a single topic** for **both** Hypercore replication and RPC, multiplexed together via **Protomux**.  
- Demonstrates advanced multiplexing of multiple protocols on one connection and topic, improving efficiency and simplicity.

---

## Why Separate Topics for RPC and Replication?

- Hypercore replication **requires strict synchronization** using the discoveryKey topic.  
- If you put RPC calls on the same topic *without multiplexing*, they will interfere with replication or cause connection conflicts.  
- Separate topics keep protocols cleanly separated unless you use multiplexing (Protomux).

---

## When to Use Protomux?

- If you want to reduce overhead and complexity by **combining replication and RPC on the same swarm connection**, use **Protomux**.  
- Protomux creates virtual channels over the same socket, letting you run multiple protocols (e.g., replication + RPC + healthchecks) in parallel on the same network connection and topic.

---

## How to Run

1. Clone or download each project folder.

2. Install dependencies with:

```bash
npm install
