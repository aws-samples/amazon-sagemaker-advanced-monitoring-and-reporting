import * as cdk from 'aws-cdk-lib';
import {
  aws_events as events,
  aws_events_targets as targets,
  aws_logs as logs,
  aws_cloudwatch as cloudwatch,
  aws_iam as iam,
  aws_lambda as lambda,
  CfnOutput,
  RemovalPolicy,
} from 'aws-cdk-lib';
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';
import { Construct } from 'constructs';
import * as path from 'path';
import { Parameters } from './constants';

type MonitoringAccountInfraStackConfig = {
  /**
   * devMode - determines whether in devMode so that some resources and setting (such as kms) are skipped
   **/
   devMode: boolean;
  /**
   * prefix - global solution prefix used for stack names, logical resource names
   * and physical names (where cross-account access scenarios apply)
   **/
  orgPathToAllow?: string;
  accountsToAllow: string[];
  monitoringAccountRoleName?: string;
  monitoringAccountEventbusName?: string;
} & cdk.StackProps;

export class MonitoringAccountInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringAccountInfraStackConfig) {
    super(scope, id, props);

    const {
      devMode,
      orgPathToAllow,
      accountsToAllow,
      monitoringAccountRoleName,
      monitoringAccountEventbusName,
    } = props;

    const AWS_EMF_NAMESPACE = Parameters.EMF.NAMESPACE;
    const AWS_EMF_LOG_GROUP_NAME = Parameters.EMF.LOG_GROUP_NAME;
    const AWS_EMF_SERVICE_TYPE = Parameters.EMF.SERVICE_TYPE;
    const AWS_EMF_SERVICE_NAME = Parameters.EMF.SERVICE_NAME;

    const crossAccountSagemakerMonitoringRole = new iam.Role(
      this, 'crossAccountSagemakerMonitoringRole', {
        roleName: monitoringAccountRoleName? monitoringAccountRoleName : Parameters.SAGEMAKER_MONITORING_ACCOUNT_ROLE_NAME,
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
      }
    );
    crossAccountSagemakerMonitoringRole.addToPolicy(
      new iam.PolicyStatement({
        resources: [`arn:aws:iam::*:role/${Parameters.SAGEMAKER_SOURCE_ACCOUNT_ROLE_NAME}`],
        actions: ["sts:AssumeRole"]
      })
    )

    const sagemakerMonitoringAccountEventbus = new events.EventBus(
      this, 'sagemakerMonitoringAccountEventbus',
      {
        eventBusName: `${monitoringAccountEventbusName? monitoringAccountEventbusName : Parameters.MONITORING_EVENTBUS_NAME}`,
      }
    );
    
    if (orgPathToAllow) {
      sagemakerMonitoringAccountEventbus.addToResourcePolicy(
        new iam.PolicyStatement({
          sid: `AllowOU-${Date.now()}`,
          actions: ['events:PutEvents'],
          principals: [new iam.PrincipalWithConditions(
            new iam.AnyPrincipal(),
            {
              'ForAnyValue:StringLike': {'aws:PrincipalOrgPaths': [orgPathToAllow]}
            }
          )],
          resources: [sagemakerMonitoringAccountEventbus.eventBusArn],
        })
      );
    }
    accountsToAllow.forEach(accountId => {
      sagemakerMonitoringAccountEventbus.addToResourcePolicy(
        new iam.PolicyStatement({
          sid: `AllowAccount${accountId}`,
          actions: ['events:PutEvents'],
          principals: [new iam.AccountPrincipal(accountId)],
          resources: [sagemakerMonitoringAccountEventbus.eventBusArn],
        })
      );
    });

    const sagemakerStageChangeEventRule = new events.Rule(
      this, 'sagemakerStageChangeEventRule',
      {
        eventBus: sagemakerMonitoringAccountEventbus,
        description: `Capture SageMaker State and Status Change events`,
        eventPattern: {
          source: ["aws.sagemaker"],
          detailType: events.Match.anyOf(
            events.Match.suffix("State Change"),
            events.Match.suffix("Status Change"),
          ),
        },
      }
    );

    const sagemakerServiceEventsLogGroup = new logs.LogGroup(
      this, "sagemakerEventsLogGroup",
      {
        logGroupName: Parameters.SAGEMAKER_EVENTS_LOG_GROUP_NAME,
        removalPolicy: devMode? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN
      }
    );

    sagemakerStageChangeEventRule.addTarget(new targets.CloudWatchLogGroup(sagemakerServiceEventsLogGroup));

    const sagemakerAPIEventRule = new events.Rule(
      this, 'sagemakerAPIEventRule',
      {
        eventBus: sagemakerMonitoringAccountEventbus,
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

    const sagemakerAPIEventsLogGroup = new logs.LogGroup(
      this, "sagemakerAPIEventsLogGroup",
      {
        logGroupName: Parameters.SAGEMAKER_API_EVENTS_LOG_GROUP_NAME,
        removalPolicy: devMode? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN
      }
    );

    sagemakerAPIEventRule.addTarget(new targets.CloudWatchLogGroup(sagemakerAPIEventsLogGroup));

    const ingesterLambda = new PythonFunction(
      this, 'ingesterLambda', {
        functionName: 'SageMaker-Event-Ingester',
        entry: path.join(__dirname, 'functions', 'ingester'),
        runtime: lambda.Runtime.PYTHON_3_9,
        index: 'index.py',
        handler: 'lambda_handler',        
        environment: {
          "AWS_EMF_NAMESPACE": AWS_EMF_NAMESPACE,
          "AWS_EMF_LOG_GROUP_NAME": AWS_EMF_LOG_GROUP_NAME,
          "AWS_EMF_SERVICE_TYPE": AWS_EMF_SERVICE_TYPE,
          "AWS_EMF_SERVICE_NAME": AWS_EMF_SERVICE_NAME,
        },
      }
    );
    ingesterLambda.addToRolePolicy(
      new iam.PolicyStatement(
        {
          actions: ["cloudwatch:GetMetricData"],
          resources: ['*']
        }
      )
    );

    sagemakerStageChangeEventRule.addTarget(new targets.LambdaFunction(ingesterLambda));

    // CloudWatch Dashboard
    const sagemakerMonitoringDashboard = new cloudwatch.Dashboard(
      this, 'sagemakerMonitoringDashboard',
      {
        dashboardName: Parameters.DASHBOARD_NAME,
        widgets: []
      }
    )

    // Processing Job
    const processingJobCountWidget = new cloudwatch.GraphWidget({
      title: "Total Processing Job Count",
      stacked: false,
      width: 12,
      height: 6,
      left:[
        new cloudwatch.MathExpression({
          expression: `SEARCH('{${AWS_EMF_NAMESPACE},account,jobType} jobType="PROCESSING_JOB" MetricName="ProcessingJobCount_Total"', 'Sum', 300)`,
          searchRegion: this.region,
          label: "${PROP('Dim.account')}",
        })
      ]
    });
    processingJobCountWidget.position(0,0)
    const processingJobFailedWidget = new cloudwatch.GraphWidget({
      title: "Failed Processing Job Count",
      stacked: false,
      width: 12,
      height:6,
      right:[
        new cloudwatch.MathExpression({
          expression: `SEARCH('{${AWS_EMF_NAMESPACE},account,jobType} jobType="PROCESSING_JOB" MetricName="ProcessingJobCount_Failed"', 'Sum', 300)`,
          searchRegion: this.region,
          label: "${PROP('Dim.account')}",
        })
      ]
    })
    processingJobFailedWidget.position(12,0)
    
    const processingJobInsightsQueryWidget = new cloudwatch.LogQueryWidget(
      {
        title: 'SageMaker Processing Job History',
        logGroupNames: [ingesterLambda.logGroup.logGroupName],
        view: cloudwatch.LogQueryVisualizationType.TABLE,
        queryLines: [
          'sort @timestamp desc',
          'filter DashboardQuery == "True"',
          'filter JobType == "PROCESSING_JOB"',
          'fields Account, JobName, Status, Duration, InstanceCount, InstanceType, Host, fromMillis(StartTime) as StartTime, FailureReason',
          'fields Metrics.CPUUtilization as CPUUtil, Metrics.DiskUtilization as DiskUtil, Metrics.MemoryUtilization as MemoryUtil',
          'fields Metrics.GPUMemoryUtilization as GPUMemoeyUtil, Metrics.GPUUtilization as GPUUtil',
        ],
        width:24,
        height: 6,
      }
    );
    processingJobInsightsQueryWidget.position(0, 6)
    sagemakerMonitoringDashboard.addWidgets(processingJobCountWidget);
    sagemakerMonitoringDashboard.addWidgets(processingJobFailedWidget);
    sagemakerMonitoringDashboard.addWidgets(processingJobInsightsQueryWidget);

    // Training Job
    const trainingJobCountWidget = new cloudwatch.GraphWidget({
      title: "Total Training Job Count",
      stacked: false,
      width: 12,
      left:[
        new cloudwatch.MathExpression({
          expression: `SEARCH('{${AWS_EMF_NAMESPACE},account,jobType} jobType="TRAINING_JOB" MetricName="TrainingJobCount_Total"', 'Sum', 300)`,
          searchRegion: this.region,
          label: "${PROP('Dim.account')}",
        })
      ]
    });
    trainingJobCountWidget.position(0,12);

    const trainingJobFailedWidget = new cloudwatch.GraphWidget({
      title: "Failed Training Job Count",
      stacked: false,
      width: 12,
      height:6,
      right:[
        new cloudwatch.MathExpression({
          expression: `SEARCH('{${AWS_EMF_NAMESPACE},account,jobType} jobType="TRAINING_JOB" MetricName="TrainingJobCount_Failed"', 'Sum', 300)`,
          searchRegion: this.region,
          label: "${PROP('Dim.account')}",
        })
      ]
    });
    trainingJobFailedWidget.position(12, 12)

    const trainingJobInsightsQueryWIdget = new cloudwatch.LogQueryWidget(
      {
        title: 'SageMaker Training Job History',
        logGroupNames: [ingesterLambda.logGroup.logGroupName],
        view: cloudwatch.LogQueryVisualizationType.TABLE,
        queryLines: [
          'sort @timestamp desc',
          'filter DashboardQuery == "True"',
          'filter JobType == "TRAINING_JOB"',
          'fields Account, JobName, Status, Duration, InstanceCount, InstanceType, Host, fromMillis(StartTime) as StartTime, FailureReason',
          'fields Metrics.CPUUtilization as CPUUtil, Metrics.DiskUtilization as DiskUtil, Metrics.MemoryUtilization as MemoryUtil',
          'fields Metrics.GPUMemoryUtilization as GPUMemoeyUtil, Metrics.GPUUtilization as GPUUtil',
        ],
        width:24,
      }
    );
    trainingJobInsightsQueryWIdget.position(0, 18)

    sagemakerMonitoringDashboard.addWidgets(trainingJobCountWidget);
    sagemakerMonitoringDashboard.addWidgets(trainingJobFailedWidget);
    sagemakerMonitoringDashboard.addWidgets(trainingJobInsightsQueryWIdget);

    new CfnOutput(this, 'MonitoringAccountRoleName', {
      exportName: 'monitoring-account-role-name',
      value: crossAccountSagemakerMonitoringRole.roleName,
    });
    new CfnOutput(this, 'MonitoringAccountEventbusARN', {
      exportName: 'monitoring-account-eventbus-arn',
      value: sagemakerMonitoringAccountEventbus.eventBusArn,
    })
  }
}
