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
            name: 'research_university',
            description:
                'Research a small college or university to discover its leadership programs, ' +
                'student demographics, institutional mission, and key contacts. Returns a ' +
                'structured research brief.',
            parameters: {
                type: 'object',
                properties: {
                    university_name: {
                        type: 'string',
                        description: 'Full name of the university to research',
                    },
                },
                required: ['university_name'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'compose_email',
            description:
                'Compose a personalized outreach email based on a research brief. The email ' +
                'offers free access to the I Grow leadership app for a specific contact role.',
            parameters: {
                type: 'object',
                properties: {
                    research_brief: {
                        type: 'string',
                        description:
                            'The full research brief about the university (JSON string)',
                    },
                    contact_role: {
                        type: 'string',
                        description:
                            'Role of the person being emailed, e.g. "Director of Leadership Programs"',
                    },
                },
                required: ['research_brief', 'contact_role'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'review_email_for_spam',
            description:
                'Review a drafted email and flag any elements that could trigger spam ' +
                'filters or feel impersonal. Returns a pass/fail verdict with suggestions.',
            parameters: {
                type: 'object',
                properties: {
                    email_subject: {
                        type: 'string',
                        description: 'The subject line of the email',
                    },
                    email_body: {
                        type: 'string',
                        description: 'The full body of the email',
                    },
                },
                required: ['email_subject', 'email_body'],
            },
        },
    },
];

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

/**
 * Uses the LLM itself to produce a structured research brief about the
 * university. In a production system you would call a web-search API or
 * scrape the school's website; here we lean on the model's training data
 * to keep the example dependency-free.
 */
async function researchUniversity(universityName) {
    console.log(`\n   [tool] research_university("${universityName}")`);

    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        messages: [
            {
                role: 'system',
                content:
                    'You are a higher-education research analyst. Given a university name, ' +
                    'produce a concise JSON research brief. Focus on leadership-related ' +
                    'programs, student body size, mission statement themes, notable ' +
                    'initiatives, and the most likely department or office that oversees ' +
                    'leadership development. Be factual; if you are uncertain about a ' +
                    'detail, say so rather than fabricating it.',
            },
            {
                role: 'user',
                content:
                    `Research the following small college/university and return a JSON object ` +
                    `with these keys:\n` +
                    `- "name": full institution name\n` +
                    `- "location": city, state\n` +
                    `- "approx_enrollment": approximate total enrollment\n` +
                    `- "mission_themes": array of 2-4 mission keywords\n` +
                    `- "leadership_programs": array of objects {name, description}\n` +
                    `- "relevant_department": the department most likely to oversee leadership courses\n` +
                    `- "suggested_contact_role": a realistic role title to reach out to\n` +
                    `- "talking_points": array of 2-3 reasons I Grow would resonate here\n\n` +
                    `University: ${universityName}`,
            },
        ],
        response_format: { type: 'json_object' },
    });

    const brief = response.choices[0].message.content;
    console.log(`   [tool] Research brief generated (${brief.length} chars)\n`);
    return brief;
}

/**
 * Composes a personalized, non-spammy outreach email using the research
 * brief as context.
 */
async function composeEmail(researchBriefJson, contactRole) {
    console.log(`\n   [tool] compose_email(brief, "${contactRole}")`);

    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.7,
        messages: [
            {
                role: 'system',
                content:
                    `You are an email copywriter who specializes in authentic, relationship-first ` +
                    `outreach to university faculty and staff. You never write spam.\n\n` +
                    `RULES FOR THE EMAIL:\n` +
                    `- Open with something specific to THIS school (a program name, a mission ` +
                    `  phrase, a recent initiative). Never use generic openers.\n` +
                    `- Keep the tone warm, collegial, and concise (under 200 words for the body).\n` +
                    `- Mention "I Grow" by name and briefly describe it as a leadership-development ` +
                    `  app built for emerging leaders.\n` +
                    `- Include a small bulleted list (3-4 bullets) of what students/participants ` +
                    `  can engage with on I Grow:\n` +
                    `    * Self-paced leadership skill modules\n` +
                    `    * Personalized growth plans with milestone tracking\n` +
                    `    * Peer accountability circles\n` +
                    `    * Real-world leadership challenges and reflections\n` +
                    `- Offer COMPLIMENTARY access for a class or cohort — frame it as a ` +
                    `  partnership exploration, not a sales pitch.\n` +
                    `- Close with a low-pressure call to action (e.g., a 15-minute call or ` +
                    `  a reply).\n` +
                    `- Include a suggested follow-up timing (e.g., "If I don't hear back, ` +
                    `  I'll follow up in about two weeks").\n` +
                    `- Do NOT use all-caps, exclamation marks in the subject, urgency language, ` +
                    `  or "click here" links.\n\n` +
                    `Return a JSON object with keys: "subject", "body", "follow_up_timing".`,
            },
            {
                role: 'user',
                content:
                    `Research brief:\n${researchBriefJson}\n\n` +
                    `Compose an outreach email to the ${contactRole} at this institution.`,
            },
        ],
        response_format: { type: 'json_object' },
    });

    const email = response.choices[0].message.content;
    console.log(`   [tool] Email composed (${email.length} chars)\n`);
    return email;
}

/**
 * Reviews a drafted email against common spam signals and provides a
 * verdict plus actionable suggestions.
 */
async function reviewEmailForSpam(subject, body) {
    console.log(`\n   [tool] review_email_for_spam(...)`);

    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        messages: [
            {
                role: 'system',
                content:
                    `You are an email deliverability expert. Analyze the provided email for ` +
                    `spam signals and impersonal patterns.\n\n` +
                    `Check for:\n` +
                    `1. Spammy subject line (ALL CAPS, exclamation marks, urgency words like ` +
                    `   "ACT NOW", "FREE", "LIMITED TIME")\n` +
                    `2. Generic opening (e.g., "Dear Sir/Madam", "To Whom It May Concern")\n` +
                    `3. Excessive sales language or pressure tactics\n` +
                    `4. Missing personalization (no reference to the recipient's institution ` +
                    `   or role)\n` +
                    `5. Unrealistic promises or hype\n` +
                    `6. Too many links or "click here" phrases\n` +
                    `7. Overly long body (>300 words)\n\n` +
                    `Return a JSON object with:\n` +
                    `- "verdict": "PASS" or "NEEDS_REVISION"\n` +
                    `- "score": 1-10 (10 = feels completely authentic and personal)\n` +
                    `- "flags": array of issues found (empty if none)\n` +
                    `- "suggestions": array of improvement suggestions (empty if none)\n` +
                    `- "revised_subject": improved subject if needed, or null\n` +
                    `- "revised_body": improved body if needed, or null`,
            },
            {
                role: 'user',
                content:
                    `Subject: ${subject}\n\nBody:\n${body}`,
            },
        ],
        response_format: { type: 'json_object' },
    });

    const review = response.choices[0].message.content;
    const parsed = JSON.parse(review);
    console.log(`   [tool] Spam review verdict: ${parsed.verdict} (score: ${parsed.score}/10)\n`);
    return review;
}

// Map tool names to handler functions
const toolHandlers = {
    research_university: async (args) => researchUniversity(args.university_name),
    compose_email: async (args) => composeEmail(args.research_brief, args.contact_role),
    review_email_for_spam: async (args) => reviewEmailForSpam(args.email_subject, args.email_body),
};

// ---------------------------------------------------------------------------
// ReAct-style agent loop
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT =
    `You are a university outreach agent for "I Grow", a leadership-development app ` +
    `designed for emerging leaders, junior managers, and students in leadership courses.\n\n` +
    `YOUR MISSION:\n` +
    `For each university you are given, follow these steps IN ORDER:\n\n` +
    `1. RESEARCH  - Call research_university to learn about the school's leadership ` +
    `programs, mission, and the right person to contact.\n` +
    `2. COMPOSE   - Call compose_email with the research brief and the suggested ` +
    `contact role to draft a personalized outreach email.\n` +
    `3. REVIEW    - Call review_email_for_spam with the drafted subject and body to ` +
    `check for spam signals.\n` +
    `4. REVISE (if needed) - If the review says NEEDS_REVISION, revise the email ` +
    `using the suggestions and call review_email_for_spam again.\n` +
    `5. PRESENT   - Once the email passes review, output the final email with the ` +
    `subject, body, and follow-up timing clearly formatted.\n\n` +
    `IMPORTANT CONTEXT:\n` +
    `- Focus on SMALL colleges and universities (under ~5,000 students).\n` +
    `- The outreach offers FREE / complimentary access — this is a partnership ` +
    `exploration, not a sales pitch.\n` +
    `- Emails must feel personal and specific to each school. Generic emails are ` +
    `unacceptable.\n` +
    `- Always think out loud before each action so the user can follow your reasoning.\n\n` +
    `After you finish ALL universities, write a brief summary of what was produced.`;

/**
 * Runs the agent loop for a batch of universities.
 */
async function runOutreachAgent(universities) {
    console.log('='.repeat(70));
    console.log('  I Grow — University Outreach Agent');
    console.log('  Model: ' + MODEL);
    console.log('  Universities: ' + universities.join(', '));
    console.log('='.repeat(70));

    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
            role: 'user',
            content:
                `Please research the following small universities and compose personalized ` +
                `outreach emails for each one:\n\n` +
                universities.map((u, i) => `${i + 1}. ${u}`).join('\n') +
                `\n\nFor each school, follow the full research -> compose -> review pipeline.`,
        },
    ];

    const MAX_ITERATIONS = 25; // generous limit for 3 universities
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

const TARGET_UNIVERSITIES = [
    'Tuskegee University',
    'Berea College',
    'Fort Valley State University',
];

runOutreachAgent(TARGET_UNIVERSITIES).catch((err) => {
    console.error('Error:', err.message);
    if (err.message.includes('API key') || err.message.includes('auth')) {
        console.error(
            '\nMake sure OPENAI_API_KEY is set in your .env file at the project root.'
        );
    }
    process.exit(1);
});
