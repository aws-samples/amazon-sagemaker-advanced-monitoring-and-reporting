import boto3
from datetime import datetime, timedelta
cw = boto3.client('cloudwatch')


def search_metrics(search_expression, account=None, start_time=datetime.now()-timedelta(minutes=5), end_time=datetime.now()):
    period = int(end_time.strftime('%s'))-int(start_time.strftime('%s'))
    period = (period+60) - period % 60  # Period should be multiple of 60
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
    result = {}
    for metric in response['MetricDataResults']:
        label = parse_label(metric['Label'])
        host = label.get("host")
        if host:
            if host not in result:
                result[host] = {}
            result[host][label.get("metric")] = float(metric['Values'][0])
        else:
            if "host" not in result:
                result["host"] = {}
            result["host"][label.get("metric")] = float(metric['Values'][0])
    return result

def parse_label(label):
    labels = label.split(" ")
    if len(labels) == 1:
        return {
            "job": None,
            "host": None,
            "metric": label
        }
    job = labels[0].split("/")
    job.append(labels[1])
    return {
        "job": job[0],
        "host": job[1],
        "metric": job[2]
    }
