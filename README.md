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

### CloudWatch Cross Account Observability
With Amazon CloudWatch cross-account observability, you can monitor and troubleshoot applications that span multiple accounts within a Region. Seamlessly search, visualize, and analyze your metrics, logs, and traces in any of the linked accounts without account boundaries. For more detail of CloudWatch Cross Account Observability, please refer to [documentation](https://aws.amazon.com/blogs/aws/new-amazon-cloudwatch-cross-account-observability/)

---
## Deployment Procedure:
This solution can be used for either AWS accounts managed by AWS Organizations or standalone accounts. The following sections will explain the steps for the 2 scenarios respectively. Please note that within each scenario, steps will be performed in different AWS accounts. For your convenience, the account type to perform the step is highlighted at the beginning each step. 

- [Deployment Instruction for AWS Organizarion Environment](./docs/deploy%20to%20organization.md)
- [Deployment Instruction for Non-Organization Environment](./docs/deploy%20to%20non-organization.md)



## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.

