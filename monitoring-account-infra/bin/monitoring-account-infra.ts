#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MonitoringAccountInfraStack } from '../lib/monitoring-account-infra-stack';

const app = new cdk.App();
new MonitoringAccountInfraStack(app, 'MonitoringAccountInfraStack', {
  env: {
    account: process.env.CDK_DEPLOY_ACCOUNT,
    region: process.env.CDK_DEPLOY_REGION,
  },
  devMode: true,
  orgPathToAllow: app.node.tryGetContext('org-path-to-allow'),
  accountsToAllow: app.node.tryGetContext('accounts-to-allow') || [],
});
