#!/usr/bin/env bash
set -e

# Check if the context input has been entered before
WORKLOAD_CDK_CONTEXT_FILE=./workload-account-infra/cdk.context.json
if [ -f "$WORKLOAD_CDK_CONTEXT_FILE" ]; then
    REGION_DEFAULT=$(cat $WORKLOAD_CDK_CONTEXT_FILE | jq -r '."home-region"')
    MONITORING_ACCOUNT_ID_DEFAULT=$(cat $WORKLOAD_CDK_CONTEXT_FILE | jq -r '."monitoring-account-id"')
    MONITORING_ACCOUNT_ROLE_NAME_DEFAULT=$(cat $WORKLOAD_CDK_CONTEXT_FILE | jq -r '."monitoring-account-role-name"')
    MONITORING_ACCOUNT_EVENTBUS_ARN_DEFAULT=$(cat $WORKLOAD_CDK_CONTEXT_FILE | jq -r '."monitoring-account-eventbus-arn"')
    MONITORING_ACCOUNT_SINK_ARN_DEFAULT=$(cat $WORKLOAD_CDK_CONTEXT_FILE | jq -r '."monitoring-account-sink-arn"')
    WORKLOAD_OU_ID_DEFAULT=$(cat $WORKLOAD_CDK_CONTEXT_FILE | jq -r '."workload-account-OUs"[0]')
    CLI_PROFILE_NAME_DEFAULT=$(cat $WORKLOAD_CDK_CONTEXT_FILE | jq -r '."awscli-profile"')
fi

read -p "Home region [$REGION_DEFAULT]: " REGION
REGION=${REGION:-$REGION_DEFAULT}

read -p "Sagemaker workload OU ID [$WORKLOAD_OU_ID_DEFAULT]: " WORKLOAD_OU_ID
WORKLOAD_OU_ID=${WORKLOAD_OU_ID:-$WORKLOAD_OU_ID_DEFAULT}

echo ""
echo "Please enter values from the monitoring stack outputs..."

read -p "Monitoring Account ID [$MONITORING_ACCOUNT_ID_DEFAULT]: " MONITORING_ACCOUNT_ID
MONITORING_ACCOUNT_ID=${MONITORING_ACCOUNT_ID:-$MONITORING_ACCOUNT_ID_DEFAULT}

read -p "Monitoring Account Role Name [$MONITORING_ACCOUNT_ROLE_NAME_DEFAULT]: " MONITORING_ACCOUNT_ROLE_NAME
MONITORING_ACCOUNT_ROLE_NAME=${MONITORING_ACCOUNT_ROLE_NAME:-$MONITORING_ACCOUNT_ROLE_NAME_DEFAULT}

read -p "Monitoring Account Eventbus ARN [$MONITORING_ACCOUNT_EVENTBUS_ARN_DEFAULT]: " MONITORING_ACCOUNT_EVENTBUS_ARN
MONITORING_ACCOUNT_EVENTBUS_ARN=${MONITORING_ACCOUNT_EVENTBUS_ARN:-$MONITORING_ACCOUNT_EVENTBUS_ARN_DEFAULT}

read -p "Monitoring Account Sink Identifier [$MONITORING_ACCOUNT_SINK_ARN_DEFAULT]: " MONITORING_ACCOUNT_SINK_ARN
MONITORING_ACCOUNT_SINK_ARN=${MONITORING_ACCOUNT_SINK_ARN:-$MONITORING_ACCOUNT_SINK_ARN_DEFAULT}

if [[ -z $CLI_PROFILE_NAME_DEFAULT ]] || [[ $CLI_PROFILE_NAME_DEFAULT == "" ]] || [[ $CLI_PROFILE_NAME_DEFAULT = null ]]; then
    read -p "Management account AWSCLI profile name. Press [enter] to use the default AWS creds from the chain: " MANAGEMENT_ACCOUNT_AWSCLI_PROFILE_NAME
else
    read -p "Management account AWSCLI profile name [$CLI_PROFILE_NAME_DEFAULT]: " MANAGEMENT_ACCOUNT_AWSCLI_PROFILE_NAME
    MANAGEMENT_ACCOUNT_AWSCLI_PROFILE_NAME=${MANAGEMENT_ACCOUNT_AWSCLI_PROFILE_NAME:-$CLI_PROFILE_NAME_DEFAULT}
fi

# Shouldn't need to change any of the scripts below

if [[ -z $MANAGEMENT_ACCOUNT_AWSCLI_PROFILE_NAME ]] || [[ $MANAGEMENT_ACCOUNT_AWSCLI_PROFILE_NAME == "" ]]
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
  "home-region": "$REGION",
  "monitoring-account-id": "$MONITORING_ACCOUNT_ID",
  "monitoring-account-sink-arn": "$MONITORING_ACCOUNT_SINK_ARN",
  "monitoring-account-role-name": "$MONITORING_ACCOUNT_ROLE_NAME",
  "monitoring-account-eventbus-arn": "$MONITORING_ACCOUNT_EVENTBUS_ARN",
  "workload-account-OUs": ["$WORKLOAD_OU_ID"]
}
EOF
make build
make deploy-management-stackset