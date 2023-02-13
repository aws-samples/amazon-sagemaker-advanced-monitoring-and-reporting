WORKSPACE=$(shell pwd)

.PHONY: deploy-management-stackset
deploy-management-stackset:
	cd management-stack && cdk deploy

.PHONY: synth-management-stackset
synth-management-stackset:
	cd management-stack && cdk synth

.PHONY: deploy-monitoring-account-infra
deploy-monitoring-account-infra:
	cd monitoring-account-infra && cdk deploy

.PHONY: synth-monitoring-account-infra
synth-monitoring-account-infra:
	cd monitoring-account-infra && cdk synth
