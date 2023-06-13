Deploying solution to AWS organizations
<details>
    <summary><b><i>[Optional] Manual Steps</i></b></summary>

### Step 0
**[Not in any account]** Collect the following information from your environment. They will be used in the later steps
  * The management account of your AWS Organizations
  * The AWS account to be used as monitoring account
  * The AWS Organization Unit that will have the SageMaker workload accounts
  * The home region of your workload. To use this solution in multiple regions, you will need to repeat the step for each region.
### Step 1
**[Monitoring account]** Enable monitoring account configuration in the home region. Only perform Section "Step 1: Set up a monitoring account" of this [documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Unified-Cross-Account-Setup.html#Unified-Cross-Account-Setup-ConfigureMonitoringAccount). Please note for the 6th step in this documentation, enter the AWS Organization path for the workload accounts. The org path is in the form of "o-1a2b3c4d5e/r-saaa/ou-saaa-1a2b3c4d/*"

Then retrieve the "monitoring account sink ARN" for later use. You can obtain the ARN by clicking through ```CloudWatch service console``` > ```Settings``` > ```Manage source accounts``` > ```Configuration details``` > note down the value of ```Monitoring accounts sink ARN```

### Step 2
Execute the following commands in your local machine. Before executing the command, replace ```<111111111111>```, ```<222222222222>```, ```<aws_region>``` to the right value based on information collected in Step 0
```bash
git clone https://github.com/aws-samples/amazon-sagemaker-advanced-monitoring-and-reporting.git
cd amazon-sagemaker-advanced-monitoring-and-reporting
cat << EOF >./.env
MANAGEMENT_ACCOUNT=<111111111111>
MONITORING_ACCOUNT=<222222222222>
CDK_DEPLOY_REGION=<aws_region>
EOF
```
These commands clone this repo to your local workspace, change directory into the local folder and then create the .env file which will be used later for CDK deployment.

### Step 3
**[Monitoring Account]** Execute the following command to deploy the  CDK application "monitoring-account-infra-stack". Before executing the command, replace the ```<organization_unit_path>``` to the actual AWS Organizations OU path. An example looks like  ```o-1a2b3c4d5e/r-saaa/ou-saaa-1a2b3c4d/*```

```bash
cat << EOF >./monitoring-account-infra/cdk.context.json
{
  "org-path-to-allow": "<organization_unit_path>"
}
EOF
make build
make deploy-monitoring-account-infra
```
Once the command execution completes, you should see the following information from output in the terminal:
* MonitoringAccountEventbusARN 
* MonitoringAccountRoleName

### Step 4
**[Management Account]** Deploy a CloudFormation StackSet into your AWS Organizations' management account. This stackset will then automatically deploy the infrastructure stack into SageMaker workload accounts in the targeted OU. With the second method, it can also be used together with AWS Organization to target the workload infra stack deployment to organization units (OUs). The deployment steps for both scenario are described below.

```bash
cat << EOF >./workload-account-infra/cdk.context.json
{
  "monitoring-account-id": "<123456789012>",
  "monitoring-account-sink-arn": "<arn:aws:oam:ap-southeast-2:123456789012:sink/11111111-2222-3333-aabb-1a2b3c4d5e>",
  "monitoring-account-role-name": "<sagemaker-monitoring-account-role>",
  "monitoring-account-eventbus-arn": "<arn:aws:events:ap-southeast-2:123456789012:event-bus/sagemaker-monitoring-eventbus>",
  "workload-account-OUs": ["<ou-aaaa-1a2b3c4d>"],
  "workload-account-regions": ["<ap-southeast-2>"]
}
EOF
make build
make deploy-management-stackset
```

### Clean up
**[Management Account and Monitoring Account]** To tear down the stacks, use the follow commands. Make sure you are using the right AWS account's credential for each of the make command. 
```bash
make destroy-management-stackset # Execute against the management account
make destroy-monitoring-account-infra # Execute against the monitoring account
```
Alternatively, you can login into the monitoring account and management account and delete the stacks from the CloudFormation console

</details>