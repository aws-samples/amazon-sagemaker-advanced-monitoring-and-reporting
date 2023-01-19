#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MonitoringAccountInfraStack } from '../lib/monitoring-account-infra-stack';

const app = new cdk.App();
new MonitoringAccountInfraStack(app, 'MonitoringAccountInfraStack', {
  devMode: true,
  prefix: `test`,
  orgPathToAllow: `o-3r1q2xdta6/r-svvu/ou-svvu-adkcr4kl/*`,
  sagemakerMonitoringAccountRoleName: 'sagemaker-monitoring-account-role',
  sagemakerSourceAccountRoleName: 'sagemaker-monitoring-sourceaccount-role',
});