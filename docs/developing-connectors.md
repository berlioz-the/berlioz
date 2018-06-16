# Connector Development Guidelines

Connectors enable service mesh functionality to microservices. They also significantly simplify microservices application development by standardizing service-to-service communication. Connectors also wrap AWS cloud SDK for simplified use.

Connectors provide following functionality:
* Store and provide list of service peers
* Notify service peer changes
* Provide convenience methods for a service to communicate with peers. Internally implements service mesh features: tracing, retry, circuit braking, client-side load balancing.
* Store and provide list of database peers
* Notify database peer changes
* Provide convenience methods for a service to access database resources. Wraps AWS SDK methods. Internally implements service mesh features for databases: tracing, retry, circuit braking, client-side load balancing.
* Store and provide list of queue peers
* Notify queue peer changes
* Provide convenience methods for a service to access queue resources. Wraps AWS SDK methods. Internally implements service mesh features for queues: tracing, retry, circuit braking, client-side load balancing.
* Provide method to attach to web server object to trace incoming requests.

## Implementing a Connector

### Milestone 1. Basic Service Discovery.
Connector should connect to a web socket server specified by the *BERLIOZ_AGENT_PATH* environment variable. Connector will receive through the web socket and store in the local registry. The messages will look like this:
```json
{
    "peers": {
        "service": {
            "app": {
                "client": {
                    "1": {
                        "protocol": "http",
                        "networkProtocol": "tcp",
                        "port": 4000,
                        "address": "10.0.0.23"
                    },
                    "2": {
                        "protocol": "http",
                        "networkProtocol": "tcp",
                        "port": 4001,
                        "address": "10.0.0.44"
                    }
                }
            }
        }
    }
}
```
The message above signifies the list of *service* *app* endpoint *client* peers. The dictionary key specifies the identity of the peer. The message contents should be stored in the **registry**. The **registry** should allow a quick lookup by kind(in this example *service*), name(in this example *app*) and endpoint(in this example *client*). It also should provide ability to notify changes if the new list of peers is different from the current list.

#### APIs to implement:

##### getPeers(kind, name, endpoint)
Returns the list of all peers for specified target.

**Parameters**:
* **kind**: is either _service_ or _cluster_
* **name**: name of the target service/cluster
* **endpoint**: name of the endpoint

Example Result:
```json
{
    "1": {
        "protocol": "http",
        "networkProtocol": "tcp",
        "port": 4000,
        "address": "10.0.0.23"
    },
    "2": {
        "protocol": "http",
        "networkProtocol": "tcp",
        "port": 4001,
        "address": "10.0.0.44"
    }
}
```

---

##### monitorPeers(kind, name, endpoints, callback)
Monitors for peers changes and triggers the provided callback with changes.

**Parameters**:
* **kind**: is either _service_ or _cluster_
* **name**: name of the target service/cluster
* **endpoint**: name of the endpoint
* **callback**: function(data). Called when peers change.
    * **data**: map of peers. same as the result from **getPeers** method
        * **identity**: unique identifier of the peer
            * **address**: ip address of the peer
            * **port**: port of the peer

---

##### getRandomPeer(kind, name, endpoint)
Returns a random peer for specified target.

**Parameters**:
* **kind**: is either _service_ or _cluster_
* **name**: name of the target service/cluster
* **endpoint**: name of the endpoint

Example Result:
```json
{
    "protocol": "http",
    "networkProtocol": "tcp",
    "port": 4000,
    "address": "10.0.0.23"
}
```

### Milestone 2. Peer Request
Allow to send an HTTP request to a peer service.

#### APIs to implement:

##### request(kind, name, endpoints, options)
Sends and HTTP request to a random peer. Literally use **getRandomPeer** do decide which peer to send the data to.

**Parameters**:
* **kind**: is either _service_ or _cluster_
* **name**: name of the target service/cluster
* **endpoint**: name of the endpoint
* **options**: specify HTTP parameters. Include _method_, _url_ and _body_ attributes. Note that _url_ should be relative (i.e. not include server ip/port)

**Returns:**
Promise or other object/callback to get notified with response.

**Examples**:
```
berlioz.request('service', 'app', 'client', {
        url: '/contact',
        method: 'POST',
        body: {
            name: 'Chuck Norris',
            phone: '314-159-2653'
        }
    });
```


### Milestone 3. Databases
Add database support. Another type of peers is **database**. Expose APIs to access database peers. Very similar how it was done in Milestone 1.
```json
{
    "peers": {
        "database": {
            "contacts": {
                "1": {
                    "tableName": "contacts",
                    "config": { }
                }
            }
        }
    }
}
```

#### APIs to implement:

##### getDatabaseInfo(name)
Returns the first entry in from the **database** peers.

**Parameters**:
* **tableName**: the name of the AWS DynamoDB Table
* **config**: contains AWS connection information. Should be passed to AWS SDK constructor.

Example Result:
```json
{
    "tableName": "contacts",
    "config": {}
}
```

---

##### monitorDatabases(name, callback)
Monitors for database changes and triggers the provided callback with changes.

**Parameters**:
* **name**: name of the database
* **callback**: function(data). Called when databases change.
    * **data**: map of databases.
        * **identity**: unique identifier of the database
            * **tableName**: tableName
            * **config**: AWS connection information


### Milestone 4. Queues
Add queue support. Another type of peers is **queue**. Expose APIs to access queue peers. Exactly same as Milestone 3. Not much to do.
```json
{
    "peers": {
        "queue": {
            "contacts": {
                "1": {
                    "streamName": "jobs",
                    "config": { }
                }
            }
        }
    }
}
```

#### APIs to implement:

##### getQueueInfo(name)
Returns the first entry in from the **queue** peers.

**Parameters**:
* **streamName**: the name of the AWS Kinesis Stream
* **config**: contains AWS connection information. Should be passed to AWS SDK constructor.

Example Result:
```json
{
    "streamName": "jobs",
    "config": {}
}
```

---

##### monitorQueues(name, callback)
Monitors for queue changes and triggers the provided callback with changes.

**Parameters**:
* **name**: name of the queue
* **callback**: function(data). Called when queues change.
    * **data**: map of databases.
        * **identity**: unique identifier of the queue
            * **streamName**: the name of the AWS Kinesis Stream
            * **config**: AWS connection information
