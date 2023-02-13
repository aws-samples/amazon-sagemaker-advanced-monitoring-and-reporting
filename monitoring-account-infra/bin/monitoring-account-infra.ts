#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MonitoringAccountInfraStack } from '../lib/monitoring-account-infra-stack';

const app = new cdk.App();
new MonitoringAccountInfraStack(app, 'MonitoringAccountInfraStack', {
  devMode: true,
  prefix: `test`,
  orgPathToAllow: app.node.tryGetContext('org_path_to_allow'),
});