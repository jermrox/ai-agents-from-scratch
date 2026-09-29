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
            name: 'scrape_leads',
            description:
                'Scrape leads from a specified source. Returns an array of raw lead ' +
                'objects with name, title, organization, email, and signal data.',
            parameters: {
                type: 'object',
                properties: {
                    source: {
                        type: 'string',
                        enum: [
                            'apollo',
                            'clay',
                            'linkedin',
                            'gummysearch',
                            'awario',
                            'conference_list',
                            'manual',
                        ],
                        description:
                            'The lead source to scrape from: ' +
                            '"apollo" for B2B contact database, ' +
                            '"clay" for AI-enriched prospecting, ' +
                            '"linkedin" for professional network profiles, ' +
                            '"gummysearch" for Reddit community signals, ' +
                            '"awario" for social listening mentions, ' +
                            '"conference_list" for event attendee lists, ' +
                            '"manual" for hand-curated entries.',
                    },
                    search_query: {
                        type: 'string',
                        description: 'What to search for on the source platform',
                    },
                    max_results: {
                        type: 'number',
                        description:
                            'Maximum number of leads to return (default 10)',
                    },
                },
                required: ['source', 'search_query'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'score_lead',
            description:
                'Score a raw lead on a 1-10 Fit Score rubric aligned to iGrow\'s ' +
                'beachhead segments. Returns the scored lead with Fit Score and rationale.',
            parameters: {
                type: 'object',
                properties: {
                    lead: {
                        type: 'string',
                        description:
                            'JSON string of the lead data to score',
                    },
                },
                required: ['lead'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'route_lead',
            description:
                'Route a scored lead to the correct downstream channel agent in the ' +
                'iGrow 6-agent outreach pipeline. Returns the routing decision and ' +
                'destination agent.',
            parameters: {
                type: 'object',
                properties: {
                    scored_lead: {
                        type: 'string',
                        description: 'JSON string of the scored lead data',
                    },
                    fit_score: {
                        type: 'number',
                        description:
                            'The lead\'s Fit Score (1-10) from the scoring step',
                    },
                },
                required: ['scored_lead', 'fit_score'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'deduplicate_lead',
            description:
                'Check if a lead already exists in the pipeline to prevent duplicate ' +
                'outreach. Returns whether the lead is a duplicate and the existing ' +
                'record if found.',
            parameters: {
                type: 'object',
                properties: {
                    lead_name: {
                        type: 'string',
                        description: 'Full name of the lead to check',
                    },
                    organization: {
                        type: 'string',
                        description: 'Organization or company name',
                    },
                    email: {
                        type: 'string',
                        description:
                            'Email address of the lead (optional, improves match accuracy)',
                    },
                },
                required: ['lead_name', 'organization'],
            },
        },
    },
];

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

/**
 * Simulates scraping leads from a specified source. In a production system
 * this would call the actual source API (Apollo, Clay, LinkedIn, etc.);
 * here we use the LLM to generate realistic lead data for the demo.
 */
async function scrapeLeads(source, searchQuery, maxResults = 10) {
    console.log(`\n   [tool] scrape_leads("${source}", "${searchQuery}", ${maxResults})`);

    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.6,
        messages: [
            {
                role: 'system',
                content:
                    'You are a lead generation data simulator. Given a source platform ' +
                    'and search query, generate realistic lead data that would come from ' +
                    'that platform. Each lead should have plausible names, titles, ' +
                    'organizations, and signal data relevant to iGrow — a conversation ' +
                    'rehearsal app for high-stakes professional conversations.\n\n' +
                    'Return a JSON object with a single key "leads" containing an array ' +
                    'of lead objects. Each lead object should have:\n' +
                    '- "name": full name\n' +
                    '- "title": job title\n' +
                    '- "organization": company or institution name\n' +
                    '- "email": plausible email address\n' +
                    '- "source": the platform this lead came from\n' +
                    '- "signal": what signal or activity triggered this lead (e.g., ' +
                    '  a Reddit post about new manager struggles, a LinkedIn post about ' +
                    '  leadership development, a conference talk on coaching)\n' +
                    '- "org_type": one of "university", "coaching_firm", "company_ld", ' +
                    '  "individual", "investor", "other"\n' +
                    '- "raw_notes": 1-2 sentences of additional context',
            },
            {
                role: 'user',
                content:
                    `Source platform: ${source}\n` +
                    `Search query: ${searchQuery}\n` +
                    `Max results: ${maxResults}\n\n` +
                    `Generate ${maxResults} realistic leads that this search would surface. ` +
                    `Make them specific and varied — different org sizes, roles, and signal types.`,
            },
        ],
        response_format: { type: 'json_object' },
    });

    const result = response.choices[0].message.content;
    const parsed = JSON.parse(result);
    console.log(`   [tool] Scraped ${parsed.leads?.length || 0} leads from ${source}\n`);
    return result;
}

/**
 * Scores a raw lead on the iGrow Fit Score rubric (1-10) using a nested
 * LLM call. The rubric weights:\n *   - Role alignment (40%): first-time managers, job-seekers with offers,
 *     people managers under 2 years\n *   - Organization fit (30%): small colleges, coaching firms, mid-size
 *     companies with L&D\n *   - Signal strength (30%): explicit need signals
 */
async function scoreLead(leadJson) {
    const lead = JSON.parse(leadJson);
    console.log(`\n   [tool] score_lead("${lead.name}" @ ${lead.organization})`);

    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        messages: [
            {
                role: 'system',
                content:
                    'You are a lead scoring analyst for iGrow, the flight simulator for ' +
                    'the conversations that decide your career. Users rehearse high-stakes ' +
                    'conversations out loud with AI that pushes back and scores substance ' +
                    'using the ANCHOR framework.\n\n' +
                    'Score this lead on a 1-10 Fit Score using the following rubric:\n\n' +
                    'ROLE ALIGNMENT (40% weight):\n' +
                    '- 10: First-time manager in first 90 days, or job-seeker with active offers\n' +
                    '- 8-9: People manager under 2 years, career services director\n' +
                    '- 6-7: L&D professional, executive coach, leadership program director\n' +
                    '- 4-5: HR generalist, academic advisor, general educator\n' +
                    '- 1-3: No clear connection to leadership development or career conversations\n\n' +
                    'ORGANIZATION FIT (30% weight):\n' +
                    '- 10: Small college with leadership program, or coaching firm specializing in new managers\n' +
                    '- 8-9: Mid-size company with active L&D budget, university career center\n' +
                    '- 6-7: Large enterprise L&D department, professional association\n' +
                    '- 4-5: General consulting firm, large university with no clear leadership focus\n' +
                    '- 1-3: No organizational fit for conversation rehearsal\n\n' +
                    'SIGNAL STRENGTH (30% weight):\n' +
                    '- 10: Explicit post/comment about needing conversation practice or interview prep\n' +
                    '- 8-9: Recent job posting for leadership dev role, or conference talk on coaching\n' +
                    '- 6-7: General interest in leadership development tools or ed-tech\n' +
                    '- 4-5: Tangential signal (e.g., posted about management challenges)\n' +
                    '- 1-3: No relevant signal detected\n\n' +
                    'Return a JSON object with:\n' +
                    '- "lead_name": the lead\'s name\n' +
                    '- "organization": the lead\'s organization\n' +
                    '- "fit_score": overall weighted score (1-10, rounded to 1 decimal)\n' +
                    '- "role_alignment_score": score for role alignment (1-10)\n' +
                    '- "organization_fit_score": score for organization fit (1-10)\n' +
                    '- "signal_strength_score": score for signal strength (1-10)\n' +
                    '- "rationale": 2-3 sentences explaining the score\n' +
                    '- "beachhead_segment": which iGrow beachhead segment this lead fits ' +
                    '  ("first_time_managers", "job_seekers", "career_services", ' +
                    '  "coaching_firms", "ld_departments", "none")\n' +
                    '- "recommended_action": "route" (score >= 3) or "reject" (score < 3)',
            },
            {
                role: 'user',
                content:
                    `Score this lead:\n${JSON.stringify(lead, null, 2)}`,
            },
        ],
        response_format: { type: 'json_object' },
    });

    const result = response.choices[0].message.content;
    const parsed = JSON.parse(result);
    console.log(
        `   [tool] Fit Score: ${parsed.fit_score}/10 ` +
        `(role: ${parsed.role_alignment_score}, org: ${parsed.organization_fit_score}, ` +
        `signal: ${parsed.signal_strength_score}) — ${parsed.recommended_action}\n`
    );
    return result;
}

/**
 * Routes a scored lead to the correct downstream channel agent based on
 * organization type and fit score. This is mostly deterministic, with
 * the LLM providing a confirmation rationale.
 */
async function routeLead(scoredLeadJson, fitScore) {
    const lead = JSON.parse(scoredLeadJson);
    console.log(`\n   [tool] route_lead("${lead.lead_name || lead.name}", fit_score=${fitScore})`);

    // Reject low-scoring leads
    if (fitScore < 3) {
        const rejection = JSON.stringify({
            lead_name: lead.lead_name || lead.name,
            organization: lead.organization,
            fit_score: fitScore,
            channel: 'Rejected',
            agent: null,
            reason: 'Fit score below threshold (< 3). Lead does not match iGrow beachhead segments.',
        });
        console.log(`   [tool] Routed to: Rejected (fit score too low)\n`);
        return rejection;
    }

    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.1,
        messages: [
            {
                role: 'system',
                content:
                    'You are the routing engine for iGrow\'s 6-agent outreach pipeline. ' +
                    'Given a scored lead, determine which downstream channel agent should ' +
                    'handle it.\n\n' +
                    'CHANNEL AGENTS:\n' +
                    '1. University Leads Agent — handles educational institutions (colleges, ' +
                    '   universities, career centers, student affairs offices)\n' +
                    '2. Partnership Leads Agent — handles coaching firms, consulting firms, ' +
                    '   and professional development organizations seeking partnership\n' +
                    '3. Business Leads Agent — handles companies with L&D programs, HR ' +
                    '   departments, and corporate training teams\n' +
                    '4. People Leads Agent — handles individual practitioners (coaches, ' +
                    '   trainers, career counselors) who would use iGrow with their clients\n' +
                    '5. Investor Leads Agent — handles VCs, angels, and strategic investors ' +
                    '   interested in ed-tech or future-of-work\n\n' +
                    'Return a JSON object with:\n' +
                    '- "lead_name": the lead\'s name\n' +
                    '- "organization": the lead\'s organization\n' +
                    '- "fit_score": the lead\'s fit score\n' +
                    '- "channel": one of "University Leads", "Partnership Leads", ' +
                    '  "Business Leads", "People Leads", "Investor Leads"\n' +
                    '- "agent": the agent name that will handle this lead\n' +
                    '- "reason": 1-2 sentences explaining the routing decision\n' +
                    '- "priority": "high" (score >= 8), "medium" (score 5-7), "low" (score 3-4)\n' +
                    '- "suggested_first_touch": what outreach approach the channel agent should use',
            },
            {
                role: 'user',
                content:
                    `Route this scored lead to the correct channel agent:\n` +
                    `${JSON.stringify(lead, null, 2)}\n\n` +
                    `Fit Score: ${fitScore}`,
            },
        ],
        response_format: { type: 'json_object' },
    });

    const result = response.choices[0].message.content;
    const parsed = JSON.parse(result);
    console.log(`   [tool] Routed to: ${parsed.channel} (${parsed.priority} priority)\n`);
    return result;
}

/**
 * Simulates checking for duplicate leads in the pipeline. In production
 * this would query a CRM or database; here the LLM simulates a match
 * check against a small set of existing records.
 */
async function deduplicateLead(leadName, organization, email) {
    console.log(`\n   [tool] deduplicate_lead("${leadName}", "${organization}"${email ? `, "${email}"` : ''})`);

    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.1,
        messages: [
            {
                role: 'system',
                content:
                    'You are a CRM deduplication engine for iGrow\'s lead pipeline. ' +
                    'You have access to the following existing records in the pipeline:\n\n' +
                    JSON.stringify([
                        { name: 'Sarah Chen', organization: 'Berea College', email: 'schen@berea.edu', status: 'contacted', channel: 'University Leads' },
                        { name: 'Marcus Williams', organization: 'BetterUp', email: 'mwilliams@betterup.com', status: 'qualified', channel: 'Partnership Leads' },
                        { name: 'Jennifer Park', organization: 'Deloitte L&D', email: 'jpark@deloitte.com', status: 'new', channel: 'Business Leads' },
                        { name: 'David Thompson', organization: 'Thompson Leadership Coaching', email: 'david@thomsoncoaching.com', status: 'contacted', channel: 'People Leads' },
                        { name: 'Rachel Martinez', organization: 'Fort Valley State University', email: 'martinezr@fvsu.edu', status: 'qualified', channel: 'University Leads' },
                    ], null, 2) +
                    '\n\nCheck if the given lead matches any existing record. A match can ' +
                    'be exact (same name + org) or fuzzy (similar name, same org; or same ' +
                    'email). Return a JSON object with:\n' +
                    '- "is_duplicate": boolean\n' +
                    '- "confidence": "exact", "high", "low", or "none"\n' +
                    '- "matching_record": the existing record if found, or null\n' +
                    '- "reason": explanation of the match or non-match',
            },
            {
                role: 'user',
                content:
                    `Check for duplicates:\n` +
                    `Name: ${leadName}\n` +
                    `Organization: ${organization}\n` +
                    `Email: ${email || 'not provided'}`,
            },
        ],
        response_format: { type: 'json_object' },
    });

    const result = response.choices[0].message.content;
    const parsed = JSON.parse(result);
    console.log(
        `   [tool] Duplicate check: ${parsed.is_duplicate ? 'DUPLICATE FOUND' : 'New lead'} ` +
        `(confidence: ${parsed.confidence})\n`
    );
    return result;
}

// Map tool names to handler functions
const toolHandlers = {
    scrape_leads: async (args) => scrapeLeads(args.source, args.search_query, args.max_results),
    score_lead: async (args) => scoreLead(args.lead),
    route_lead: async (args) => routeLead(args.scored_lead, args.fit_score),
    deduplicate_lead: async (args) => deduplicateLead(args.lead_name, args.organization, args.email),
};

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT =
    'You are the Lead Scraper & Daily Updater, the centralized intake funnel for ' +
    'iGrow\'s 6-agent outreach pipeline.\n\n' +
    'ABOUT iGROW:\n' +
    'iGrow (i-grow.co) is the flight simulator for the conversations that decide ' +
    'your career. Users rehearse high-stakes conversations — mock interviews, salary ' +
    'negotiations, difficult manager conversations — OUT LOUD with an AI that pushes ' +
    'back and scores them on SUBSTANCE (what you said) using the ANCHOR scoring ' +
    'framework. Records are portable and owned by the individual.\n\n' +
    'BEACHHEAD SEGMENTS:\n' +
    '- First-time managers in their first 90 days\n' +
    '- Job-seekers with active offers who need negotiation practice\n' +
    '- People managers under 2 years looking to level up\n' +
    '- Small colleges with leadership programs\n' +
    '- Coaching firms specializing in leadership development\n' +
    '- Mid-size companies with active L&D budgets\n\n' +
    'YOUR MISSION:\n' +
    'For each batch of sources you are given, follow these steps IN ORDER:\n\n' +
    '1. SCRAPE   — Call scrape_leads for each source to discover raw leads.\n' +
    '2. DEDUP    — For each lead, call deduplicate_lead to check if they already exist ' +
    'in the pipeline. Skip duplicates.\n' +
    '3. SCORE    — For each new (non-duplicate) lead, call score_lead to apply the ' +
    'Fit Score rubric (1-10).\n' +
    '4. ROUTE    — For each scored lead, call route_lead to assign it to the correct ' +
    'downstream channel agent (University, Partnership, Business, People, or Investor).\n' +
    '5. SUMMARIZE — After processing all sources, produce a daily intake summary:\n' +
    '   - Total leads scraped\n' +
    '   - Duplicates found\n' +
    '   - New leads scored\n' +
    '   - Leads routed per channel\n' +
    '   - Leads rejected (fit score < 3)\n' +
    '   - Top 3 highest-scoring leads with brief rationale\n\n' +
    'IMPORTANT:\n' +
    '- Always think out loud before each action so the user can follow your reasoning.\n' +
    '- Process leads from all sources before producing the summary.\n' +
    '- Be thorough: every lead gets deduped, scored, and routed (or rejected).';

// ---------------------------------------------------------------------------
// ReAct-style agent loop
// ---------------------------------------------------------------------------

/**
 * Runs the lead scraper agent for a batch of sources.
 */
async function runLeadScraperAgent(sources) {
    console.log('='.repeat(70));
    console.log('  iGrow — Lead Scraper & Daily Updater Agent');
    console.log('  Model: ' + MODEL);
    console.log('  Sources: ' + sources.map((s) => `${s.source}:"${s.query}"`).join(', '));
    console.log('='.repeat(70));

    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
            role: 'user',
            content:
                'Run the daily lead scrape for the following sources:\n\n' +
                sources
                    .map(
                        (s, i) =>
                            `${i + 1}. Source: ${s.source} | Query: "${s.query}"`
                    )
                    .join('\n') +
                '\n\nFor each source, scrape leads, deduplicate, score, and route them. ' +
                'Then produce the daily intake summary.',
        },
    ];

    const MAX_ITERATIONS = 30;
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
            console.log('  Agent finished. Daily intake complete.');
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

const SOURCES_TO_SCRAPE = [
    { source: 'apollo', query: 'leadership program director small college' },
    { source: 'linkedin', query: 'executive coaching firm leadership development' },
    { source: 'gummysearch', query: 'new manager first 90 days advice' },
];

runLeadScraperAgent(SOURCES_TO_SCRAPE).catch((err) => {
    console.error('Error:', err.message);
    if (err.message.includes('API key') || err.message.includes('auth')) {
        console.error(
            '\nMake sure OPENAI_API_KEY is set in your .env file at the project root.'
        );
    }
    process.exit(1);
});
