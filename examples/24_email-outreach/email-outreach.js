import OpenAI from 'openai';
import 'dotenv/config';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const MODEL = process.env.MODEL || 'gpt-4o-mini';

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// ---------------------------------------------------------------------------
// Tool definitions (OpenAI function-calling format)
// ---------------------------------------------------------------------------

const tools = [
    {
        type: 'function',
        function: {
            name: 'select_send_platform',
            description:
                'Choose the optimal sending platform for an email based on channel, ' +
                'touch number, fit score, and priority. Returns the selected platform ' +
                '(Instantly, Smartlead, Lemlist, or Manual-Gmail) with rationale.',
            parameters: {
                type: 'object',
                properties: {
                    channel: {
                        type: 'string',
                        enum: ['university', 'partnership', 'business'],
                        description:
                            'The outreach channel: "university" for higher-ed contacts, ' +
                            '"partnership" for strategic alliance targets, ' +
                            '"business" for B2B enterprise leads.',
                    },
                    touch_number: {
                        type: 'number',
                        description:
                            'Which touch in the sequence (1-4). Touch 1 is the initial ' +
                            'outreach; higher numbers are follow-ups.',
                    },
                    fit_score: {
                        type: 'number',
                        description:
                            'How well the contact fits the ideal customer profile (1-10). ' +
                            'Scores of 9-10 may trigger manual high-touch sending.',
                    },
                    priority: {
                        type: 'string',
                        description:
                            'Priority tier: "P1" for top-priority contacts (CEO-level, ' +
                            'strategic accounts), "P2" for standard priority, "P3" for ' +
                            'bulk outreach.',
                    },
                },
                required: ['channel', 'touch_number', 'fit_score', 'priority'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'schedule_send',
            description:
                'Schedule an email for optimal delivery within the recipient\'s local ' +
                'time zone. Enforces warm-up limits (30/day first 2 weeks, 50/day ' +
                'steady state), 8am-11am send windows, Tue-Thu preferred days, and ' +
                '3-5 minute randomized delays between sends.',
            parameters: {
                type: 'object',
                properties: {
                    contact_email: {
                        type: 'string',
                        description: 'The recipient email address to schedule the send for.',
                    },
                    timezone_estimate: {
                        type: 'string',
                        description:
                            'Estimated timezone of the recipient (e.g., "America/New_York", ' +
                            '"America/Chicago"). Used to target the 8am-11am local window.',
                    },
                    platform: {
                        type: 'string',
                        description:
                            'The sending platform to use (as returned by select_send_platform).',
                    },
                },
                required: ['contact_email', 'timezone_estimate', 'platform'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'check_deliverability',
            description:
                'Check current domain health and deliverability metrics before sending. ' +
                'Returns domain reputation, bounce rate, spam complaints, warm-up stage, ' +
                'and remaining daily capacity. Triggers an emergency stop if bounce rate ' +
                'exceeds 5% or any spam complaint is detected.',
            parameters: {
                type: 'object',
                properties: {
                    domain: {
                        type: 'string',
                        description:
                            'The sending domain to check (e.g., "igrow.co", "outreach.igrow.co").',
                    },
                    daily_sends_so_far: {
                        type: 'number',
                        description:
                            'Number of emails already sent today from this domain. Used to ' +
                            'calculate remaining capacity against warm-up limits.',
                    },
                },
                required: ['domain', 'daily_sends_so_far'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'log_send_result',
            description:
                'Log the result of a send attempt. If the status is "bounced", triggers ' +
                'Do Not Contact list propagation. If "failed", logs the error for retry ' +
                'queue processing.',
            parameters: {
                type: 'object',
                properties: {
                    send_id: {
                        type: 'string',
                        description: 'Unique identifier for this send attempt (e.g., "SEND-001").',
                    },
                    status: {
                        type: 'string',
                        enum: ['sent', 'bounced', 'failed'],
                        description:
                            'Outcome of the send: "sent" for successful delivery, ' +
                            '"bounced" for hard/soft bounce, "failed" for technical failure.',
                    },
                    response_details: {
                        type: 'string',
                        description:
                            'Optional details about the send result (e.g., SMTP response, ' +
                            'error message, bounce reason).',
                    },
                },
                required: ['send_id', 'status'],
            },
        },
    },
];

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

/**
 * Selects the optimal sending platform based on the email's channel, touch
 * number, fit score, and priority. Uses a nested LLM call to reason about
 * platform selection.
 */
async function selectSendPlatform(channel, touchNumber, fitScore, priority) {
    console.log(
        `\n   [tool] select_send_platform("${channel}", touch=${touchNumber}, ` +
        `fit=${fitScore}, priority="${priority}")`
    );

    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        messages: [
            {
                role: 'system',
                content:
                    `You are an email operations specialist for iGrow. Select the optimal ` +
                    `sending platform for a given email based on these rules:\n\n` +
                    `PLATFORM SELECTION RULES:\n` +
                    `- Instantly: Default for bulk outreach (P3), first-touch university ` +
                    `  emails at scale. Best warm-up infrastructure.\n` +
                    `- Smartlead: Use when A/B testing is needed (touch 2+ follow-ups), ` +
                    `  or when mailbox rotation is critical. Good for partnership channel.\n` +
                    `- Lemlist: Use for multimedia-rich emails (video thumbnails, custom ` +
                    `  images). Best for business channel where personalization drives reply.\n` +
                    `- Manual-Gmail: ONLY for P1 priority AND (fit score >= 9 OR CEO/VP-level ` +
                    `  contacts). Maximum deliverability, no automation fingerprint.\n\n` +
                    `Return a JSON object with:\n` +
                    `- "platform": the selected platform name\n` +
                    `- "rationale": 1-2 sentences explaining why\n` +
                    `- "deliverability_notes": any special configuration needed\n` +
                    `- "fallback_platform": backup if primary is unavailable`,
            },
            {
                role: 'user',
                content:
                    `Channel: ${channel}\n` +
                    `Touch number: ${touchNumber}\n` +
                    `Fit score: ${fitScore}/10\n` +
                    `Priority: ${priority}\n\n` +
                    `Select the best sending platform for this email.`,
            },
        ],
        response_format: { type: 'json_object' },
    });

    const result = response.choices[0].message.content;
    const parsed = JSON.parse(result);
    console.log(`   [tool] Platform selected: ${parsed.platform} (${parsed.rationale})\n`);
    return result;
}

/**
 * Schedules an email for optimal delivery within the recipient's local
 * timezone. Enforces warm-up limits and send windows.
 */
async function scheduleSend(contactEmail, timezoneEstimate, platform) {
    console.log(
        `\n   [tool] schedule_send("${contactEmail}", tz="${timezoneEstimate}", ` +
        `platform="${platform}")`
    );

    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        messages: [
            {
                role: 'system',
                content:
                    `You are an email scheduling engine for iGrow's outreach pipeline. ` +
                    `Calculate the optimal send time for an email.\n\n` +
                    `SCHEDULING RULES:\n` +
                    `- Send window: 8:00 AM - 11:00 AM in the recipient's LOCAL timezone\n` +
                    `- Preferred days: Tuesday, Wednesday, Thursday (highest open rates)\n` +
                    `- Acceptable days: Monday, Friday (slightly lower performance)\n` +
                    `- Never send: Saturday, Sunday\n` +
                    `- Send delay: 3-5 minutes randomized between consecutive sends\n` +
                    `- Warm-up limits: 30 emails/day during first 2 weeks, 50/day steady state\n` +
                    `- Current warm-up stage: assume week 3 (steady state, 50/day limit)\n` +
                    `- Current daily sends: assume 12 sent so far today\n\n` +
                    `Return a JSON object with:\n` +
                    `- "scheduled_time": ISO 8601 timestamp in recipient's local tz\n` +
                    `- "scheduled_time_utc": the same time in UTC\n` +
                    `- "day_of_week": the day name\n` +
                    `- "send_delay_seconds": randomized delay (180-300s) before this send\n` +
                    `- "daily_quota_status": {"sent_today": N, "limit": 50, "remaining": N}\n` +
                    `- "notes": any scheduling considerations`,
            },
            {
                role: 'user',
                content:
                    `Schedule a send for:\n` +
                    `- Recipient email: ${contactEmail}\n` +
                    `- Recipient timezone: ${timezoneEstimate}\n` +
                    `- Sending platform: ${platform}\n\n` +
                    `Calculate the next optimal send time.`,
            },
        ],
        response_format: { type: 'json_object' },
    });

    const result = response.choices[0].message.content;
    const parsed = JSON.parse(result);
    console.log(
        `   [tool] Scheduled: ${parsed.scheduled_time} (${parsed.day_of_week}), ` +
        `delay=${parsed.send_delay_seconds}s, quota=${parsed.daily_quota_status?.remaining} remaining\n`
    );
    return result;
}

/**
 * Checks domain health and deliverability metrics. Implements emergency
 * stop logic for excessive bounces or spam complaints.
 */
async function checkDeliverability(domain, dailySendsSoFar) {
    console.log(
        `\n   [tool] check_deliverability("${domain}", sends_today=${dailySendsSoFar})`
    );

    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.1,
        messages: [
            {
                role: 'system',
                content:
                    `You are a domain health monitoring system for iGrow's email ` +
                    `infrastructure. Evaluate the current sending domain's health.\n\n` +
                    `DELIVERABILITY RULES:\n` +
                    `- Bounce rate threshold: 5% (EMERGENCY STOP if exceeded)\n` +
                    `- Spam complaint threshold: 0 (EMERGENCY STOP on ANY complaint)\n` +
                    `- Warm-up stages: Week 1-2 = 30/day, Week 3+ = 50/day\n` +
                    `- Domain age factor: newer domains need more conservative limits\n\n` +
                    `Simulate realistic deliverability metrics for a well-maintained ` +
                    `outreach domain. The domain has been warmed up for 3 weeks.\n\n` +
                    `Return a JSON object with:\n` +
                    `- "domain": the domain checked\n` +
                    `- "reputation_status": "healthy", "warning", or "critical"\n` +
                    `- "bounce_rate_percent": current bounce rate (should be low for healthy)\n` +
                    `- "spam_complaints": number of recent spam complaints\n` +
                    `- "warm_up_stage": "ramping" or "steady_state"\n` +
                    `- "daily_limit": current daily send limit\n` +
                    `- "sends_today": the number passed in\n` +
                    `- "remaining_capacity": daily_limit minus sends_today\n` +
                    `- "emergency_stop": boolean, true if thresholds exceeded\n` +
                    `- "spf_status": "pass" or "fail"\n` +
                    `- "dkim_status": "pass" or "fail"\n` +
                    `- "dmarc_status": "pass" or "fail"\n` +
                    `- "recommendation": brief advice on sending posture`,
            },
            {
                role: 'user',
                content:
                    `Check deliverability for:\n` +
                    `- Domain: ${domain}\n` +
                    `- Emails sent today: ${dailySendsSoFar}\n\n` +
                    `Return the full health report.`,
            },
        ],
        response_format: { type: 'json_object' },
    });

    const result = response.choices[0].message.content;
    const parsed = JSON.parse(result);
    const status = parsed.emergency_stop ? 'EMERGENCY STOP' : parsed.reputation_status;
    console.log(
        `   [tool] Domain health: ${status}, bounce=${parsed.bounce_rate_percent}%, ` +
        `spam=${parsed.spam_complaints}, remaining=${parsed.remaining_capacity}\n`
    );
    return result;
}

/**
 * Logs the result of a send attempt. Handles bounce propagation and
 * failure retry logic.
 */
async function logSendResult(sendId, status, responseDetails) {
    console.log(
        `\n   [tool] log_send_result("${sendId}", status="${status}"` +
        `${responseDetails ? `, details="${responseDetails}"` : ''})` 
    );

    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.1,
        messages: [
            {
                role: 'system',
                content:
                    `You are iGrow's email delivery logging system. Record the result of ` +
                    `a send attempt and determine any follow-up actions.\n\n` +
                    `LOGGING RULES:\n` +
                    `- "sent": Record successful delivery. Update daily send count.\n` +
                    `- "bounced": Record bounce. Add contact to Do Not Contact list. ` +
                    `  Propagate DNC across all sending platforms. Flag for list hygiene.\n` +
                    `- "failed": Record failure. Add to retry queue (max 2 retries). ` +
                    `  Log error details for debugging.\n\n` +
                    `Return a JSON object with:\n` +
                    `- "send_id": the send ID\n` +
                    `- "status": the status recorded\n` +
                    `- "timestamp": ISO 8601 timestamp of the log entry\n` +
                    `- "actions_taken": array of follow-up actions triggered\n` +
                    `- "dnc_propagated": boolean (true only if bounced)\n` +
                    `- "retry_queued": boolean (true only if failed)\n` +
                    `- "retry_count": number of retries attempted so far (0 if first failure)\n` +
                    `- "daily_send_count_updated": new daily total after this result\n` +
                    `- "notes": any additional context`,
            },
            {
                role: 'user',
                content:
                    `Log send result:\n` +
                    `- Send ID: ${sendId}\n` +
                    `- Status: ${status}\n` +
                    `${responseDetails ? `- Response details: ${responseDetails}\n` : ''}` +
                    `\nRecord this result and trigger any necessary follow-up actions.`,
            },
        ],
        response_format: { type: 'json_object' },
    });

    const result = response.choices[0].message.content;
    const parsed = JSON.parse(result);
    console.log(
        `   [tool] Logged: ${parsed.send_id} = ${parsed.status}, ` +
        `actions=${JSON.stringify(parsed.actions_taken)}\n`
    );
    return result;
}

// Map tool names to handler functions
const toolHandlers = {
    select_send_platform: async (args) =>
        selectSendPlatform(args.channel, args.touch_number, args.fit_score, args.priority),
    schedule_send: async (args) =>
        scheduleSend(args.contact_email, args.timezone_estimate, args.platform),
    check_deliverability: async (args) =>
        checkDeliverability(args.domain, args.daily_sends_so_far),
    log_send_result: async (args) =>
        logSendResult(args.send_id, args.status, args.response_details),
};

// ---------------------------------------------------------------------------
// ReAct-style agent loop
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT =
    `You are the Email Outreach agent, the final agent in iGrow's 6-agent pipeline. ` +
    `iGrow is "the flight simulator for the conversations that decide your career." ` +
    `Users rehearse high-stakes conversations — mock interviews, salary negotiations, ` +
    `difficult manager conversations — OUT LOUD with an AI that pushes back and scores ` +
    `them on SUBSTANCE via the ANCHOR scoring framework.\n\n` +
    `YOUR ROLE:\n` +
    `You receive QA-approved emails from the upstream QA agent and handle the sending ` +
    `mechanics. You NEVER write or modify email content — you send what was approved. ` +
    `Your job is to:\n` +
    `1. Select the right sending platform for each email\n` +
    `2. Check domain deliverability before any sends\n` +
    `3. Schedule sends within optimal delivery windows\n` +
    `4. Log every send result and handle bounces/failures\n\n` +
    `CRITICAL RULES:\n` +
    `- Warm-up limits: 30 emails/day first 2 weeks, 50/day steady state\n` +
    `- Send window: 8am-11am in recipient's local timezone\n` +
    `- Preferred days: Tuesday, Wednesday, Thursday\n` +
    `- Send delays: 3-5 minutes randomized between consecutive sends\n` +
    `- EMERGENCY STOP: Halt ALL sends if bounce rate > 5% or ANY spam complaint\n` +
    `- CAN-SPAM compliance: Process unsubscribe requests within 1 hour\n` +
    `- Manual-Gmail: Only for P1 priority with fit score >= 9 or CEO-level contacts\n\n` +
    `EXECUTION ORDER for each approved email:\n` +
    `1. check_deliverability — Verify domain health before sending\n` +
    `2. select_send_platform — Choose the right platform\n` +
    `3. schedule_send — Schedule within optimal window\n` +
    `4. log_send_result — Record the outcome\n\n` +
    `After processing all emails, report daily delivery metrics: total sent, ` +
    `platforms used, scheduled times, bounce/failure rates, and remaining daily capacity. ` +
    `Always think out loud before each action so the operator can follow your reasoning.`;

/**
 * Runs the email outreach agent for a batch of QA-approved emails.
 */
async function runEmailOutreachAgent(approvedEmails) {
    console.log('='.repeat(70));
    console.log('  iGrow — Email Outreach Agent (Final-Mile Delivery)');
    console.log('  Model: ' + MODEL);
    console.log('  Approved emails to send: ' + approvedEmails.length);
    console.log('='.repeat(70));

    const emailSummary = approvedEmails
        .map(
            (e, i) =>
                `${i + 1}. [${e.send_id}] To: ${e.contact_name} <${e.contact_email}> ` +
                `at ${e.organization} | Channel: ${e.channel} | Touch: ${e.touch_number} | ` +
                `Fit: ${e.fit_score}/10 | Priority: ${e.priority}\n` +
                `   Subject: ${e.subject}`
        )
        .join('\n');

    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
            role: 'user',
            content:
                `You have ${approvedEmails.length} QA-approved emails ready to send. ` +
                `Process each one through the full delivery pipeline (deliverability ` +
                `check -> platform selection -> scheduling -> send logging).\n\n` +
                `APPROVED EMAILS:\n${emailSummary}\n\n` +
                `Our sending domain is "outreach.igrow.co" and we have sent 12 emails ` +
                `so far today. Begin processing.`,
        },
    ];

    const MAX_ITERATIONS = 25;
    let iteration = 0;

    while (iteration < MAX_ITERATIONS) {
        iteration++;
        console.log(`\n--- Agent iteration ${iteration} ---`);

        const response = await client.chat.completions.create({
            model: MODEL,
            messages,
            tools,
            temperature: 0.4,
        });

        const choice = response.choices[0];
        const assistantMessage = choice.message;

        // Append the assistant's message to history
        messages.push(assistantMessage);

        // If the model produced text, print it
        if (assistantMessage.content) {
            console.log('\n' + assistantMessage.content);
        }

        // If the model wants to call tools, execute them
        if (choice.finish_reason === 'tool_calls' || assistantMessage.tool_calls?.length) {
            for (const toolCall of assistantMessage.tool_calls) {
                const fnName = toolCall.function.name;
                const fnArgs = JSON.parse(toolCall.function.arguments);

                const handler = toolHandlers[fnName];
                if (!handler) {
                    console.error(`   Unknown tool: ${fnName}`);
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: JSON.stringify({ error: `Unknown tool: ${fnName}` }),
                    });
                    continue;
                }

                const result = await handler(fnArgs);
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: result,
                });
            }
            // Continue the loop so the model can process tool results
            continue;
        }

        // If the model stopped naturally (no more tool calls), we're done
        if (choice.finish_reason === 'stop') {
            console.log('\n' + '='.repeat(70));
            console.log('  Agent finished.');
            console.log('='.repeat(70));
            break;
        }
    }

    if (iteration >= MAX_ITERATIONS) {
        console.log('\n  Warning: reached maximum iterations.');
    }

    console.log('\n' + '='.repeat(70));
    console.log('  Email outreach processing complete.');
    console.log('='.repeat(70));

    return messages;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const APPROVED_EMAILS = [
    {
        send_id: 'SEND-001',
        contact_name: 'Dr. Sarah Johnson',
        contact_email: 'sjohnson@tuskegee.edu',
        organization: 'Tuskegee University',
        channel: 'university',
        subject: 'Quick question about Tuskegee career prep',
        body: 'Dr. Johnson, I noticed Tuskegee Career Services runs an annual mock interview week...',
        touch_number: 1,
        fit_score: 8,
        priority: 'P1',
    },
    {
        send_id: 'SEND-002',
        contact_name: 'Mark Chen',
        contact_email: 'mchen@ccl.org',
        organization: 'Center for Creative Leadership',
        channel: 'partnership',
        subject: 'Between-sessions practice for CCL coaching clients',
        body: 'Mark, I noticed CCL uses 360-feedback methodology with Fortune 500 managers...',
        touch_number: 1,
        fit_score: 7,
        priority: 'P2',
    },
    {
        send_id: 'SEND-003',
        contact_name: 'Lisa Ramirez',
        contact_email: 'lramirez@acmecorp.com',
        organization: 'Acme Corp',
        channel: 'business',
        subject: 'Manager readiness for Acme\'s new leaders',
        body: 'Lisa, congrats on promoting 12 first-time managers in Q3...',
        touch_number: 1,
        fit_score: 6,
        priority: 'P2',
    },
];

runEmailOutreachAgent(APPROVED_EMAILS).catch((err) => {
    console.error('Error:', err.message);
    if (err.message.includes('API key') || err.message.includes('auth')) {
        console.error(
            '\nMake sure OPENAI_API_KEY is set in your .env file at the project root.'
        );
    }
    process.exit(1);
});
