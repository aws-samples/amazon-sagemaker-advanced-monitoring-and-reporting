import json
import boto3
import os
from constants import SAGEMAKER_STAGE_CHANGE_EVENT

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.getenv('JOBHISTORY_TABLE'))

def lambda_handler(event, context):

    print("Event Received:")
    print(json.dumps(event))
    
    event_type = None
    try:
        event_type = SAGEMAKER_STAGE_CHANGE_EVENT(event["detail-type"])
        print("%s event received" % event_type)
    except ValueError as e:
        print("Unexpected event received")

    if(event_type):
        account = event["account"]
        detail = event["detail"]
        for resource in event["resources"]:
            print(parse_arn(resource))
        
        item = {"pk": event_type.name, "account": account, "metadata": json.dumps(detail)}
        if event_type == SAGEMAKER_STAGE_CHANGE_EVENT.PROCESSING_JOB:
            item["sk"] = detail.get("ProcessingJobName")
            item["status"] = detail.get("ProcessingJobStatus")
            if(detail.get("FailureReason")):
                item["failureReason"] = detail.get("FailureReason")
        elif event_type == SAGEMAKER_STAGE_CHANGE_EVENT.TRAINING_JOB:
            item["sk"] = detail.get("TrainingJobName")
            item["status"] = detail.get("TrainingJobStatus")
        else:
            print("Unhandled event type")
        
        response = table.put_item(
            Item=item,
            ReturnValues='NONE'
        )
        
    return response

def parse_arn(arn):
    # http://docs.aws.amazon.com/general/latest/gr/aws-arns-and-namespaces.html
    elements = arn.split(':', 5)
    result = {
        'arn': elements[0],
        'partition': elements[1],
        'service': elements[2],
        'region': elements[3],
        'account': elements[4],
        'resource': elements[5],
        'resource_type': None
    }
    if '/' in result['resource']:
        result['resource_type'], result['resource'] = result['resource'].split('/',1)
    elif ':' in result['resource']:
        result['resource_type'], result['resource'] = result['resource'].split(':',1)
    return result