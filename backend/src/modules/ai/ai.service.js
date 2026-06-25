import Groq from 'groq-sdk';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

/**
 * Generates a structured AI summary for a Daily Progress Report using Groq LLM.
 * @param {Object} reportData - The full report data from the frontend.
 * @returns {Object} - Parsed JSON with points and confidence score.
 */
export const analyzeReport = async (reportData) => {
    const isWeekly = !!reportData.week;

    let prompt;
    if (isWeekly) {
        prompt = `Act as a neutral construction expert. Summarize this Weekly Progress Report: ${JSON.stringify(reportData)}

Return JSON ONLY. No markdown.
{
  "executiveSummary": "2-sentence high-level overview of the week's performance.",
  "points": [
    {"title": "Accumulated Manpower Breakdown", "content": "Direct Personnel: [Count]\\nMasons: [Count]\\nCarpenters: [Count]\\nPlumbers & Painters: [Count]\\nLogistical Note: [One sentence on workforce adequacy]"},
    {"title": "Weekly Site Conditions", "content": "Dominant Weather: [Type]\\nTotal Working Days: [Count] days\\nAtmospheric Impact: [One sentence on how weather affected work]"},
    {"title": "Weekly Project Progression", "content": "Average Completion: [Percentage]%\\nKey Achievement: [Most significant milestone hit this week]\\nVariance Note: [Summary of ahead/behind status across all tasks]"},
    {"title": "Strategic Planning & Next Week Outlook", "content": "Primary Targets: [Bullet list of strategic plans]\\nCritical Path Focus: [One sentence on highest priority task for next week]"}
  ],
  "confidenceScore": 95
}

RULES:
- Each "content" must be a series of "Label: Sentence" pairs separated by \\n.
- Use short dates (e.g. Feb 01).
- Tone: Executive, neutral and factual.`;
    } else {
        prompt = `Act as a neutral construction expert. Summarize this Daily Progress Report: ${JSON.stringify(reportData)}

Return JSON ONLY. No markdown.
{
  "executiveSummary": "2-sentence objective overview of today's progress.",
  "points": [
    {"title": "Summary of Project Identity & Context", "content": ""},
    {"title": "Summary of Site Environment", "content": ""},
    {"title": "Workforce & Logistics", "content": ""},
    {"title": "Today's Progress & Tomorrow's Plan", "content": ""},
    {"title": "Project Director's Observations", "content": ""}
  ],
  "confidenceScore": 90
}

RULES:
- Each "content" must be a series of "Label: Sentence" pairs separated by \\n.
- Use short dates (e.g. Feb 01, 2026).
- Tone: Neutral and factual. Avoid appreciative/biased words.`;
    }

    const chatCompletion = await groq.chat.completions.create({
        messages: [
            {
                role: 'user',
                content: prompt,
            },
        ],
        model: 'llama-3.1-8b-instant',
        temperature: 0.0,
        seed: 42,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
    });

    const responseText = chatCompletion.choices[0]?.message?.content;

    if (!responseText) {
        throw new Error('Empty response from Groq LLM');
    }

    // Parse the JSON response
    const parsed = JSON.parse(responseText);
    return parsed;
};

export const analyzeBudget = async ({ budgetData, slabArea, gstRate, sectionId }) => {
    try {
        const response = await fetch('http://127.0.0.1:8000/analyze-budget', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                budgetData,
                slabArea,
                gstRate,
                sectionId
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Python AI Engine Error: ${errorData}`);
        }

        const data = await response.json();
        return data; // Returns { insights: [ ... ] } exactly as the frontend expects
    } catch (error) {
        console.error("AI Microservice Error:", error);
        throw error;
    }
};

export const analyzeSchedule = async ({ phases, macro }) => {
    try {
        const response = await fetch('http://127.0.0.1:8000/analyze-schedule', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ phases, macro: !!macro })
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Python AI Engine Error: ${errorData}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("AI Microservice Error:", error);
        throw error;
    }
};
