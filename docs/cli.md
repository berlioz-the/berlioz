# Berlioz Command Line Interface


## build


Builds Docker images from current project.

Should be used from the root directory of the project. Can be used to build images for one or multiple clusters.

The tool will be searching for service definitions in **Berliozfile** files within the current directory. It will then build **Dockerfile** files in the same directory.

```
cluster_one/
    Berliozfile        # Definition of the cluster_one
    service_one/
        Berliozfile    # Definition of the service_one
        Dockerfile
    service_two/
        Berliozfile    # Definition of the service_two
        Dockerfile
```

## cluster describe


Displays cluster definitions.

## cluster list


Outputs the list of clusters.

## cluster versions


Outputs the version history of cluster defnitions.

## deployment cluster list


Outputs the list of deployments.

## deployment cluster versions


Outputs the versions of deployment clusters.

## deployment create


Creates a new deployment.

## deployment delete


Deletes an existing deployment.

## deployment dns get


Gets configured service domain name for the deployment.

## deployment dns set


Sets service domain name for the deployment.

## deployment get-configs


Displays dynamic deployment configuration.

## deployment list


Outputs the list of deployments.

## deployment processor logs


Outputs logs of berlioz deployer robot.

## deployment scale get


Gets the configured number of running instances for a service.

## deployment scale set


Sets the number of running instances for a service.

## deployment set-config


Configures deployment dynamic values.

## deployment status


Displays current status of the deployment.

## endpoints


Outputs publicly exposed endpoints of the deployment.

## local account


Setup AWS account profile name for local deployment native resources.

## local endpoints


Outputs publicly exposed endpoints of the deployment.

## local get-configs


Displays current configuration.

## local provision


Starts the service on a local workstation.

## local push


Builds and pushes the images to local deployment store.

## local push-provision


Builds and pushes the images to local deployment store.

## local scale get


Specifies number of service instances to deploy on a local workstation.

## local scale set


Specifies number of service instances to deploy on a local workstation.

## local unprovision


Starts the service on a local workstation.

## login


Logs in to Berlioz account.

## logout


Logs out from Berlioz account.

## output-definitions


Outputs Berlioz definitions in current project.

## output-diagram


Renders Berlioz definition diagram in current project.

## provider create


Links cloud provider account.

## provider delete


Unlinks cloud provider account.

## provider list


Outputs the list of linked providers.

## provision


Deploys the service to cloud.

## pull-template


Downloads service template from the public repository.

## push


Builds and pushes the images to the cloud.

Executes the [build](#build) command and once the build is complete, pushes the images to the cloud. It is important to note that this command does not deploy the software version. It only makes it available for one click deployment.

To deploy the cluster refer to [provision](#provision) command.

Just like with the [build](#build) command, this command should be called from the project root directory.

## signup


Signs up new account with Berlioz.

## unprovision


Terminates service deployment from the cloud.
