WORKSPACE=$(shell pwd)

.PHONY: deploy-management-stackset
deploy-management-stackset:
	cd management-stack && cdk deploy --profile dongj-org-management

.PHONY: deploy-monitoring-account-infra
deploy-monitoring-account-infra:
	cd monitoring-account-infra && cdk deploy --profile dongj-org-monitor
