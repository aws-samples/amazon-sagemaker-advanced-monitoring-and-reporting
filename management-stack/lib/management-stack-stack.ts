import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  aws_cloudformation as cfn,
} from 'aws-cdk-lib'
import * as fs from 'fs';
import * as path from 'path';
import {Parameters} from './constants';

type ManagementInfraProps = {
  monitoringAccountId: string;
  monitoringAccountRoleName: string;
  monitoringAccountSinkArn: string;
  monitoringAccountEventbusArn: string;
  stackSetTargetOUs: string[];
  stackSetTargetRegions: string[];
} & cdk.StackProps;

export class ManagementStackStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ManagementInfraProps) {
    super(scope, id, props);

    const {
      monitoringAccountId,
      monitoringAccountRoleName,
      monitoringAccountSinkArn,
      monitoringAccountEventbusArn,
      stackSetTargetOUs,
      stackSetTargetRegions,
    } = props;

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
            parameterValue: Parameters.CROSSACCOUNT_CLOUDWATCH_SHARING_POLICY,
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
