deploy-staging:
	@echo "deploying HOLON to staging.."
	bash scripts/deploy-staging.sh
deploy-private:
	@echo "deploying HOLON to private.."
	bash scripts/deploy-private.sh
deploy-production:
	@echo "deploying HOLON to production.."
	bash scripts/deploy-production.sh