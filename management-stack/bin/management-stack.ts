#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ManagementStackStack } from '../lib/management-stack-stack';

const app = new cdk.App();
new ManagementStackStack(app, 'ManagementStackStack', {
  env: {
    account: process.env.CDK_DEPLOY_ACCOUNT,
    region: process.env.CDK_DEPLOY_REGION,
  },
  monitoringAccountId: app.node.tryGetContext('monitoring-account-id'),
  monitoringAccountRoleName: app.node.tryGetContext('monitoring-account-role-name'),
  monitoringAccountSinkArn: app.node.tryGetContext('monitoring-account-sink-arn'),
  monitoringAccountEventbusArn: app.node.tryGetContext('monitoring-account-eventbus-arn'),
  stackSetTargetOUs: app.node.tryGetContext('workload-account-OUs'),
  stackSetTargetRegions: app.node.tryGetContext('workload-account-regions'),
});