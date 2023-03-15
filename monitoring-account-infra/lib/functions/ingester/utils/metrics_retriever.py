import boto3
import datetime
cw = boto3.client('cloudwatch')

def search_metrics(search_expression, account=None):
  query = {
      'Id': 'searchjob',
      'Expression': search_expression,
      'Label': 'job',
      'ReturnData': True,
      'Period': 300,
  }
  if account:
    query['AccountId'] = account
  
  response = cw.get_metric_data(
    MetricDataQueries=[query],
    StartTime=datetime.datetime(2023, 3, 12),
    EndTime=datetime.datetime.now()
  )
  return response