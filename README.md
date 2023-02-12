## SageMaker Centralized Monitoring and Reporting

A solution to enable centralized monitoring of SageMaker jobs and activities across AWS Organization. This aims to assist the operation team to have a highlevel view of all SageMaker workloads spread in multiple workload accounts from a single pane of glass. It also has an option to enable the ![Amazon CloudWatch Cross-Account Observability](https://aws.amazon.com/blogs/aws/new-amazon-cloudwatch-cross-account-observability/) across the SageMaker workload accounts to provide access to monitoring telemetries such as metrics, logs and traces from the centralized monitoring account.

## Solution Architecture
![Solution Architecture](Architecture.png?raw=true "Solution Architecture")

Highlevel Steps:

* Enable monitoring account configuration in the home region
* Deploy observability source account stackset via Control Tower management account to target OUs/Accounts

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.

