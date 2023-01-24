WORKSPACE=$(shell pwd)

.PHONY: deploy-management-stackset
deploy-management-stackset:
	cd management-stack && cdk deploy

.PHONY: synth-management-stackset
synth-management-stackset:
	cd management-stack && cdk synth

.PHONY: deploy-monitoring-account-infra
deploy-monitoring-account-infra:
	#pip install --target ./monitoring-account-infra/lib/functions/${function}/ -r ./monitoring-account-infra/lib/functions/${function}/requirements.txt
	cd monitoring-account-infra && cdk deploy

.PHONY: synth-monitoring-account-infra
synth-monitoring-account-infra:
	cd monitoring-account-infra && cdk synth
