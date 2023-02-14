include .env # Copy .env.sample to .env and fill in the values

WORKSPACE=$(shell pwd)

.PHONY: deploy-management-stackset
deploy-management-stackset:
	cd management-stack && CDK_DEPLOY_ACCOUNT=${MANAGEMENT_ACCOUNT} cdk deploy

.PHONY: synth-management-stackset
synth-management-stackset:
	cd management-stack && CDK_DEPLOY_ACCOUNT=${MANAGEMENT_ACCOUNT} cdk synth

.PHONY: deploy-monitoring-account-infra
deploy-monitoring-account-infra:
	cd monitoring-account-infra && CDK_DEPLOY_ACCOUNT=${MONITORING_ACCOUNT} cdk deploy

.PHONY: synth-monitoring-account-infra
synth-monitoring-account-infra:
	cd monitoring-account-infra && CDK_DEPLOY_ACCOUNT=${MONITORING_ACCOUNT} cdk synth
