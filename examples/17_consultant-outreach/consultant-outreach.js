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
            name: 'research_consulting_firm',
            description:
                'Research a leadership coaching or consulting firm to discover its ' +
                'methodologies, programs, client types, coaching approach, and key ' +
                'differentiators. Returns a structured research brief.',
            parameters: {
                type: 'object',
                properties: {
                    firm_name: {
                        type: 'string',
                        description: 'Full name of the consulting firm to research',
                    },
                    website: {
                        type: 'string',
                        description: 'Website URL of the consulting firm',
                    },
                },
                required: ['firm_name', 'website'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'compose_email',
            description:
                'Compose a personalized outreach email to a leadership coach or ' +
                'consulting firm contact, positioning iGrow as a between-sessions ' +
                'practice tool for their coaching clients.',
            parameters: {
                type: 'object',
                properties: {
                    contact_name: {
                        type: 'string',
                        description: 'Full name of the person being emailed',
                    },
                    firm_name: {
                        type: 'string',
                        description: 'Name of the consulting firm',
                    },
                    contact_title: {
                        type: 'string',
                        description:
                            'Title or role of the person being emailed, e.g. "Founder & Executive Coach"',
                    },
                    specific_methodology: {
                        type: 'string',
                        description:
                            'A specific methodology, program, or approach the firm uses that iGrow complements',
                    },
                },
                required: ['contact_name', 'firm_name', 'contact_title', 'specific_methodology'],
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
    {
        type: 'function',
        function: {
            name: 'recommend_lead_gen_tools',
            description:
                'Recommend AI-powered lead generation tools for executing consultant ' +
                'outreach campaigns at scale. Selects the best combination of tools ' +
                'based on the campaign stage and budget, drawing from the ' +
                'awesome-ai-lead-generation toolchain ' +
                '(https://github.com/toofast1/awesome-ai-lead-generation).',
            parameters: {
                type: 'object',
                properties: {
                    campaign_stage: {
                        type: 'string',
                        enum: ['prospecting', 'enrichment', 'outreach', 'monitoring'],
                        description:
                            'The current stage of the outreach campaign: ' +
                            '"prospecting" for finding leads, ' +
                            '"enrichment" for building detailed prospect profiles, ' +
                            '"outreach" for sending personalized emails at scale, ' +
                            '"monitoring" for tracking responses and brand mentions.',
                    },
                    budget: {
                        type: 'string',
                        enum: ['free', 'starter', 'growth'],
                        description:
                            'Budget tier: "free" for no-cost tools only, ' +
                            '"starter" for under $100/mo total, ' +
                            '"growth" for $100-500/mo total.',
                    },
                },
                required: ['campaign_stage', 'budget'],
            },
        },
    },
];

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

/**
 * Uses the LLM itself to produce a structured research brief about the
 * consulting firm. In a production system you would call a web-search API or
 * scrape the firm's website; here we lean on the model's training data
 * to keep the example dependency-free.
 */
async function researchConsultingFirm(firmName, website) {
    console.log(`\n   [tool] research_consulting_firm("${firmName}", "${website}")`);

    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        messages: [
            {
                role: 'system',
                content:
                    'You are a leadership coaching and consulting industry analyst. Given a ' +
                    'firm name and website, produce a concise JSON research brief. Focus on ' +
                    'their specific methodologies, coaching programs, client types, key ' +
                    'differentiators, and coaching approach. Be factual; if you are uncertain ' +
                    'about a detail, say so rather than fabricating it.',
            },
            {
                role: 'user',
                content:
                    `Research the following leadership coaching/consulting firm and return a JSON object ` +
                    `with these keys:\n` +
                    `- "firm_name": full firm name\n` +
                    `- "website": firm website\n` +
                    `- "location": city, state\n` +
                    `- "firm_overview": 2-3 sentence summary of what the firm does\n` +
                    `- "specific_methodologies": array of objects {name, description} for their coaching methodologies or frameworks\n` +
                    `- "key_programs": array of their main programs or service offerings\n` +
                    `- "client_types": array of typical client types (e.g., "C-suite executives", "emerging leaders")\n` +
                    `- "coaching_approach": brief description of how they deliver coaching\n` +
                    `- "key_differentiators": array of 2-3 things that set them apart\n` +
                    `- "igrow_fit": array of 2-3 reasons iGrow's conversation rehearsal and ANCHOR scoring would complement their coaching as a between-sessions practice tool\n\n` +
                    `Firm: ${firmName}\nWebsite: ${website}`,
            },
        ],
        response_format: { type: 'json_object' },
    });

    const brief = response.choices[0].message.content;
    console.log(`   [tool] Research brief generated (${brief.length} chars)\n`);
    return brief;
}

/**
 * Composes a personalized, non-spammy outreach email using the firm research
 * and contact details as context.
 */
async function composeEmail(contactName, firmName, contactTitle, specificMethodology) {
    console.log(`\n   [tool] compose_email("${contactName}", "${firmName}", "${contactTitle}", "${specificMethodology}")`);

    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.7,
        messages: [
            {
                role: 'system',
                content:
                    `You are an email copywriter who specializes in authentic, relationship-first ` +
                    `outreach to leadership coaches and consulting firms. You never write spam.\n\n` +
                    `RULES FOR THE EMAIL:\n` +
                    `- Open with something specific to THIS firm (a methodology name, a program, ` +
                    `  their coaching philosophy). Never use generic openers.\n` +
                    `- Keep the tone warm, peer-to-peer, and concise (under 200 words for the body).\n` +
                    `- Mention "iGrow" (i-grow.co) by name and briefly describe it as the flight ` +
                    `  simulator for the conversations that decide your career — clients rehearse ` +
                    `  high-stakes conversations out loud with AI that pushes back and scores ` +
                    `  their substance using the ANCHOR scoring framework.\n` +
                    `- Position iGrow as a between-sessions practice tool that extends the coach's ` +
                    `  impact — clients get unlimited reps between sessions.\n` +
                    `- Include a small bulleted list (4 bullets) of what coaching clients can do ` +
                    `  with iGrow:\n` +
                    `    * Voice-based conversation rehearsal between coaching sessions — AI pushes back like a real counterpart\n` +
                    `    * Salary negotiation, difficult feedback, and high-stakes dialogue practice on demand\n` +
                    `    * ANCHOR-scored feedback on substance the coach can review with their client\n` +
                    `    * Unlimited reps — clients practice as often as they want, not just during sessions\n` +
                    `- Offer complimentary access for a cohort of their clients — frame it as a ` +
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
                    `Contact name: ${contactName}\n` +
                    `Firm: ${firmName}\n` +
                    `Contact title: ${contactTitle}\n` +
                    `Specific methodology/program to reference: ${specificMethodology}\n\n` +
                    `Compose an outreach email to this coach/consultant positioning iGrow ` +
                    `as a between-sessions practice tool for their clients.`,
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
                    `4. Missing personalization (no reference to the recipient's firm ` +
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

/**
 * Recommends AI lead generation tools from the awesome-ai-lead-generation
 * toolchain (https://github.com/toofast1/awesome-ai-lead-generation) based
 * on the campaign stage and budget. Uses a nested LLM call to select and
 * rank the best combination of tools.
 */
async function recommendLeadGenTools(campaignStage, budget) {
    console.log(`\n   [tool] recommend_lead_gen_tools("${campaignStage}", "${budget}")`);

    const toolCatalog = JSON.stringify({
        data_scraping_and_enrichment: [
            {
                name: 'Apollo',
                url: 'https://apollo.io',
                description: 'B2B contact database for finding coaches and consultants at leadership firms',
                pricing: 'Free tier available, paid from $49/mo',
                best_for: ['prospecting', 'enrichment'],
            },
            {
                name: 'Clay',
                url: 'https://clay.com',
                description: 'AI-enriched spreadsheets for building consultant prospect lists',
                pricing: 'Free tier available, paid from $149/mo',
                best_for: ['enrichment'],
            },
            {
                name: 'PhantomBuster',
                url: 'https://phantombuster.com',
                description: 'LinkedIn automation for coaching firm founder and partner profiles',
                pricing: 'Free trial, paid from $69/mo',
                best_for: ['prospecting', 'enrichment'],
            },
            {
                name: 'Vibe Prospecting',
                url: 'https://vibeprospecting.ai',
                description: 'Natural-language prospecting — describe your ideal lead and get matches',
                pricing: 'Starter plans from $39/mo',
                best_for: ['prospecting'],
            },
        ],
        cold_outreach_and_email_ai: [
            {
                name: 'Instantly',
                url: 'https://instantly.ai',
                description: 'Unlimited email accounts with AI warm-up for cold outreach at scale',
                pricing: 'From $30/mo',
                best_for: ['outreach'],
            },
            {
                name: 'Lavender',
                url: 'https://lavender.ai',
                description: 'AI email coaching and grading — scores emails before you send',
                pricing: 'Free tier available, paid from $29/mo',
                best_for: ['outreach'],
            },
            {
                name: 'Lemlist',
                url: 'https://lemlist.com',
                description: 'Personalized outreach with custom images and video for higher reply rates',
                pricing: 'From $59/mo',
                best_for: ['outreach'],
            },
            {
                name: 'Smartlead',
                url: 'https://smartlead.ai',
                description: 'Deliverability infrastructure — mailbox rotation, warm-up, and unified inbox',
                pricing: 'From $39/mo',
                best_for: ['outreach'],
            },
        ],
        ai_copywriting_and_personalization: [
            {
                name: 'Warmer.ai',
                url: 'https://warmer.ai',
                description: 'Generates personalized email intro lines from prospect websites and LinkedIn',
                pricing: 'From $59/mo',
                best_for: ['outreach', 'enrichment'],
            },
            {
                name: 'Copy.ai',
                url: 'https://copy.ai',
                description: 'AI marketing copy at scale — subject lines, email bodies, follow-ups',
                pricing: 'Free tier available, paid from $49/mo',
                best_for: ['outreach'],
            },
        ],
        social_listening: [
            {
                name: 'GummySearch',
                url: 'https://gummysearch.com',
                description: 'Reddit monitoring for leadership coaching and executive development discussions',
                pricing: 'From $48/mo',
                best_for: ['monitoring', 'prospecting'],
            },
            {
                name: 'Awario',
                url: 'https://awario.com',
                description: 'Brand and keyword monitoring across social media, news, and web',
                pricing: 'From $49/mo',
                best_for: ['monitoring'],
            },
        ],
    });

    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        messages: [
            {
                role: 'system',
                content:
                    `You are an AI lead generation strategist specializing in consultant and ` +
                    `coaching firm outreach. You have deep knowledge of the tools listed in the ` +
                    `awesome-ai-lead-generation repository ` +
                    `(https://github.com/toofast1/awesome-ai-lead-generation).\n\n` +
                    `Given a campaign stage and budget tier, recommend the best combination of ` +
                    `tools from the provided catalog. For each recommendation, explain WHY it ` +
                    `fits the specific use case of consultant outreach for a leadership coaching app.\n\n` +
                    `Budget tiers:\n` +
                    `- "free": Only tools with free tiers; total spend $0/mo\n` +
                    `- "starter": Up to ~$100/mo total across all tools\n` +
                    `- "growth": Up to ~$500/mo total across all tools\n\n` +
                    `Return a JSON object with:\n` +
                    `- "stage": the campaign stage\n` +
                    `- "budget": the budget tier\n` +
                    `- "recommended_stack": array of objects, each with:\n` +
                    `    - "tool": tool name\n` +
                    `    - "url": tool URL\n` +
                    `    - "category": which category it belongs to\n` +
                    `    - "monthly_cost": estimated monthly cost for this use case\n` +
                    `    - "why": 1-2 sentences on why this tool fits consultant outreach\n` +
                    `    - "priority": "essential" or "nice_to_have"\n` +
                    `- "total_estimated_cost": sum of monthly costs\n` +
                    `- "workflow_summary": 2-3 sentences describing how these tools work together\n` +
                    `- "quick_start_steps": array of 3-5 actionable first steps`,
            },
            {
                role: 'user',
                content:
                    `Campaign stage: ${campaignStage}\n` +
                    `Budget tier: ${budget}\n\n` +
                    `Tool catalog:\n${toolCatalog}\n\n` +
                    `Recommend the best tools for a consultant outreach campaign promoting ` +
                    `"iGrow" (i-grow.co), a conversation-rehearsal app that scores substance, ` +
                    `to leadership coaches and consulting firms as a between-sessions practice tool.`,
            },
        ],
        response_format: { type: 'json_object' },
    });

    const recommendation = response.choices[0].message.content;
    const parsed = JSON.parse(recommendation);
    console.log(
        `   [tool] Recommended ${parsed.recommended_stack.length} tools ` +
        `(~$${parsed.total_estimated_cost}/mo) for ${campaignStage}/${budget}\n`
    );
    return recommendation;
}

// Map tool names to handler functions
const toolHandlers = {
    research_consulting_firm: async (args) => researchConsultingFirm(args.firm_name, args.website),
    compose_email: async (args) => composeEmail(args.contact_name, args.firm_name, args.contact_title, args.specific_methodology),
    review_email_for_spam: async (args) => reviewEmailForSpam(args.email_subject, args.email_body),
    recommend_lead_gen_tools: async (args) => recommendLeadGenTools(args.campaign_stage, args.budget),
};

// ---------------------------------------------------------------------------
// ReAct-style agent loop
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT =
    `You are a consultant outreach agent for "iGrow" (i-grow.co), the flight simulator ` +
    `for the conversations that decide your career. Users rehearse high-stakes conversations ` +
    `OUT LOUD with an AI that pushes back and scores them on SUBSTANCE (what you said), not ` +
    `delivery (pace, filler words, eye contact). It uses an owned scoring framework called ` +
    `ANCHOR. Records are portable and owned by the individual.\n\n` +
    `YOUR MISSION:\n` +
    `You are reaching out to leadership coaches and consulting firms to position iGrow as a ` +
    `between-sessions practice tool. When a coach works with a client on salary negotiation, ` +
    `difficult feedback, or executive presence, the client can use iGrow between sessions to ` +
    `rehearse those exact conversations out loud — getting unlimited reps and ANCHOR-scored ` +
    `feedback the coach can review.\n\n` +
    `For each consulting firm you are given, follow these steps IN ORDER:\n\n` +
    `1. RESEARCH  - Call research_consulting_firm to learn about the firm's methodology, ` +
    `programs, coaching approach, and how iGrow fits.\n` +
    `2. COMPOSE   - Call compose_email with the contact details and a specific methodology ` +
    `to reference in the email.\n` +
    `3. REVIEW    - Call review_email_for_spam with the drafted subject and body to ` +
    `check for spam signals.\n` +
    `4. REVISE (if needed) - If the review says NEEDS_REVISION, revise the email ` +
    `using the suggestions and call review_email_for_spam again.\n` +
    `5. PRESENT   - Once the email passes review, output the final email with the ` +
    `subject, body, and follow-up timing clearly formatted.\n\n` +
    `After composing and reviewing all emails, call recommend_lead_gen_tools to ` +
    `suggest the best AI tools for executing the outreach campaign at scale. This ` +
    `draws from the awesome-ai-lead-generation toolchain ` +
    `(https://github.com/toofast1/awesome-ai-lead-generation) and helps the user ` +
    `move from drafted emails to a fully operational outreach pipeline.\n\n` +
    `IMPORTANT CONTEXT:\n` +
    `- Focus on leadership coaching firms and consultancies that work with individual ` +
    `leaders, not just organizational consulting.\n` +
    `- iGrow is a BETWEEN-SESSIONS tool — it extends the coach's impact without ` +
    `replacing them.\n` +
    `- The outreach offers COMPLIMENTARY access for a cohort of their coaching clients ` +
    `— this is a partnership exploration, not a sales pitch.\n` +
    `- Emails must feel personal and specific to each firm's methodology. Generic emails ` +
    `are unacceptable.\n` +
    `- Always think out loud before each action so the user can follow your reasoning.\n\n` +
    `After you finish ALL firms, write a brief summary of what was produced ` +
    `and include the lead generation tool recommendations for scaling the campaign.`;

/**
 * Runs the agent loop for a batch of consulting firms.
 */
async function runOutreachAgent(firms) {
    console.log('='.repeat(70));
    console.log('  iGrow — Consultant Outreach Agent');
    console.log('  Model: ' + MODEL);
    console.log('  Firms: ' + firms.map((f) => f.firm).join(', '));
    console.log('='.repeat(70));

    const firmList = firms
        .map(
            (f, i) =>
                `${i + 1}. ${f.firm} (${f.website}) — Contact: ${f.contact}, ${f.location}, fit score: ${f.fit}`
        )
        .join('\n');

    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
            role: 'user',
            content:
                `Please research the following leadership coaching/consulting firms and compose ` +
                `personalized outreach emails for each one:\n\n` +
                firmList +
                `\n\nFor each firm, follow the full research -> compose -> review pipeline.`,
        },
    ];

    const MAX_ITERATIONS = 25; // generous limit for 3 firms
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

    // -----------------------------------------------------------------------
    // Final step: recommend lead generation tools for scaling the campaign
    // -----------------------------------------------------------------------
    console.log('\n' + '-'.repeat(70));
    console.log('  Recommending lead generation tools for campaign execution...');
    console.log('-'.repeat(70));

    const toolRecommendation = await recommendLeadGenTools('outreach', 'starter');

    messages.push({
        role: 'user',
        content:
            `Here are the recommended AI lead generation tools for executing this ` +
            `outreach campaign at scale:\n\n${toolRecommendation}\n\n` +
            `Please summarize these tool recommendations along with the emails produced.`,
    });

    const summaryResponse = await client.chat.completions.create({
        model: MODEL,
        messages,
        temperature: 0.4,
    });

    const summaryMessage = summaryResponse.choices[0].message;
    messages.push(summaryMessage);

    if (summaryMessage.content) {
        console.log('\n' + summaryMessage.content);
    }

    console.log('\n' + '='.repeat(70));
    console.log('  Campaign preparation complete.');
    console.log('='.repeat(70));

    return messages;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const TARGET_FIRMS = [
    {
        firm: 'Speak by Design',
        website: 'speakbydesign.com',
        contact: 'Stephanie Bickel',
        location: 'Chicago IL',
        fit: 10,
    },
    {
        firm: 'The Violet Group',
        website: 'thevioletgrp.com',
        contact: 'Stefanie Mockler PhD',
        location: 'Chicago IL',
        fit: 10,
    },
    {
        firm: 'Bridge Builder Leadership',
        website: 'webridgebuild.com',
        contact: 'David Arrington',
        location: 'Charlotte NC',
        fit: 9,
    },
];

runOutreachAgent(TARGET_FIRMS).catch((err) => {
    console.error('Error:', err.message);
    if (err.message.includes('API key') || err.message.includes('auth')) {
        console.error(
            '\nMake sure OPENAI_API_KEY is set in your .env file at the project root.'
        );
    }
    process.exit(1);
});
