# Connectors

## Purpose
A connector provides service mesh for across microservice, as well
as between microservice to AWS native service communications. It comes in a form of a client library which is linked to the microservice. For the full list of connectors see [implementations](#implementations).


## Architecture
![Connector Archictecture](../assets/diagrams/connector.svg)

* **AWS-Client**: Client AWS cloud account where deployment is specified to happen.
* **Instance**: An AWS Instance.
* **Service[x][y]**: Running replica **y** of the **Service[x]**.
* **Connector**: A client library which is linked to the **Service[x]**.
* **Berlioz Agent**: An agent which is automatically deployed on every instance by the **Berlioz Robot**.
* **AWS-SQS**: A message queue service provided by AWS is used as a communication mechanism between **Berlioz Agent** and **Berlioz Robot**.
* **AWS-Berlioz**: Berlioz AWS cloud account.
* **Berlioz Robot**: A smart robot that performs deployment of clusters to client AWS account, along will all the resources in the diagram.

## Requirements


## Implementations


### NodeJS Connector
[NodeJS Connector](https://github.com/berlioz-the/connector-nodejs)
