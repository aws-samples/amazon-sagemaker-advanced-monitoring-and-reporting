import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  aws_cloudformation as cfn,
} from 'aws-cdk-lib'
import * as fs from 'fs';
import * as path from 'path';

export class ManagementStackStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'ManagementStackQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
    const monitoringAccountId = '028884242148';
    const monitoringAccountRoleName = 'sagemaker-monitoring-account-role'
    const monitoringAccountSinkArn = 'arn:aws:oam:ap-southeast-2:028884242148:sink/086b5142-3953-4772-acf5-7a645b05f8a4';
    const monitoringAccountEventbusArn = 'arn:aws:events:ap-southeast-2:028884242148:event-bus/test-sagemaker-monitoring-eventbus';
    const crossaccountCloudWatchSharingPolicy = 'CloudWatch-and-ServiceLens';
    const stackSetTargetOUs = ['ou-svvu-adkcr4kl'];
    const stackSetTargetRegions = ['ap-southeast-2'];


    const crossaccountObservabilitySourceStack = new cfn.CfnStackSet(this, "crossaccountObservabilitySourceStack",
      {
        permissionModel: 'SERVICE_MANAGED',
        stackSetName: 'CloudWatch-Observability-SourceAccountStack',
        description: 'StackSet deployment to source accounts for cross account observability',
        autoDeployment: {
          enabled: true,
          retainStacksOnAccountRemoval: false,
        },
        capabilities: ['CAPABILITY_NAMED_IAM'],
        operationPreferences: {
          failureToleranceCount: 0,
          maxConcurrentCount: 4,
        },
        parameters: [
          {
            parameterKey: 'MonitoringAccountId',
            parameterValue: monitoringAccountId,
          },
          {
            parameterKey: 'MonitoringAccountSinkArn',
            parameterValue: monitoringAccountSinkArn,
          },
          {
            parameterKey: 'Policy',
            parameterValue: crossaccountCloudWatchSharingPolicy,
          },
        ],
        stackInstancesGroup: [{
          deploymentTargets: {
            organizationalUnitIds: stackSetTargetOUs,
          },
          regions: stackSetTargetRegions,
        }],
        templateBody: fs.readFileSync(path.resolve(__dirname, '..', 'resources', 'templates', 'crossaccountobservability_sources.yaml')).toString() 
      }
    );

    const centralizedEventStackSet = new cfn.CfnStackSet(this, "centralizedEventStackSet",
      {
        permissionModel: 'SERVICE_MANAGED',
        stackSetName: 'Centralized-EventsCollection-SourceAccountStack',
        description: 'StackSet deployment to source accounts for centralizing eventbridge events',
        autoDeployment: {
          enabled: true,
          retainStacksOnAccountRemoval: false,
        },
        capabilities: ['CAPABILITY_NAMED_IAM'],
        operationPreferences: {
          failureToleranceCount: 0,
          maxConcurrentCount: 4,
        },
        parameters: [
          {
            parameterKey: 'MonitoringEventBusArn',
            parameterValue: monitoringAccountEventbusArn,
          },
          {
            parameterKey: 'MonitoringAccountId',
            parameterValue: monitoringAccountId,
          },
          {
            parameterKey: 'MonitoringAccountRoleName',
            parameterValue: monitoringAccountRoleName,
          }
        ],
        stackInstancesGroup: [{
          deploymentTargets: {
            organizationalUnitIds: stackSetTargetOUs,
          },
          regions: stackSetTargetRegions,
        }],
        templateBody: fs.readFileSync(path.resolve(__dirname, '..', 'resources', 'templates', 'crossaccountevents_sources.yaml')).toString() 
      }
    );
  }
}
