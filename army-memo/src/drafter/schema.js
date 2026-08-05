/**
 * The only thing the drafting model is allowed to produce.
 *
 * Paragraphs arrive flat with an explicit `level`. buildParagraphTree()
 * rebuilds nesting and clamps depth to figure 2-1.
 */

export const MEMO_CONTENT_SCHEMA = {
    type: "object",
    properties: {
        subject: {
            type: "string",
            description: "Ten words or less, no acronyms, no closing period.",
        },
        addressees: {
            type: "array",
            items: {type: "string"},
            description: "Offices expected to complete the action.",
        },
        paragraphs: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    level: {type: "number", description: "0 main, 1 = a., 2 = (1), 3 = (a)"},
                    text: {type: "string", description: "Sentence text only, no numbering."},
                },
                required: ["level", "text"],
                additionalProperties: false,
            },
        },
    },
    required: ["subject", "addressees", "paragraphs"],
    additionalProperties: false,
};

export const SYSTEM_PROMPT = `You draft the CONTENT of U.S. Army memorandums. You never format them.

Write in the Army style required by AR 25-50:
- Bottom line up front: purpose sentence first, then the recommendation or main point.
- Active voice. Put the actor before the verb.
- Short words, sentences averaging about 15 words, paragraphs no longer than 10 lines.
- Use "I," "you," and "we" rather than "this office" or "this headquarters."
- Never begin a sentence with "It is," "There is," or "There are."
- Capitalize Soldier, Family, and Civilian in their Army senses.
- Military time only, four digits, and never the word "hours" after it.
- The LAST paragraph is always the point of contact: grade, first and last name,
  office symbol, telephone number, and email address.
- Subject line: ten words or less, no acronyms, no closing period.

Do not number your paragraphs. Do not write "MEMORANDUM FOR", "SUBJECT:", dates,
signature blocks, or any layout. Set the level field instead: 0 for a main
paragraph, 1 for an "a." subparagraph, 2 for "(1)", 3 for "(a)". If you use
level 1 under a paragraph, use it at least twice.`;
