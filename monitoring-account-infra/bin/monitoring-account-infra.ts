#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MonitoringAccountInfraStack, MonitoringAccountInfraStackConfig } from '../lib/monitoring-account-infra-stack';

let config:MonitoringAccountInfraStackConfig = {
  devMode: true,
  prefix: `test`,
  orgPathToAllow: `o-3r1q2xdta6/r-svvu/ou-svvu-adkcr4kl/*`,
};

const app = new cdk.App();
new MonitoringAccountInfraStack(app, 'MonitoringAccountInfraStack', config);