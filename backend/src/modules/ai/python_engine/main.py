from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Any, Dict
from groq import Groq
import os
from dotenv import load_dotenv
import json

# Load .env from the backend directory
env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../.env"))
load_dotenv(env_path)

app = FastAPI(title="MANO-ERP AI Engine")

# Initialize Groq client
import logging
if not os.getenv("GROQ_API_KEY"):
    logging.warning(f"Failed to find GROQ_API_KEY at {env_path}. Make sure it is set!")
client = Groq(api_key=os.getenv("GROQ_API_KEY", "fallback_to_prevent_crash_during_init"))

# ─── Pydantic Models for Output ─────────────────────────

class BudgetInsight(BaseModel):
    secId: str = Field(..., description="The ID of the budget phase (e.g., 'civil', 'elec', 'equip')")
    t: Literal["w", "s", "i", "g"] = Field(..., description="Type of insight: 'w' (warning), 's' (saving), 'i' (info), or 'g' (suggestion)")
    title: str = Field(..., description="A short, catchy title for the insight")
    totalCost: str = Field(..., description="The total budget of the ENTIRE project (e.g. '₹1.28 Cr')")
    occupiedCost: str = Field(..., description="The cost of this specific section and its percentage of the total (e.g. '₹45L, 35%')")
    suggestion: str = Field(..., max_length=1000, description="State if the budget is good for that work. If not, what real changes can be made to improve it.")

class BudgetInsightsSchema(BaseModel):
    insights: List[BudgetInsight] = Field(description="List of budget insights")

class TaskStatus(BaseModel):
    taskName: str = Field(description="Name of the task")
    status: Literal["On Time", "Behind Schedule", "Ahead of Time", "Ahead of Schedule"] = Field(description="Current status of the task")
    difference: str = Field(description="The difference from the planned timeline (e.g. '3 days behind', 'On track')")
    alert: bool = Field(description="True if the task is behind schedule or delayed")
    action: str = Field(description="A very short, specific action to recover time if behind schedule (e.g. 'Deploy 2 extra excavators'). If on time, say 'Continue as planned'.")
    impact: str = Field(description="How this task's status is directly affecting subsequent tasks or the overall schedule (e.g. 'Delaying the start of slab casting by 3 days' or 'Providing a 2-day buffer for plumbing').")

class ScheduleInsightsSchema(BaseModel):
    taskStatuses: List[TaskStatus] = Field(description="Status breakdown for each task")
    overallSuggestion: str = Field(description="A small overall suggestion summarizing the project state and what to do next")

# ─── API Requests ───────────────────────────────────────

class AnalyzeBudgetRequest(BaseModel):
    budgetData: List[Dict[str, Any]]
    slabArea: float
    gstRate: float
    sectionId: Optional[str] = None

class AnalyzeScheduleRequest(BaseModel):
    phases: List[dict] = Field(description="List of project phases and their activities")
    macro: bool = Field(default=False, description="If True, only analyze Master Tasks (Phases)")

@app.post("/analyze-budget")
async def analyze_budget(req: AnalyzeBudgetRequest):
    # 1. Filter and Compress budgetData to save tokens and force focus
    compressed_data = []
    total_budget_cost = 0
    
    # Treat "all" as analyzing the entire budget
    is_entire_budget = not req.sectionId or str(req.sectionId).lower() == 'all'
    
    for sec in req.budgetData:
        # If specific section requested, ONLY include that section.
        if not is_entire_budget and str(sec.get("id")) != str(req.sectionId):
            continue
            
        items = []
        section_total = 0
        for it in sec.get("items", []):
            rate = it.get("totalRateOverride")
            if rate is None:
                rate = float(it.get("materialRate", 0)) + float(it.get("labourRate", 0))
            
            qty = float(it.get("quantity", 0))
            item_total = qty * float(rate)
            section_total += item_total
            total_budget_cost += item_total
            if item_total > 0:
                items.append({
                    "desc": str(it.get("description"))[:40], # Truncated
                    "u": it.get("unit"),
                    "q": qty,
                    "r": rate,
                    "_t": item_total
                })
        
        # Sort to find major cost drivers
        items.sort(key=lambda x: x["_t"], reverse=True)
        for x in items: del x["_t"] # cleanup
        
        # When analyzing the entire budget, only send the top 5 most expensive items per section
        if is_entire_budget:
            items = items[:5]
            
        compressed_data.append({
            "id": sec.get("id"),
            "n": sec.get("name"),
            "tot": section_total,
            "items": items
        })

    # Adjust prompt context dynamically
    if not is_entire_budget:
        section_name = compressed_data[0]['n'] if compressed_data else 'Unknown'
        focus_context = f"You are analyzing a SPECIFIC section of the budget: {section_name}. Do not give general project advice. Give highly technical, granular advice on the line items within this section."
        section_breakdown = ""
        audit_rules = """STRICT AUDIT RULES FOR THIS SECTION:
1. ACT AS A HARSH PROJECT CRITIC & ARCHITECT: Your job is to aggressively look for value engineering opportunities. Do not just agree with the budget.
2. OPTIMIZE EVERYTHING: Even if rates look okay, suggest alternative materials, modern construction techniques, or workflow changes that could optimize costs further.
3. BE SPECIFIC & CONTEXTUAL: If suggesting a change, name the exact alternative (e.g., 'Use AAC blocks instead of Red Bricks to save 15% on mortar').
4. EVERY insight MUST cite a specific line item name, its current rate/quantity, and the mathematical impact of your proposed alternative.
5. If a line item is genuinely flawless with zero room for optimization, explain EXACTLY why it is perfectly priced according to current market standards."""
    else:
        # Build a per-section cost breakdown for the AI
        breakdown_lines = []
        for sec in compressed_data:
            pct = (sec['tot'] / total_budget_cost * 100) if total_budget_cost > 0 else 0
            breakdown_lines.append(f"  - {sec['n']} (ID: {sec.get('id', 'N/A')}): ₹{sec['tot']:,.2f} ({pct:.1f}% of total)")
        section_breakdown = "SECTION-WISE BUDGET ALLOCATION:\n" + "\n".join(breakdown_lines)

        focus_context = f"You are analyzing the ENTIRE project budget across ALL sections. The total estimated cost is ₹{total_budget_cost:,.2f}."
        audit_rules = """STRICT AUDIT RULES FOR ENTIRE PROJECT:
1. GENERATE EXACTLY ONE INSIGHT PER SECTION: You must output exactly one single, accumulated suggestion for each section provided in the data.
2. ACT AS A HARSH PROJECT CRITIC: Aggressively look for value engineering opportunities for each section based on its line items, just like an architect would.
3. ALIGN WITH SECTIONAL LOGIC: Your high-level summary for each section must match the critical approach you would take if analyzing that section individually. Suggest real, modern construction alternatives if costs can be optimized.
4. FOR EACH SUGGESTION, you MUST state the section name, its allocated budget amount (from the breakdown above), and its percentage share of the total project cost.
5. If the section is perfectly priced, explain exactly why it aligns with market standards. If it can be optimized, suggest real alternatives.
6. Keep it punchy but use authentic, professional sentences. Explain the rationale clearly without being overly verbose."""

    prompt = f"""Act as a highly experienced Indian real estate construction veteran and cost auditor.
{focus_context}
Slab Area: {req.slabArea} Sqft. GST: {req.gstRate * 100}%.

{section_breakdown}

Input Data (Line Items by Section):
{json.dumps(compressed_data, separators=(',', ':'))}

{audit_rules}

Return ONLY a valid JSON object. DO NOT return the JSON schema itself. You must return actual generated data that matches this structure:

Example Output:
{{
  "insights": [
    {{
      "secId": "civil",
      "t": "w",
      "title": "Example Title",
      "totalCost": "₹1.28 Cr",
      "occupiedCost": "₹45L (35%)",
      "suggestion": "Example suggestion explaining the budget..."
    }}
  ]
}}

Schema Constraints:
{json.dumps(BudgetInsightsSchema.model_json_schema())}
"""

    try:
        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
            temperature=0.0,
            seed=42,
            response_format={"type": "json_object"},
        )
        
        response_text = chat_completion.choices[0].message.content
        if not response_text:
            raise Exception("Empty response from Groq LLM")
            
        # Parse the JSON and validate it via Pydantic!
        raw_result = json.loads(response_text)
        validated_result = BudgetInsightsSchema.model_validate(raw_result)
        
        type_mapping = {"w": "warning", "s": "saving", "i": "info", "g": "suggestion"}
        
        insights_out = []
        for item in validated_result.insights:
            insights_out.append({
                "sectionId": item.secId,
                "type": type_mapping.get(item.t, "info"),
                "title": item.title,
                "totalCost": item.totalCost,
                "occupiedCost": item.occupiedCost,
                "body": item.suggestion
            })
            
        return {"insights": insights_out}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze-schedule")
async def analyze_schedule(req: AnalyzeScheduleRequest):
    # Compress phases to send only essential data to LLM
    compressed_phases = []
    
    if req.macro:
        for phase in req.phases:
            acts = phase.get("activities", [])
            total = len(acts)
            prog = sum([a.get("progress", 0) for a in acts]) / total if total > 0 else 0
            p_start = min([a.get('start') for a in acts if a.get('start')] or [None])
            p_end = max([a.get('end') for a in acts if a.get('end')] or [None])
            p_origStart = min([a.get('origStart') for a in acts if a.get('origStart')] or [None])
            p_origEnd = max([a.get('origEnd') for a in acts if a.get('origEnd')] or [None])
            
            compressed_phases.append({
                "name": phase.get("name"),
                "start": p_start,
                "end": p_end,
                "origStart": p_origStart,
                "origEnd": p_origEnd,
                "progress": prog
            })
        focus_prompt = "You are analyzing the MASTER TASKS (Phases). Evaluate the schedule at the macro Phase level. Treat each Phase as a single master task."
    else:
        for phase in req.phases:
            acts = []
            for act in phase.get("activities", []):
                acts.append({
                    "name": act.get("name"),
                    "start": act.get("start"),
                    "end": act.get("end"),
                    "origStart": act.get("origStart"),
                    "origEnd": act.get("origEnd"),
                    "progress": act.get("progress"),
                    "critical": act.get("critical"),
                    "milestone": act.get("milestone")
                })
            if acts:
                compressed_phases.append({
                    "name": phase.get("name"),
                    "activities": acts
                })
        focus_prompt = "You are analyzing the SUB-TASKS (Activities) within a specific master task. Evaluate the schedule at the granular Activity level."

    prompt = f"""Act as an expert project manager and schedule analyst.
{focus_prompt}
Analyze the provided Gantt chart schedule data for the construction project.

Input Data (Phases and Activities):
{json.dumps(compressed_phases)}

STRICT ANALYSIS RULES:
1. You MUST analyze EVERY task individually and report its status (On Time, Behind Schedule, Ahead of Time).
2. For each task, calculate and explicitly define the difference between its planned end date (origEnd) and current end date (end).
3. Identify how each task's status is affecting OTHER downstream tasks and document this in the `impact` field.
4. If a task is "Behind Schedule", provide a specific, actionable recommendation in the `action` field to mitigate the delay (e.g., "Add a second shift", "Expedite concrete delivery").
5. After evaluating all tasks, provide a SINGLE small "overallSuggestion" summarizing the overall health and the next best step for the project manager to optimize the schedule.
6. Return the result strictly following the JSON Schema provided.

Return ONLY a valid JSON object. DO NOT return the JSON schema itself. You must return actual generated data that matches this structure:

Example Output:
{{
  "taskStatuses": [
    {{
      "taskName": "Foundation Excavation",
      "status": "Behind Schedule",
      "difference": "3 days behind plan",
      "alert": true,
      "action": "Deploy one extra excavator and run a weekend shift to catch up.",
      "impact": "This delay is directly pushing back the start of the Site Preparation and Substructure phase by 3 days."
    }},
    {{
      "taskName": "Site Preparation",
      "status": "On Time",
      "difference": "0 days difference",
      "alert": false,
      "action": "Continue as planned.",
      "impact": "Currently not affecting any downstream tasks."
    }}
  ],
  "overallSuggestion": "The project is mostly on track, but the foundation excavation delay requires deploying an extra excavator this weekend to catch up before the monsoon hits."
}}

Schema Constraints:
{json.dumps(ScheduleInsightsSchema.model_json_schema())}
"""

    try:
        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
            temperature=0.0,
            seed=42,
            response_format={"type": "json_object"}
        )
        response_text = chat_completion.choices[0].message.content
        return ScheduleInsightsSchema.model_validate_json(response_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
