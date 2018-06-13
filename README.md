[![Release](https://img.shields.io/github/release/berlioz-the/berlioz.svg)](https://github.com/berlioz-the/berlioz/releases/latest)
[![License](https://img.shields.io/github/license/berlioz-the/berlioz.svg)](https://github.com/berlioz-the/berlioz/LICENSE.md)
[![GitHub last commit](https://img.shields.io/github/last-commit/berlioz-the/berlioz.svg)](https://github.com/berlioz-the/berlioz/commits/master)
[![Slack](https://img.shields.io/badge/slack-join-6073A0.svg)](https://slack.berlioz.cloud)
[![Analytics](https://ga-beacon.appspot.com/UA-120606268-2/github/berlioz)](https://github.com/igrigorik/ga-beacon)

[**Berlioz**](https://berlioz.cloud) is a service that delivers microservices applications to AWS public cloud. Application components are defined in YAML using high level abstractions. This enables teams to work independently and focus on  business problems rather than cloud logistics. **Berlioz** will also configure AWS native services like DynamoDB, Kinesis, etc.

Another very useful capability of **Berlioz** is to deploy the application locally on a workstation as if it is running in an AWS cloud. This will also work even if the application is using cloud native resources and services. This significantly improves development team productivity.

## Features
![Cloud Provisioning](assets/features/deploy.svg?sanitize=true) **Cloud Provisioning** - Describe your container based microservices application in a developer-friendly declarative manner and get it automatically deployed in AWS public cloud.

![Service Discovery](assets/features/service-discovery.svg?sanitize=true) **Service Discovery** - Zero-config discovery is available for all services out of the box. Berlioz does much more than just Load Balancer and DNS.

![Multi-Region Support](assets/features/region.svg?sanitize=true)  **Multi-Region Support** - We also support the deployment of services to multiple regions. Numerous options are available to control communication allowance across/within regions and availability zones.

![Native Resources](assets/features/resources.svg?sanitize=true) **Native Resources** - We configure, bind and manage cloud-native resources like storage volumes, message queues, etc. and make them available for stateful services to consume.

![Network Configuration](assets/features/networking.svg?sanitize=true) **Network Configuration** - We automatically configure the network and ensure the availability and security of your application.

![Load Balancing](assets/features/load-balancer.svg?sanitize=true) **Load Balancing** - Single line entry in your service declaration would provision load balancer for your service.

![Isolated Deployments](assets/features/isolated-deployment.svg?sanitize=true) **Isolated Deployments** - Get your application deployed per your staging (test & prod) and your team member needs.

![Local Deployment](assets/features/local-deployment.svg?sanitize=true) **Local Deployment** - For means of rapid development, the application can be launched on a local workstation as if it is running in a cloud.

## Getting Started
Follow steps below to:
1. Install berlioz command line tool
2. Download sample projects
3. Deploy HelloWorld web application to local workstation

```
$ npm install berlioz -g
$ git clone https://github.com/berlioz-the/samples.git
$ cd samples/01.HelloWorld/v1.basic
$ berlioz local push-run
```

Now lets deploy the same application to AWS. The steps below will:
1. Register an account with Berlioz
2. Link AWS account with Berlioz. Follow [this guide](docs/aws-account.md)
to obtain AWS key and secret.
3. Create new deployment definition for production
4. Build docker images and push the to the cloud
5. Deploy the application to production
6. Check the deployment status
7. See the endpoints

```
$ berlioz signup
$ berlioz provider create --name myaws --kind aws --key <key> --secret <secret>
$ berlioz deployment create --name prod --provider myaws --region us-east-1
$ berlioz push
$ berlioz run --deployment prod
$ berlioz status
$ berlioz endpoints --deployment prod
```

With the single web application up and running we can make some code changes
to add the second service and let them communicate. Just like before we will
run the application on a local workstation:
```
$ cd ../v2.second-service
$ berlioz local push-run
```
and then, to the cloud:
```
$ berlioz push
$ berlioz run --deployment prod
$ berlioz status
$ berlioz endpoints --deployment prod
```

This was the most trivial application example we could come up with. For more
sample uses and scenarios checkout the complete samples repository [here](https://github.com/berlioz-the/samples).

## Documentation
Complete documentation reference:
* [Language](docs/language.md) - declarative YAML to define services and interactions.
* [Command Line Interface](docs/cli.md) - toolkit to build and deploy applications.
* [Connectors](docs/connectors.md) - client library to enable service-discovery.
* [Samples](https://github.com/berlioz-the/samples) - probably one of the best way to explore Berlioz capabilities.
