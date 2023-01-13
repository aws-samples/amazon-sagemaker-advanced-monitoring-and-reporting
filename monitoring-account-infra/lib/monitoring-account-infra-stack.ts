import * as cdk from 'aws-cdk-lib';
import {
  aws_events as events,
  aws_events_targets as targets,
  aws_logs as logs,
  aws_cloudwatch as cloudwatch,
  aws_iam as iam,
  CfnOutput,
  RemovalPolicy,
} from 'aws-cdk-lib'
import { StringListParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface MonitoringAccountInfraStackConfig extends cdk.StackProps {
  /**
   * devMode - determines whether in devMode so that some resources and setting (such as kms) are skipped
   **/
   readonly devMode: boolean;
  /**
   * prefix - global solution prefix used for stack names, logical resource names
   * and physical names (where cross-account access scenarios apply)
   **/
  readonly prefix: string;

  readonly orgPathToAllow: string;
  
}

export class MonitoringAccountInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringAccountInfraStackConfig) {
    super(scope, id, props);

    const sagemakerMonitoringEventbus = new events.EventBus(
      this, 'sagemakerMonitoringEventbus',
      {
        eventBusName: `${props.prefix}-sagemaker-monitoring-eventbus`,
      }
    );

    new CfnOutput(this, 'monitoringEventbusArn', {
      value: sagemakerMonitoringEventbus.eventBusArn
    });
    
    sagemakerMonitoringEventbus.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowOU',
        actions: ['events:PutEvents'],
        principals: [new iam.PrincipalWithConditions(
          new iam.AnyPrincipal(),
          {
            'ForAnyValue:StringLike': {'aws:PrincipalOrgPaths': [props.orgPathToAllow]}
          }
        )],
        resources: [sagemakerMonitoringEventbus.eventBusArn],
      })
    );

    const sageMakerProcessingJobEventRule = new events.Rule(
      this, 'sageMakerProcessingJobEventRule',
      {
        eventBus: sagemakerMonitoringEventbus,
        description: `SageMaker Processing Job State Change event streamed to a log group`,
        eventPattern: {
          source: ["aws.sagemaker"],
          detailType: ["SageMaker Processing Job State Change"],
        },
      }
    );

    const sageMakerProcessingJobLogGroup = new logs.LogGroup(
      this, "sageMakerProcessingJobLogGroup",
      {
        logGroupName: `monitoring/sagemaker-processingjob-events`,
        removalPolicy: props.devMode? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN
      }
    );

    sageMakerProcessingJobEventRule.addTarget(new targets.CloudWatchLogGroup(sageMakerProcessingJobLogGroup));

    const sageMakerAPIEventRule = new events.Rule(
      this, 'sageMakerAPIEventRule',
      {
        eventBus: sagemakerMonitoringEventbus,
        description: `SageMaker API events streamed to a log group`,
        eventPattern: {
          source: ["aws.sagemaker"],
          detailType: ["AWS API Call via CloudTrail"],
          detail: {
            eventSource: ['sagemaker.amazonaws.com'],
          }
        },
      }
    );

    const sageMakerAPIEventsLogGroup = new logs.LogGroup(
      this, "sageMakerAPIEventsLogGroup",
      {
        logGroupName: `monitoring/sagemaker-api-events`,
        removalPolicy: props.devMode? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN
      }
    );

    sageMakerAPIEventRule.addTarget(new targets.CloudWatchLogGroup(sageMakerAPIEventsLogGroup));
    // const sagemakerMonitoringDashboard = new cloudwatch.Dashboard(
    //   this, 'sagemakerMonitoringDashboard',
    //   {
    //     dashboardName: 'SageMaker-Monitoring-Dashboard',
    //     widgets: []
    //   }
    // )
    // sagemakerMonitoringDashboard.addWidgets(
    //   new cloudwatch.LogQueryWidget(
    //     {
    //       title: 'SageMaker Processing Job History',
    //       logGroupNames: [sageMakerProcessingJobLogGroup.logGroupName],
    //       view: cloudwatch.LogQueryVisualizationType.TABLE,
    //       queryLines: [
    //         'sort @timestamp desc',
    //         'filter detail.ProcessingJobStatus not like /InProgress/',
    //         'fields detail.ProcessingJobName as jobname,  detail.ProcessingJobStatus as status, fromMillis(detail.ProcessingStartTime) as start_time, (detail.ProcessingEndTime-detail.ProcessingStartTime)/1000 as duration_in_seconds, detail.FailureReason as failure_reason'
    //       ]
    //     }
    //   )
    // );

    // sagemakerMonitoringDashboard.addWidgets(
    //   new cloudwatch.LogQueryWidget(
    //     {
    //       title: 'SageMaker Training Job History',
    //       logGroupNames: [sageMakerProcessingJobLogGroup.logGroupName],
    //       view: cloudwatch.LogQueryVisualizationType.TABLE,
    //       queryLines: [
    //         'sort @timestamp desc',
    //         'filter detail.TrainingJobStatus not like /InProgress/',
    //         'fields detail.TrainingJobName as jobname,  detail.TrainingJobStatus as status, detail.SecondaryStatus as secondary_status, fromMillis(detail.TrainingStartTime) as start_time, (detail.TrainingEndTime-detail.TrainingStartTime)/1000 as duration_in_seconds'
    //       ]
    //     }
    //   )
    // );
  }
}
