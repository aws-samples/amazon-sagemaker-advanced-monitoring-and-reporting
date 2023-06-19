### Deploy to Non-Organizations Environment
If your environment doesn't use AWS Organizations, the monitoring account infra stack is deployed in a similar manner with just a slightly change. However, the workload infrastructure stack needs to be deployed manually into each workload accounts. Therefore, it is suitable for environment with limited number of account. For large environment, it is recommended to consider AWS Organizations.

#### Step 1: Setup Monitoring Account Resources
To deploy the monitoring accont resources, run the follow command:
```bash
./scripts/individual-deployment/deploy-monitoring-account.sh
```
Enter the following input values:
| Input | Description | Example |
| -------- | ------- | ------- |
| Home region | This represents the AWS region name where the workloads run | ap-southeast-2
| Sagemaker workload account list | A list of accounts that run the Sagemake workload and stream events to monitoring account. Separated by comma. | 111111111111,222222222222 |
| Monitoring account AWSCLI profile name | [Optional] You can find the profile name from ~/.aws/config. If not provided, uses default AWS creds from the chain | |

Keep a note of the outputs as below. They will be used in next step when deploying management account stack.
![Monitoring Stack Outputs](../images/MonitoringStackOutputs.png)

#### Step 2: Setup Workload Account Monitoring Infrastructure
<span style="background-color: #FFFF00">Repeat this step for each workload account that will be centrally monitored</span>
To deploy the monitoring infra for workload account, run the following command:
```bash
./scripts/individual-deployment/deploy-workload-account.sh
```
Enter the following input values:
| Input | Description | Example |
| -------- | ------- | ------- |
| Home region | This represents the AWS region name where the workloads run. This should be the same as monitoring stack | ap-southeast-2
| Monitoring Account ID | The account ID of where the monitoring stack is deployed to | |
| Monitoring Account Role Name | Output "MonitoringAccountRoleName" from Step 1 |
| Monitoring Account Eventbus ARN | Output "MonitoringAccountEventbusARN" from Step 1 |
| Monitoring Account Sink Identifier | Output "MonitoringAccountSinkIdentifier" from Step 1 |
| Workload account AWSCLI profile name | [Optional] You can find the profile name from ~/.aws/config. If not provided, uses default AWS creds from the chain | |

#### Clean up
**[Management Account and Monitoring Account]** To tear down the stacks, use the follow commands. Make sure you are using the right AWS account's credential for each of the make command. 
```bash
make destroy-workload-account-infra # Execute against each workload account
make destroy-monitoring-account-infra # Execute against the monitoring account
```
Alternatively, you can login into the monitoring account and workload accounts and delete the stacks from the CloudFormation console.