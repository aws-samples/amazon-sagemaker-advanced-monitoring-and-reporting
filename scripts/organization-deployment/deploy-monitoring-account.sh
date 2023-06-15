#!/usr/bin/env bash
set -e

# Check if the context input has been entered before
MONITORING_CDK_CONTEXT_FILE=./monitoring-account-infra/cdk.context.json
if [ -f "$MONITORING_CDK_CONTEXT_FILE" ]; then
    REGION_DEFAULT=$(cat $MONITORING_CDK_CONTEXT_FILE | jq -r '."home-region"')
    WORKLOAD_OU_PATH_DEFAULT=$(cat $MONITORING_CDK_CONTEXT_FILE | jq -r '."org-path-to-allow"')
    CLI_PROFILE_NAME_DEFAULT=$(cat $MONITORING_CDK_CONTEXT_FILE | jq -r '."awscli-profile"')
fi

read -p "Home region [$REGION_DEFAULT]: " REGION
REGION=${REGION:-$REGION_DEFAULT}

read -p "Sagemaker workload OU path [$WORKLOAD_OU_PATH_DEFAULT]: " WORKLOAD_OU_PATH
WORKLOAD_OU_PATH=${WORKLOAD_OU_PATH:-$WORKLOAD_OU_PATH_DEFAULT}


if [[ -z $CLI_PROFILE_NAME_DEFAULT ]] || [[ $CLI_PROFILE_NAME_DEFAULT == "" ]] || [[ $CLI_PROFILE_NAME_DEFAULT = null ]]; then
    read -p "Monitoring account AWSCLI profile name. Press [enter] to use the default AWS creds from the chain: " MONITORING_ACCOUNT_AWSCLI_PROFILE_NAME
else
    read -p "Monitoring account AWSCLI profile name [$CLI_PROFILE_NAME_DEFAULT]" MONITORING_ACCOUNT_AWSCLI_PROFILE_NAME
    MONITORING_ACCOUNT_AWSCLI_PROFILE_NAME=${MONITORING_ACCOUNT_AWSCLI_PROFILE_NAME:-$CLI_PROFILE_NAME_DEFAULT}
fi

if [[ -z $MONITORING_ACCOUNT_AWSCLI_PROFILE_NAME ]] || [[ $MONITORING_ACCOUNT_AWSCLI_PROFILE_NAME == "" ]]
then
    PROFILE=""
    echo "Profile not specified. Use default AWS credential."
else
    PROFILE="--profile ${MONITORING_ACCOUNT_AWSCLI_PROFILE_NAME}"
fi

# Confirm target account ID to deploy the monitoring stack
MONITORING_ACCOUNT=$(aws sts get-caller-identity ${PROFILE} | jq -r ".Account")
read -p "Current deploying to Account $MONITORING_ACCOUNT. Is this correct? [y/n]: " confirm

if [[ $confirm == "y" ]] || [[ $confirm == "Y" ]]
then
    echo "Account confirmed. Processding with the deployment.."
else
    echo "Please confirm your AWS credential. Make sure you specified the correct AWSCLI profile name or have the default credential configured correctly"
    exit 1
fi

# Try to perform bootstrap
cdk bootstrap aws://$MONITORING_ACCOUNT/$REGION $PROFILE

cat << EOF >./.env
MONITORING_ACCOUNT=$MONITORING_ACCOUNT
MONITORING_PROFILE=$PROFILE
CDK_DEPLOY_REGION=$REGION
EOF

cat << EOF >./monitoring-account-infra/cdk.context.json
{
  "org-path-to-allow": "$WORKLOAD_OU_PATH",
  "home-region": "$REGION",
  "awscli-profile": "$MONITORING_ACCOUNT_AWSCLI_PROFILE_NAME"
}
EOF
make build
make deploy-monitoring-account-infra
