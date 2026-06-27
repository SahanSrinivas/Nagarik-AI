# NagarikAI Vision agent — empirical eval

Sample: **1138** valid predictions (of 1138 attempted; 0 infra errors).
Eval ran the live `vision_agent.PROMPT` against Gemini 2.5 Flash and applied the same guardrail logic the production agent uses.

## Guardrail — civic vs non-civic

|              | predicted civic | predicted non-civic |
|--------------|-----------------|---------------------|
| **actual civic** (667) | TP = **311** | FN = **356** |
| **actual non-civic** (471) | FP = **0** | TN = **471** |

- **Sensitivity (civic recall)**: 46.6%
- **Specificity (non-civic correctly rejected)**: 100.0%
- **False-positive rate** (non-civic LEAKED to agent chain): 0.0%
- **False-negative rate** (real civic issue wrongly rejected): 53.4%

## Per-category accuracy (civic-only)

| Category | n | exact match | wrong civic type | wrongly rejected |
|---|---:|---:|---:|---:|
| pothole | 100 | 66 (66%) | 6 (6%) | 28 (28%) |
| garbage | 99 | 76 (77%) | 0 (0%) | 23 (23%) |
| streetlight | 76 | 45 (59%) | 1 (1%) | 30 (39%) |
| water_leak | 96 | 1 (1%) | 1 (1%) | 94 (98%) |
| sewage | 99 | 22 (22%) | 19 (19%) | 58 (59%) |
| tree_fall | 99 | 62 (63%) | 0 (0%) | 37 (37%) |
| encroachment | 98 | 11 (11%) | 1 (1%) | 86 (88%) |

## Confusion matrix (rows = expected, cols = predicted)

| expected ↓ \ pred → | pothole | garbage | streetlight | water_leak | sewage | tree_fall | encroachment | other | total |
|---|---|---|---|---|---|---|---|---|---|
| pothole | 66 | 0 | 0 | 6 | 0 | 0 | 0 | 28 | 100 |
| garbage | 0 | 76 | 0 | 0 | 0 | 0 | 0 | 23 | 99 |
| streetlight | 0 | 0 | 45 | 0 | 0 | 1 | 0 | 30 | 76 |
| water_leak | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 94 | 96 |
| sewage | 1 | 13 | 0 | 5 | 22 | 0 | 0 | 58 | 99 |
| tree_fall | 0 | 0 | 0 | 0 | 0 | 62 | 0 | 37 | 99 |
| encroachment | 0 | 1 | 0 | 0 | 0 | 0 | 11 | 86 | 98 |
| other | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 471 | 471 |
