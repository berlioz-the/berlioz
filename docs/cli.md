# Command Line Interface


## build


Builds Docker images for current project.

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


Displays cluster definition contents.

Will output cluster, service and other resource definitions of the cluster. Optionally a version can be specified. Refer to [cluster versions](#cluster-versions) for the version history.

## cluster list


Outputs the list of cluster definitions.

Those are the clusters published using [push](#push) command. Please note that the output of this command does not display clusters that are currently deployed. Refer to [deployment cluster list](#deployment-cluster-list) for see deployed clusters.

## cluster versions


Outputs cluster definition version history.

The version from this command can be used to output definitions of a particular version using [cluster describe](#cluster-describe) command.

## deployment clusters


Outputs the list of deployed clusters.

## deployment create


Creates a new deployment definition.

After creating the deployment definition you should use [push](#push) command to publish the cluster, and [provision](#provision) command to deploy.

Prior to creating a deployment definition, a cloud provider should be linked using [provider create](#provider-create) command.

## deployment delete


Deletes an existing deployment definition.

All provisioned clusters for this definition will be undeployed.

## deployment dns get


Returns configured service domain name for the deployment.

## deployment dns set


Sets service domain name for the deployment.

Used for service endpoints where dns is turned on.

## deployment get-configs


Displays dynamic deployment configuration.

## deployment list


Outputs the list of deployment definitions.

## deployment processor logs


Outputs logs of berlioz deployer robot.

## deployment scale get


Returns configured number of running instances for a service.

## deployment scale set


Sets the number of running instances for a service.

## deployment set-config


Sets up deployment dynamic configuration.

## deployment status


Displays deployments and their statuses.

## deployment versions


Outputs the deployment versions.

The result of this command can be used to downgrade/upgrade to a particular version using [provision](#provision) command.

## endpoints


Outputs publicly exposed service endpoints.

## local account


Setup AWS account profile name for local deployment native resources.

Berlioz allows use of cloud native resources like DynamoDB and Kinesis. In order to have access to such services even when deploying on a local workstation, we need an access to some AWS account to configure those resources. Specify AWS profile to use for that purpose. Note, that this account does not have to be the one used in other deployments.

## local endpoints


Outputs publicly exposed endpoints for local deployment

## local get-configs


Displays dynamic local deployment configuration.

## local provision


Provisions services on a local workstation.

This command provisions locally published clusters on a local workstation.

Optionally, a single cluster can be specified to provision a single cluster only.

## local push


Builds and pushes the images to local workstation store.

Executes the [build](#build) command and once the build is complete, pushes the images to the local workstation store. It is important to note that this command does not deploy the cluster locally yet. To deploy the cluster use the [local provision](#local-provision) command.

Just like with the [build](#build) command, this command should be called from the project root directory.

## local push-provision


Builds and provisions the services on a local workstation

This command should be called from the project root directory. This command literally combines [build](#build), [local push](#local-push) and [local provision](#local-provision) commands.

## local scale get


Returns configured number of service instances to deploy on a local workstation.

## local scale set


Sets the number of running instances for a service on a local workstation.

## local unprovision


Terminates services on a local workstation.

Optionally, a single cluster can be specified to undeploy a single cluster only.

## login


Logs in to Berlioz account.

If you don't already have a Berlioz account refer to [signup](#signup) command to create one.

## logout


Logs out from Berlioz account.

## output-definitions


Outputs Berlioz definitions in current project.

This command displays the contents of "Berliozfile" files in a tabular format.

Should be used from the root directory of the project.

## output-diagram


Renders Berlioz definition diagram

This command displays the contents of "Berliozfile" files in a graphical format.

Should be used from the root directory of the project.

Please not that the tool uses PlantUML and GraphViz for rendering. PlantUML is already packaged with Berlioz. For GraphViz installation please refer to https://graphviz.gitlab.io/download/

## provider create


Links cloud provider account to Berlioz.

You can link as many AWS accounts as needed. The "kind" argument should be "aws".

Follow these steps to obtain "key" and "secret": 
 1. Login to AWS Account https://console.aws.amazon.com/console/home 
 2. Navigate to **IAM** (i.e. Identity and Access Management) 
 3. Select **Users** Menu. 
 4. Select the admin user or create a new one. 
 5. Select **Security credentials** tab. 
 6. Click **Create access key** button. 
 7. Save **Access key ID** and **Secret access key** values. You may need to click the **Show** link to fully reveal the secret key. 
 8. Once you provide the access and secret keys to berlioz command line make sure you discard the keys. 


## provider delete


Unlinks cloud provider account.

Any provisioned deployments will not be undeployed.

## provider list


Outputs the list of linked providers.

## provision


Provisions the services to the cloud.

The name of the deployment definition should be specified.

Optionally a cluster and region can be specified to limit the deployment scope, otherwise all clusters would be deployed to all regions included in the deployment definition. Please note that the changes will be made to the specified deployment only. Any other deployment definition will be unchanged.

The command will preview the changes to be made and trigger deployment process. To monitor the process refer to [deployment status](#deployment-status) command.

Also, once the deployment is fully provisioned you can access the public endpoints using [endpoints](#endpoints) command.

## push


Builds and pushes the images to the cloud.

Executes the [build](#build) command and once the build is complete, pushes the images to the cloud. It is important to note that this command does not deploy the software version. It only makes it available for one click deployment.

To deploy the cluster refer to [provision](#provision) command.

Just like with the [build](#build) command, this command should be called from the project root directory.

## signup


Signs up new account with Berlioz.

## unprovision


Terminates service deployment from the cloud.

The name of the deployment definition should be specified.

Optionally a cluster and region can be specified to limit the deployment scope, otherwise all clusters across all regions will undeployed. Please note that the changes will be made to the specified deployment only. Any other deployment definition will be unchanged.

The command will preview the changes to be made and trigger deployment process. To monitor the process refer to [deployment status](#deployment-status) command.
