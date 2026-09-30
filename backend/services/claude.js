const Anthropic = require('@anthropic-ai/sdk');

let client = null;

function getClient() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

async function ask(systemPrompt, userPrompt) {
  const c = getClient();
  const msg = await c.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });
  return msg.content[0].text;
}

// Extract structured data from a raw inquiry email/text
async function parseInquiry(text) {
  const system = `You extract wedding inquiry data and return ONLY valid JSON. Extract whatever is present.`;
  const user = `Extract from this inquiry:
${text}

Return JSON: {"couple_name":"","partner1_name":"","partner2_name":"","email":"","phone":"","wedding_date":"","venue":"","guest_count":"","notes":""}
If a field isn't mentioned, use empty string. couple_name should be "Name & Name" format.`;
  const raw = await ask(system, user);
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    return {};
  }
}

// Draft personalized inquiry reply, under 170 words
async function draftInquiryReply({ inquiry, lead, settings, calendarAvailable }) {
  const system = `You are ${settings.owner_name} of ${settings.business_name}, a wedding photographer in ${settings.location}.
Voice: ${settings.voice_tone}.
Write emails that are warm, genuine, and personal — never templated-sounding. Under 170 words. One clear next step.`;

  const availabilityLine = calendarAvailable === true
    ? 'Your calendar shows that date is available.'
    : calendarAvailable === false
    ? 'That date appears booked on your calendar.'
    : 'You should verify calendar availability.';

  const user = `Draft a reply to this wedding inquiry. Be personal and reference specifics.

Inquiry:
${inquiry}

Extracted details: ${lead.wedding_date ? `Wedding: ${lead.wedding_date}` : ''} ${lead.venue ? `at ${lead.venue}` : ''}
Calendar: ${availabilityLine}
Packages: 6 hours $${settings.package_6hr}, 8 hours $${settings.package_8hr}

Requirements:
- Under 170 words
- Warm and genuine, not templated
- Reference their specific venue or date if mentioned
- One clear next step (book a call, reply with questions)
- Sign off: "${settings.sign_off}, ${settings.owner_name}"
- DO NOT invent details about past weddings or awards`;

  return ask(system, user);
}

// Draft a follow-up for a stale lead
async function draftLeadFollowUp({ lead, settings, daysSinceContact }) {
  const system = `You are ${settings.owner_name} of ${settings.business_name}. Write a gentle, warm follow-up. Under 150 words.`;
  const user = `Draft a follow-up to ${lead.couple_name} (${lead.email || 'email unknown'}).
They inquired ${daysSinceContact} days ago about their ${lead.wedding_date ? `wedding on ${lead.wedding_date}` : 'wedding'}${lead.venue ? ` at ${lead.venue}` : ''}.
Status: ${lead.status}. Last contact: ${lead.last_contact_date || 'unknown'}.

Be gentle, helpful, provide something useful (tip about booking timelines, or ask if they have questions).
Under 150 words. Sign off: "${settings.sign_off}, ${settings.owner_name}"
DO NOT make up details.`;
  return ask(system, user);
}

// Draft a partnership pitch for a venue/planner
async function draftPartnershipPitch({ prospect, settings }) {
  const system = `You are ${settings.owner_name} of ${settings.business_name}, a wedding photographer in ${settings.location}.
Write a genuine partnership outreach — warm, personal, referencing something real about the recipient. Under 200 words.`;

  const user = `Draft a partnership pitch to ${prospect.name} (${prospect.type}) at ${prospect.address || prospect.city || 'their location'}.
Website: ${prospect.website || 'unknown'}
Specific detail about them: ${prospect.specific_detail || 'a well-regarded local business'}
Their style/focus: ${prospect.style || 'weddings'}

Requirements:
- Reference something specific and real about ${prospect.name}
- Explain the value of referring couples to each other
- Mention your packages: 6hrs $${settings.package_6hr}, 8hrs $${settings.package_8hr}
- Include opt-out line at the end: "Reply STOP to be removed from our list."
- Include your mailing address: ${settings.mailing_address}
- Under 200 words. Sign off: "${settings.sign_off}, ${settings.owner_name} | ${settings.business_name}"
- DO NOT invent testimonials, award wins, or fabricate details`;

  return ask(system, user);
}

// Draft a sequence follow-up (step 2 or 3)
async function draftSequenceFollowUp({ prospect, step, originalPitch, settings }) {
  const system = `You are ${settings.owner_name} of ${settings.business_name}. Write follow-up #${step} to a partnership outreach. Very brief, warm, no pressure. Under 120 words.`;
  const user = `Follow-up #${step} to ${prospect.name}.
Their type: ${prospect.type}. Original pitch sent ~${step === 2 ? '7' : '14'} days ago.
Be brief, friendly, reference the original message. No hard sell.
Include opt-out: "Reply STOP to opt out."
Sign off: "${settings.sign_off}, ${settings.owner_name}"`;
  return ask(system, user);
}

// Generate venue landing page copy
async function draftVenueLandingPage({ venueName, weddings, settings }) {
  const system = `You are writing SEO-friendly wedding photography landing page copy for ${settings.business_name}. Only use facts provided. Do not invent weddings or details.`;
  const user = `Write a landing page for "${venueName}" — a venue where ${settings.business_name} has photographed weddings.

Real weddings photographed there (use only these):
${weddings.length > 0 ? weddings.map(w => `- ${w.couple_name}, ${w.wedding_date}`).join('\n') : '(No weddings yet — write placeholder copy that doesn\'t invent specifics)'}

Include: headline, 2-3 paragraphs about the venue and experience, a call to action.
Style: warm, genuine, SEO-friendly. Mention Philadelphia area.`;
  return ask(system, user);
}

// Generate Google Business Profile post ideas
async function draftGBPPost({ wedding, settings }) {
  const system = `You are writing a Google Business Profile post for ${settings.business_name}. Warm, genuine, no hashtag spam.`;
  const user = `Write a short Google Business Profile post celebrating this wedding:
Couple: ${wedding.couple_name}
Date: ${wedding.wedding_date}
Venue: ${wedding.venue || 'a beautiful venue'}

Keep it under 200 words. Warm and genuine. End with a soft call to action about booking.`;
  return ask(system, user);
}

// Draft morning summary of scheduled actions
async function draftMorningSummary({ staleLeads, sequenceDue, newProspectsFound, settings }) {
  const system = `You are writing a brief morning summary for ${settings.owner_name} of ${settings.business_name}. Concise and actionable.`;
  const user = `Write a morning summary email for ${settings.owner_name}:
- Stale leads needing follow-up: ${staleLeads}
- Outreach sequences due today: ${sequenceDue}
- New prospects researched: ${newProspectsFound}

Brief, warm, actionable. Under 100 words.`;
  return ask(system, user);
}

module.exports = {
  parseInquiry,
  draftInquiryReply,
  draftLeadFollowUp,
  draftPartnershipPitch,
  draftSequenceFollowUp,
  draftVenueLandingPage,
  draftGBPPost,
  draftMorningSummary,
};
