## SageMaker Centralized Monitoring and Reporting

A solution to enable centralized monitoring of SageMaker jobs and activities across AWS Organization. This aims to assist the operation team to have a highlevel view of all SageMaker workloads spread in multiple workload accounts from a single pane of glass. It also has an option to enable the [Amazon CloudWatch Cross-Account Observability](https://aws.amazon.com/blogs/aws/new-amazon-cloudwatch-cross-account-observability/) across the SageMaker workload accounts to provide access to monitoring telemetries such as metrics, logs and traces from the centralized monitoring account.

## Solution Architecture
![Solution Architecture](Architecture.png?raw=true "Solution Architecture")
### Centralized Events Collection
Amazon SageMaker has native integration with the Amazon EventBridge service and can generates various service events. The list of SageMaker service events through EventBridge can be found [here](https://docs.aws.amazon.com/sagemaker/latest/dg/automating-sagemaker-with-eventbridge.html). In addition to the service events, CloudTrail service captures API servers for various AWS services, which also streams to EventBridge so that can be utilized by many downstream automation or monitoring use cases. In our solution, we uses EventBridge rules in the workload accounts to stream both SageMaker service events and API events to the monitoring account's EventBus for centralized monitoring.

In the centralized monitoring account, the events are captured by an EventBrige rule and further processed into in different targets:
* CloudWatch Log Group - all events are stored in here has below purpose:
  * Auditing purpose.
  * Analyzing log data with [CloudWatch Log Insights queries](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/AnalyzingLogData.html). CloudWatch Logs Insights enables you to interactively search and analyze your log data in Amazon CloudWatch Logs. You can perform queries to help you more efficiently and effectively respond to operational issues. If an issue occurs, you can use CloudWatch Logs Insights to identify potential causes and validate deployed fixes.
  * Support use of CloudWatch Insights Query Widget for highlevel operation CloudWatch dashboard
* Lambda Function
  * Perform custom logic to augment the SageMaker service events. One example is to perform metric query on SageMaker job hosts's utilization metrics when a job completion event is received. This example is supported by the native CloudWatch Cross-Account Observability feature to achieve cross-account metrics, logs and traces access.
  * Convert event information to metric, certain log format as ingested as [EMF](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Embedded_Metric_Format.html)

## Steps:

* Enable monitoring account configuration in the home region. This is a one-off action. Follow the [Step 1 instruction](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Unified-Cross-Account-Setup.html#Unified-Cross-Account-Setup-ConfigureMonitoringAccount) to complete. Once this step is completed, you should have the following information:
  * monitoring account sink?? ARN: CloudWatch service console > Settings > Manage source accounts > Configuration details > Monitoring accounts sink ARN
  
* Clone this [repo] to local workspace. Copy `.env.sample` file to `.env`, and update monitoring account ID and region to the corresponding values. This solution does support AWS accounts managed by AWS Organizations or standalone accounts. 
If you are using AWS Organizations, you can set the management account ID in `.env` file. The management account ID will be used later when deploying the workload account infrastructure. If all accounts managed by AWS organization, the required resources in the source workload accounts are deployed via CloudFormation StackSet from the AWS organization's management account. Therefore, no manual deploy of a source workload account stack is required. When a new account is created or an existing account moved into a target OU, the source workload infra stack will be automatically deployed to support this solution.
  
* Deploy the CDK monitoring-account-infra-stack. 
  * Duplicate `cdk.context.json.sample` in `monitoring-account-infra` folder and rename to `cdk.context.json`
  * (If AWS Organizations is in use) Obtain the AWS Organizations path where the SageMaker workload accounts are located. Example: "o-1a2b3c4d5e/r-saaa/ou-saaa-1a2b3c4d/*". Update the `org-path-to-allow` attribute in the `cdk.context.json` to the value obtained from previous step
  * (If AWS Organizations is not used) Update the `accounts-to-allow` attribute to include a list of workload accounts ID that you would like to enable monitoring for.
  * Run make target
    ```
    make deploy-monitoring-account-infra
    ```
    Once this step is completed, you should have the following information from output:
    * MonitoringAccountEventbusARN 
    * MonitoringAccountRoleName

* Deploy the workload account observability infrastructure. Here, we provide two ways to deploy the workload account infrastructure. For users with limited number of accounts, you can directly deployment the workload infra stack into the individual account. Alternatively, deploy a CloudFormation StackSet into a management account which then automatically deploys the stack into targeted account. With the second method, it can also be used together with AWS Organization to target the workload infra stack deployment to organization units (OUs). The deployment steps for both scenario are described below.
  * Deploy into a single workload account
    * Change directory into the `workload-account-infra` folder
    * Create cdk.context.json in `workload-account-infra` folder with below structure. Set each attribute's value to be the ones from previous steps
    ```
    {
      "monitoring-account-id": "",
      "monitoring-account-sink-arn": "",
      "monitoring-account-role-name": "",
      "monitoring-account-eventbus-arn": ""
    }
    ```
    * Deploy CDK application stack `WorkloadAccountInfraStack`. Replace the `<workload_account_awscli_profile>` with the actual awscli profile name for the account you are deploying to.
      ```
      cdk deploy WorkloadAccountInfraStack --profile <workload_account_awscli_profile>
      ```
  * Deploy with CloudFormation StackSet and AWS Organization
    * Duplicate cdk.context.json.sample in `WorkloadAccountInfraStack` folder and rename to cdk.context.json. Update the content of cdk.context.json using the values obtained above
    ```
    {
      "monitoring-account-id": "",
      "monitoring-account-sink-arn": "",
      "monitoring-account-role-name": "",
      "monitoring-account-eventbus-arn": "",
      "workload-account-OUs": [""],
      "workload-account-regions": [""]
    }
    ```
  * Run make target
    ```
    make deploy-management-stackset
    ```

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.

