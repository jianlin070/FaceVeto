PROJECT ?= faceveto-2026
REGION ?= asia-southeast1
SA ?= faceveto-api@$(PROJECT).iam.gserviceaccount.com
GEMINI_MODEL ?= gemini-3.6-flash

.PHONY: dev api web test build-web deploy-api deploy-web deploy ship seed eval

dev:
	$(MAKE) -j2 api web

api:
	cd api && .venv/bin/uvicorn app.main:app --reload --port 8080

web:
	cd web && npm run dev

test:
	cd api && .venv/bin/pytest -q

build-web:
	cd web && npm run build && git rev-parse --short HEAD > dist/version.txt

deploy-api:
	gcloud run deploy faceveto-api --source api/ --region $(REGION) --project $(PROJECT) \
	  --service-account $(SA) --allow-unauthenticated \
	  --cpu 2 --memory 4Gi --concurrency 4 --timeout 120 \
	  --min-instances 1 --max-instances 5 --cpu-boost --update-labels commit=$(shell git rev-parse --short HEAD) \
	  --set-env-vars GCP_PROJECT=$(PROJECT),GCP_REGION=$(REGION),GEMINI_MODEL=$(GEMINI_MODEL),GEMINI_LOCATION=global,MEDIA_BUCKET=$(PROJECT)-faceveto-media,DEMO_MODE=true,MATCH_THRESHOLD=0.45,FACE_MODEL_ROOT=/models,USE_ADK_AGENT=true

deploy-web: build-web
	firebase deploy --only hosting --project $(PROJECT)

deploy: deploy-api deploy-web

# Test, deploy only what changed since the live version, verify the live site
ship:
	scripts/ship.sh

seed:
	api/.venv/bin/python scripts/seed.py

eval:
	api/.venv/bin/python eval/face_match_eval.py
	api/.venv/bin/python eval/harm_eval.py
	api/.venv/bin/python eval/latency_report.py
