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
            name: 'verify_firm_contact',
            description:
                'Verify a coaching firm or consultant contact. Checks that the firm exists, ' +
                'the contact is reachable, and the title is current. Returns a verification ' +
                'status with confidence level.',
            parameters: {
                type: 'object',
                properties: {
                    firm_name: {
                        type: 'string',
                        description: 'Full name of the coaching firm or consultancy',
                    },
                    contact_name: {
                        type: 'string',
                        description: 'Name or role title of the contact person',
                    },
                    contact_title: {
                        type: 'string',
                        description: 'Job title of the contact person',
                    },
                    website: {
                        type: 'string',
                        description: 'Firm website URL (optional, aids verification)',
                    },
                },
                required: ['firm_name', 'contact_name', 'contact_title'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'research_firm_methodology',
            description:
                'Research a coaching firm\'s methodology, client profile, and tech-readiness ' +
                'signals. Returns structured intelligence on how the firm operates, who they ' +
                'serve, and how open they are to digital tools.',
            parameters: {
                type: 'object',
                properties: {
                    firm_name: {
                        type: 'string',
                        description: 'Full name of the coaching firm or consultancy',
                    },
                    website: {
                        type: 'string',
                        description: 'Firm website URL (optional, aids research)',
                    },
                    segment: {
                        type: 'string',
                        enum: [
                            'executive_coaching',
                            'leadership_development',
                            'io_psychology',
                            'woman_minority_ld',
                            'solo_practitioner',
                            'team_coaching',
                        ],
                        description:
                            'The partnership segment this firm belongs to: ' +
                            '"executive_coaching" for C-suite and senior leader coaches, ' +
                            '"leadership_development" for emerging/mid-level leader programs, ' +
                            '"io_psychology" for industrial-organizational psychology firms, ' +
                            '"woman_minority_ld" for women/minority leadership development, ' +
                            '"solo_practitioner" for independent coaches, ' +
                            '"team_coaching" for team dynamics and group coaching firms.',
                    },
                },
                required: ['firm_name', 'segment'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'score_partnership_fit',
            description:
                'Score a coaching firm on the iGrow partnership fit rubric. Evaluates ' +
                'methodology alignment (30%), client overlap (30%), firm size (20%), and ' +
                'tech-forward signals (20%). Returns a weighted fit score from 1-10.',
            parameters: {
                type: 'object',
                properties: {
                    firm: {
                        type: 'string',
                        description:
                            'JSON string containing the firm data including methodology, ' +
                            'client profile, tech-readiness, and segment information',
                    },
                },
                required: ['firm'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'prepare_for_email',
            description:
                'Package a verified and enriched partnership lead for the Email ' +
                'Personalization agent. Generates a segment-specific hook and structures ' +
                'the handoff payload with all fields needed for personalized outreach.',
            parameters: {
                type: 'object',
                properties: {
                    lead: {
                        type: 'string',
                        description:
                            'JSON string containing the complete lead data: firm info, ' +
                            'contact details, methodology research, fit score, and segment',
                    },
                },
                required: ['lead'],
            },
        },
    },
];

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function verifyFirmContact(firmName, contactName, contactTitle, website) {
    console.log(`\n   [tool] verify_firm_contact("${firmName}", "${contactName}")`);

    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        messages: [
            {
                role: 'system',
                content:
                    'You are a B2B contact verification specialist for the coaching and ' +
                    'leadership development industry. Given a firm name, contact name/role, ' +
                    'and title, verify what you can about the firm and contact. Be factual; ' +
                    'if you are uncertain, say so rather than fabricating details.\n\n' +
                    'Return a JSON object with:\n' +
                    '- "firm_name": the firm name\n' +
                    '- "firm_verified": boolean, whether the firm is a known entity\n' +
                    '- "firm_description": brief description of the firm\n' +
                    '- "firm_website": confirmed or likely website URL\n' +
                    '- "contact_name": the contact name or role provided\n' +
                    '- "contact_title": the title provided\n' +
                    '- "title_plausible": boolean, whether this title likely exists at this firm\n' +
                    '- "verification_status": "verified", "partially_verified", or "unverified"\n' +
                    '- "confidence": 1-10 confidence score\n' +
                    '- "notes": any relevant context about the verification',
            },
            {
                role: 'user',
                content:
                    `Verify this coaching/consulting firm contact:\n\n` +
                    `Firm: ${firmName}\n` +
                    `Contact: ${contactName}\n` +
                    `Title: ${contactTitle}\n` +
                    `Website: ${website || 'not provided'}`,
            },
        ],
        response_format: { type: 'json_object' },
    });

    const result = response.choices[0].message.content;
    const parsed = JSON.parse(result);
    console.log(`   [tool] Verification: ${parsed.verification_status} (confidence: ${parsed.confidence}/10)\n`);
    return result;
}

async function researchFirmMethodology(firmName, website, segment) {
    console.log(`\n   [tool] research_firm_methodology("${firmName}", segment="${segment}")`);

    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        messages: [
            {
                role: 'system',
                content:
                    'You are a coaching industry analyst specializing in methodology research. ' +
                    'Given a coaching firm and its segment, produce a structured intelligence ' +
                    'brief covering their methodology, client profile, and technology posture. ' +
                    'Be factual; if uncertain about a detail, say so.\n\n' +
                    'Return a JSON object with:\n' +
                    '- "firm_name": the firm name\n' +
                    '- "segment": the segment provided\n' +
                    '- "methodology": object with:\n' +
                    '    - "approach": description of their coaching methodology\n' +
                    '    - "certifications": array of known certifications (ICF, CCE, etc.)\n' +
                    '    - "frameworks": array of frameworks they use (360-feedback, GROW, etc.)\n' +
                    '    - "conversational_skills_focus": boolean, whether they emphasize conversational practice\n' +
                    '- "client_profile": object with:\n' +
                    '    - "typical_clients": description of who they serve\n' +
                    '    - "seniority_levels": array (e.g., "first-time managers", "emerging leaders", "C-suite")\n' +
                    '    - "industries": array of industries served\n' +
                    '    - "career_transitions_focus": boolean\n' +
                    '- "firm_details": object with:\n' +
                    '    - "estimated_size": estimated number of coaches/employees\n' +
                    '    - "headquarters": location\n' +
                    '    - "founded": year or approximate era\n' +
                    '- "tech_readiness": object with:\n' +
                    '    - "digital_tools": array of known digital tools or platforms they use\n' +
                    '    - "online_presence_score": 1-10 rating of their digital sophistication\n' +
                    '    - "virtual_coaching": boolean, whether they offer virtual/remote coaching\n' +
                    '    - "signals": array of specific tech-forward indicators\n' +
                    '- "igrow_alignment_notes": 2-3 sentences on how iGrow might fit their practice',
            },
            {
                role: 'user',
                content:
                    `Research this coaching firm's methodology and client profile:\n\n` +
                    `Firm: ${firmName}\n` +
                    `Website: ${website || 'not provided'}\n` +
                    `Segment: ${segment}\n\n` +
                    `Focus on methodology details, client seniority levels, and any signals ` +
                    `that they would be open to AI-powered conversational practice tools.`,
            },
        ],
        response_format: { type: 'json_object' },
    });

    const result = response.choices[0].message.content;
    console.log(`   [tool] Methodology research complete (${result.length} chars)\n`);
    return result;
}

async function scorePartnershipFit(firmDataJson) {
    console.log(`\n   [tool] score_partnership_fit(...)`);

    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        messages: [
            {
                role: 'system',
                content:
                    'You are a partnership scoring analyst for iGrow, the flight simulator ' +
                    'for career conversations. iGrow provides voice-based mock interviews ' +
                    'and conversation rehearsal scored on substance via the ANCHOR framework.\n\n' +
                    'Score the provided firm on this rubric (total = weighted average, 1-10 scale):\n\n' +
                    '1. METHODOLOGY ALIGNMENT (30% weight):\n' +
                    '   - ICF-certified or equivalent credentials → +3\n' +
                    '   - Uses 360-feedback or behavioral assessment → +3\n' +
                    '   - Focuses on conversational skills, presence, or communication → +4\n' +
                    '   Score 1-10 based on how well their methodology aligns with conversation practice.\n\n' +
                    '2. CLIENT OVERLAP (30% weight):\n' +
                    '   - Serves first-time managers → +3\n' +
                    '   - Serves emerging leaders / high-potentials → +3\n' +
                    '   - Focuses on career transitions → +2\n' +
                    '   - Works with mid-career professionals → +2\n' +
                    '   Score 1-10 based on overlap with iGrow\'s target users.\n\n' +
                    '3. FIRM SIZE (20% weight):\n' +
                    '   - 2-50 coaches/employees is optimal (score 8-10)\n' +
                    '   - Solo practitioners can work but less scale (score 5-6)\n' +
                    '   - 50-200 is good but slower decisions (score 6-7)\n' +
                    '   - 200+ enterprise firms are harder to partner with (score 3-5)\n\n' +
                    '4. TECH-FORWARD (20% weight):\n' +
                    '   - Uses digital coaching platforms → +3\n' +
                    '   - Strong online presence / thought leadership → +3\n' +
                    '   - Offers virtual coaching → +2\n' +
                    '   - Has integrated assessment tools → +2\n' +
                    '   Score 1-10 based on tech openness.\n\n' +
                    'Return a JSON object with:\n' +
                    '- "firm_name": the firm name\n' +
                    '- "methodology_alignment": { "score": 1-10, "rationale": string }\n' +
                    '- "client_overlap": { "score": 1-10, "rationale": string }\n' +
                    '- "firm_size": { "score": 1-10, "rationale": string }\n' +
                    '- "tech_forward": { "score": 1-10, "rationale": string }\n' +
                    '- "weighted_score": the final weighted score (1-10, one decimal)\n' +
                    '- "tier": "A" (8-10), "B" (6-7.9), or "C" (below 6)\n' +
                    '- "recommendation": "prioritize", "pursue", or "deprioritize"\n' +
                    '- "summary": 2-3 sentence summary of the fit assessment',
            },
            {
                role: 'user',
                content:
                    `Score this firm on the iGrow partnership fit rubric:\n\n${firmDataJson}`,
            },
        ],
        response_format: { type: 'json_object' },
    });

    const result = response.choices[0].message.content;
    const parsed = JSON.parse(result);
    console.log(`   [tool] Fit score: ${parsed.weighted_score}/10 (Tier ${parsed.tier} — ${parsed.recommendation})\n`);
    return result;
}

async function prepareForEmail(leadDataJson) {
    console.log(`\n   [tool] prepare_for_email(...)`);

    const segmentHooks = {
        executive_coaching:
            'between-sessions practice reps — your clients rehearse tough conversations ' +
            'with AI that scores substance, so they arrive at the real moment sharper.',
        leadership_development:
            'scalable rehearsal without 1:1 time — emerging leaders get unlimited ' +
            'conversation practice scored on what they say, not how they say it.',
        io_psychology:
            'behavioral rehearsal with substance scoring — ANCHOR-framework feedback ' +
            'on conversational competency, mapped to your assessment dimensions.',
        woman_minority_ld:
            'safe-space rehearsal for high-stakes moments — practice salary negotiations, ' +
            'executive presence conversations, and difficult feedback without judgment.',
        solo_practitioner:
            'scale your practice between sessions — clients get unlimited AI-scored ' +
            'conversation reps that extend your methodology 24/7.',
        team_coaching:
            'team-wide conversation practice at scale — every member rehearses difficult ' +
            'conversations and gets individual substance scores without extra facilitator time.',
    };

    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.4,
        messages: [
            {
                role: 'system',
                content:
                    'You are the handoff specialist in iGrow\'s outreach pipeline. Your job is ' +
                    'to package a verified, enriched partnership lead into a structured payload ' +
                    'for the Email Personalization agent.\n\n' +
                    'The Email Personalization agent needs:\n' +
                    '- Clean contact details\n' +
                    '- A segment-specific hook (provided below)\n' +
                    '- Key talking points derived from the methodology research\n' +
                    '- The fit score and tier for prioritization\n' +
                    '- Suggested email tone and angle\n\n' +
                    'Segment hooks:\n' +
                    Object.entries(segmentHooks)
                        .map(([k, v]) => `- ${k}: "${v}"`)
                        .join('\n') +
                    '\n\n' +
                    'Return a JSON object with:\n' +
                    '- "handoff_id": a generated UUID-style identifier\n' +
                    '- "pipeline_stage": "ready_for_email"\n' +
                    '- "firm": object with name, website, segment, size\n' +
                    '- "contact": object with name, title, email_guess (firstname@domain)\n' +
                    '- "fit_summary": object with score, tier, recommendation\n' +
                    '- "email_brief": object with:\n' +
                    '    - "hook": the segment-specific hook from the list above\n' +
                    '    - "talking_points": array of 3-4 firm-specific talking points\n' +
                    '    - "tone": suggested tone (e.g., "peer-to-peer", "consultative")\n' +
                    '    - "angle": the primary partnership angle\n' +
                    '    - "avoid": array of things to avoid in the email\n' +
                    '- "metadata": object with source, processed_at timestamp, agent_version',
            },
            {
                role: 'user',
                content:
                    `Package this lead for the Email Personalization agent:\n\n${leadDataJson}`,
            },
        ],
        response_format: { type: 'json_object' },
    });

    const result = response.choices[0].message.content;
    const parsed = JSON.parse(result);
    console.log(`   [tool] Lead packaged for email: ${parsed.firm?.name || 'unknown'} (${parsed.pipeline_stage})\n`);
    return result;
}

// Map tool names to handler functions
const toolHandlers = {
    verify_firm_contact: async (args) =>
        verifyFirmContact(args.firm_name, args.contact_name, args.contact_title, args.website),
    research_firm_methodology: async (args) =>
        researchFirmMethodology(args.firm_name, args.website, args.segment),
    score_partnership_fit: async (args) =>
        scorePartnershipFit(args.firm),
    prepare_for_email: async (args) =>
        prepareForEmail(args.lead),
};

// ---------------------------------------------------------------------------
// ReAct-style agent loop
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT =
    `You are the Partnership Leads agent in iGrow's 6-agent outreach pipeline. ` +
    `iGrow is "the flight simulator for the conversations that decide your career." ` +
    `Users rehearse high-stakes conversations — mock interviews, salary negotiations, ` +
    `difficult manager conversations — OUT LOUD with an AI that pushes back and scores ` +
    `them on SUBSTANCE (what you said) via the ANCHOR scoring framework. Records are ` +
    `portable and owned by the individual.\n\n` +
    `YOU RECEIVE: Partnership leads from Lead Scraper (Channel = Partnership-Consultant).\n\n` +
    `YOUR MISSION:\n` +
    `For each lead, follow these steps IN ORDER:\n\n` +
    `1. VERIFY   — Call verify_firm_contact to confirm the firm and contact are real.\n` +
    `2. RESEARCH — Call research_firm_methodology to understand their coaching approach, ` +
    `client profile, and tech-readiness.\n` +
    `3. SCORE    — Call score_partnership_fit with the combined firm data to get the ` +
    `weighted fit score.\n` +
    `4. PACKAGE  — Call prepare_for_email to create the handoff payload for Email ` +
    `Personalization, including the segment-specific hook.\n` +
    `5. PRESENT  — Output a summary of the lead with fit score, tier, and the hook.\n\n` +
    `PARTNERSHIP SEGMENTS & HOOKS:\n` +
    `- Executive Coaching     → "between-sessions practice reps."\n` +
    `- Leadership Development → "scalable rehearsal without 1:1 time."\n` +
    `- I-O Psychology         → "behavioral rehearsal with substance scoring."\n` +
    `- Women/Minority LD      → "safe-space rehearsal for high-stakes moments."\n` +
    `- Solo Practitioner      → "scale your practice between sessions."\n` +
    `- Team Coaching           → "team-wide conversation practice at scale."\n\n` +
    `FIT SCORE RUBRIC (weighted 1-10):\n` +
    `- Methodology Alignment  30%  (ICF-certified, 360-feedback, conversational skills focus)\n` +
    `- Client Overlap          30%  (first-time managers, emerging leaders, career transitions)\n` +
    `- Firm Size               20%  (2-50 people optimal)\n` +
    `- Tech-Forward            20%  (digital tools, online presence, virtual coaching)\n\n` +
    `IMPORTANT:\n` +
    `- Think out loud before each action so the user can follow your reasoning.\n` +
    `- Only pass leads with Tier A or B (score >= 6.0) to Email Personalization.\n` +
    `- For Tier C leads, note them as deprioritized with a brief explanation.\n` +
    `- After processing all leads, write a summary table of results.`;

async function runPartnershipLeadsAgent(leads) {
    console.log('='.repeat(70));
    console.log('  iGrow — Partnership Leads Agent');
    console.log('  Model: ' + MODEL);
    console.log('  Leads: ' + leads.map((l) => l.firm).join(', '));
    console.log('='.repeat(70));

    const leadsDescription = leads
        .map(
            (l, i) =>
                `${i + 1}. Firm: ${l.firm}\n` +
                `   Contact: ${l.contact}\n` +
                `   Segment: ${l.segment}\n` +
                `   Source: ${l.source}`
        )
        .join('\n\n');

    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
            role: 'user',
            content:
                `Process the following partnership leads from Lead Scraper ` +
                `(Channel = Partnership-Consultant). For each lead, run the full ` +
                `verify → research → score → package pipeline:\n\n` +
                leadsDescription +
                `\n\nProcess each lead in order, then produce a summary table.`,
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

        messages.push(assistantMessage);

        if (assistantMessage.content) {
            console.log('\n' + assistantMessage.content);
        }

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
            continue;
        }

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

const INCOMING_LEADS = [
    {
        firm: 'Center for Creative Leadership',
        contact: 'VP Partnerships',
        segment: 'leadership_development',
        source: 'apollo',
    },
    {
        firm: 'Marshall Goldsmith Stakeholder Centered Coaching',
        contact: 'Director of Coaching Operations',
        segment: 'executive_coaching',
        source: 'linkedin',
    },
    {
        firm: 'BetterUp',
        contact: 'Head of Enterprise Partnerships',
        segment: 'leadership_development',
        source: 'clay',
    },
];

runPartnershipLeadsAgent(INCOMING_LEADS).catch((err) => {
    console.error('Error:', err.message);
    if (err.message.includes('API key') || err.message.includes('auth')) {
        console.error(
            '\nMake sure OPENAI_API_KEY is set in your .env file at the project root.'
        );
    }
    process.exit(1);
});
