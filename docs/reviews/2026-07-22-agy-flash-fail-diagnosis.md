# Diagnosis — why `agy` gemini flash always “failed”

> Date: 2026-07-22  
> Symptom: every hetero call returned only “I am Gemini 3.6 Flash (High)” / CLI `--model` help, never the actual task.

## Root cause (confirmed)

**Argument order bug in how we invoked `agy`, not a dead Gemini model.**

`agy --print` / `-p` / `--prompt` **consumes the next argv as the prompt string**.

### Broken (what we did in hetero R1–R4)

```bash
agy -p --model gemini-3.6-flash-high --print-timeout 90s "real long prompt…"
#        ^^^^^^^
#        this becomes the prompt (length 7 = "--model")
```

```bash
agy --print --print-timeout 45s "real prompt…"
#           ^^^^^^^^^^^^^^^
#           becomes the prompt (length 15)
```

CLI logs proved it:

```text
Print mode: starting (promptLength=7, model="", conversationID="")
Print mode: starting (promptLength=15, model="", conversationID="")
```

The model was asked about `--model` / `--print-timeout` as if that *were* the user question → identity / flag documentation spam.  
Looks like “flash is broken”; actually **the review prompt never arrived**.

### Fixed

```bash
# prompt immediately after -p, then other flags
agy -p "real prompt…" --model gemini-3.6-flash-high --print-timeout 90s

# or flags first, -p PROMPT last
agy --model gemini-3.6-flash-high --print-timeout 90s -p "real prompt…"

# or equals form
agy --print="real prompt…" --model gemini-3.6-flash-high
```

Verified:

```text
promptLength=39, model="gemini-3.6-flash-high"
→ model answers "4" to 2+2
```

## Secondary notes

| Item | Finding |
|------|---------|
| Auth | Silent auth works (`cookys@gmail.com`); “not logged in” noise is pre-silent-auth poll |
| settings.json model | Default `Gemini 3.6 Flash (High)` is fine when `--model` is actually applied |
| cwd /tmp vs trusted | Not the cause; broken arg order failed from mudgate cwd too |
| Other models on agy | Same bug when `-p --model …` order used — all looked “broken” |

## Harness rule (for future hetero)

**Never put flags between `-p`/`--print`/`--prompt` and the prompt text.**  
Prefer: `agy --model <m> --print-timeout <d> -p "$PROMPT"`.

Optional wrapper:

```bash
agy_print() {
  local model=$1; shift
  local timeout=${AGY_PRINT_TIMEOUT:-5m0s}
  agy --model "$model" --print-timeout "$timeout" -p "$*"
}
```

## Companion plan hetero impact

Gemini seats in R1–R4 were **invalid (empty task)**, not model refusal.  
ALL_CLEAR still stands on gpt/GLM/Qwen/MiniMax.  
Optional: re-run one Gemini review with fixed CLI for the record.
