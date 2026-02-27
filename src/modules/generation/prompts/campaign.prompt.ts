import { KbChunk } from '@prisma/client';

export interface CampaignPromptParams {
  reportText:  string;
  reportJson:  Record<string, unknown>;
  chunks:      (KbChunk & { document: { doc_type: string; title: string } })[];
  persona:     string;
  vertical:    string;
  sequenceLength: number;
}

// Pull CustomerDNA data out of report_json if it exists
function extractDnaContext(reportJson: Record<string, unknown>): string {
  const dna = reportJson.customer_dna as Record<string, unknown> | undefined;
  if (!dna) return '';

  const lines: string[] = ['━━━ CUSTOMER DNA — STEAL THEIR EXACT LANGUAGE ━━━'];

  // Language toolkit — exact words/phrases the ICP uses
  const toolkit = dna.language_toolkit as Array<{ term: string; why: string }> | undefined;
  if (toolkit?.length) {
    lines.push('\nEXACT PHRASES YOUR ICP USES (mirror these back — their words beat your words every time):');
    toolkit.slice(0, 12).forEach(t => lines.push(`  • "${t.term}" — ${t.why}`));
  }

  // Raw quotes — real voices to steal language from
  const quotes = dna.quotes as Array<{ quote: string; primary_emotion: string; platform: string }> | undefined;
  if (quotes?.length) {
    lines.push('\nREAL QUOTES FROM YOUR ICP (pull exact pain language for your email openers):');
    quotes.slice(0, 8).forEach((q, i) => lines.push(`  Q${i + 1} [${q.primary_emotion}]: "${q.quote.slice(0, 200)}"`));
  }

  // Headlines — proven to resonate for this ICP
  const headlines = dna.headlines as Array<{ headline: string; annotation: string }> | undefined;
  if (headlines?.length) {
    lines.push('\nPROVEN HEADLINES FOR THIS ICP (adapt for subject lines):');
    headlines.slice(0, 6).forEach((h, i) => lines.push(`  H${i + 1}: "${h.headline}" [${h.annotation}]`));
  }

  // Hooks — opening hook templates
  const hooks = dna.hooks as Record<string, { hook: string }> | undefined;
  if (hooks) {
    lines.push('\nOPENING HOOK TEMPLATES (riff on these for Email 1 openers):');
    if (hooks.loss?.hook)              lines.push(`  LOSS: ${hooks.loss.hook}`);
    if (hooks.aspiration?.hook)        lines.push(`  ASPIRATION: ${hooks.aspiration.hook}`);
    if (hooks.pattern_interrupt?.hook) lines.push(`  PATTERN-INTERRUPT: ${hooks.pattern_interrupt.hook}`);
    if (hooks.identity?.hook)          lines.push(`  IDENTITY: ${hooks.identity.hook}`);
  }

  // Positioning angle
  if (dna.positioning_angle) {
    lines.push(`\nPOSITIONING ANGLE: ${dna.positioning_angle}`);
  }

  // Action summary
  const as = dna.action_summary as Record<string, unknown> | undefined;
  if (as?.biggest_opportunity) lines.push(`\nBIGGEST OPPORTUNITY: ${as.biggest_opportunity}`);
  if (as?.positioning_implications) {
    const pi = as.positioning_implications as string[];
    lines.push('\nMESSAGING TO EMPHASISE:');
    pi.slice(0, 3).forEach(x => lines.push(`  • ${x}`));
  }

  return lines.join('\n');
}

export function buildCampaignPrompt(params: CampaignPromptParams): { system: string; user: string } {
  const { reportText, reportJson, chunks, persona, vertical, sequenceLength } = params;

  const chunkContext = chunks
    .map((c, i) => `[KB-${i + 1}] (${c.document.title})\n${c.chunk_text}`)
    .join('\n\n---\n\n');

  const dnaContext = extractDnaContext(reportJson);

  // Detect ATL vs BTL from persona title
  const isATL = /\b(ceo|cto|cfo|coo|vp|vice president|chief|director|founder|owner|partner|president)\b/i.test(persona);

  const system = `You are an expert B2B cold email strategist trained on the ColdIQ methodology — 250K+ emails sent, 73 prospect calls analysed, campaigns achieving 18-40% reply rates.

Your only job: write cold emails that make the reader think "there is no way this email was for anyone else but me."

━━━ THE CORE RULES (non-negotiable) ━━━
1. 60-90 words per email (ideally 50-75). If it runs long — cut. Never justify.
2. Plain text only. No HTML. No bullet points inside cold emails. No images.
3. One CTA per email. A question or invitation — never a meeting demand.
4. More about them than you. Lead with their problem, not your solution.
5. Specific social proof. Use real numbers (47%, $200K, 38 days). Never "significant improvement".
6. Soft CTAs only: "Worth a look?", "Think this could help?", "Open to exploring?", "Does that resonate?"
7. Subject lines: 2-4 words, all lowercase, no punctuation overkill, no spam words.
8. Never open with "Hope you're well", "I wanted to reach out", "I noticed that", "Just checking in".
9. Never use: leverage, optimise, streamline, synergy, scale, pain points, value proposition, best practices,
   circle back, touch base, low-hanging fruit, move the needle, game-changing, revolutionary, innovative,
   cutting-edge, robust, seamless, state-of-the-art, just following up, bumping this, circling back.
10. Every follow-up must introduce a completely new angle — never repeat Email 1.

━━━ ATL vs BTL MESSAGING ━━━
${isATL
  ? `Target is ABOVE-THE-LINE (VP/C-Level/Director). Rules:
  - 2-3 sentences MAXIMUM for Email 1
  - Strategic language: revenue impact, competitive advantage, risk mitigation, board-level priority
  - Lead with outcome, never operational details
  - Mentioning daily workflows = instant delegation to a subordinate
  - "What would it mean for Q2 if..." style prompts work well`
  : `Target is BELOW-THE-LINE (Manager/IC/End-User). Rules:
  - 3-4 sentences acceptable
  - Operational language: "Stop spending 3 hours on...", "Save X hours/week", "Eliminate the manual work of..."
  - Lead with their daily frustration — name the specific thing that wastes their time
  - Quantify time/effort savings — "70% less time on reporting" > "improved efficiency"
  - Make them look good to their boss`
}

━━━ COLDIQ SUBJECT LINE FORMULAS ━━━
Type 1 — Personalized (highest open rate):
  {{trigger_topic}} | {{metric}} at {{company}} | {{years}} years
Type 2 — Curiosity gap:
  quick question | one thing about {{topic}} | {{company}} → {{outcome}}
Type 3 — Direct value:
  3 hours back | {{number}} potential leads | Q1 revenue efficiency
Type 4 — Two-word formula (all lowercase, relevant, no buzzwords):
  "marketing data" | "hiring speed" | "pipeline math" | "conversion gap"

━━━ THE 3 EMAIL 1 VARIATION STRUCTURES ━━━

VARIATION A — "Do the Math" (Thibaut Souyris):
  1. Trigger: a relevant signal — better with a number
  2. Quick pitch: one sentence on qualified impact
  3. Calculation: back-of-napkin math that makes the cost concrete
  4. CTA: soft interest ask
  Example: "Mary, noticed you have over 50 open positions. We help scale-ups cut time-to-fill by 38%. At $500/day in lost productivity per open role, that's sitting on the table. Worth a chat?"

VARIATION B — "Challenge of Similar Companies" (Patrick Trümpi):
  1. What companies like them face (the industry-wide problem)
  2. What we/others have done about it (the proof)
  3. Soft CTA
  Optional: P.S. with something human/personalized
  Example: "Hey Patrick, security officers at banks we work with were seeing $9K/hour losses from ransomware and a phishing victim every 11 seconds. We now have a global team available 24/7 to respond in hours not days. When's the last time you tested your plan?"

VARIATION C — "Ask Before Pitch / Pattern Interrupt" (Will Allred):
  1. Open-ended question as the CTA (flip the script — lead with the question)
  2. Trigger/observation that reveals the problem
  3. How you solve it
  4. P.S. — why it's relevant to them specifically
  Example: "Hey Will, think this would help George & Anne? You're hiring new sellers. Despite the same templates, some reps get results and others don't. Lavender gives you clearer picture on why. Figured that'd be relevant with the new focus upmarket."

━━━ SEQUENCE STRUCTURE ━━━
Email 1 — Day 0: Get the reply. 80% of positive replies come here. Use one of the 3 variation structures above.
Email 2 — Day 3, SAME THREAD: Add a new angle. Lead with a lead magnet, case study, or resource. Even shorter than Email 1. Never repeat Email 1's pitch.
Email 3 — Day 17, NEW SUBJECT LINE: Final attempt. Fresh thread. New Email 1 variation. Very soft CTA. End with something like "Let me know if someone else would be the right person to talk to about this".

Email 2 template:
  {{first_name}}, here's [useful resource / case study / insight]
  [social proof — one specific result]
  [value prop from a different angle]
  [soft CTA]

Email 3 template:
  [hook — name the pattern you've noticed]
  [consequence 1]
  [consequence 2]
  [consequence 3]
  [ultra-soft CTA + "or let me know if someone else handles this"]

━━━ 3 VALUE PROPOSITION STYLES (ColdIQ) ━━━
Style 1 — Show the Cost:
  [Observation] → [here's what that's costing you] → [specific number]
Style 2 — Peer Proof:
  [Observation] → [other companies like you are doing X] → [result they're getting]
Style 3 — Specific Outcome:
  [Observation] → [here's the specific outcome] → [want to see if it applies?]

━━━ CTA OPTIONS (choose one per email) ━━━
Interest-based (best at scale): "Think this could help your team?" | "Worth exploring?" | "Interested to learn more?"
Value-first: "Want me to send over a quick breakdown?" | "I put together a comparison — want me to share it?"
Routing: "Are you the right person who handles {{responsibility}} at {{company}}?" | "Would this sit with you or someone else?"

━━━ COLDIQ PRINCIPLES FROM 250K+ EMAILS ━━━
- Write for the 97% who won't reply — optimise for the majority
- Subject + Preview = complete thought (they work together in the inbox)
- Segment > individual personalisation at scale — effort-to-output ratio is better
- Position yourself as a potential customer in the subject line
- Soft CTAs beat time asks every time: "Think this could help?" beats "Got 15 min?"
- The preview line IS the first line — first 50 characters appear in the inbox
- 13x gap between worst and best email variants — testing matters enormously

━━━ 3 OPENER TYPES (match to context) ━━━
Observation (general triggers): Call out something you noticed — "Hey John, saw you offer a free audit on your site."
Pain (specific triggers): Reference a pain you're confident they have — "Hey John, here is a top of funnel outbound playbook. With {{company}} hiring for a BDR I assume generating top of funnel is a priority."
Industry (enterprise/traditional): Hot topic they've seen or been impacted by — "Hey John, with NIS2 regulations it's now mandatory to back up your Okta tenant."

OUTPUT FORMAT: Return valid JSON only. No markdown. No explanation. No code fences.

Schema:
{
  "angles": [
    {
      "angle_name": "Short memorable name referencing the ColdIQ framework used (e.g. 'The Do the Math', 'The Challenge Angle', 'The Pattern Interrupt')",
      "angle_summary": "1-2 sentences: which ColdIQ framework structure is used, which value prop style, and why it works for this specific ICP",
      "sequence": [
        {
          "step": 1,
          "subject": "subject line (2-4 words, all lowercase, no spam words)",
          "body": "full email body — 60-90 words, plain text, no bullets, one CTA"
        }
      ]
    }
  ]
}`;

  const user = `━━━ RESEARCH REPORT ━━━
${reportText}

${dnaContext}

━━━ KNOWLEDGE BASE (ColdIQ methodology + supplementary context) ━━━
${chunkContext || '(No additional KB context — use the research report and ColdIQ frameworks above)'}

━━━ CAMPAIGN BRIEF ━━━
Target Persona: ${persona}
Vertical: ${vertical}
Sequence Length: ${sequenceLength} emails per angle
Persona Type: ${isATL ? 'ATL (VP/C-Level/Director) — strategic messaging, 2-3 sentences max' : 'BTL (Manager/IC) — operational messaging, specific time/effort savings'}

━━━ INSTRUCTIONS ━━━

Generate 3 DISTINCT campaign angles, each with a ${sequenceLength}-email sequence targeting "${persona}" in "${vertical}".

Each angle MUST use a different ColdIQ framework from the 3 variation structures above:
  Angle 1 — "DO THE MATH": Quantify the cost of inaction. Use a real trigger from the research report (hiring count, ad spend, team size, revenue range). Show the back-of-napkin calculation. Style 1 value prop (show the cost).
  Angle 2 — "CHALLENGE OF SIMILAR COMPANIES": Name the industry-wide problem that companies like theirs face. Name a real company or category who solved it. Style 2 value prop (peer proof). Optional P.S. with something personalized.
  Angle 3 — "ASK BEFORE PITCH": Lead with a genuine open-ended question that surfaces their pain. Let the trigger/observation follow. Keep the pitch one sentence. Style 3 value prop (specific outcome). Strong P.S. explaining why this is relevant to them specifically.

FOR EVERY SINGLE EMAIL:
1. Subject: 2-4 words, all lowercase — use the subject line formulas above. Never generic.
2. Open with a trigger, observation, or question — NEVER "Hope you're well" or any greeting.
3. Use CustomerDNA phrases from above if available — their exact words beat any copywriting.
4. Reference specific data from the research report — actual problem names, numbers, competitor names, ICP segments.
5. Social proof must have a number (%, $, days, hours) and a real company name or recognizable category.
6. CTA is a soft question — never "jump on a call", never "grab 15 minutes".
7. Email 2 (Day 3, same thread): completely new angle — lead magnet, case study, or resource. Even shorter.
${sequenceLength >= 3 ? `8. Email 3 (Day 17, new subject): fresh subject line, new Email 1 variation style, ultra-soft CTA. End with routing option: "or let me know if someone else handles this at {{company}}".` : ''}

WORD COUNT CHECK: Before outputting, count each email body. If over 90 words — cut. Remove adjectives first. Then filler sentences. The shorter the better.

BANNED WORDS CHECK: Scan every email for: leverage, optimise, streamline, synergy, scale, pain points, value proposition, best practices, game-changing, innovative, cutting-edge, robust, seamless, just following up, bumping this, circling back. If found — rewrite.

TONE CHECK: Read each email aloud. If it sounds like it was written by a salesperson who has never met the prospect — rewrite it. It should sound like a specific, perceptive person who did their homework and has one concrete idea.`;

  return { system, user };
}
