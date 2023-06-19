import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  aws_cloudformation as cfn,
  aws_s3_assets as assets,
} from 'aws-cdk-lib'
import * as fs from 'fs';
import * as path from 'path';
import {Parameters} from './constants';

type WorkloadAccountInfraProps = {
  monitoringAccountId: string;
  monitoringAccountRoleName: string;
  monitoringAccountSinkArn: string;
  monitoringAccountEventbusArn: string;
} & cdk.StackProps;

export class WorkloadAccountInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: WorkloadAccountInfraProps) {
    super(scope, id, props);

    const {
      monitoringAccountId,
      monitoringAccountRoleName,
      monitoringAccountSinkArn,
      monitoringAccountEventbusArn,
    } = props;

    const crossaccountObservabilityCfnTemplate = new assets.Asset(this, 'CrossaccountObservabilityCfnTemplate', {
      path: path.resolve(__dirname, '..', 'resources', 'templates', 'crossaccountobservability_sources.yaml'),
    });
    new cfn.CfnStack(this, "crossaccountObservabilityWorkloadStack",
      {
        templateUrl: crossaccountObservabilityCfnTemplate.httpUrl,
        parameters: {
          MonitoringAccountId: monitoringAccountId,
          MonitoringAccountSinkArn: monitoringAccountSinkArn,
          Policy: Parameters.CROSSACCOUNT_CLOUDWATCH_SHARING_POLICY,
        },
      }
    );

    const centralizedEventStackCfnTemplate = new assets.Asset(this, 'CentralizedEventStackCfnTemplate', {
      path: path.resolve(__dirname, '..', 'resources', 'templates', 'crossaccountevents_sources.yaml'),
    });
    new cfn.CfnStack(this, "centralizedEventWorkloadStack",
      {
        templateUrl: centralizedEventStackCfnTemplate.httpUrl,
        parameters: {
          MonitoringEventBusArn: monitoringAccountEventbusArn,
          MonitoringAccountId: monitoringAccountId,
          MonitoringAccountRoleName: monitoringAccountRoleName,
        },
      }
    );
  }
}
