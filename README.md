# Intelligent Customer Support Agent (LangGraph & Gemini)

Welcome to the **Intelligent Customer Support Agent** project! This repository contains a fully-fledged, production-ready, interactive customer support orchestration dashboard built using **LangGraph** (Python's premier stateful graph library) and **Google Gemini** LLMs, combined with a premium, state-of-the-art Web UI dashboard.

This application is modeled directly from the Nir Diamant Generative AI agent tutorials, upgraded with custom tracing visuals and advanced Gemini-only integrations.

---

## 🌟 Key Features

1. **Structured LangGraph State Machine**: Manages the complete customer query lifecycle using state variables: `query`, `category`, `sentiment`, and `response`.
2. **Dynamic Semantic Routing**:
   - **Categorization Node**: Classifies user prompts into `Technical`, `Billing`, or `General` support categories.
   - **Sentiment Node**: Analyzes tone as `Positive`, `Neutral`, or `Negative`.
   - **Billing & Technical Resolvers**: Custom generative answer builders based on category.
   - **Automated Human Escalation**: Bypasses generative AI when a client's sentiment is classified as `Negative` (e.g., highly distressed, angry), automatically alerting senior representatives.
3. **Interactive Step-by-Step UI Trace**: Watch nodes light up in real-time on a graphical SVG flowchart as the backend processes the query state.
4. **Interactive Credentials Manager**: Paste your Gemini API key directly inside the dashboard settings to immediately configure the app locally.
5. **Live Log Analytics**: Filter, search, and audit past customer interactions stored in a fast local database.

---

## 📂 Project Architecture

```
customer_support_agent/
│
├── backend/
│   ├── app.py              # FastAPI server + LangGraph state machine definitions
│   ├── requirements.txt    # Backend Python library package versions
│   └── history.json        # Fast local database containing query logs
│
├── frontend/
│   ├── index.html          # Dashboard components & layout (HTML5)
│   ├── style.css           # Premium theme variables, layout grid & animations (CSS3)
│   └── app.js              # State binding, async APIs & SVG glowing transitions (ES6)
│
├── .env                    # Active local environment variables (stores your API keys)
├── .env.template           # Template for environment keys configuration
├── setup.bat               # Interactive setup script for Windows CMD
└── README.md               # User documentation
```

---

## 🛠️ Step-by-Step Installation (Windows)

We have packaged everything into an automated script. Follow these quick steps:

### 1. Run the Automated Installer
Double-click `setup.bat` or run it inside your Windows CMD terminal from the project folder:
```cmd
setup.bat
```
This script will:
- Check for Python 3.9+ installation.
- Build a safe local Python virtual environment (`venv`).
- Update pip and install all backend requirements (FastAPI, Uvicorn, LangGraph, LangChain, Google GenAI, etc.).
- Prepare your local `.env` configuration file automatically.
- Launch the Uvicorn server on **http://127.0.0.1:8000**.

---

## 🔑 Customizing Credentials & API Keys

To run models, the agent needs a Google Gemini API Key. You can get one for free at the [Google AI Studio Console](https://aistudio.google.com/).

You have two convenient ways to set it up:

### Method A: Through the Web Dashboard (Recommended)
1. Open **http://127.0.0.1:8000** in your browser.
2. Look at the **Gemini Credentials** widget in the left sidebar.
3. Paste your Gemini API key in the input box and click **Save Key**.
4. The system status indicator will instantly glow green: **CONNECTED**.

### Method B: Manual File Configuration
1. Open the `.env` file in the project's root folder using any text editor.
2. Edit the keys as shown:
   ```ini
   GEMINI_API_KEY=YourGeminiApiKeyHere...
   GOOGLE_API_KEY=YourGeminiApiKeyHere...
   ```
3. Save the file. The server will automatically pick up the key on the next query!

---

## 🚀 Testing and Verification

Once the API Key is set and the server is running, open the dashboard in your browser and select one of the **Test Templates** (or type your own query) to verify its execution:

| Test Input Prompt | Expected Category | Expected Sentiment | Expected Action / Routing Path |
| :--- | :--- | :--- | :--- |
| *Can you help me reset my account password? It keeps saying invalid credentials.* | **Technical** | **Neutral** | Routes to **Technical Support Node** (generates instructions). |
| *I was charged $49.99 twice on my bill this month. Please issue a refund immediately!* | **Billing** | **Negative** | Routes to **Escalate Node** (bypasses generation, marks for human support). |
| *What are your delivery options and normal business hours?* | **General** | **Positive / Neutral** | Routes to **General Support Node** (friendly information response). |

Observe the **LangGraph Execution Trace** timeline on the right side and the **Workflow Graph** visualizer in the left sidebar. They will animate sequentially as the state moves from **1. Categorize** ➡️ **2. Sentiment** ➡️ **Leaf nodes** ➡️ **END**.
