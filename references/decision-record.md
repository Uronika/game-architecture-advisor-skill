# Decision Record Format

Use this compact format for any decision that has more than one credible option.

```markdown
## Decision: <short title>

### Confirmed context
- <facts observed in the project or supplied by the user>

### Open questions
- <only questions whose answers may alter the recommendation>

### Evidence consulted
- <local path or official URL, version, and the specific relevant section>

### Options
| Option | Benefits | Costs and risks | Fit with confirmed constraints |
|---|---|---|---|
| A. <name> | | | |
| B. <name> | | | |

### Recommendation
Choose **<option>** because <reason grounded in confirmed facts and evidence>.

### Consequences
- <what becomes simpler or safer>
- <what new complexity, operational cost, or limitation is accepted>

### Validation plan
- <observable test, profile, prototype, or migration check>

### Approval requested
`Approve option <name> to implement <bounded change>.`
```

Mark a conclusion as an **inference** when it follows from evidence but is not directly documented. Do not include unconfirmed assumptions in the confirmed-context section.
