# Code Explanation: university-outreach.js

This example implements a **research-then-compose outreach agent** using the OpenAI SDK. The agent researches small colleges, drafts personalized emails offering free access to the "I Grow" leadership app, and self-reviews each email for spam signals before presenting the final version.

## Run

```bash
node examples/16_university-outreach/university-outreach.js
```

Requires `OPENAI_API_KEY` in your `.env` file. Uses `gpt-4o-mini` by default; override with the `MODEL` environment variable:

```bash
MODEL=gpt-4o node examples/16_university-outreach/university-outreach.js
```

---

## 1) Tool Definitions (Lines 22-84)

Three tools are defined in OpenAI function-calling format:

```javascript
const tools = [
    {
        type: 'function',
        function: {
            name: 'research_university',
            description: 'Research a small college or university...',
            parameters: { ... }
        }
    },
    {
        type: 'function',
        function: {
            name: 'compose_email',
            description: 'Compose a personalized outreach email...',
            parameters: { ... }
        }
    },
    {
        type: 'function',
        function: {
            name: 'review_email_for_spam',
            description: 'Review a drafted email and flag spam signals...',
            parameters: { ... }
        }
    },
];
```

Each tool has a clear, descriptive name and parameter schema so the model knows when and how to call it.

---

## 2) Tool Implementations

### `researchUniversity` (Lines 93-137)

Uses a **nested LLM call** to generate a structured research brief:

```javascript
async function researchUniversity(universityName) {
    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.3,  // low temperature for factual output
        messages: [ ... ],
        response_format: { type: 'json_object' },
    });
    return response.choices[0].message.content;
}
```

Key design choices:
- **Low temperature (0.3)** keeps research factual and consistent
- **JSON response format** ensures structured output the compose step can parse
- The research prompt asks for mission themes, leadership programs, a suggested contact role, and talking points specific to I Grow

The returned JSON includes:
- `name`, `location`, `approx_enrollment`
- `mission_themes` — keywords from the school's mission
- `leadership_programs` — array of `{name, description}` objects
- `relevant_department` and `suggested_contact_role`
- `talking_points` — reasons I Grow fits this school

### `composeEmail` (Lines 143-194)

Drafts the outreach email with strict anti-spam rules baked into the system prompt:

```javascript
async function composeEmail(researchBriefJson, contactRole) {
    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.7,  // higher temperature for natural writing
        messages: [ ... ],
        response_format: { type: 'json_object' },
    });
    return response.choices[0].message.content;
}
```

The system prompt enforces:
- Open with something **specific to this school** (never generic)
- Keep body **under 200 words**
- Include a **bulleted list** of I Grow features (skill modules, growth plans, peer circles, real-world challenges)
- Frame as a **complimentary partnership** exploration
- Low-pressure call to action
- No ALL-CAPS, exclamation marks in subject, urgency language, or "click here"

### `reviewEmailForSpam` (Lines 200-248)

Acts as a quality gate — checks the drafted email against spam heuristics:

```javascript
async function reviewEmailForSpam(subject, body) {
    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.2,  // very low — deterministic judgment
        messages: [ ... ],
        response_format: { type: 'json_object' },
    });
    return response.choices[0].message.content;
}
```

Returns a structured verdict:
- `verdict`: `"PASS"` or `"NEEDS_REVISION"`
- `score`: 1-10 authenticity rating
- `flags`: specific issues found
- `suggestions`: how to fix them
- `revised_subject` / `revised_body`: improved versions if needed

---

## 3) The Agent System Prompt (Lines 260-281)

The system prompt gives the agent a clear, ordered pipeline:

```
1. RESEARCH  → call research_university
2. COMPOSE   → call compose_email with the brief
3. REVIEW    → call review_email_for_spam
4. REVISE    → if NEEDS_REVISION, fix and re-review
5. PRESENT   → output the final email
```

It also emphasizes:
- Focus on **small** colleges (under ~5,000 students)
- Offer is **free / complimentary**
- Emails must be **personal and specific**
- Think out loud before each action

---

## 4) The ReAct Agent Loop (Lines 286-341)

```javascript
async function runOutreachAgent(universities) {
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Please research...` },
    ];

    while (iteration < MAX_ITERATIONS) {
        const response = await client.chat.completions.create({
            model: MODEL,
            messages,
            tools,
            temperature: 0.4,
        });

        const choice = response.choices[0];
        messages.push(choice.message);

        // Execute any tool calls
        if (choice.message.tool_calls?.length) {
            for (const toolCall of choice.message.tool_calls) {
                const result = await toolHandlers[fnName](fnArgs);
                messages.push({ role: 'tool', tool_call_id: ..., content: result });
            }
            continue;
        }

        // Natural stop = agent is done
        if (choice.finish_reason === 'stop') break;
    }
}
```

**How the loop works:**

1. Send the full conversation (system + user + history) to the model with tool definitions
2. The model either returns text (reasoning/final output) or tool calls
3. For tool calls: execute each one, append results as `tool` messages, and loop back
4. The model processes tool results, reasons about next steps, and either calls more tools or produces final output
5. When `finish_reason` is `"stop"`, the agent has completed all work

This is a standard **OpenAI function-calling agent loop** — the model decides which tool to use and when to stop, guided by the system prompt's ordered pipeline.

---

## 5) The Three-University Demo (Lines 347-351)

```javascript
const TARGET_UNIVERSITIES = [
    'Tuskegee University',
    'Berea College',
    'Fort Valley State University',
];
```

The agent processes all three in a single conversation, which lets it potentially notice patterns and maintain consistency across emails.

---

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│  User: "Research these 3 universities"  │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│        Agent (ReAct Loop)               │
│                                         │
│  For each university:                   │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ Step 1: research_university()     │  │
│  │  → LLM sub-call produces brief    │  │
│  └──────────────┬────────────────────┘  │
│                 ▼                        │
│  ┌───────────────────────────────────┐  │
│  │ Step 2: compose_email()           │  │
│  │  → LLM sub-call drafts email      │  │
│  └──────────────┬────────────────────┘  │
│                 ▼                        │
│  ┌───────────────────────────────────┐  │
│  │ Step 3: review_email_for_spam()   │  │
│  │  → LLM sub-call checks quality    │  │
│  └──────────────┬────────────────────┘  │
│                 │                        │
│                 ├─── PASS ──► Present    │
│                 │                        │
│                 └─── FAIL ──► Revise     │
│                       │      & re-review │
│                       └──────────────────│
└─────────────────────────────────────────┘
```

---

## Key Patterns Demonstrated

### 1. Nested LLM Calls (Tool-as-Agent)

Each tool function makes its own LLM call with a specialized system prompt. The outer agent orchestrates; the inner calls do focused work:

```
Outer agent (orchestrator, temp 0.4)
  └─► research_university (analyst, temp 0.3)
  └─► compose_email (copywriter, temp 0.7)
  └─► review_email_for_spam (reviewer, temp 0.2)
```

Different temperatures match each role: low for factual research and judgment, higher for creative writing.

### 2. Self-Review Loop

The agent can catch its own mistakes:
```
compose → review → NEEDS_REVISION → revise → review → PASS
```

This is a simple but effective quality gate that prevents the agent from outputting emails that feel like spam.

### 3. Structured Intermediate Data

Using `response_format: { type: 'json_object' }` ensures each step produces parseable data the next step can consume reliably.

### 4. Conversation-as-Memory

The entire message history is the agent's working memory. Tool results accumulate in the conversation, so the agent can reference earlier research when composing later emails.

---

## Expected Output

```
======================================================================
  I Grow — University Outreach Agent
  Model: gpt-4o-mini
  Universities: Tuskegee University, Berea College, Fort Valley State University
======================================================================

--- Agent iteration 1 ---
Let me start by researching Tuskegee University...

   [tool] research_university("Tuskegee University")
   [tool] Research brief generated (842 chars)

--- Agent iteration 2 ---
Now I'll compose the outreach email...

   [tool] compose_email(brief, "Director of Leadership Programs")
   [tool] Email composed (612 chars)

--- Agent iteration 3 ---
Let me review this email for spam signals...

   [tool] review_email_for_spam(...)
   [tool] Spam review verdict: PASS (score: 9/10)

--- Agent iteration 4 ---
Here is the final email for Tuskegee University:

Subject: A Leadership Resource for Tuskegee Students
Body: ...
Follow-up: Two weeks

... (continues for Berea College and Fort Valley State University) ...

======================================================================
  Agent finished.
======================================================================
```

---

## Extending This Example

1. **Real web research** — Replace the `researchUniversity` LLM call with actual web scraping or a search API to get live data about each school's programs.
2. **CRM integration** — Write results to a spreadsheet or CRM system using an additional tool.
3. **Batch scaling** — Read university names from a CSV file and process them in configurable batch sizes.
4. **A/B subject lines** — Have the compose tool generate multiple subject line variants and let the review tool pick the best one.
5. **Human-in-the-loop** — Add a confirmation step where the agent pauses for human approval before marking an email as final.
