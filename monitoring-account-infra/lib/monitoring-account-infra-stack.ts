import * as cdk from 'aws-cdk-lib';
import {
  aws_events as events,
  aws_events_targets as targets,
  aws_logs as logs,
  aws_cloudwatch as cloudwatch,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_dynamodb as ddb,
  CfnOutput,
  RemovalPolicy,
  Duration,
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
  prefix: string;
  orgPathToAllow?: string;
  accountsToAllow: string[];
} & cdk.StackProps;

export class MonitoringAccountInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringAccountInfraStackConfig) {
    super(scope, id, props);

    const {
      devMode,
      prefix,
      orgPathToAllow,
      accountsToAllow,
    } = props;

    const AWS_EMF_NAMESPACE = Parameters.EMF.NAMESPACE;
    const AWS_EMF_LOG_GROUP_NAME = Parameters.EMF.LOG_GROUP_NAME;
    const AWS_EMF_SERVICE_TYPE = Parameters.EMF.SERVICE_TYPE;
    const AWS_EMF_SERVICE_NAME = Parameters.EMF.SERVICE_NAME;

    const crossAccountSagemakerMonitoringRole = new iam.Role(
      this, 'crossAccountSagemakerMonitoringRole', {
        roleName: Parameters.SAGEMAKER_MONITORING_ACCOUNT_ROLE_NAME,
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
      }
    );
    crossAccountSagemakerMonitoringRole.addToPolicy(
      new iam.PolicyStatement({
        resources: [`arn:aws:iam::*:role/${Parameters.SAGEMAKER_SOURCE_ACCOUNT_ROLE_NAME}`],
        actions: ["sts:AssumeRole"]
      })
    )

    const sagemakerMonitoringEventbus = new events.EventBus(
      this, 'sagemakerMonitoringEventbus',
      {
        eventBusName: `${prefix}${Parameters.MONITORING_EVENTBUS_SUFFIX}`,
      }
    );
    
    if (orgPathToAllow) {
      sagemakerMonitoringEventbus.addToResourcePolicy(
        new iam.PolicyStatement({
          sid: 'AllowOU',
          actions: ['events:PutEvents'],
          principals: [new iam.PrincipalWithConditions(
            new iam.AnyPrincipal(),
            {
              'ForAnyValue:StringLike': {'aws:PrincipalOrgPaths': [orgPathToAllow]}
            }
          )],
          resources: [sagemakerMonitoringEventbus.eventBusArn],
        })
      );
    }
    accountsToAllow.forEach(accountId => {
      sagemakerMonitoringEventbus.addToResourcePolicy(
        new iam.PolicyStatement({
          sid: `AllowAccount${accountId}`,
          actions: ['events:PutEvents'],
          principals: [new iam.AccountPrincipal(accountId)],
          resources: [sagemakerMonitoringEventbus.eventBusArn],
        })
      );
    });

    const sagemakerStageChangeEventRule = new events.Rule(
      this, 'sagemakerStageChangeEventRule',
      {
        eventBus: sagemakerMonitoringEventbus,
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

    const sagemakerAPIEventsLogGroup = new logs.LogGroup(
      this, "sagemakerAPIEventsLogGroup",
      {
        logGroupName: Parameters.SAGEMAKER_API_EVENTS_LOG_GROUP_NAME,
        removalPolicy: devMode? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN
      }
    );

    sagemakerAPIEventRule.addTarget(new targets.CloudWatchLogGroup(sagemakerAPIEventsLogGroup));
    
    // Create DDB and Lambda
    const sagemakerJobHistoryTable = new ddb.Table(
      this,'sagemakerJobHistoryTable', {
        partitionKey: {name: 'pk', type: ddb.AttributeType.STRING},
        sortKey: {name:'sk', type:ddb.AttributeType.STRING},
        billingMode: ddb.BillingMode.PAY_PER_REQUEST
      }
    );

    const ingesterLambda = new PythonFunction(
      this, 'ingesterLambda', {
        entry: path.join(__dirname, 'functions', 'ingester'),
        runtime: lambda.Runtime.PYTHON_3_9,
        index: 'index.py',
        handler: 'lambda_handler',        
        environment: {
          "JOBHISTORY_TABLE": sagemakerJobHistoryTable.tableName,
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
          actions: ["dynamodb:PutItem"],
          resources: [sagemakerJobHistoryTable.tableArn]
        },
      )
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

    // const customWidgetLambda = new PythonFunction(
    //   this, 'customWidgetLambda', {
    //     entry: path.join(__dirname, 'functions', 'custom_widget'),
    //     runtime: lambda.Runtime.PYTHON_3_9,
    //     index: 'index.py',
    //     handler: 'lambda_handler',
    //     timeout: Duration.minutes(1),
    //     environment: {
    //       "JOBHISTORY_TABLE": sagemakerJobHistoryTable.tableName
    //     }
    //   }
    // );
    // customWidgetLambda.addToRolePolicy(
    //   new iam.PolicyStatement(
    //     {
    //       actions: ["dynamodb:query"],
    //       resources: ["*"]
    //     },
    //   )
    // );
    
    // const customWidget = new cloudwatch.CustomWidget({
    //   functionArn: customWidgetLambda.functionArn,
    //   title: 'My lambda baked widget',
    //   width: 12,
    //   height: 12,
    //   params: {
    //     service: 'DynamoDB',
    //     api: "Query",
    //     params: {
    //       TableName: sagemakerJobHistoryTable.tableName,
    //       ExpressionAttributeValues: {
    //         ':v1': {
    //             'S': 'PROCESSING_JOB',
    //         },
    //       },
    //       KeyConditionExpression: 'pk = :v1',
    //     },
    //   },
    // });
    // sagemakerMonitoringDashboard.addWidgets(customWidget);

    // Processing Job
    const processingJobCountWidget = new cloudwatch.GraphWidget({
      title: "Total Processing Job Count",
      stacked: false,
      width: 12,
      height: 6,
      left:[
        new cloudwatch.MathExpression({
          expression: `SELECT SUM(ProcessingJobCount_Total) FROM ${AWS_EMF_NAMESPACE} GROUP BY account ORDER BY COUNT() ASC`,
          searchRegion: this.region,
          label: "Account"
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
          expression: `SELECT SUM(ProcessingJobCount_Failed) FROM ${AWS_EMF_NAMESPACE} GROUP BY account ORDER BY COUNT() ASC`,
          searchRegion: this.region,
          label: "Account"
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
          expression: `SELECT SUM(TrainingJobCount_Total) FROM ${AWS_EMF_NAMESPACE} GROUP BY account ORDER BY COUNT() ASC`,
          searchRegion: this.region,
          label: "Account"
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
          expression: `SELECT SUM(TrainingJobCount_Failed) FROM ${AWS_EMF_NAMESPACE} GROUP BY account ORDER BY COUNT() ASC`,
          searchRegion: this.region,
          label: "Account"
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
      value: sagemakerMonitoringEventbus.eventBusArn,
    })
  }
}
