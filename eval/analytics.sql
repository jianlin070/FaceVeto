-- Trust and safety analytics over the API's structured logs.
-- Cloud Logging exports every app log line from Cloud Run (sink: faceveto-api-to-bigquery)
-- into BigQuery dataset faceveto_logs. No faces, embeddings, tokens or image bytes are logged.
-- Run in the BigQuery console or: bq query --nouse_legacy_sql < eval/analytics.sql

-- 1. What happened to posts, by harm category (last 30 days)
SELECT
  jsonPayload.decision AS decision,
  IFNULL(jsonPayload.category, 'no protected face') AS category,
  COUNT(*) AS posts
FROM `faceveto-2026.faceveto_logs.run_googleapis_com_stdout`
WHERE jsonPayload.message = 'post scanned'
  AND timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY decision, category
ORDER BY posts DESC;

-- 2. Decision latency, with and without a Gemini call
SELECT
  IF(jsonPayload.gemini_called, 'protected face, Gemini judged', 'no protected face') AS path,
  COUNT(*) AS posts,
  APPROX_QUANTILES(jsonPayload.latency_ms, 100)[OFFSET(50)] AS p50_ms,
  APPROX_QUANTILES(jsonPayload.latency_ms, 100)[OFFSET(95)] AS p95_ms
FROM `faceveto-2026.faceveto_logs.run_googleapis_com_stdout`
WHERE jsonPayload.message = 'post scanned'
  AND timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY path;

-- 3. How owners answered held posts
SELECT
  jsonPayload.response AS owner_response,
  COUNT(*) AS cases
FROM `faceveto-2026.faceveto_logs.run_googleapis_com_stdout`
WHERE jsonPayload.message = 'owner responded'
  AND timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY owner_response;
