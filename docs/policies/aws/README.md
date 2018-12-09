# AWS Berlioz Permissions Policy

Berlioz would fully automation application deployment to your AWS account, including image packaging & upload, infrastructure setup, service deployment and monitoring. 

In order to berlioz to perform its duties, you should allow certain permission to AWS user linked to your Berlioz account. Features and apabilities used can affect necessary policy to be configured. Below are several common scenarios. For anything custom, contact us at <info@berlioz.cloud>

## Simple Policy
Easiest to start with. Policy below disallows Berlioz to access to user and group management. Allows easy start and evaluation. For more advanced and production uses, or if you already have legacy deployments we would recommend [Advanced](#advanced-policy) policy.

<pre>
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Deny",
            "Action": [
                "iam:DeactivateMFADevice",
                "iam:DeleteAccessKey",
                "iam:DeleteGroup",
                "iam:UpdateGroup",
                "iam:CreateVirtualMFADevice",
                "iam:CreateSAMLProvider",
                "iam:CreateUser",
                "iam:CreateAccessKey",
                "iam:CreateLoginProfile",
                "iam:AddUserToGroup",
                "iam:RemoveUserFromGroup",
                "iam:EnableMFADevice",
                "iam:ResyncMFADevice",
                "iam:CreateAccountAlias",
                "iam:DetachGroupPolicy",
                "iam:DetachUserPolicy",
                "iam:DeleteAccountAlias",
                "iam:UpdateSAMLProvider",
                "iam:DeleteLoginProfile",
                "iam:ChangePassword",
                "iam:PutGroupPolicy",
                "iam:UpdateLoginProfile",
                "iam:CreateGroup",
                "iam:UpdateUser",
                "iam:PutUserPermissionsBoundary",
                "iam:DeleteUserPolicy",
                "iam:AttachUserPolicy",
                "iam:UpdateAccessKey",
                "iam:DeleteUser",
                "iam:DeleteUserPermissionsBoundary",
                "iam:TagUser",
                "iam:UntagUser",
                "iam:UpdateAccountPasswordPolicy",
                "iam:DeleteVirtualMFADevice",
                "iam:AttachGroupPolicy",
                "iam:PutUserPolicy",
                "iam:DeleteGroupPolicy",
                "iam:DeleteSAMLProvider"
            ],
            "Resource": "*"
        }
    ]
}
</pre>

## Advanced Policy
Best for production or evaluation when security matters. In case you already have existing deployments, the best practice it would be to:
* set up a dedicated AWS account for Berlioz to operate
* create a new VPC in the dedicated account
* configure VPC peering connections to existing VPCs

<pre>
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ec2:AcceptVpcPeeringConnection",
                "ec2:AssociateRouteTable",
                "ec2:AttachInternetGateway",
                "ec2:AuthorizeSecurityGroupIngress",
                "ec2:CreateInternetGateway",
                "ec2:CreateKeyPair",
                "ec2:CreateRoute",
                "ec2:CreateRouteTable",
                "ec2:CreateSecurityGroup",
                "ec2:CreateSubnet",
                "ec2:CreateTags",
                "ec2:CreateVpc",
                "ec2:CreateVpcPeeringConnection",
                "ec2:DeleteInternetGateway",
                "ec2:DeleteKeyPair",
                "ec2:DeleteRoute",
                "ec2:DeleteRouteTable",
                "ec2:DeleteSecurityGroup",
                "ec2:DeleteSubnet",
                "ec2:DeleteVpc",
                "ec2:DeleteVpcPeeringConnection",
                "ec2:DescribeInstances",
                "ec2:DescribeInternetGateways",
                "ec2:DescribeKeyPairs",
                "ec2:DescribeNetworkInterfaces",
                "ec2:DescribeRouteTables",
                "ec2:DescribeSecurityGroups",
                "ec2:DescribeSubnets",
                "ec2:DescribeVolumes",
                "ec2:DescribeVpcAttribute",
                "ec2:DescribeVpcPeeringConnections",
                "ec2:DescribeVpcs",
                "ec2:DetachInternetGateway",
                "ec2:DisassociateRouteTable",
                "ec2:ModifySubnetAttribute",
                "ec2:ModifyVpcAttribute",
                "ec2:RevokeSecurityGroupIngress"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "iam:AddRoleToInstanceProfile",
                "iam:AttachRolePolicy",
                "iam:CreateInstanceProfile",
                "iam:CreatePolicy",
                "iam:CreateRole",
                "iam:DeleteInstanceProfile",
                "iam:DeletePolicy",
                "iam:DeleteRole",
                "iam:DetachRolePolicy",
                "iam:GetInstanceProfile",
                "iam:GetPolicy",
                "iam:GetPolicyVersion",
                "iam:GetRole",
                "iam:GetUser",
                "iam:ListAttachedRolePolicies",
                "iam:ListInstanceProfiles",
                "iam:ListPolicies",
                "iam:ListPolicyVersions",
                "iam:ListRoles",
                "iam:PassRole",
                "iam:RemoveRoleFromInstanceProfile"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "apigateway:GET"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "cognito-idp:DescribeUserPool",
                "cognito-idp:DescribeUserPoolClient",
                "cognito-idp:ListUserPoolClients",
                "cognito-idp:ListUserPools"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "ecs:CreateCluster",
                "ecs:DeleteCluster",
                "ecs:DeregisterTaskDefinition",
                "ecs:DescribeClusters",
                "ecs:DescribeContainerInstances",
                "ecs:DescribeTaskDefinition",
                "ecs:DescribeTasks",
                "ecs:ListClusters",
                "ecs:ListContainerInstances",
                "ecs:ListTaskDefinitions",
                "ecs:ListTasks",
                "ecs:RegisterTaskDefinition",
                "ecs:StartTask",
                "ecs:StopTask"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "ecr:BatchCheckLayerAvailability",
                "ecr:BatchGetImage",
                "ecr:CompleteLayerUpload",
                "ecr:CreateRepository",
                "ecr:DescribeRepositories",
                "ecr:GetAuthorizationToken",
                "ecr:GetDownloadUrlForLayer",
                "ecr:InitiateLayerUpload",
                "ecr:PutImage",
                "ecr:UploadLayerPart"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:CreateTable",
                "dynamodb:DeleteTable",
                "dynamodb:DescribeTable",
                "dynamodb:ListTables"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "kms:DescribeKey",
                "kms:ListAliases",
                "kms:ListKeys",
                "kms:ListResourceTags"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "events:DescribeRule",
                "events:ListRules",
                "events:ListTargetsByRule"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "route53:GetHostedZone",
                "route53:ListHostedZones",
                "route53:ListRecordSets",
                "route53:ListTagsForResource"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "kinesis:DescribeStream",
                "kinesis:ListStreams"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "lambda:GetPolicy",
                "lambda:ListEventSourceMappings",
                "lambda:ListFunctions"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "autoscaling:CreateAutoScalingGroup",
                "autoscaling:CreateLaunchConfiguration",
                "autoscaling:DeleteAutoScalingGroup",
                "autoscaling:DeleteLaunchConfiguration",
                "autoscaling:DescribeAutoScalingGroups",
                "autoscaling:DescribeLaunchConfigurations",
                "autoscaling:UpdateAutoScalingGroup"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "elasticloadbalancing:AddTags",
                "elasticloadbalancing:CreateListener",
                "elasticloadbalancing:CreateLoadBalancer",
                "elasticloadbalancing:CreateTargetGroup",
                "elasticloadbalancing:DeleteListener",
                "elasticloadbalancing:DeleteLoadBalancer",
                "elasticloadbalancing:DeleteTargetGroup",
                "elasticloadbalancing:DeregisterTargets",
                "elasticloadbalancing:DescribeListeners",
                "elasticloadbalancing:DescribeLoadBalancers",
                "elasticloadbalancing:DescribeTags",
                "elasticloadbalancing:DescribeTargetGroups",
                "elasticloadbalancing:DescribeTargetHealth",
                "elasticloadbalancing:RegisterTargets"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:DeleteLogGroup",
                "logs:DescribeLogGroups",
                "logs:ListTagsLogGroup"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "sqs:CreateQueue",
                "sqs:DeleteQueue",
                "sqs:GetQueueAttributes",
                "sqs:ListQueueTags",
                "sqs:ListQueues",
                "sqs:SendMessage",
                "sqs:TagQueue"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "ssm:DescribeParameters"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:CreateBucket",
                "s3:GetBucketLocation",
                "s3:GetBucketTagging",
                "s3:HeadBucket",
                "s3:ListAllMyBuckets",
                "s3:ListBucket",
                "s3:PutBucketTagging",
                "s3:Upload"
            ],
            "Resource": "*"
        }
    ]
}
</pre>