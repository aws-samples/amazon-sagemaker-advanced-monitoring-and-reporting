#!/usr/bin/env bash
set -e

# Fill in the following details before running this scripts
REGION=''
MANAGEMENT_ACCOUNT_AWSCLI_PROFILE_NAME=''
MONITORING_ACCOUNT_AWSCLI_PROFILE_NAME=''
MONITORING_ACCOUNT_SINK_ARN=''
WORKLOAD_OU_PATH=''
WORKLOAD_OU_ID=''

############################################################
echo "Checking the variables..."
if [ "$REGION" == "" ]
then
    echo " - Please make sure variable REGION have the correct value"
    exit 1
fi
if [ "$MANAGEMENT_ACCOUNT_AWSCLI_PROFILE_NAME" == "" ]
then
    echo " - Please make sure variable MANAGEMENT_ACCOUNT_AWSCLI_PROFILE_NAME have the correct value"
    exit 1
fi
if [ "$MONITORING_ACCOUNT_AWSCLI_PROFILE_NAME" == "" ]
then
    echo " - Please make sure variable MONITORING_ACCOUNT_AWSCLI_PROFILE_NAME have the correct value"
    exit 1
fi
if [ "$MONITORING_ACCOUNT_SINK_ARN" == "" ]
then
    echo " - Please make sure variable MONITORING_ACCOUNT_SINK_ARN have the correct value"
    exit 1
fi
if [ "$WORKLOAD_OU_PATH" == "" ]
then
    echo " - Please make sure variable WORKLOAD_OU_PATH have the correct value"
    exit 1
fi
if [ "$WORKLOAD_OU_ID" == "" ]
then
    echo " - Please make sure variable WORKLOAD_OU_ID have the correct value"
    exit 1
fi

echo "Variables validation completed!"

# Shouldn't need to change any of the scripts below
MANAGEMENT_ACCOUNT=$(aws sts get-caller-identity --profile $MANAGEMENT_ACCOUNT_AWSCLI_PROFILE_NAME | jq -r ".Account")
MONITORING_ACCOUNT=$(aws sts get-caller-identity --profile $MONITORING_ACCOUNT_AWSCLI_PROFILE_NAME | jq -r ".Account")

cdk bootstrap aws://$MANAGEMENT_ACCOUNT/$REGION --profile $MANAGEMENT_ACCOUNT_AWSCLI_PROFILE_NAME
cdk bootstrap aws://$MONITORING_ACCOUNT/$REGION --profile $MONITORING_ACCOUNT_AWSCLI_PROFILE_NAME

cat << EOF >./.env
MANAGEMENT_ACCOUNT=$MANAGEMENT_ACCOUNT
MANAGEMENT_PROFILE=$MANAGEMENT_ACCOUNT_AWSCLI_PROFILE_NAME
MONITORING_ACCOUNT=$MONITORING_ACCOUNT
MONITORING_PROFILE=$MONITORING_ACCOUNT_AWSCLI_PROFILE_NAME
CDK_DEPLOY_REGION=$REGION
EOF

cat << EOF >./monitoring-account-infra/cdk.context.json
{
  "org-path-to-allow": "$WORKLOAD_OU_PATH",
  "monitoring-account-role-name": "sagemaker-monitoring-account-role",
  "monitoring-account-eventbus-name": "sagemaker-monitoring-account-eventbus"
}
EOF
make build
make deploy-monitoring-account-infra

# Deploy StackSet into Management account
cat << EOF >./workload-account-infra/cdk.context.json
{
  "monitoring-account-id": "$MONITORING_ACCOUNT",
  "monitoring-account-sink-arn": "$MONITORING_ACCOUNT_SINK_ARN",
  "monitoring-account-role-name": "sagemaker-monitoring-account-role",
  "monitoring-account-eventbus-arn": "arn:aws:events:$REGION:$MONITORING_ACCOUNT:event-bus/sagemaker-monitoring-account-eventbus",
  "workload-account-OUs": ["$WORKLOAD_OU_ID"],
  "workload-account-regions": ["$REGION"]
}
EOF
make build
make deploy-management-stackset