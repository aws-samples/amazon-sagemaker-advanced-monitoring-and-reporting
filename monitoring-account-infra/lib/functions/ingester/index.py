import json
import boto3
import datetime
import os
from aws_embedded_metrics import metric_scope
from utils.metrics_retriever import search_metrics

from constants import SAGEMAKER_STAGE_CHANGE_EVENT

dynamodb = boto3.resource('dynamodb')
cw = boto3.client('cloudwatch')
#table = dynamodb.Table(os.getenv('JOBHISTORY_TABLE'))

@metric_scope
def lambda_handler(event, context, metrics):

    print("Event Received:")
    print(json.dumps(event))
    
    event_type = None
    try:
        event_type = SAGEMAKER_STAGE_CHANGE_EVENT(event["detail-type"])
        print("%s event received" % event_type)
    except ValueError as e:
        print("Unexpected event received")

    if event_type:
        account = event["account"]
        detail = event["detail"]
        # for resource in event["resources"]:
        #     print(parse_arn(resource))
        
        item = {"pk": event_type.name, "account": account, "metadata": json.dumps(detail)}
        metrics.set_dimensions({"account": account, "jobType": event_type.name}, use_default=False)
        metrics.set_property("JobType", event_type.value)
        
        if event_type == SAGEMAKER_STAGE_CHANGE_EVENT.PROCESSING_JOB:
            item["sk"] = detail.get("ProcessingJobName")
            job_status = detail.get("ProcessingJobStatus")
            item["status"] = job_status
            metrics.set_property("ProcessingJobArn", detail.get("ProcessingJobArn"))

            if detail.get("FailureReason"):
                item["failureReason"] = detail.get("FailureReason")

            if job_status and job_status != "InProgress":
                metrics.put_metric("ProcessingJobCount_Total", 1, "Count")
                metrics.put_metric("ProcessingJobCount_"+job_status, 1, "Count")
                metrics.put_metric("ProcessingJob_Duration", detail.get("ProcessingEndTime") - detail.get("ProcessingStartTime"), "Milliseconds")
                

        elif event_type == SAGEMAKER_STAGE_CHANGE_EVENT.TRAINING_JOB:
            item["sk"] = detail.get("TrainingJobName")
            job_status = detail.get("TrainingJobStatus")
            item["status"] = job_status
            metrics.set_property("TrainingJobArn", detail.get("TrainingJobArn"))

            if detail.get("FailureReason"):
                item["failureReason"] = detail.get("FailureReason")
            
            if job_status and job_status != "InProgress":
                metrics.put_metric("TrainingJobCount_Total", 1, "Count")
                metrics.put_metric("TrainingJobCount_"+job_status, 1, "Count")
                metrics.put_metric("TrainingJob_Duration", detail.get("TrainingEndTime") - detail.get("TrainingStartTime"), "Milliseconds")
                
                search_pattern = "SEARCH('{/aws/sagemaker/TrainingJobs,Host} "+ detail.get("TrainingJobName") +"', 'Maximum')"
                job_metrics = search_metrics(
                    search_pattern,
                    account=account,
                    start_time=datetime.datetime.utcfromtimestamp(float(detail.get("TrainingStartTime"))/1000),
                    end_time=datetime.datetime.utcfromtimestamp(float(detail.get("TrainingEndTime"))/1000)
                )
                for metric_name, metric_value in job_metrics.items():
                    metrics.put_metric("TrainingJob_"+metric_name, metric_value, "Percent")
        else:
            print("Unhandled event type")
        
        # response = table.put_item(
        #     Item=item,
        #     ReturnValues='NONE'
        # )
        
    return None

# def parse_arn(arn):
#     # http://docs.aws.amazon.com/general/latest/gr/aws-arns-and-namespaces.html
#     elements = arn.split(':', 5)
#     result = {
#         'arn': elements[0],
#         'partition': elements[1],
#         'service': elements[2],
#         'region': elements[3],
#         'account': elements[4],
#         'resource': elements[5],
#         'resource_type': None
#     }
#     if '/' in result['resource']:
#         result['resource_type'], result['resource'] = result['resource'].split('/',1)
#     elif ':' in result['resource']:
#         result['resource_type'], result['resource'] = result['resource'].split(':',1)
#     return result

if __name__ == '__main__':
    print("No default defined")
