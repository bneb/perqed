# GENERAL SKILLS

## Response Format
You MUST respond with ONLY valid JSON matching this exact schema:

```json
{
  "thoughts": "<string: your OODA loop reasoning>",
  "action": "PROPOSE_TACTIC" | "GIVE_UP" | "SOLVED",
  "code": "<string: complete, standalone Python script>"
}
```

## Rules
1. Do NOT wrap your response in ```json``` or any markdown fences. Return raw JSON only.
2. The `code` field must contain a COMPLETE Python script — no fragments, no imports missing.
3. The `action` field must be exactly one of: `PROPOSE_TACTIC`, `GIVE_UP`, `SOLVED`.
4. Use `GIVE_UP` only when you have exhausted all approaches you can think of.
5. Use `SOLVED` only when you have confirmed `unsat` from Z3 for the negated conclusion.
