import json
import boto3
import datetime
import os
from aws_embedded_metrics import metric_scope

from utils.metrics_retriever import search_metrics

from constants import SAGEMAKER_STAGE_CHANGE_EVENT

dynamodb = boto3.resource('dynamodb')
cw = boto3.client('cloudwatch')
# table = dynamodb.Table(os.getenv('JOBHISTORY_TABLE'))

@metric_scope
def lambda_handler(event, context, metrics):

    print("Event Received:")
    print(json.dumps(event))
    
    event_type = None
    try:
        event_type = SAGEMAKER_STAGE_CHANGE_EVENT(event["detail-type"])
    except ValueError as e:
        print("Unexpected event received")

    if event_type:
        account = event["account"]
        detail = event["detail"]
        
        # item = {"pk": event_type.name, "account": account, "metadata": json.dumps(detail)}
        metrics.set_dimensions({"account": account, "jobType": event_type.name}, use_default=False)
        metrics.set_property("JobType", event_type.value)
        metrics.set_property("EMF_LOG", True)
        
        if event_type == SAGEMAKER_STAGE_CHANGE_EVENT.PROCESSING_JOB:
            # item["sk"] = detail.get("ProcessingJobName")
            job_status = detail.get("ProcessingJobStatus")
            # item["status"] = job_status
            metrics.set_property("JobName", detail.get("ProcessingJobName"))
            metrics.set_property("ProcessingJobArn", detail.get("ProcessingJobArn"))
            metrics.set_property("Status", job_status)
            metrics.set_property("StartTime", detail.get("ProcessingStartTime"))

            if detail.get("FailureReason"):
                metrics.set_property("FailureReason", detail.get("FailureReason"))
                # item["failureReason"] = detail.get("FailureReason")

            if job_status and job_status != "InProgress":
                metrics.put_metric("ProcessingJobCount_Total", 1, "Count")
                metrics.put_metric("ProcessingJobCount_"+job_status, 1, "Count")
                metrics.put_metric("ProcessingJob_Duration", detail.get("ProcessingEndTime") - detail.get("ProcessingStartTime"), "Milliseconds")
                

        elif event_type == SAGEMAKER_STAGE_CHANGE_EVENT.TRAINING_JOB:
            # item["sk"] = detail.get("TrainingJobName")
            job_status = detail.get("TrainingJobStatus")
            # item["status"] = job_status
            metrics.set_property("JobName", detail.get("TrainingJobName"))
            metrics.set_property("TrainingJobArn", detail.get("TrainingJobArn"))
            metrics.set_property("Status", job_status)
            metrics.set_property("StartTime", detail.get("TrainingStartTime"))

            if detail.get("FailureReason"):
                metrics.set_property("FailureReason", detail.get("FailureReason"))
                # item["failureReason"] = detail.get("FailureReason")
            
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
                # item["utilization"] = job_metrics
                for metric_name, metric_value in job_metrics.items():
                    metrics.put_metric("TrainingJob_"+metric_name, metric_value, "Percent")
        else:
            print("Unhandled event type")
        
        # table.put_item(
        #     Item=item,
        #     ReturnValues='NONE'
        # )
        
    return None

if __name__ == '__main__':
    print("No default defined")
