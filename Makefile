include .env # Copy .env.sample to .env and fill in the values

WORKSPACE=$(shell pwd)

.PHONY: deploy-management-stackset
deploy-management-stackset:
	cd workload-account-infra && CDK_DEPLOY_ACCOUNT=${MANAGEMENT_ACCOUNT} cdk deploy ManagementStackStack --require-approval never --profile ${MANAGEMENT_PROFILE}

.PHONY: synth-management-stackset
synth-management-stackset:
	cd workload-account-infra && CDK_DEPLOY_ACCOUNT=${MANAGEMENT_ACCOUNT} cdk synth ManagementStackStack --profile ${MANAGEMENT_PROFILE}

.PHONY: destroy-management-stackset
destroy-management-stackset:
	cd workload-account-infra && CDK_DEPLOY_ACCOUNT=${MANAGEMENT_ACCOUNT} cdk destroy ManagementStackStack --profile ${MANAGEMENT_PROFILE}


.PHONY: deploy-monitoring-account-infra
deploy-monitoring-account-infra:
	cd monitoring-account-infra && CDK_DEPLOY_ACCOUNT=${MONITORING_ACCOUNT} cdk deploy --require-approval never --profile ${MONITORING_PROFILE}

.PHONY: synth-monitoring-account-infra
synth-monitoring-account-infra:
	cd monitoring-account-infra && CDK_DEPLOY_ACCOUNT=${MONITORING_ACCOUNT} cdk synth --profile ${MONITORING_PROFILE}

.PHONY: destroy-monitoring-account-infra
destroy-monitoring-account-infra:
	cd monitoring-account-infra && CDK_DEPLOY_ACCOUNT=${MONITORING_ACCOUNT} cdk destroy --profile ${MONITORING_PROFILE}

.PHONY: deploy-workload-account-infra
deploy-workload-account-infra:
	cd workload-account-infra && CDK_DEPLOY_ACCOUNT=${WORKLOAD_ACCOUNT} cdk deploy WorkloadAccountInfraStack

.PHONY: synth-workload-account-infra
synth-workload-account-infra:
	cd workload-account-infra && CDK_DEPLOY_ACCOUNT=${WORKLOAD_ACCOUNT} cdk synth WorkloadAccountInfraStack

.PHONY: destroy-workload-account-infra
destroy-workload-account-infra:
	cd workload-account-infra && CDK_DEPLOY_ACCOUNT=${WORKLOAD_ACCOUNT} cdk destroy WorkloadAccountInfraStack

build:
	cd workload-account-infra && npm ci
	cd monitoring-account-infra && npm ci