**Berlioz** is a service that delivers microservices applications to AWS public cloud. Application components are defined in YAML using high level abstractions. This enables teams work independently and focus on the business problems and not cloud logistics. **Berlioz** will also configure AWS native services like DynamoDB, Kinesis, etc.

Another very useful capability of **Berlioz** is to deploy the application locally on a workstation as if it is running in an AWS cloud. This will also work even if the application is using cloud native resources and services. This significantly improves development team productivity.

## Features
![Cloud Provisioning](assets/features/deploy.svg) **Cloud Provisioning** - Describe your container based microservices application in a developer-friendly declarative manner and get it automatically deployed in AWS public cloud.

![Service Discovery](assets/features/service-discovery.svg) **Service Discovery** - Zero-config discovery is available for all services out of the box. Berlioz does much more than just Load Balancer and DNS.

![Multi-Region Support](assets/features/region.svg)  **Multi-Region Support** - We also support the deployment of services to multiple regions. Numerous options are available to control communication allowance across/within regions and availability zones.

![Native Resources](assets/features/resources.svg) **Native Resources** - We configure, bind and manage cloud-native resources like storage volumes, message queues, etc. and make them available for stateful services to consume.

![Network Configuration](assets/features/networking.svg) **Network Configuration** - We automatically configure the network and ensure the availability and security of your application.

![Load Balancing](assets/features/load-balancer.svg) **Load Balancing** - Single line entry in your service declaration would provision load balancer for your service.

![Isolated Deployments](assets/features/isolated-deployment.svg) **Isolated Deployments** - Get your application deployed per your staging (test & prod) and your team member needs.

![Local Deployment](assets/features/local-deployment.svg) **Local Deployment** - For means of rapid development, the application can be launched on a local workstation as if it is running in a cloud.
