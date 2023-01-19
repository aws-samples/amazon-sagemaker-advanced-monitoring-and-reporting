#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ManagementStackStack } from '../lib/management-stack-stack';

const app = new cdk.App();
new ManagementStackStack(app, 'ManagementStackStack', {
  monitoringAccountId: '028884242148',
  monitoringAccountRoleName: 'sagemaker-monitoring-account-role',
  monitoringAccountSinkArn: 'arn:aws:oam:ap-southeast-2:028884242148:sink/086b5142-3953-4772-acf5-7a645b05f8a4',
  monitoringAccountEventbusArn: 'arn:aws:events:ap-southeast-2:028884242148:event-bus/test-sagemaker-monitoring-eventbus',
  crossaccountCloudWatchSharingPolicy: 'CloudWatch-and-ServiceLens',
  stackSetTargetOUs: ['ou-svvu-adkcr4kl'],
  stackSetTargetRegions: ['ap-southeast-2'],
});