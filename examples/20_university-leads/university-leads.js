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
            name: 'verify_university_contact',
            description:
                'Verify that a university contact exists and their information is current. ' +
                'Checks the contact name, title, and email against institutional records and ' +
                'returns verification status with any updated information.',
            parameters: {
                type: 'object',
                properties: {
                    institution: {
                        type: 'string',
                        description: 'Full name of the university or college',
                    },
                    contact_name: {
                        type: 'string',
                        description: 'Name of the contact to verify',
                    },
                    contact_title: {
                        type: 'string',
                        description: 'Title or role of the contact (e.g. "Director of Career Services")',
                    },
                    contact_email: {
                        type: 'string',
                        description: 'Email address to verify (optional)',
                    },
                },
                required: ['institution', 'contact_name', 'contact_title'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'research_university_program',
            description:
                'Deep-research a specific university program to find personalization hooks ' +
                'for iGrow outreach. Returns program details, recent news, and talking points ' +
                'tailored to how iGrow can serve that program.',
            parameters: {
                type: 'object',
                properties: {
                    institution: {
                        type: 'string',
                        description: 'Full name of the university or college',
                    },
                    program_type: {
                        type: 'string',
                        enum: [
                            'career_services',
                            'coop_internship',
                            'leadership_program',
                            'student_affairs',
                            'greek_life',
                            'alumni_services',
                        ],
                        description: 'The type of university program to research',
                    },
                },
                required: ['institution', 'program_type'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'assign_priority',
            description:
                'Assign P1/P2/P3 priority to a university lead based on institution size, ' +
                'program type, and signal strength. P1: career services or co-op, 500-5000 ' +
                'students, explicit signal. P2: leadership or student affairs, 5000-10000. ' +
                'P3: adjacent office, weaker signal. Excludes R1 research, Ivy, flagship, >15000.',
            parameters: {
                type: 'object',
                properties: {
                    institution: {
                        type: 'string',
                        description: 'Full name of the university or college',
                    },
                    enrollment: {
                        type: 'number',
                        description: 'Approximate total enrollment',
                    },
                    program_type: {
                        type: 'string',
                        description: 'The program type (e.g. "career_services", "student_affairs")',
                    },
                    signal_strength: {
                        type: 'string',
                        enum: ['explicit', 'moderate', 'weak'],
                        description:
                            'How strong the buying signal is: "explicit" (direct interest or RFP), ' +
                            '"moderate" (job posting or event mention), "weak" (general fit only)',
                    },
                },
                required: ['institution', 'enrollment', 'program_type', 'signal_strength'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'prepare_for_email',
            description:
                'Package a verified, enriched university lead for handoff to the Email ' +
                'Personalization agent. Returns a structured record with all fields needed ' +
                'for personalized outreach.',
            parameters: {
                type: 'object',
                properties: {
                    lead: {
                        type: 'string',
                        description:
                            'JSON string of the verified lead including institution, contact, ' +
                            'program context, priority, and talking points',
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

async function verifyUniversityContact(institution, contactName, contactTitle, contactEmail) {
    console.log(`\n   [tool] verify_university_contact("${institution}", "${contactName}", "${contactTitle}")`);

    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        messages: [
            {
                role: 'system',
                content:
                    'You are a contact verification specialist for higher-education outreach. ' +
                    'Given an institution and contact details, verify whether the person exists ' +
                    'in that role and provide any updated information. Be factual; if you are ' +
                    'uncertain, say so and flag the confidence level.\n\n' +
                    'Return a JSON object with:\n' +
                    '- "verification_status": "verified", "likely_valid", "unverified", or "stale"\n' +
                    '- "confidence": 0.0-1.0\n' +
                    '- "contact_name": confirmed or corrected name\n' +
                    '- "contact_title": confirmed or corrected title\n' +
                    '- "contact_email": confirmed email or best-guess format (e.g. first.last@school.edu)\n' +
                    '- "department": the department this person belongs to\n' +
                    '- "notes": any relevant context (e.g. "title may have changed", "new hire")\n' +
                    '- "last_verified": approximate date of last known data',
            },
            {
                role: 'user',
                content:
                    `Verify this university contact:\n` +
                    `Institution: ${institution}\n` +
                    `Contact name: ${contactName}\n` +
                    `Contact title: ${contactTitle}\n` +
                    (contactEmail ? `Contact email: ${contactEmail}\n` : '') +
                    `\nCheck if this person likely holds this role at this institution and ` +
                    `provide your best assessment.`,
            },
        ],
        response_format: { type: 'json_object' },
    });

    const result = response.choices[0].message.content;
    const parsed = JSON.parse(result);
    console.log(`   [tool] Verification: ${parsed.verification_status} (confidence: ${parsed.confidence})\n`);
    return result;
}

async function researchUniversityProgram(institution, programType) {
    console.log(`\n   [tool] research_university_program("${institution}", "${programType}")`);

    const programLabels = {
        career_services: 'Career Services',
        coop_internship: 'Co-op / Internship Program',
        leadership_program: 'Leadership Program',
        student_affairs: 'Student Affairs',
        greek_life: 'Greek Life',
        alumni_services: 'Alumni Services',
    };

    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        messages: [
            {
                role: 'system',
                content:
                    'You are a higher-education research analyst specializing in program-level ' +
                    'intelligence for B2B outreach. Given an institution and program type, produce ' +
                    'a detailed research brief focused on how a voice-based mock-interview and ' +
                    'conversation-rehearsal platform (iGrow) could serve that program.\n\n' +
                    'iGrow is "the flight simulator for the conversations that decide your career." ' +
                    'Students rehearse high-stakes conversations out loud with AI that pushes back ' +
                    'and scores substance using the ANCHOR framework. Use cases: mock interviews, ' +
                    'salary negotiation, difficult conversations, co-op prep, leadership coaching.\n\n' +
                    'Return a JSON object with:\n' +
                    '- "institution": full name\n' +
                    '- "program_type": the program researched\n' +
                    '- "program_details": object with "name", "description", "key_staff_roles", "student_count_estimate"\n' +
                    '- "recent_initiatives": array of 2-3 recent or notable initiatives\n' +
                    '- "pain_points": array of 2-3 challenges this program likely faces\n' +
                    '- "igrow_talking_points": array of 3-4 specific reasons iGrow fits this program\n' +
                    '- "best_time_to_reach": recommended outreach window (considering academic calendar)\n' +
                    '- "personalization_hooks": array of 2-3 specific details to reference in outreach',
            },
            {
                role: 'user',
                content:
                    `Research the ${programLabels[programType] || programType} program at ` +
                    `${institution}. Find details, recent news, and personalization hooks ` +
                    `for iGrow outreach.`,
            },
        ],
        response_format: { type: 'json_object' },
    });

    const result = response.choices[0].message.content;
    console.log(`   [tool] Program research complete (${result.length} chars)\n`);
    return result;
}

async function assignPriority(institution, enrollment, programType, signalStrength) {
    console.log(`\n   [tool] assign_priority("${institution}", ${enrollment}, "${programType}", "${signalStrength}")`);

    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.1,
        messages: [
            {
                role: 'system',
                content:
                    'You are a lead-scoring specialist for iGrow\'s university outreach pipeline. ' +
                    'Assign a priority level (P1, P2, or P3) to each lead using these strict rules:\n\n' +
                    'P1 (Highest priority):\n' +
                    '- Program type: career_services OR coop_internship\n' +
                    '- Enrollment: 500-5,000 students\n' +
                    '- Signal strength: explicit\n' +
                    '- These programs have the most direct need for mock-interview preparation\n\n' +
                    'P2 (Medium priority):\n' +
                    '- Program type: leadership_program OR student_affairs\n' +
                    '- Enrollment: 5,000-10,000 students\n' +
                    '- Signal strength: moderate or better\n' +
                    '- Good fit but less direct alignment with core iGrow use case\n\n' +
                    'P3 (Lower priority):\n' +
                    '- Program type: greek_life OR alumni_services or other adjacent offices\n' +
                    '- Signal strength: weak\n' +
                    '- Indirect fit, may require more education on iGrow value\n\n' +
                    'EXCLUSIONS (assign "EXCLUDE" instead of a priority):\n' +
                    '- R1 research universities\n' +
                    '- Ivy League institutions\n' +
                    '- Flagship state universities\n' +
                    '- Enrollment > 15,000\n\n' +
                    'NOTE: If a lead matches criteria across tiers (e.g. career_services at a ' +
                    '7,000-student school), use your judgment and explain the rationale.\n\n' +
                    'Return a JSON object with:\n' +
                    '- "institution": the institution name\n' +
                    '- "priority": "P1", "P2", "P3", or "EXCLUDE"\n' +
                    '- "score": numeric score 1-100\n' +
                    '- "rationale": 2-3 sentences explaining the priority assignment\n' +
                    '- "program_fit": "direct", "strong", "moderate", or "indirect"\n' +
                    '- "enrollment_tier": "ideal" (500-5000), "good" (5000-10000), "marginal" (10000-15000), or "exclude" (>15000)\n' +
                    '- "next_step": recommended next action for this lead',
            },
            {
                role: 'user',
                content:
                    `Score this university lead:\n` +
                    `Institution: ${institution}\n` +
                    `Enrollment: ${enrollment}\n` +
                    `Program type: ${programType}\n` +
                    `Signal strength: ${signalStrength}`,
            },
        ],
        response_format: { type: 'json_object' },
    });

    const result = response.choices[0].message.content;
    const parsed = JSON.parse(result);
    console.log(`   [tool] Priority: ${parsed.priority} (score: ${parsed.score}/100)\n`);
    return result;
}

async function prepareForEmail(leadJson) {
    console.log(`\n   [tool] prepare_for_email(...)`);

    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        messages: [
            {
                role: 'system',
                content:
                    'You are a data-packaging specialist in iGrow\'s outreach pipeline. Your job ' +
                    'is to take a verified, enriched university lead and produce a clean handoff ' +
                    'record for the Email Personalization agent.\n\n' +
                    'The Email Personalization agent needs these fields to compose a personalized ' +
                    'outreach email:\n\n' +
                    'Return a JSON object with:\n' +
                    '- "handoff_id": a unique identifier (format: "UNI-" + first 3 letters of institution + "-" + timestamp-like suffix)\n' +
                    '- "pipeline_stage": "ready_for_email"\n' +
                    '- "institution": object with "name", "enrollment", "location", "type"\n' +
                    '- "contact": object with "name", "title", "email", "department", "verification_status"\n' +
                    '- "priority": object with "level" (P1/P2/P3), "score", "rationale"\n' +
                    '- "program_context": object with "type", "details", "pain_points", "recent_initiatives"\n' +
                    '- "personalization": object with "talking_points" (array), "hooks" (array), "tone" (recommended tone)\n' +
                    '- "constraints": object with "outreach_window" (best months), "avoid_months" (July-Aug, Dec-Jan), "follow_up_cadence"\n' +
                    '- "source": the original lead source (e.g. "apollo", "linkedin", "clay")\n' +
                    '- "created_at": current timestamp\n\n' +
                    'Ensure all fields are populated. If any data is missing from the input, ' +
                    'flag it in a "missing_fields" array and fill with reasonable defaults.',
            },
            {
                role: 'user',
                content:
                    `Package this verified lead for the Email Personalization agent:\n\n${leadJson}`,
            },
        ],
        response_format: { type: 'json_object' },
    });

    const result = response.choices[0].message.content;
    const parsed = JSON.parse(result);
    console.log(`   [tool] Handoff record created: ${parsed.handoff_id} (${parsed.pipeline_stage})\n`);
    return result;
}

// Map tool names to handler functions
const toolHandlers = {
    verify_university_contact: async (args) =>
        verifyUniversityContact(args.institution, args.contact_name, args.contact_title, args.contact_email),
    research_university_program: async (args) =>
        researchUniversityProgram(args.institution, args.program_type),
    assign_priority: async (args) =>
        assignPriority(args.institution, args.enrollment, args.program_type, args.signal_strength),
    prepare_for_email: async (args) =>
        prepareForEmail(args.lead),
};

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT =
    `You are the University Leads agent in iGrow's outreach pipeline. iGrow is "the flight ` +
    `simulator for the conversations that decide your career" — voice-based mock interviews ` +
    `with AI that pushes back and scores substance using the ANCHOR framework. Records are ` +
    `portable and owned by the individual.\n\n` +
    `You receive university leads routed from the Lead Scraper (Channel = University). ` +
    `Your mission: verify each contact, research their specific program, assign priority ` +
    `(P1/P2/P3), and prepare verified leads for the Email Personalization agent.\n\n` +
    `TARGET INSTITUTIONS:\n` +
    `- Small colleges: 500-10,000 students\n` +
    `- 6 segments: Career Services, Co-op/Internship, Leadership Programs, Student Affairs, ` +
    `Greek Life, Alumni Services\n\n` +
    `EXCLUSIONS:\n` +
    `- R1 research universities\n` +
    `- Ivy League institutions\n` +
    `- Flagship state universities\n` +
    `- Enrollment > 15,000\n\n` +
    `ACADEMIC CALENDAR AWARENESS:\n` +
    `- Avoid outreach during July-August (summer break) and December-January (winter break)\n` +
    `- Best windows: September-November (fall semester) and February-April (spring semester)\n\n` +
    `FOR EACH LEAD, FOLLOW THESE STEPS IN ORDER:\n\n` +
    `1. VERIFY   — Call verify_university_contact to confirm the contact exists and their ` +
    `information is current.\n` +
    `2. RESEARCH — Call research_university_program to deep-research the specific program ` +
    `and find personalization hooks.\n` +
    `3. SCORE    — Call assign_priority to assign P1/P2/P3 based on institution size, ` +
    `program type, and signal strength.\n` +
    `4. PACKAGE  — Call prepare_for_email to create a structured handoff record for the ` +
    `Email Personalization agent.\n\n` +
    `Always think out loud before each action so the user can follow your reasoning.\n\n` +
    `After processing ALL leads, write a summary that includes:\n` +
    `- How many leads were verified, scored, and packaged\n` +
    `- Priority breakdown (P1/P2/P3/excluded)\n` +
    `- Any leads that need manual follow-up\n` +
    `- Recommended next steps for the Email Personalization agent`;

// ---------------------------------------------------------------------------
// ReAct-style agent loop
// ---------------------------------------------------------------------------

async function runUniversityLeadsAgent(leads) {
    console.log('='.repeat(70));
    console.log('  iGrow — University Leads Agent');
    console.log('  Model: ' + MODEL);
    console.log('  Incoming leads: ' + leads.length);
    console.log('='.repeat(70));

    const leadsDescription = leads
        .map(
            (l, i) =>
                `${i + 1}. ${l.institution} — ${l.contact} (enrollment: ${l.enrollment}, source: ${l.source})`
        )
        .join('\n');

    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
            role: 'user',
            content:
                `The Lead Scraper has routed the following university leads to you. ` +
                `Process each one through the full pipeline: verify -> research -> score -> package.\n\n` +
                `INCOMING LEADS:\n${leadsDescription}\n\n` +
                `For each lead, determine the appropriate program_type from context, then ` +
                `run all four steps. Flag any leads that should be excluded.`,
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
            console.log('  University Leads agent finished.');
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
    { institution: 'Tuskegee University', contact: 'Director of Career Services', enrollment: 3100, source: 'apollo' },
    { institution: 'Berea College', contact: 'VP of Student Affairs', enrollment: 1600, source: 'linkedin' },
    { institution: 'Fort Valley State University', contact: 'Co-op Program Coordinator', enrollment: 2800, source: 'clay' },
];

runUniversityLeadsAgent(INCOMING_LEADS).catch((err) => {
    console.error('Error:', err.message);
    if (err.message.includes('API key') || err.message.includes('auth')) {
        console.error(
            '\nMake sure OPENAI_API_KEY is set in your .env file at the project root.'
        );
    }
    process.exit(1);
});
