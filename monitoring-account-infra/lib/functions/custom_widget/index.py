# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

# CloudWatch Custom Widget sample: call any read-only AWS API and return raw results in JSON
import json
import os
import base64
from plot import plot_chart

DOCS = """
## Make an AWS Call
Calls any (read-only) AWS API and displays the result as JSON.

### Widget parameters
Param | Description
---|---
**service** | The name of the AWS service to call, e.g. **EC2** or **CloudWatch**
**api** | The API name to call
**params** | The parameters to pass to the API

### Example parameters
``` yaml
service: EC2
api: describeInstances
params:
  Filters:
  - Name: instance-state-name
    Values:
    - running
```"""

def lambda_handler(event, context):
    if 'describe' in event:
        return DOCS 

    plot_chart()
    image_data = open("/tmp/test.png", "rb").read()
    base64_image = base64.b64encode(image_data).decode('UTF-8')
    return f"""<img src="data:image/png;base64,{base64_image}">"""
    