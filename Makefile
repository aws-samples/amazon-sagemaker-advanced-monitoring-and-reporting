WORKSPACE=$(shell pwd)

.PHONY: deploy-management-stackset
deploy-management-stackset:
	cd management-stack && cdk deploy --profile dongj-org-management

.PHONY: synth-management-stackset
synth-management-stackset:
	cd management-stack && cdk synth --profile dongj-org-management

.PHONY: deploy-monitoring-account-infra
deploy-monitoring-account-infra:
	# pip install --target ./monitoring-account-infra/lib/functions/ingester/ -r ./monitoring-account-infra/lib/functions/ingester//requirements.txt
	cd monitoring-account-infra && cdk deploy --profile dongj-org-monitor

.PHONY: synth-monitoring-account-infra
synth-monitoring-account-infra:
	cd monitoring-account-infra && cdk synth --profile dongj-org-monitor
