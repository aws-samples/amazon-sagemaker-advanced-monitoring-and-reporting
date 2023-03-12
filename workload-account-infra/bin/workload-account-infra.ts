#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { OrganizationStackset } from '../lib/organization-stackset';
import { WorkloadAccountInfraStack } from '../lib/workload-account-infra-stack';

const app = new cdk.App();
const monitoringAccountParameters = {
  monitoringAccountId: app.node.tryGetContext('monitoring-account-id'),
  monitoringAccountRoleName: app.node.tryGetContext('monitoring-account-role-name'),
  monitoringAccountSinkArn: app.node.tryGetContext('monitoring-account-sink-arn'),
  monitoringAccountEventbusArn: app.node.tryGetContext('monitoring-account-eventbus-arn'),
}

new OrganizationStackset(app, 'ManagementStackStack', {
  ...monitoringAccountParameters,
  env: {
    account: process.env.CDK_DEPLOY_ACCOUNT,
    region: process.env.CDK_DEPLOY_REGION,
  },
  stackSetTargetOUs: app.node.tryGetContext('workload-account-OUs'),
  stackSetTargetRegions: app.node.tryGetContext('workload-account-regions'),
});

new WorkloadAccountInfraStack(app, 'WorkloadAccountInfraStack', {
  ...monitoringAccountParameters,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT || process.env.CDK_DEPLOY_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || process.env.CDK_DEPLOY_REGION,
  },
})