include .env # Copy .env.sample to .env and fill in the values

WORKSPACE=$(shell pwd)

.PHONY: deploy-management-stackset
deploy-management-stackset:
	cd workload-account-infra && CDK_DEPLOY_ACCOUNT=${MANAGEMENT_ACCOUNT} cdk deploy ManagementStackStack

.PHONY: synth-management-stackset
synth-management-stackset:
	cd workload-account-infra && CDK_DEPLOY_ACCOUNT=${MANAGEMENT_ACCOUNT} cdk synth ManagementStackStack

.PHONY: deploy-monitoring-account-infra
deploy-monitoring-account-infra:
	cd monitoring-account-infra && CDK_DEPLOY_ACCOUNT=${MONITORING_ACCOUNT} cdk deploy

.PHONY: synth-monitoring-account-infra
synth-monitoring-account-infra:
	cd monitoring-account-infra && CDK_DEPLOY_ACCOUNT=${MONITORING_ACCOUNT} cdk synth

.PHONY: deploy-workload-account-infra
deploy-workload-account-infra:
	cd workload-account-infra && CDK_DEPLOY_ACCOUNT=${WORKLOAD_ACCOUNT} cdk deploy WorkloadAccountInfraStack

.PHONY: synth-workload-account-infra
synth-workload-account-infra:
	cd workload-account-infra && CDK_DEPLOY_ACCOUNT=${WORKLOAD_ACCOUNT} cdk synth WorkloadAccountInfraStack

build:
	cd workload-account-infra && npm ci
	cd monitoring-account-infra && npm ci