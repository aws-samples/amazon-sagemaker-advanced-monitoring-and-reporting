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