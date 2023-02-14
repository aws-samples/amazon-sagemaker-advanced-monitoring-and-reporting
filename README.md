## SageMaker Centralized Monitoring and Reporting

A solution to enable centralized monitoring of SageMaker jobs and activities across AWS Organization. This aims to assist the operation team to have a highlevel view of all SageMaker workloads spread in multiple workload accounts from a single pane of glass. It also has an option to enable the [Amazon CloudWatch Cross-Account Observability](https://aws.amazon.com/blogs/aws/new-amazon-cloudwatch-cross-account-observability/) across the SageMaker workload accounts to provide access to monitoring telemetries such as metrics, logs and traces from the centralized monitoring account.

## Solution Architecture
![Solution Architecture](Architecture.png?raw=true "Solution Architecture")

There are 2 parts in this solution.
### Centralized Events Collection
Amazon SageMaker has native integration with the Amazon EventBridge service and can generates various service events. The list of SageMaker service events through EventBridge can be found [here](https://docs.aws.amazon.com/sagemaker/latest/dg/automating-sagemaker-with-eventbridge.html). In addition to the service events, CloudTrail service captures API servers for various AWS services, which also streams to EventBridge so that can be utilized by many downstream automation or monitoring use cases. In our solution, we uses EventBridge rules in the workload accounts to stream both SageMaker service events and API events to the monitoring account's EventBus for centralized monitoring.

In the centralized monitoring account, the events are captured by a EventBrige rule and further processed into in different targets:
* CloudWatch Log Group - events are stored in there for auditing purpose. The event logs can also be used to run [CloudWatch Log Insights queries](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/AnalyzingLogData.html) which can help to perform adhoc query as well as showing queries in a CloudWatch Dashboard for operation visibility.
* DynamoDB - With a help of an event parsing Lambda function, the events captured by EventBridge rule can be transformed into more structured data entries and stored in a DynamoDB. This can then further supports more advanced monitoring tool, such as CloudWatch Dashboard custom widget, Amazon managed service for Grafana or even fronted by an API for external tool integration (Please note the integration with other monitoring tool with the DynamoDB is not part of the solution).

### CloudWatch Cross-Account Observability
In the bottom part of the solution diagram uses native CloudWatch Cross-Account Observability to achieve metrics, logs and traces access. In order to enable this, necessary permission and resources needs to be created in the source workload accounts.


In our solution, the required resources in the source workload accounts are deployed via CloudFormation StackSet from the AWS organization's management account. Therefore, no manual deploy of a source workload account stack is required. When a new account is created or an existing account moved into a target OU, the source workload infra stack will be automatically deployed to support this solution.

## Steps:

* Enable monitoring account configuration in the home region. This is a one-off action. Follow the [Step 1 instruction](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Unified-Cross-Account-Setup.html#Unified-Cross-Account-Setup-ConfigureMonitoringAccount) to complete. Once this step is completed, you should have the following information:
  * monitoring account sink ARN: CloudWatch service console > Settings > Manage source accounts > Configuration details > Monitoring accounts sink ARN
* Clone this repo to local workspace. Copy .env.sample file to .env, and update the management account ID, monitoring account ID and region to the corresponding values.
* Deploy the CDK monitoring-account-infra-stack. 
  * Obtain the AWS Organization path where the SageMaker workload accounts are located. Example: "o-1a2b3c4d5e/r-saaa/ou-saaa-1a2b3c4d/*"
  * Duplicate cdk.context.json.sample in monitoring-account-infra folder and rename to cdk.context.json
  * Update the "org-path-to-allow" attribute in the cdk.context.json to the value obtained from previous step
  * Run make target
    ```
    make deploy-monitoring-account-infra
    ```
    Once this step is completed, you should have the following information from output:
    * MonitoringAccountEventbusARN 
    * MonitoringAccountRoleName

* Deploy the source account stackset. This is done using the management-stack CDK code to deploy stackset into the AWS organization's management account.
  * Duplicate cdk.context.json.sample in management-stack folder and rename to cdk.context.json. Update the content of cdk.context.json using the values obtained above
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

