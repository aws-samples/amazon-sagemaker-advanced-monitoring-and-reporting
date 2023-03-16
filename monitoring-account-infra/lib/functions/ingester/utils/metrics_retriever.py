import boto3
from datetime import datetime, timedelta
cw = boto3.client('cloudwatch')

def search_metrics(search_expression, account=None, start_time=datetime.now()-timedelta(minutes=5), end_time=datetime.now()):
  period = int(end_time.strftime('%s'))-int(start_time.strftime('%s'))
  period = (period+60) - period % 60 # Period should be multiple of 60
  query = {
      'Id': 'searchjob',
      'Expression': search_expression,
      'ReturnData': True,
      'Period': period,
  }
  if account:
    query['AccountId'] = account
  
  response = cw.get_metric_data(
    MetricDataQueries=[query],
    StartTime=start_time,
    EndTime=end_time
  )
  print(start_time)
  print(end_time)
  print(response)
  result = {}
  for metric in response['MetricDataResults']:
    result[metric['Label']] = float(metric['Values'][0])

  return result