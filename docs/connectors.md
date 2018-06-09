# Connectors

## Purpose
The connector provides service mesh functionality across microservices, as well
as between microservice to AWS native service communications. It comes in a form of a client library which is linked to the microservice. For the full list of connectors see [implementations](#implementations).


## Architecture
![Connector Architecture](../assets/diagrams/connector.svg)

* **AWS-Client**: Client AWS cloud account where deployment is specified to happen.
* **Instance**: An AWS Instance.
* **Service[x][y]**: Running replica **y** of the **Service[x]**.
* **Connector**: A client library which is linked to the **Service[x]**.
* **Berlioz Agent**: An agent which is automatically deployed on every instance by the **Berlioz Robot**.
* **AWS-SQS**: A message queue service provided by AWS is used as a communication mechanism between **Berlioz Agent** and **Berlioz Robot**.
* **AWS-Berlioz**: Berlioz AWS cloud account.
* **Berlioz Robot**: A smart robot that performs deployment of clusters to client AWS account, along will all the resources in the diagram.

## Using The Connector
Connectors are implemented in different languages and language specifics may affect exact interface, but regardless the connectors provide following APIs to the microservice:

#### getPeers(kind, name, endpoints)
Returns the list of all peers for specified target.

**Parameters**:
* **kind**: is either _service_ or _cluster_
* **name**: name of the target service/cluster
* **endpoint**: name of the endpoint

**Examples**:
```
berlioz.getPeers('service', 'app', 'client');
```
returns:
```
{
    '1': {
        address: '10.0.0.22',
        port: '1234'
    },
    '2': {
        address: '10.0.0.23',
        port: '5678'
    }
}
```

#### monitorPeers(kind, name, endpoints, cb)
Monitors for peers changes and triggers the provided callback with changes.

**Parameters**:
* **kind**: is either _service_ or _cluster_
* **name**: name of the target service/cluster
* **endpoint**: name of the endpoint
* **callback**: the callback to trigger


**Examples**:
```
berlioz.monitorPeers('service', 'app', 'client', (peers) => {
    console.log(peers);
});
```
outputs:
```
{
    '1': {
        address: '10.0.0.22',
        port: '1234'
    },
    '2': {
        address: '10.0.0.23',
        port: '5678'
    }
}
```


## Implementations

### NodeJS Connector
[NodeJS Connector](https://github.com/berlioz-the/connector-nodejs)

## Developing New Connector
