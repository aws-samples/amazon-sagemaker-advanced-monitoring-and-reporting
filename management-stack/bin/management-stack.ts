#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ManagementStackStack } from '../lib/management-stack-stack';

const app = new cdk.App();
new ManagementStackStack(app, 'ManagementStackStack', {
  monitoringAccountId: app.node.tryGetContext('monitoring_account_id'),
  monitoringAccountRoleName: app.node.tryGetContext('monitoring_account_role_name'),
  monitoringAccountSinkArn: app.node.tryGetContext('monitoring_account_sink_arn'),
  monitoringAccountEventbusArn: app.node.tryGetContext('monitoring_account_eventbus_arn'),
  stackSetTargetOUs: app.node.tryGetContext('workload_account_OUs'),
  stackSetTargetRegions: app.node.tryGetContext('workload_account_regions'),
});