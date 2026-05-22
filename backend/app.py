import os
import json
import datetime
from typing import Dict, TypedDict
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# LangGraph and LangChain imports
from langgraph.graph import StateGraph, END
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

# Load environment variables
load_dotenv()

app = FastAPI(title="LangGraph Customer Support Agent API")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- Database & Helper Functions -----------------

HISTORY_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "history.json"))

def load_history():
    if not os.path.exists(HISTORY_FILE):
        return []
    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def save_history_item(query, category, sentiment, response):
    history = load_history()
    item = {
        "id": len(history) + 1,
        "query": query,
        "category": category,
        "sentiment": sentiment,
        "response": response,
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    history.insert(0, item)  # Add to top (newest first)
    history = history[:50]   # Limit to last 50 items
    try:
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=4)
    except Exception as e:
        print(f"Error saving history: {e}")

def get_model():
    """Helper to initialize ChatGoogleGenAI using the key from env vars."""
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("Gemini API key is not configured. Please add it via UI settings.")
    # Map to GOOGLE_API_KEY for langchain compatibility
    os.environ["GOOGLE_API_KEY"] = api_key
    return ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0)

# ----------------- LangGraph Definitions -----------------

class State(TypedDict):
    query: str
    category: str
    sentiment: str
    response: str

def categorize(state: State) -> State:
    """Categorize the customer query into Technical, Billing, or General."""
    prompt = ChatPromptTemplate.from_template(
        "You are an expert customer service router. Categorize the following customer query into exactly "
        "one of these three categories: Technical, Billing, General.\n\n"
        "Query: {query}\n\n"
        "Respond with only the category name (Technical, Billing, or General) without punctuation."
    )
    chain = prompt | get_model()
    try:
        category = chain.invoke({"query": state["query"]}).content.strip()
        # Normalize response
        normalized = "General"
        if "technical" in category.lower():
            normalized = "Technical"
        elif "billing" in category.lower():
            normalized = "Billing"
    except Exception as e:
        print(f"Error in categorize node: {e}")
        normalized = "General"
        
    return {"category": normalized}

def analyze_sentiment(state: State) -> State:
    """Analyze the sentiment of the customer query as Positive, Neutral, or Negative."""
    prompt = ChatPromptTemplate.from_template(
        "Analyze the emotional sentiment of the following customer query. "
        "Respond with exactly one of these words: Positive, Neutral, Negative.\n\n"
        "Query: {query}\n\n"
        "Respond with only the sentiment word without punctuation."
    )
    chain = prompt | get_model()
    try:
        sentiment = chain.invoke({"query": state["query"]}).content.strip()
        # Normalize response
        normalized = "Neutral"
        if "positive" in sentiment.lower():
            normalized = "Positive"
        elif "negative" in sentiment.lower():
            normalized = "Negative"
    except Exception as e:
        print(f"Error in analyze_sentiment node: {e}")
        normalized = "Neutral"
        
    return {"sentiment": normalized}

def handle_technical(state: State) -> State:
    """Provide a technical support response to the query."""
    prompt = ChatPromptTemplate.from_template(
        "You are a helpful, polite and professional technical support engineer.\n"
        "Provide a high-quality, practical response to resolve the customer's issue.\n\n"
        "Query: {query}"
    )
    chain = prompt | get_model()
    try:
        response = chain.invoke({"query": state["query"]}).content.strip()
    except Exception as e:
        response = f"Sorry, we encountered a technical error: {str(e)}"
    return {"response": response}

def handle_billing(state: State) -> State:
    """Provide a billing support response to the query."""
    prompt = ChatPromptTemplate.from_template(
        "You are a helpful, polite and professional billing support representative.\n"
        "Provide a clear, detailed, and reassuring response to resolve the billing query.\n\n"
        "Query: {query}"
    )
    chain = prompt | get_model()
    try:
        response = chain.invoke({"query": state["query"]}).content.strip()
    except Exception as e:
        response = f"Sorry, we encountered an error while processing billing query: {str(e)}"
    return {"response": response}

def handle_general(state: State) -> State:
    """Provide a general support response to the query."""
    prompt = ChatPromptTemplate.from_template(
        "You are a friendly, helpful, and professional customer service agent.\n"
        "Provide a polite, warm, and structured response to the customer.\n\n"
        "Query: {query}"
    )
    chain = prompt | get_model()
    try:
        response = chain.invoke({"query": state["query"]}).content.strip()
    except Exception as e:
        response = f"Sorry, we encountered a server error: {str(e)}"
    return {"response": response}

def escalate(state: State) -> State:
    """Escalate the query to a human agent due to negative sentiment."""
    response = (
        "⚠️ This query has been automatically escalated to our VIP human support queue "
        "due to the urgent or distressed nature of your request. A senior representative "
        "has been assigned and will contact you via email or phone within 15 minutes."
    )
    return {"response": response}

def route_query(state: State) -> str:
    """Route the query based on its sentiment and category."""
    if state.get("sentiment") == "Negative":
        return "escalate"
    elif state.get("category") == "Technical":
        return "handle_technical"
    elif state.get("category") == "Billing":
        return "handle_billing"
    else:
        return "handle_general"

# Assemble the StateGraph
workflow = StateGraph(State)

workflow.add_node("categorize", categorize)
workflow.add_node("analyze_sentiment", analyze_sentiment)
workflow.add_node("handle_technical", handle_technical)
workflow.add_node("handle_billing", handle_billing)
workflow.add_node("handle_general", handle_general)
workflow.add_node("escalate", escalate)

workflow.add_edge("categorize", "analyze_sentiment")
workflow.add_conditional_edges(
    "analyze_sentiment",
    route_query,
    {
        "handle_technical": "handle_technical",
        "handle_billing": "handle_billing",
        "handle_general": "handle_general",
        "escalate": "escalate"
    }
)

workflow.add_edge("handle_technical", END)
workflow.add_edge("handle_billing", END)
workflow.add_edge("handle_general", END)
workflow.add_edge("escalate", END)

workflow.set_entry_point("categorize")

# Compile LangGraph app
langgraph_app = workflow.compile()

# ----------------- FastAPI API Models -----------------

class ChatRequest(BaseModel):
    query: str

# ----------------- API Endpoints -----------------

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    query = request.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")
        
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return {
            "success": False,
            "error": "Gemini API key is missing. Please set it in the settings panel."
        }
        
    try:
        steps = []
        current_state = {"query": query, "category": "Pending", "sentiment": "Pending", "response": ""}
        
        # Execute the LangGraph streaming state changes
        for event in langgraph_app.stream({"query": query}):
            for node_name, node_state in event.items():
                for k, v in node_state.items():
                    current_state[k] = v
                steps.append({
                    "node": node_name,
                    "state": current_state.copy()
                })
                
        # Persist to local JSON history
        save_history_item(
            query=query,
            category=current_state.get("category", "General"),
            sentiment=current_state.get("sentiment", "Neutral"),
            response=current_state.get("response", "")
        )
        
        return {
            "success": True,
            "query": query,
            "category": current_state.get("category"),
            "sentiment": current_state.get("sentiment"),
            "response": current_state.get("response"),
            "steps": steps
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Error running LangGraph agent: {str(e)}"
        }

@app.get("/api/history")
async def history_endpoint():
    return load_history()

@app.post("/api/history/clear")
async def clear_history_endpoint():
    try:
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/settings")
async def get_settings_endpoint():
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    preview = ""
    if api_key:
        preview = f"AIzaSy...{api_key[-4:]}" if len(api_key) > 10 else "API Key Set"
    return {
        "hasKey": bool(api_key),
        "keyPreview": preview
    }

@app.post("/api/settings")
async def save_settings_endpoint(data: dict):
    new_key = data.get("apiKey", "").strip()
    if not new_key:
        return {"success": False, "error": "API Key cannot be empty"}
        
    os.environ["GEMINI_API_KEY"] = new_key
    os.environ["GOOGLE_API_KEY"] = new_key
    
    # Save to local .env
    env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
    
    lines = []
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
        except Exception:
            pass
            
    gemini_key_replaced = False
    google_key_replaced = False
    new_lines = []
    
    for line in lines:
        if line.strip().startswith("GEMINI_API_KEY="):
            new_lines.append(f"GEMINI_API_KEY={new_key}\n")
            gemini_key_replaced = True
        elif line.strip().startswith("GOOGLE_API_KEY="):
            new_lines.append(f"GOOGLE_API_KEY={new_key}\n")
            google_key_replaced = True
        else:
            new_lines.append(line)
            
    if not gemini_key_replaced:
        new_lines.append(f"GEMINI_API_KEY={new_key}\n")
    if not google_key_replaced:
        new_lines.append(f"GOOGLE_API_KEY={new_key}\n")
        
    try:
        with open(env_path, "w", encoding="utf-8") as f:
            f.writelines(new_lines)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": f"Failed to save to .env: {str(e)}"}

# ----------------- Static File Hosting -----------------

# Mount frontend directory for hosting index.html, style.css, and app.js
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
else:
    print(f"WARNING: Frontend directory not found at {frontend_dir}. Make sure you create it.")

if __name__ == "__main__":
    import uvicorn
    # Default port is 8000
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
