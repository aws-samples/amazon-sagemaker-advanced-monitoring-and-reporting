import json
import boto3
from datetime import datetime, timedelta
from aws_embedded_metrics import metric_scope
from utils.metrics_retriever import search_metrics
from constants import SAGEMAKER_STAGE_CHANGE_EVENT

cw = boto3.client('cloudwatch')

@metric_scope
def lambda_handler(event, context, metrics):
    
    try:
        event_type = None
        try:
            event_type = SAGEMAKER_STAGE_CHANGE_EVENT(event["detail-type"])
        except ValueError as e:
            print("Unexpected event received")

        if event_type:
            account = event["account"]
            detail = event["detail"]

            job_detail = {
                "DashboardQuery": "True"
            }
            job_detail["Account"] = account
            job_detail["JobType"] = event_type.name

            
            metrics.set_dimensions({"account": account, "jobType": event_type.name}, use_default=False)
            metrics.set_property("JobType", event_type.value)
            
            if event_type == SAGEMAKER_STAGE_CHANGE_EVENT.PROCESSING_JOB:
                job_status = detail.get("ProcessingJobStatus")

                metrics.set_property("JobName", detail.get("ProcessingJobName"))
                metrics.set_property("ProcessingJobArn", detail.get("ProcessingJobArn"))

                job_detail["JobName"]  = detail.get("ProcessingJobName")
                job_detail["ProcessingJobArn"] = detail.get("ProcessingJobArn")
                job_detail["Status"] = job_status
                job_detail["StartTime"] = detail.get("ProcessingStartTime")
                job_detail["InstanceType"] = detail.get("ProcessingResources").get("ClusterConfig").get("InstanceType")
                job_detail["InstanceCount"] = detail.get("ProcessingResources").get("ClusterConfig").get("InstanceCount")
                if detail.get("FailureReason"):
                    job_detail["FailureReason"] = detail.get("FailureReason")

                if job_status and job_status != "InProgress":
                    metrics.put_metric("ProcessingJobCount_Total", 1, "Count")
                    metrics.put_metric("ProcessingJobCount_"+job_status, 1, "Count")
                    metrics.put_metric("ProcessingJob_Duration", detail.get("ProcessingEndTime") - detail.get("ProcessingStartTime"), "Milliseconds")

                    search_pattern = "SEARCH('{/aws/sagemaker/ProcessingJobs,Host} "+ detail.get("ProcessingJobName") +"', 'Maximum')"
                    job_metrics = search_metrics(
                        search_pattern,
                        account=account,
                        start_time=datetime.utcfromtimestamp(float(detail.get("CreationTime"))/1000),
                        end_time=datetime.utcfromtimestamp(float(detail.get("ProcessingEndTime"))/1000)
                    )
                    for host, metrics in job_metrics.items():
                        job_host_detail = job_detail.copy()
                        job_host_detail["Host"] = host
                        job_host_detail["Metrics"] = metrics
                        print(job_host_detail)

            elif event_type == SAGEMAKER_STAGE_CHANGE_EVENT.TRAINING_JOB:
                job_status = detail.get("TrainingJobStatus")

                metrics.set_property("JobName", detail.get("TrainingJobName"))
                metrics.set_property("TrainingJobArn", detail.get("TrainingJobArn"))

                job_detail["JobName"]  = detail.get("TrainingJobName")
                job_detail["TrainingJobArn"] = detail.get("TrainingJobArn")
                job_detail["Status"] = job_status
                job_detail["StartTime"] = detail.get("TrainingStartTime")
                job_detail["InstanceType"] = detail.get("ResourceConfig").get("InstanceType")
                job_detail["InstanceCount"] = detail.get("ResourceConfig").get("InstanceCount")
                if detail.get("FailureReason"):
                    job_detail["FailureReason"] = detail.get("FailureReason")
                
                if job_status and job_status != "InProgress":
                    metrics.put_metric("TrainingJobCount_Total", 1, "Count")
                    metrics.put_metric("TrainingJobCount_"+job_status, 1, "Count")
                    metrics.put_metric("TrainingJob_Duration", detail.get("TrainingEndTime") - detail.get("TrainingStartTime"), "Milliseconds")
                    
                    search_pattern = "SEARCH('{/aws/sagemaker/TrainingJobs,Host} "+ detail.get("TrainingJobName") +"', 'Maximum')"
                    job_metrics = search_metrics(
                        search_pattern,
                        account=account,
                        start_time=datetime.utcfromtimestamp(float(detail.get("CreationTime"))/1000),
                        end_time=datetime.utcfromtimestamp(float(detail.get("TrainingEndTime"))/1000)
                    )
                    for host, metrics in job_metrics.items():
                        job_host_detail = job_detail.copy()
                        job_host_detail["Host"] = host
                        job_host_detail["Metrics"] = metrics
                        print(job_host_detail)
                        
            else:
                print("Unhandled event type")
    except Exception as error:
        print("Event Received:")
        print(json.dumps(event))
        raise error

    return None

if __name__ == '__main__':
    print("No default defined")
