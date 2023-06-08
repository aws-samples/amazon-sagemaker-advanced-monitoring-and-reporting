## SageMaker Centralized Monitoring and Reporting

A solution to enable centralized monitoring of SageMaker jobs and activities across multiple AWS accounts. This aims to assist operation team to have a highlevel view of all SageMaker workloads spread in multiple workload accounts from a single pane of glass. It also has an option to enable the [Amazon CloudWatch Cross-Account Observability](https://aws.amazon.com/blogs/aws/new-amazon-cloudwatch-cross-account-observability/) across the SageMaker workload accounts to provide access to monitoring telemetries such as metrics, logs and traces from the centralized monitoring account.

## Tools required
- [Node.js](https://nodejs.org/en/download/) 14.15.0 or later
- [AWS CLI Version 2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- [CDK Toolkit](https://docs.aws.amazon.com/cdk/v2/guide/cli.html)
- [Docker Engine](https://docs.docker.com/engine/install/) (in running state when performing the deployment procedures)

## Solution Architecture
![Solution Architecture](Architecture.png?raw=true "Solution Architecture")
### Centralized Events Collection
Amazon SageMaker has native integration with the [Amazon EventBridge](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-what-is.html), Amazon EventBridge monitors status change events in Amazon SageMaker. EventBridge enables you to automate SageMaker and respond automatically to events such as a training job status change or endpoint status change. Events from SageMaker are delivered to EventBridge in near real time. SageMaker events monitored by EventBridge can be found [here](https://docs.aws.amazon.com/sagemaker/latest/dg/automating-sagemaker-with-eventbridge.html). In addition to the SageMaker native events, AWS CloudTrail publishes events when you make API calls, which also streams to Aamzon EventBridge so that this can be utilized by many downstream automation or monitoring use cases. In our solution, we uses EventBridge rules in the workload accounts to stream both SageMaker service events and API events to the monitoring account's EventBus for centralized monitoring.

In the centralized monitoring account, the events are captured by an EventBrige rule and further processed into in different targets:
* CloudWatch Log Group - all events are stored in here has below purpose:
  * Auditing/Archive purpose (https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/WhatIsCloudWatchLogs.html)
  * Analyzing log data with [CloudWatch Log Insights queries](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/AnalyzingLogData.html). CloudWatch Logs Insights enables you to interactively search and analyze your log data in Amazon CloudWatch Logs. You can perform queries to help you more efficiently and effectively respond to operational issues. If an issue occurs, you can use CloudWatch Logs Insights to identify potential causes and validate deployed fixes.
  * Support use of CloudWatch Insights Query Widget for highlevel operation CloudWatch dashboard/ Add query CloudWatch Insights Query to dashboard or export query results
* Lambda Function
  * Perform custom logic to augment the SageMaker service events. One example is to perform metric query on SageMaker job hosts's utilization metrics when a job completion event is received. This example is supported by the native [CloudWatch Cross-Account Observability](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Unified-Cross-Account.html) feature to achieve cross-account metrics, logs and traces access.
  * Convert event information to metric, certain log format as ingested as [EMF](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Embedded_Metric_Format.html)

---
## Procedure:
This solution can be used for either AWS accounts managed by AWS Organizations or standalone accounts. The following sections will explain the steps for the 2 scenarios respectively. Please note that within each scenario, steps will be performed in different AWS accounts. For your convenience, the account type to perform the step is highlighted at the beginning each step. 

### Deploy for AWS Organizations environment
If the monitoring account and all SageMaker workload accounts are all in the same AWS Organization, the required infrastructure in the source workload accounts are automatically via CloudFormation StackSet from the AWS Organization's management account. Therefore, no manual infra deploy into source workload accounts is required. When a new account is created or an existing account moved into a target OU, the source workload infra stack will be automatically deployed and included in the scope of centralized monitoring.

```bash
./scripts/deploy-organizations.sh
```
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

### Deploy to Individual Accounts
If your environment doesn't use AWS Organizations, the monitoring account infra stack is deployed in a similar manner with just a slightly change. However, the workload infrastructure stack needs to be deployed manually into each workload accounts. Therefore, it is suitable for environment with limited number of account. For large environment, it is recommended to consider AWS Organizations.

```bash
./scripts/deploy-individual.sh
```
<details>
    <summary><b><i>[Optional] Manual Steps</i></b></summary>

### Step 0
**[Not in any account]** Collect the following information from your environment. They will be used in the later steps
  * The AWS account to be used as monitoring account
  * A list of AWS accounts which will be used as SageMaker workload accounts and will be included into centralized monitoring
  * The home region of your workload.

### Step 1
**[Monitoring account]** Enable monitoring account configuration in the home region. Only perform Section "Step 1: Set up a monitoring account" of this [documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Unified-Cross-Account-Setup.html#Unified-Cross-Account-Setup-ConfigureMonitoringAccount). Please note for the 6th step in this documentation, enter the list of individual workload account IDs.

Then retrieve the "monitoring account sink ARN" for later use. You can obtain the ARN by clicking through ```CloudWatch service console``` > ```Settings``` > ```Manage source accounts``` > ```Configuration details``` > note down the value of ```Monitoring accounts sink ARN```

### Step 2
Execute the following commands in your local machine. Before executing the command, replace ```<111111111111>``` and ```<aws_region>``` to the right value based on information collected in Step 0
```bash
git clone https://github.com/aws-samples/amazon-sagemaker-advanced-monitoring-and-reporting.git
cd amazon-sagemaker-advanced-monitoring-and-reporting
cat << EOF >./.env
MONITORING_ACCOUNT=<111111111111>
CDK_DEPLOY_REGION=<aws_region>
EOF
```
These commands clone this repo to your local workspace, change directory into the local folder and then create the .env file which will be used later for CDK deployment.

### Step 3
**[Monitoring Account]** Execute the following command to deploy the  CDK application "monitoring-account-infra-stack". Before executing the command, modify the ```accounts-to-allow``` list to the actual list of SageMaker workload account IDs 

```bash
cat << EOF >./monitoring-account-infra/cdk.context.json
{
  "accounts-to-allow": [
    "<222222222222>",
    "<333333333333>",
    ...
  ]
}
EOF
make deploy-monitoring-account-infra
```
Once the command execution completes, you should see the following information from output in the terminal:
* MonitoringAccountEventbusARN 
* MonitoringAccountRoleName

### Step 4
**[Workload Account]** Deploy the workload infrastructure stack into each SageMaker workload account. 
Execute the below command only once to set up the CDK deployment context
```bash
cat << EOF >./workload-account-infra/cdk.context.json
{
  "monitoring-account-id": "<123456789012>",
  "monitoring-account-sink-arn": "<arn:aws:oam:ap-southeast-2:123456789012:sink/11111111-2222-3333-aabb-1a2b3c4d5e>",
  "monitoring-account-role-name": "<sagemaker-monitoring-account-role>",
  "monitoring-account-eventbus-arn": "<arn:aws:events:ap-southeast-2:123456789012:event-bus/sagemaker-monitoring-eventbus>"
}
EOF
make deploy-workload-account-infra
```

Then repeat the following command for each workload account. Modify the ```<111111111111>``` to the actual workload account ID you are deploying into. 
```bash
export WORKLOAD_ACCOUNT=<111111111111>
make deploy-workload-account-infra
unset WORKLOAD_ACCOUNT
```

### Clean up
**[Workload Accounts and Monitoring Account]** To tear down the stacks, use the follow commands. Make sure you are using the right AWS account's credential for each of the make command. 
```bash
make destroy-workload-account-infra # Execute against each workload account
make destroy-monitoring-account-infra # Execute against the monitoring account
```
Alternatively, you can login into the monitoring account and workload account and delete the stacks from the CloudFormation console

</details>

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.

