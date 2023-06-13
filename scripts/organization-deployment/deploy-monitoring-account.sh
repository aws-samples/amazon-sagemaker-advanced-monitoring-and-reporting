#!/usr/bin/env bash
set -e

read -p "Home region: " REGION
read -p "Monitoring account AWSCLI profile name. [Enter] to use the default AWS creds from the chain: " MONITORING_ACCOUNT_AWSCLI_PROFILE_NAME
read -p "Sagemaker workload OU path: " WORKLOAD_OU_PATH

# Shouldn't need to change any of the scripts below

if [[ -z $MONITORING_ACCOUNT_AWSCLI_PROFILE_NAME ]]
then
    PROFILE=""
    echo "Profile not specified. Use default AWS credential."
else
    PROFILE="--profile ${MONITORING_ACCOUNT_AWSCLI_PROFILE_NAME}"
fi
MONITORING_ACCOUNT=$(aws sts get-caller-identity ${PROFILE} | jq -r ".Account")
read -p "Current deploying to Account $MONITORING_ACCOUNT. Is this correct? [y/n]: " confirm

if [[ $confirm == "y" ]] || [[ $confirm == "Y" ]]
then
    echo "Account confirmed. Processding with the deployment.."
else
    echo "Please confirm your AWS credential."
    exit 1
fi
cdk bootstrap aws://$MONITORING_ACCOUNT/$REGION $PROFILE

cat << EOF >./.env
MONITORING_ACCOUNT=$MONITORING_ACCOUNT
MONITORING_PROFILE=$PROFILE
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
