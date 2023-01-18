import json
import boto3
from constants import SAGEMAKER_STAGE_CHANGE_EVENT

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
        print(event_type.name)
        account = event["account"]
        for resource in event["resources"]:
            print(parse_arn(resource))
        
    return {
        "statusCode": 200,
        "body": json.dumps({
            "message": "event received"
        })
    }

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