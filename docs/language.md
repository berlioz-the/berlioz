[![Analytics](https://ga-beacon.appspot.com/UA-120606268-2/github/berlioz/docs/language)](https://github.com/igrigorik/ga-beacon)

# Language
Berlioz entities are defined as a part of the application code base.
Every entity defined should be in a separate directory and defined in a file
called **Berliozfile** in YAML format.

```
web/
    Berliozfile
```

## Cluster
Clusters represent a logical group of services that are deployed as a single entity.
A cluster can wrap endpoints exposed by service and expose them to internet.

```yaml
kind: cluster
name: hello

provides:
    web:
        service: web
        endpoint: client
        public: true
```

## Service
Service specifies an executable entity. For service entities it is required a
**Dockerfile** to be in the same directory as the **Berliozfile**. This enables
automatic build of all docker images and deployment.
```
web/
    Berliozfile
    Dockerfile
```

**provides** attribute specifies exposed endpoints. The **load-balance** specifies
if the endpoint should be behind a load balancer. In case a public dns entry is needed,
a flag **dns** would control that. Supported **protocol** values are *http*, *https*, *tcp*, and *udp*.

**consumes** attribute defines which endpoints of other services are used by the current
service. This definition would control how firewall security rules are defined, and also
the automatic service discovery entries.

The minimum number of replicas of the service can be specified in
**scale:min** attribute. Consumed resources of the service are specified in
**resources** attribute.

```yaml
kind: service
name: web
cluster: hello

provides:
    client:
        port: 4000
        protocol: http
        load-balance: true
        dns: true

consumes:
    - service: app
      endpoint: client

scale:
    min: 1

resources:
    memory:
        min: 100
```

## Database
AWS DynamoDB tables can be utilized by specifying **class: nosql**, **class: dynamodb**.
**name** specifies table naming, **hashKey** and **rangeKey** specify key columns. **rangeKey** is optional.

```yaml
kind: database
cluster: hello
name: addressbook
class: nosql
subClass: dynamodb

hashKey:
    name: name
    type: String

rangeKey:
    name: name
    type: String
```

The table can be used by one or multiple service by specifying it in the consumes
attribute of the service:

```yaml
consumes:
    - database: addressbook
```

## Queue
AWS Kinesis queue can be utilized by specifying **class: queue**, **class: kinesis**.
**name** specifies queue naming.

```yaml
kind: queue
cluster: hello
name: myJobsQueue
class: queue
subClass: kinesis

```

The queue can be used by one or multiple service by specifying it in the consumes
attribute of the service:

```yaml
consumes:
    - queue: myJobsQueue
```
