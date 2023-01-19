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
} from 'aws-cdk-lib'
import { Construct } from 'constructs';
import * as path from 'path';

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

    const sagemakerMonitoringAccountRoleName = 'sagemaker-monitoring-account-role'
    const sagemakerSourceAccountRoleName = 'sagemaker-monitoring-sourceaccount-role'

    const crossAccountSagemakerMonitoringRole = new iam.Role(
      this, 'crossAccountSagemakerMonitoringRole', {
        roleName: sagemakerMonitoringAccountRoleName,
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
      }
    );
    crossAccountSagemakerMonitoringRole.addToPolicy(
      new iam.PolicyStatement({
        resources: [`arn:aws:iam::*:role/${sagemakerSourceAccountRoleName}`],
        actions: ["sts:AssumeRole"]
      })
    )

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
        logGroupName: `monitoring/sagemaker-service-events`,
        removalPolicy: props.devMode? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN
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
        logGroupName: `monitoring/sagemaker-api-events`,
        removalPolicy: props.devMode? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN
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

    const ingesterLambda = new lambda.Function(
      this, 'ingesterLambda', {
        code: lambda.Code.fromAsset(path.join(__dirname, 'functions', 'ingester')),
        runtime: lambda.Runtime.PYTHON_3_9,
        handler: 'main.lambda_handler',
        environment: {
          "JOBHISTORY_TABLE": sagemakerJobHistoryTable.tableName
        }
      }
    );

    sagemakerStageChangeEventRule.addTarget(new targets.LambdaFunction(ingesterLambda));

    // CloudWatch Dashboard
    const sagemakerMonitoringDashboard = new cloudwatch.Dashboard(
      this, 'sagemakerMonitoringDashboard',
      {
        dashboardName: 'SageMaker-Monitoring-Dashboard',
        widgets: []
      }
    )

    // Example query:
    // 'sort @timestamp desc',
    // 'filter detail.ProcessingJobStatus not like /InProgress/',
    // 'fields detail.ProcessingJobName as jobname,  detail.ProcessingJobStatus as status, fromMillis(detail.ProcessingStartTime) as start_time, (detail.ProcessingEndTime-detail.ProcessingStartTime)/1000 as duration_in_seconds, detail.FailureReason as failure_reason'
    sagemakerMonitoringDashboard.addWidgets(
      new cloudwatch.LogQueryWidget(
        {
          title: 'SageMaker Processing Job History',
          logGroupNames: [sagemakerServiceEventsLogGroup.logGroupName],
          view: cloudwatch.LogQueryVisualizationType.TABLE,
          queryLines: [
            'sort @timestamp desc',
            'filter @message like /SageMaker Processing Job State Change/'
          ],
          width:24,
        }
      )
    );

    sagemakerMonitoringDashboard.addWidgets(
      new cloudwatch.LogQueryWidget(
        {
          title: 'SageMaker Training Job History',
          logGroupNames: [sagemakerServiceEventsLogGroup.logGroupName],
          view: cloudwatch.LogQueryVisualizationType.TABLE,
          queryLines: [
            'sort @timestamp desc',
            'filter @message like /SageMaker Training Job State Change/'
          ],
          width:24,
        }
      )
    );

    const customWidgetLambda = new lambda.Function(
      this, 'customWidgetLambda', {
        code: lambda.Code.fromAsset(path.join(__dirname, 'functions', 'custom_widget')),
        runtime: lambda.Runtime.PYTHON_3_9,
        handler: 'main.lambda_handler',
        environment: {
          "JOBHISTORY_TABLE": sagemakerJobHistoryTable.tableName
        }
      }
    );
    customWidgetLambda.addToRolePolicy(
      new iam.PolicyStatement(
        {
          actions: ["ec2:DescribeInstances"],
          resources: ["*"]
        }
      )
    )
    
    sagemakerMonitoringDashboard.addWidgets(new cloudwatch.CustomWidget({
      functionArn: customWidgetLambda.functionArn,
      title: 'My lambda baked widget',
      params: {
        service: 'EC2',
        api: "describeInstances",
        params: {
          Filters: [
            {
              Name: "instance-state-name",
              Values: ["running"],
            },
          ],
        },
      },
    }));
  }
}
