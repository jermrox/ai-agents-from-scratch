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
            name: 'compose_personalized_email',
            description:
                'Compose a personalized outreach email for a verified lead. Uses channel-specific ' +
                'framing: University = free access for students, partnership not pitch. ' +
                'Partnership = between-sessions practice tool for coaching clients. ' +
                'Business = manager-readiness practice for new leaders.',
            parameters: {
                type: 'object',
                properties: {
                    contact_name: {
                        type: 'string',
                        description: 'Full name of the contact',
                    },
                    organization: {
                        type: 'string',
                        description: 'Name of their organization',
                    },
                    channel: {
                        type: 'string',
                        enum: ['university', 'partnership', 'business'],
                        description:
                            'Outreach channel determining email framing: ' +
                            '"university" for higher-ed free access, ' +
                            '"partnership" for coaching practice tool, ' +
                            '"business" for manager-readiness practice',
                    },
                    personalization_hook: {
                        type: 'string',
                        description:
                            'Specific detail about their org/role to weave into the email ' +
                            '(e.g., "runs annual mock interview week for 300+ students")',
                    },
                    touch_number: {
                        type: 'number',
                        description: 'Which touch in the sequence (1-4)',
                    },
                },
                required: ['contact_name', 'organization', 'channel', 'personalization_hook', 'touch_number'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'check_anti_spam_compliance',
            description:
                'Check an email draft against 14 anti-spam rules including: no ALL CAPS, ' +
                'no urgency language, no misleading subjects, under 200 words, conversational ' +
                'tone, single CTA, specific personalization, no attachments on first contact, ' +
                'max one hyperlink, no exclamation in subject, no fake tokens, no hype language, ' +
                'subject under 60 chars, plain text preferred. Returns compliance report with ' +
                'spam score 1-10 and overall verdict.',
            parameters: {
                type: 'object',
                properties: {
                    subject: {
                        type: 'string',
                        description: 'The email subject line',
                    },
                    body: {
                        type: 'string',
                        description: 'The full email body text',
                    },
                    touch_number: {
                        type: 'number',
                        description: 'Which touch in the sequence (1-4), affects certain rules',
                    },
                },
                required: ['subject', 'body', 'touch_number'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'generate_touch_sequence',
            description:
                'Generate a full 4-touch email sequence for a lead. Touch 1: value-first intro ' +
                '(120-180 words). Touch 2: different angle (100-150 words). Touch 3: social proof ' +
                '(100-150 words). Touch 4: graceful close (80-120 words). Each email is tailored ' +
                'to the contact and channel.',
            parameters: {
                type: 'object',
                properties: {
                    contact_name: {
                        type: 'string',
                        description: 'Full name of the contact',
                    },
                    organization: {
                        type: 'string',
                        description: 'Name of their organization',
                    },
                    channel: {
                        type: 'string',
                        enum: ['university', 'partnership', 'business'],
                        description: 'Outreach channel determining email framing',
                    },
                    context: {
                        type: 'string',
                        description:
                            'Research brief about the contact and organization — background, ' +
                            'role details, and personalization hooks to use across the sequence',
                    },
                },
                required: ['contact_name', 'organization', 'channel', 'context'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'revise_email',
            description:
                'Revise an email based on anti-spam compliance feedback. Takes the original email ' +
                'and the specific flags/suggestions from the compliance check, and returns a revised ' +
                'version that addresses all issues while preserving personalization and tone.',
            parameters: {
                type: 'object',
                properties: {
                    original_subject: {
                        type: 'string',
                        description: 'The original email subject line',
                    },
                    original_body: {
                        type: 'string',
                        description: 'The original email body text',
                    },
                    spam_flags: {
                        type: 'string',
                        description: 'JSON array of anti-spam issues found (from compliance check)',
                    },
                    suggestions: {
                        type: 'string',
                        description: 'JSON array of improvement suggestions (from compliance check)',
                    },
                },
                required: ['original_subject', 'original_body', 'spam_flags', 'suggestions'],
            },
        },
    },
];

// ---------------------------------------------------------------------------
// Tool implementations (nested LLM calls)
// ---------------------------------------------------------------------------

/**
 * Composes a personalized outreach email for a verified lead using
 * channel-specific framing. Uses a nested LLM call to generate the
 * email content with appropriate tone and structure.
 */
async function composePersonalizedEmail(contactName, organization, channel, personalizationHook, touchNumber) {
    console.log(`\n   [tool] compose_personalized_email("${contactName}", "${organization}", ch=${channel}, touch=${touchNumber})`);

    const channelFraming = {
        university:
            'Frame this as offering FREE ACCESS for students — a partnership exploration, ' +
            'not a sales pitch. Mention how iGrow fits into career services, mock interview ' +
            'prep, or leadership development curricula.',
        partnership:
            'Frame iGrow as a BETWEEN-SESSIONS PRACTICE TOOL for their coaching clients. ' +
            'Position it as extending their coaching methodology — clients rehearse difficult ' +
            'conversations between sessions and get substance-scored feedback.',
        business:
            'Frame iGrow as MANAGER-READINESS PRACTICE for new leaders. Position it as ' +
            'helping first-time managers rehearse difficult conversations (feedback, PIPs, ' +
            'conflict resolution) before having them for real.',
    };

    const touchGuidance = {
        1: 'Touch 1 — VALUE-FIRST INTRO (120-180 words). Lead with something specific about THEIR org. Introduce iGrow briefly. Single low-pressure CTA.',
        2: 'Touch 2 — DIFFERENT ANGLE (100-150 words). Reference the first email briefly. Approach from a new angle or use case. Keep it shorter.',
        3: 'Touch 3 — SOCIAL PROOF (100-150 words). Share a brief result or testimonial. Connect it to their specific situation.',
        4: 'Touch 4 — GRACEFUL CLOSE (80-120 words). Acknowledge you have been reaching out. Make one final, clear offer. Respect their time and close the door gently.',
    };

    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.7,
        messages: [
            {
                role: 'system',
                content:
                    `You are an expert email copywriter for iGrow (i-grow.co), the flight simulator ` +
                    `for the conversations that decide your career. Users rehearse high-stakes ` +
                    `conversations — mock interviews, salary negotiations, difficult manager ` +
                    `conversations — OUT LOUD with an AI that pushes back and scores them on ` +
                    `SUBSTANCE using the ANCHOR framework.\n\n` +
                    `CHANNEL FRAMING:\n${channelFraming[channel]}\n\n` +
                    `TOUCH GUIDANCE:\n${touchGuidance[touchNumber]}\n\n` +
                    `RULES:\n` +
                    `- Open with something specific to THIS person/org (use the personalization hook)\n` +
                    `- Keep tone warm, conversational, and concise\n` +
                    `- NO ALL CAPS, NO exclamation marks in subject, NO urgency language\n` +
                    `- Single clear CTA (reply or short call)\n` +
                    `- Maximum one hyperlink\n` +
                    `- Subject line under 60 characters\n` +
                    `- Plain text style (no HTML formatting)\n\n` +
                    `Return a JSON object with keys: "subject", "body", "word_count"`,
            },
            {
                role: 'user',
                content:
                    `Compose touch ${touchNumber} email for:\n` +
                    `- Contact: ${contactName}\n` +
                    `- Organization: ${organization}\n` +
                    `- Channel: ${channel}\n` +
                    `- Personalization hook: ${personalizationHook}`,
            },
        ],
        response_format: { type: 'json_object' },
    });

    const email = response.choices[0].message.content;
    const parsed = JSON.parse(email);
    console.log(`   [tool] Email composed: "${parsed.subject}" (${parsed.word_count} words)\n`);
    return email;
}

/**
 * Checks an email draft against 14 anti-spam rules using a nested LLM
 * call. Returns a detailed compliance report with pass/fail for each
 * rule, a spam score, and an overall verdict.
 */
async function checkAntiSpamCompliance(subject, body, touchNumber) {
    console.log(`\n   [tool] check_anti_spam_compliance("${subject.substring(0, 40)}...", touch=${touchNumber})`);

    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        messages: [
            {
                role: 'system',
                content:
                    `You are an email deliverability and anti-spam compliance expert. Analyze the ` +
                    `provided email against these 14 rules and report on each one:\n\n` +
                    `1. NO ALL CAPS — No words in all capitals (acronyms like "AI" are OK)\n` +
                    `2. NO URGENCY LANGUAGE — No "act now", "limited time", "don't miss", "hurry"\n` +
                    `3. NO MISLEADING SUBJECT — Subject must accurately reflect body content\n` +
                    `4. UNDER 200 WORDS — Body must be under 200 words\n` +
                    `5. CONVERSATIONAL TONE — Must read like a real person wrote it, not a template\n` +
                    `6. SINGLE CTA — One clear call to action, not multiple competing asks\n` +
                    `7. SPECIFIC PERSONALIZATION — Must reference something specific about the recipient\n` +
                    `8. NO ATTACHMENTS FIRST CONTACT — Touch 1 must not mention attachments\n` +
                    `9. MAX ONE HYPERLINK — At most one URL in the body\n` +
                    `10. NO EXCLAMATION IN SUBJECT — Subject line must not contain "!"\n` +
                    `11. NO FAKE TOKENS — No fake personalization like "{{first_name}}" or "[Company]"\n` +
                    `12. NO HYPE LANGUAGE — No "revolutionary", "game-changing", "incredible", "amazing"\n` +
                    `13. SUBJECT UNDER 60 CHARS — Subject line must be under 60 characters\n` +
                    `14. PLAIN TEXT PREFERRED — No HTML tags, rich formatting, or embedded images\n\n` +
                    `Touch number context: This is touch ${touchNumber} of a 4-touch sequence.\n` +
                    `Rule 8 (no attachments) applies strictly to touch 1.\n\n` +
                    `Return a JSON object with:\n` +
                    `- "rules": array of 14 objects, each with "rule_number", "rule_name", "passed" (boolean), "detail" (string)\n` +
                    `- "spam_score": number 1-10 (1 = definitely spam, 10 = fully compliant)\n` +
                    `- "verdict": "PASS" or "NEEDS_REVISION"\n` +
                    `- "flags": array of strings describing issues found (empty if clean)\n` +
                    `- "suggestions": array of specific improvement suggestions (empty if clean)`,
            },
            {
                role: 'user',
                content: `Subject: ${subject}\n\nBody:\n${body}`,
            },
        ],
        response_format: { type: 'json_object' },
    });

    const report = response.choices[0].message.content;
    const parsed = JSON.parse(report);
    const passCount = parsed.rules.filter(r => r.passed).length;
    console.log(`   [tool] Compliance: ${passCount}/14 rules passed | Score: ${parsed.spam_score}/10 | Verdict: ${parsed.verdict}\n`);
    return report;
}

/**
 * Generates a full 4-touch email sequence for a lead using a nested
 * LLM call. Each touch has specific word count targets and strategic
 * purpose.
 */
async function generateTouchSequence(contactName, organization, channel, context) {
    console.log(`\n   [tool] generate_touch_sequence("${contactName}", "${organization}", ch=${channel})`);

    const channelFraming = {
        university: 'free access for students — partnership exploration, not a pitch',
        partnership: 'between-sessions practice tool for coaching clients',
        business: 'manager-readiness practice for new leaders',
    };

    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.7,
        messages: [
            {
                role: 'system',
                content:
                    `You are an expert email sequence strategist for iGrow (i-grow.co), the flight ` +
                    `simulator for the conversations that decide your career. Voice-based mock ` +
                    `interviews that score substance via ANCHOR.\n\n` +
                    `Channel framing for ${channel}: ${channelFraming[channel]}\n\n` +
                    `Generate a complete 4-touch email sequence. Each touch must:\n` +
                    `- Have a unique subject line (under 60 chars, no "!" or ALL CAPS)\n` +
                    `- Reference something specific about the contact/org\n` +
                    `- Use warm, conversational tone\n` +
                    `- Have a single clear CTA\n` +
                    `- Max one hyperlink per email\n\n` +
                    `TOUCH STRUCTURE:\n` +
                    `Touch 1 — VALUE-FIRST INTRO (120-180 words): Lead with their specific ` +
                    `situation. Introduce iGrow briefly. Low-pressure CTA.\n` +
                    `Touch 2 — DIFFERENT ANGLE (100-150 words): Reference touch 1 briefly. ` +
                    `New angle or use case. Shorter and punchy.\n` +
                    `Touch 3 — SOCIAL PROOF (100-150 words): Brief result or testimonial. ` +
                    `Connect to their situation.\n` +
                    `Touch 4 — GRACEFUL CLOSE (80-120 words): Acknowledge prior outreach. ` +
                    `Final clear offer. Respect their time.\n\n` +
                    `Return a JSON object with:\n` +
                    `- "contact_name": string\n` +
                    `- "organization": string\n` +
                    `- "channel": string\n` +
                    `- "sequence": array of 4 objects, each with "touch_number", "subject", ` +
                    `"body", "word_count", "strategic_purpose", "suggested_send_delay" ` +
                    `(e.g., "Day 0", "Day 4", "Day 9", "Day 14")`,
            },
            {
                role: 'user',
                content:
                    `Generate a 4-touch sequence for:\n` +
                    `- Contact: ${contactName}\n` +
                    `- Organization: ${organization}\n` +
                    `- Channel: ${channel}\n` +
                    `- Context: ${context}`,
            },
        ],
        response_format: { type: 'json_object' },
    });

    const sequence = response.choices[0].message.content;
    const parsed = JSON.parse(sequence);
    console.log(`   [tool] Generated 4-touch sequence for ${contactName}:`);
    for (const touch of parsed.sequence) {
        console.log(`          Touch ${touch.touch_number}: "${touch.subject}" (${touch.word_count} words, ${touch.suggested_send_delay})`);
    }
    console.log();
    return sequence;
}

/**
 * Revises an email based on anti-spam compliance feedback using a
 * nested LLM call. Addresses all flagged issues while preserving
 * personalization and tone.
 */
async function reviseEmail(originalSubject, originalBody, spamFlags, suggestions) {
    console.log(`\n   [tool] revise_email("${originalSubject.substring(0, 40)}...")`);

    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.6,
        messages: [
            {
                role: 'system',
                content:
                    `You are an email revision specialist for iGrow (i-grow.co). Your job is to ` +
                    `fix anti-spam compliance issues in outreach emails while preserving the ` +
                    `personal touch and conversational tone.\n\n` +
                    `REVISION RULES:\n` +
                    `- Address EVERY flagged issue\n` +
                    `- Keep all specific personalization references\n` +
                    `- Maintain warm, human tone\n` +
                    `- Stay under 200 words\n` +
                    `- Keep subject under 60 characters with no "!"\n` +
                    `- Single CTA\n` +
                    `- Max one hyperlink\n` +
                    `- No ALL CAPS, no urgency, no hype language\n\n` +
                    `Return a JSON object with:\n` +
                    `- "revised_subject": the improved subject line\n` +
                    `- "revised_body": the improved body text\n` +
                    `- "word_count": number of words in revised body\n` +
                    `- "changes_made": array of strings describing each change\n` +
                    `- "flags_addressed": array of which original flags were fixed`,
            },
            {
                role: 'user',
                content:
                    `ORIGINAL EMAIL:\nSubject: ${originalSubject}\nBody: ${originalBody}\n\n` +
                    `SPAM FLAGS:\n${spamFlags}\n\n` +
                    `SUGGESTIONS:\n${suggestions}\n\n` +
                    `Please revise this email to address all issues.`,
            },
        ],
        response_format: { type: 'json_object' },
    });

    const revised = response.choices[0].message.content;
    const parsed = JSON.parse(revised);
    console.log(`   [tool] Revised: "${parsed.revised_subject}" (${parsed.word_count} words, ${parsed.changes_made.length} changes)\n`);
    return revised;
}

// Map tool names to handler functions
const toolHandlers = {
    compose_personalized_email: async (args) =>
        composePersonalizedEmail(args.contact_name, args.organization, args.channel, args.personalization_hook, args.touch_number),
    check_anti_spam_compliance: async (args) =>
        checkAntiSpamCompliance(args.subject, args.body, args.touch_number),
    generate_touch_sequence: async (args) =>
        generateTouchSequence(args.contact_name, args.organization, args.channel, args.context),
    revise_email: async (args) =>
        reviseEmail(args.original_subject, args.original_body, args.spam_flags, args.suggestions),
};

// ---------------------------------------------------------------------------
// ReAct-style agent loop
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT =
    `You are the Email Personalization agent for iGrow (i-grow.co), the flight simulator ` +
    `for the conversations that decide your career. iGrow offers voice-based mock interviews ` +
    `that score substance via the ANCHOR framework — users rehearse high-stakes conversations ` +
    `OUT LOUD with an AI that pushes back and scores them on WHAT THEY SAID, not delivery.\n\n` +
    `YOUR ROLE:\n` +
    `You are the centralized email composition agent in the iGrow 6-agent pipeline. You ` +
    `receive verified leads from the University Leads, Partnership Leads, and Business Leads ` +
    `agents, and compose personalized, anti-spam-compliant outreach emails for each.\n\n` +
    `REQUIREMENTS:\n` +
    `- Every email MUST reference specific details about the contact's organization or role\n` +
    `- Write 4-touch sequences when asked\n` +
    `- Check EVERY email against anti-spam rules before marking ready\n` +
    `- Include iGrow context naturally (not as a sales pitch)\n\n` +
    `CHANNEL FRAMING:\n` +
    `- University: free access for students — partnership exploration, not a pitch\n` +
    `- Partnership: between-sessions practice tool for coaching clients\n` +
    `- Business: manager-readiness practice for new leaders\n\n` +
    `PROCESS FOR EACH LEAD:\n` +
    `1. Review the lead context (name, org, channel, personalization hook)\n` +
    `2. Compose a personalized email using compose_personalized_email\n` +
    `3. Check anti-spam compliance using check_anti_spam_compliance\n` +
    `4. If NEEDS_REVISION, revise with revise_email and re-check\n` +
    `5. Mark as Ready for QA once the email passes compliance\n\n` +
    `Always think step by step and explain your reasoning before each action.\n` +
    `After processing all leads, provide a summary of all emails produced with their ` +
    `compliance status.`;

/**
 * Runs the Email Personalization agent for a batch of verified leads.
 */
async function runEmailPersonalizationAgent(leads) {
    console.log('='.repeat(70));
    console.log('  iGrow — Email Personalization Agent');
    console.log('  Model: ' + MODEL);
    console.log('  Leads: ' + leads.map(l => `${l.name} (${l.org})`).join(', '));
    console.log('='.repeat(70));

    const leadsDescription = leads
        .map(
            (l, i) =>
                `${i + 1}. ${l.name} at ${l.org} (channel: ${l.channel}, touch: ${l.touch})\n` +
                `   Hook: ${l.hook}`
        )
        .join('\n');

    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
            role: 'user',
            content:
                `Here are verified leads from the channel agents. For each lead, compose a ` +
                `personalized email, check it against anti-spam rules, and revise if needed.\n\n` +
                `VERIFIED LEADS:\n${leadsDescription}\n\n` +
                `Process each lead through the full compose -> check -> revise pipeline. ` +
                `Mark each email as Ready for QA once it passes compliance.`,
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

    return messages;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const VERIFIED_LEADS = [
    {
        name: 'Dr. Sarah Johnson',
        org: 'Tuskegee University',
        channel: 'university',
        hook: 'Career Services Office runs annual mock interview week for 300+ students',
        touch: 1,
    },
    {
        name: 'Mark Chen',
        org: 'Center for Creative Leadership',
        channel: 'partnership',
        hook: 'ICF-certified firm using 360-feedback methodology with Fortune 500 managers',
        touch: 1,
    },
    {
        name: 'Lisa Ramirez',
        org: 'Acme Corp',
        channel: 'business',
        hook: 'Recently promoted 12 first-time managers in Q3, runs internal leadership cohort',
        touch: 1,
    },
];

runEmailPersonalizationAgent(VERIFIED_LEADS).catch((err) => {
    console.error('Error:', err.message);
    if (err.message.includes('API key') || err.message.includes('auth')) {
        console.error(
            '\nMake sure OPENAI_API_KEY is set in your .env file at the project root.'
        );
    }
    process.exit(1);
});
