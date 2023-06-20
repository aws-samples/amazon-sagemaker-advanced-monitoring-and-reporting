import json
import boto3
import os
from datetime import datetime
from boto3.dynamodb.types import TypeDeserializer, TypeSerializer
from aws_embedded_metrics import metric_scope
from utils.metrics_retriever import search_metrics
from constants import SAGEMAKER_STAGE_CHANGE_EVENT

cw = boto3.client('cloudwatch')
dynamodb = boto3.client('dynamodb')

table_name = os.getenv('JOB_STATE_TABLE')

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
                job_detail["Tags"] = detail.get("Tags")
                if detail.get("FailureReason"):
                    job_detail["FailureReason"] = detail.get("FailureReason")

                if job_status and job_status != "InProgress":
                    isDuplicate, item = check_job_event_duplication(account, event_type.name, job_detail["JobName"], job_detail["Status"])
                    record_job_event(account, event_type.name, job_detail["JobName"], job_detail["Status"], detail)
                    if not isDuplicate:
                        job_detail["Duration"] = detail.get("ProcessingEndTime") - detail.get("ProcessingStartTime")
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
                        if job_metrics:
                            for host, metrics in job_metrics.items():
                                job_host_detail = job_detail.copy()
                                job_host_detail["Host"] = host
                                job_host_detail["Metrics"] = metrics
                                print(job_host_detail)
                        else:
                            print(job_detail)

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
                    isDuplicate, item = check_job_event_duplication(account, event_type.name, job_detail["JobName"], job_detail["Status"])
                    record_job_event(account, event_type.name, job_detail["JobName"], job_detail["Status"], detail)
                    if not isDuplicate:
                        job_detail["Duration"] = detail.get("TrainingEndTime") - detail.get("TrainingStartTime")
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
                        if job_metrics:
                            for host, metrics in job_metrics.items():
                                job_host_detail = job_detail.copy()
                                job_host_detail["Host"] = host
                                job_host_detail["Metrics"] = metrics
                                print(job_host_detail)
                        else:
                            print(job_detail)

            else:
                print("Unhandled event type")
    except Exception as error:
        print("Event Received:")
        print(json.dumps(event))
        raise error

    return None

def record_job_event(account: str, job_type: str, job_name: str, job_status:str, event_metadata:dict):
    try:
        new_job_event = {
            "accountJobtypeJobname": f"{account}#{job_type}#{job_name}",
            "jobStatus": job_status,
            "metadata": json.dumps(event_metadata),
            "jobName": job_name,
            "jobType": job_type,
            "sourceAccount": account,
        }
        _ = dynamodb.put_item(
            TableName=table_name,
            Item={
                k: TypeSerializer().serialize(v)
                for k, v in new_job_event.items()
            }
        )
    except Exception as ex:
        print(f"Failed to add job event to DynamoDB: {ex}")

def check_job_event_duplication(account:str, job_type:str, job_name:str, job_status:str):
    # This function checks if an account-jobtype-jobname with a given jobstatus has received before. 
    # Return True if record already exist, otherwise False
    try:
        response = dynamodb.query(
            TableName = table_name,
            ExpressionAttributeValues={
                ":pk": {
                    "S": f"{account}#{job_type}#{job_name}",
                },
                ":sk": {
                    "S": job_status
                }
            },
            KeyConditionExpression="accountJobtypeJobname = :pk AND jobStatus = :sk",
            ScanIndexForward=False,
            ConsistentRead=True,
            Limit=1,
        )
        if len(response['Items']) > 0:
            job_event = {
                k: TypeDeserializer().deserialize(v)
                for k, v in response["Items"][0].items()
            }
            return True, job_event
        else:
            return False, None
    except Exception:
        return False, None

if __name__ == '__main__':
    print("No default defined")
