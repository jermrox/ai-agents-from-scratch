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
            name: 'run_spam_analysis',
            description:
                'Analyze an email for spam triggers. Returns a spam score from 1-10 and ' +
                'a list of specific flags such as ALL CAPS, urgency language, misleading ' +
                'subject lines, salesy tone, multiple CTAs, and other deliverability risks.',
            parameters: {
                type: 'object',
                properties: {
                    subject: {
                        type: 'string',
                        description: 'The email subject line to analyze',
                    },
                    body: {
                        type: 'string',
                        description: 'The full email body to analyze',
                    },
                },
                required: ['subject', 'body'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'check_personalization_quality',
            description:
                'Verify that an email contains genuine, specific personalization. Checks ' +
                'that the email references the specific organization by name, mentions ' +
                'something specific to their role or program, and does not rely on generic templates.',
            parameters: {
                type: 'object',
                properties: {
                    body: {
                        type: 'string',
                        description: 'The full email body to check',
                    },
                    organization: {
                        type: 'string',
                        description: 'The target organization name',
                    },
                    contact_name: {
                        type: 'string',
                        description: 'The name of the contact being emailed',
                    },
                    channel: {
                        type: 'string',
                        description: 'The outreach channel (e.g. "university", "partnership", "coaching")',
                    },
                },
                required: ['body', 'organization', 'contact_name', 'channel'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'verify_length_and_structure',
            description:
                'Check that an email meets word count limits and structural requirements ' +
                'for its touch number. Touch 1: 120-180 words, Touch 2: 100-150 words, ' +
                'Touch 3: 100-150 words, Touch 4: 80-120 words. Also verifies exactly one CTA.',
            parameters: {
                type: 'object',
                properties: {
                    body: {
                        type: 'string',
                        description: 'The full email body to verify',
                    },
                    touch_number: {
                        type: 'number',
                        description: 'The touch sequence number (1-4)',
                    },
                },
                required: ['body', 'touch_number'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'issue_verdict',
            description:
                'Issue a final QA verdict based on all accumulated checks. Returns Pass ' +
                '(send to Email Outreach), Revise (return to Personalization with notes), ' +
                'or Fail (block with explanation).',
            parameters: {
                type: 'object',
                properties: {
                    spam_score: {
                        type: 'number',
                        description: 'Spam score from run_spam_analysis (1-10)',
                    },
                    personalization_verdict: {
                        type: 'string',
                        description: 'Pass or Fail from check_personalization_quality',
                    },
                    length_pass: {
                        type: 'boolean',
                        description: 'Whether the email passed length verification',
                    },
                    cta_pass: {
                        type: 'boolean',
                        description: 'Whether the email has exactly one CTA',
                    },
                    contact_verified: {
                        type: 'boolean',
                        description: 'Whether the contact has been verified',
                    },
                    tone_issues: {
                        type: 'string',
                        description: 'JSON array of any tone issues found',
                    },
                },
                required: [
                    'spam_score',
                    'personalization_verdict',
                    'length_pass',
                    'cta_pass',
                    'contact_verified',
                    'tone_issues',
                ],
            },
        },
    },
];

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

/**
 * Uses the LLM to analyze an email for spam triggers. In a production system
 * you might call a dedicated spam-scoring API; here we leverage the model's
 * knowledge of email deliverability best practices.
 */
async function runSpamAnalysis(subject, body) {
    console.log(`\n   [tool] run_spam_analysis("${subject.substring(0, 40)}...")`);  

    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        messages: [
            {
                role: 'system',
                content:
                    'You are an email deliverability expert. Analyze the provided email for ' +
                    'spam triggers and return a detailed assessment.\n\n' +
                    'Check for ALL of the following flags:\n' +
                    '- ALL CAPS words or phrases\n' +
                    '- Urgency language ("act now", "limited time", "don\'t miss out")\n' +
                    '- Misleading subject line (subject does not match body content)\n' +
                    '- Body too long (over 250 words for cold outreach)\n' +
                    '- Salesy tone (pushy, promotional language)\n' +
                    '- Multiple CTAs (more than one ask)\n' +
                    '- Generic personalization ("Dear Sir/Madam", no specific references)\n' +
                    '- Attachment references\n' +
                    '- Too many links (more than 2)\n' +
                    '- Exclamation marks in subject line\n' +
                    '- Fake scarcity or social proof tokens\n' +
                    '- Hype words ("revolutionary", "game-changing", "incredible")\n' +
                    '- Subject line too long (over 60 characters)\n' +
                    '- Excessive HTML formatting references\n\n' +
                    'Return a JSON object with:\n' +
                    '- "spam_score": number 1-10 (1 = clean, 10 = definite spam)\n' +
                    '- "flags": array of specific flag strings that were triggered\n' +
                    '- "flag_details": object mapping each flag to the specific text that triggered it\n' +
                    '- "summary": one-sentence overall assessment',
            },
            {
                role: 'user',
                content: `Subject: ${subject}\n\nBody:\n${body}`,
            },
        ],
        response_format: { type: 'json_object' },
    });

    const result = response.choices[0].message.content;
    const parsed = JSON.parse(result);
    console.log(`   [tool] Spam score: ${parsed.spam_score}/10 | Flags: ${parsed.flags.length}\n`);
    return result;
}

/**
 * Uses the LLM to verify that the email contains genuine, specific
 * personalization rather than generic template language.
 */
async function checkPersonalizationQuality(body, organization, contactName, channel) {
    console.log(`\n   [tool] check_personalization_quality("${organization}", "${contactName}")`);  

    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        messages: [
            {
                role: 'system',
                content:
                    'You are a personalization quality auditor for outreach emails. Your job ' +
                    'is to verify that an email contains genuine, specific personalization — ' +
                    'not generic template language.\n\n' +
                    'Check the following criteria:\n' +
                    '1. The email must reference the specific organization by name (not just ' +
                    '   in the greeting, but in the body content)\n' +
                    '2. The email must mention something specific to the contact\'s role, ' +
                    '   program, or institution (a program name, a statistic, a mission ' +
                    '   phrase, or a recent initiative)\n' +
                    '3. The email must NOT use generic template language ("Dear Sir/Madam", ' +
                    '   "To Whom It May Concern", "your organization", "your company")\n' +
                    '4. The personalization must feel researched, not surface-level\n\n' +
                    'Return a JSON object with:\n' +
                    '- "personalization_verdict": "Pass" or "Fail"\n' +
                    '- "specific_references_found": array of specific references found in the email\n' +
                    '- "generic_flags": array of generic or template language found\n' +
                    '- "reasoning": brief explanation of the verdict',
            },
            {
                role: 'user',
                content:
                    `Organization: ${organization}\n` +
                    `Contact: ${contactName}\n` +
                    `Channel: ${channel}\n\n` +
                    `Email body:\n${body}`,
            },
        ],
        response_format: { type: 'json_object' },
    });

    const result = response.choices[0].message.content;
    const parsed = JSON.parse(result);
    console.log(`   [tool] Personalization: ${parsed.personalization_verdict} | ` +
        `Refs: ${parsed.specific_references_found.length} | ` +
        `Generic flags: ${parsed.generic_flags.length}\n`);
    return result;
}

/**
 * Verifies that the email meets word count limits and structural requirements
 * for its touch number in the outreach sequence.
 */
async function verifyLengthAndStructure(body, touchNumber) {
    console.log(`\n   [tool] verify_length_and_structure(touch=${touchNumber})`);  

    const limits = {
        1: { min: 120, max: 180 },
        2: { min: 100, max: 150 },
        3: { min: 100, max: 150 },
        4: { min: 80, max: 120 },
    };

    const limit = limits[touchNumber] || limits[1];
    const wordCount = body.split(/\s+/).filter((w) => w.length > 0).length;
    const lengthPass = wordCount >= limit.min && wordCount <= limit.max;

    // Use LLM to check structural issues (CTA count, formatting)
    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        messages: [
            {
                role: 'system',
                content:
                    'You are an email structure auditor. Analyze the email body for ' +
                    'structural issues.\n\n' +
                    'Check for:\n' +
                    '1. Number of CTAs (calls to action) — there should be exactly ONE\n' +
                    '2. Paragraph structure — should be scannable, not a wall of text\n' +
                    '3. Greeting and sign-off present\n' +
                    '4. Bullet points used appropriately (if present)\n' +
                    '5. No broken formatting or placeholder tokens\n\n' +
                    'Return a JSON object with:\n' +
                    '- "cta_count": number of distinct calls to action found\n' +
                    '- "cta_text": array of the CTA text found\n' +
                    '- "structure_issues": array of structural problems found (empty if none)\n' +
                    '- "has_greeting": boolean\n' +
                    '- "has_signoff": boolean',
            },
            {
                role: 'user',
                content: `Email body:\n${body}`,
            },
        ],
        response_format: { type: 'json_object' },
    });

    const structureResult = JSON.parse(response.choices[0].message.content);
    const ctaPass = structureResult.cta_count === 1;

    const result = JSON.stringify({
        word_count: wordCount,
        limit: `${limit.min}-${limit.max}`,
        length_pass: lengthPass,
        cta_count: structureResult.cta_count,
        cta_pass: ctaPass,
        cta_text: structureResult.cta_text,
        structure_issues: structureResult.structure_issues,
        has_greeting: structureResult.has_greeting,
        has_signoff: structureResult.has_signoff,
    });

    console.log(`   [tool] Words: ${wordCount} (limit ${limit.min}-${limit.max}) | ` +
        `${lengthPass ? 'PASS' : 'FAIL'} | CTAs: ${structureResult.cta_count}\n`);
    return result;
}

/**
 * Issues a final QA verdict based on all accumulated check results.
 * Pass = send to Email Outreach, Revise = return to Personalization,
 * Fail = block the email.
 */
async function issueVerdict(spamScore, personalizationVerdict, lengthPass, ctaPass, contactVerified, toneIssues) {
    console.log(`\n   [tool] issue_verdict(spam=${spamScore}, pers=${personalizationVerdict}, ` +
        `len=${lengthPass}, cta=${ctaPass}, contact=${contactVerified})`);  

    let toneIssuesParsed;
    try {
        toneIssuesParsed = JSON.parse(toneIssues);
    } catch {
        toneIssuesParsed = [];
    }

    // Determine verdict based on rules
    const checks = {
        spam: spamScore <= 3,
        personalization: personalizationVerdict === 'Pass',
        length: lengthPass,
        cta: ctaPass,
        contact: contactVerified,
        tone: toneIssuesParsed.length === 0,
    };

    const failedChecks = Object.entries(checks)
        .filter(([, passed]) => !passed)
        .map(([name]) => name);

    let verdict;
    const notes = [];

    if (spamScore >= 7 || failedChecks.length >= 2) {
        verdict = 'Fail';
        notes.push('Email blocked — multiple critical issues detected.');
    } else if (spamScore >= 4 || failedChecks.length === 1) {
        verdict = 'Revise';
        notes.push('Email needs revision before sending.');
    } else {
        verdict = 'Pass';
        notes.push('Email approved for sending via Email Outreach agent.');
    }

    // Build detailed notes for each failed check
    if (!checks.spam) {
        notes.push(`Spam score ${spamScore}/10 is too high (max 3 for Pass, 6 for Revise).`);
    }
    if (!checks.personalization) {
        notes.push('Personalization check failed — email lacks specific references to the organization or contact.');
    }
    if (!checks.length) {
        notes.push('Word count is outside the acceptable range for this touch number.');
    }
    if (!checks.cta) {
        notes.push('Email must contain exactly one clear call to action.');
    }
    if (!checks.contact) {
        notes.push('Contact has not been verified — cannot send to an unverified recipient.');
    }
    if (!checks.tone) {
        notes.push(`Tone issues found: ${toneIssuesParsed.join(', ')}`);
    }

    const result = JSON.stringify({
        verdict,
        spam_score: spamScore,
        checks_passed: Object.entries(checks)
            .filter(([, passed]) => passed)
            .map(([name]) => name),
        checks_failed: failedChecks,
        notes,
    });

    const icon = verdict === 'Pass' ? 'APPROVED' : verdict === 'Revise' ? 'REVISION NEEDED' : 'BLOCKED';
    console.log(`   [tool] Verdict: ${icon} | Failed: ${failedChecks.length} checks\n`);
    return result;
}

// Map tool names to handler functions
const toolHandlers = {
    run_spam_analysis: async (args) => runSpamAnalysis(args.subject, args.body),
    check_personalization_quality: async (args) =>
        checkPersonalizationQuality(args.body, args.organization, args.contact_name, args.channel),
    verify_length_and_structure: async (args) =>
        verifyLengthAndStructure(args.body, args.touch_number),
    issue_verdict: async (args) =>
        issueVerdict(
            args.spam_score,
            args.personalization_verdict,
            args.length_pass,
            args.cta_pass,
            args.contact_verified,
            args.tone_issues
        ),
};

// ---------------------------------------------------------------------------
// ReAct-style agent loop
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT =
    'You are the QA/QC Check agent in the iGrow outreach pipeline. iGrow is ' +
    '"the flight simulator for the conversations that decide your career." It ' +
    'offers voice-based mock interviews that score substance via the ANCHOR ' +
    'framework.\n\n' +
    'YOUR ROLE:\n' +
    'Review every email from the Email Personalization agent before it can be ' +
    'sent. No email leaves the pipeline without your approval.\n\n' +
    'APPLY THIS 6-POINT CHECKLIST TO EVERY EMAIL:\n\n' +
    '1. SPAM SCORE — Call run_spam_analysis to check for spam triggers. The ' +
    '   email must score 3 or below to pass cleanly.\n' +
    '2. PERSONALIZATION QUALITY — Call check_personalization_quality to verify ' +
    '   the email contains genuine, specific references to the organization ' +
    '   and contact, not generic templates.\n' +
    '3. LENGTH COMPLIANCE — Call verify_length_and_structure to confirm the ' +
    '   email meets word count limits for its touch number.\n' +
    '4. CTA CLARITY — The length/structure check also counts CTAs. There must ' +
    '   be exactly one clear call to action.\n' +
    '5. CONTACT VERIFICATION — Use the contact_verified flag provided with ' +
    '   the email. If the contact is not verified, this check fails.\n' +
    '6. TONE ALIGNMENT — Review the spam analysis flags for tone issues ' +
    '   (salesy, pushy, hype words). The tone must be warm and collegial.\n\n' +
    'After running all checks, call issue_verdict with the aggregated results.\n\n' +
    'VERDICTS:\n' +
    '- Pass — Send the email to the Email Outreach agent for delivery.\n' +
    '- Revise — Return the email to the Email Personalization agent with ' +
    '  specific revision notes.\n' +
    '- Fail — Block the email entirely with a clear explanation of why.\n\n' +
    'Think through each check systematically. Always explain your reasoning ' +
    'before issuing a verdict.';

/**
 * Runs the QA/QC agent loop for a batch of emails to review.
 */
async function runQAQCAgent(emails) {
    console.log('='.repeat(70));
    console.log('  iGrow — QA/QC Check Agent');
    console.log('  Model: ' + MODEL);
    console.log('  Emails to review: ' + emails.length);
    console.log('='.repeat(70));

    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
            role: 'user',
            content:
                'Please review the following emails and issue a QA verdict for each one. ' +
                'Apply the full 6-point checklist to every email.\n\n' +
                emails
                    .map(
                        (e, i) =>
                            `--- EMAIL ${i + 1} ---\n` +
                            `Subject: ${e.subject}\n` +
                            `To: ${e.contact} at ${e.org}\n` +
                            `Channel: ${e.channel}\n` +
                            `Touch: ${e.touch}\n` +
                            `Contact Verified: ${e.contact_verified}\n` +
                            `Body:\n${e.body}\n`
                    )
                    .join('\n'),
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
            console.log('  QA/QC review complete.');
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

const EMAILS_TO_REVIEW = [
    {
        subject: 'Quick question about Tuskegee career prep',
        body: 'Dr. Johnson,\n\nI noticed Tuskegee Career Services runs an annual mock interview week for 300+ students. I work with a tool called I Grow that gives students unlimited voice-based practice for exactly those conversations.\n\nStudents can:\n- Rehearse mock interviews with AI that pushes back\n- Practice salary negotiations before real offers\n- Get scored on what they said, not filler words\n\nAccess would be free for your students. Would you be open to a 15-minute conversation about whether this fits your program?\n\nBest,\nJeremy',
        contact: 'Dr. Sarah Johnson',
        org: 'Tuskegee University',
        channel: 'university',
        touch: 1,
        contact_verified: true,
    },
    {
        subject: 'AMAZING OPPORTUNITY for your coaching clients!!!',
        body: 'Dear Sir/Madam,\n\nWe have an INCREDIBLE tool that will REVOLUTIONIZE how your clients practice conversations. This LIMITED TIME offer gives FREE access to our GAME-CHANGING platform. Click here to learn more: link1.com, link2.com, link3.com.\n\nDon\'t miss out on this amazing opportunity! Act now before spots fill up!\n\nSign up today,\nThe Team',
        contact: 'Mark Chen',
        org: 'Center for Creative Leadership',
        channel: 'partnership',
        touch: 1,
        contact_verified: false,
    },
];

runQAQCAgent(EMAILS_TO_REVIEW).catch((err) => {
    console.error('Error:', err.message);
    if (err.message.includes('API key') || err.message.includes('auth')) {
        console.error(
            '\nMake sure OPENAI_API_KEY is set in your .env file at the project root.'
        );
    }
    process.exit(1);
});
