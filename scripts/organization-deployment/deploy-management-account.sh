#!/usr/bin/env bash
set -e

read -p "Home region: " REGION
read -p "Management account AWSCLI profile name. To use the default AWS creds from the chain hit [Enter] : " MANAGEMENT_ACCOUNT_AWSCLI_PROFILE_NAME
read -p "Sagemaker workload OU ID: " WORKLOAD_OU_ID
echo ""
echo "Please enter values from the monitoring stack outputs..."
read -p "Monitoring Account ID: " MONITORING_ACCOUNT
read -p "Monitoring Account Role Name: " MONITORING_ACCOUNT_ROLE_NAME
read -p "Monitoring Account Eventbus ARN: " MONITORING_ACCOUNT_EVENTBUS_ARN
read -p "Monitoring Account Sink Identifier: " MONITORING_ACCOUNT_SINK_ARN

# Shouldn't need to change any of the scripts below

if [[ -z $MANAGEMENT_ACCOUNT_AWSCLI_PROFILE_NAME ]]
then
    PROFILE=""
    echo "Profile not specified. Use default AWS credential."
else
    PROFILE="--profile ${MANAGEMENT_ACCOUNT_AWSCLI_PROFILE_NAME}"
fi
MANAGEMENT_ACCOUNT=$(aws sts get-caller-identity ${PROFILE} | jq -r ".Account")
read -p "Current deploying to Account $MANAGEMENT_ACCOUNT. Is this correct? [y/n]: " confirm

if [[ $confirm == "y" ]] || [[ $confirm == "Y" ]]
then
    echo "Account confirmed. Processding with the deployment.."
else
    echo "Please confirm your AWS credential."
    exit 1
fi


# Shouldn't need to change any of the scripts below
cdk bootstrap aws://$MANAGEMENT_ACCOUNT/$REGION $PROFILE

cat << EOF >./.env
MANAGEMENT_ACCOUNT=$MANAGEMENT_ACCOUNT
MANAGEMENT_PROFILE=$PROFILE
CDK_DEPLOY_REGION=$REGION
EOF

# Deploy StackSet into Management account
cat << EOF >./workload-account-infra/cdk.context.json
{
  "monitoring-account-id": "$MONITORING_ACCOUNT",
  "monitoring-account-sink-arn": "$MONITORING_ACCOUNT_SINK_ARN",
  "monitoring-account-role-name": "$MONITORING_ACCOUNT_ROLE_NAME",
  "monitoring-account-eventbus-arn": "$MONITORING_ACCOUNT_EVENTBUS_ARN",
  "workload-account-OUs": ["$WORKLOAD_OU_ID"],
  "workload-account-regions": ["$REGION"]
}
EOF
make build
make deploy-management-stackset