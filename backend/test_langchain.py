import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

# Load env variables
load_dotenv()

api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
if not api_key or api_key == "your_gemini_api_key_here":
    print("API Key is not set yet. Please paste your key in the web UI settings or manually edit .env.")
    exit(1)

os.environ["GOOGLE_API_KEY"] = api_key
print(f"Testing LangChain Gemini models with key: ...{api_key[-4:] if len(api_key) > 4 else ''}")

# List of models to probe
models_to_try = [
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-2.5-flash",
    "gemini-pro"
]

for model_name in models_to_try:
    print(f"\nTesting '{model_name}'...")
    try:
        model = ChatGoogleGenerativeAI(model=model_name, temperature=0)
        res = model.invoke("Hello! Say 'Model active' in exactly two words.")
        print(f" -> SUCCESS: {res.content.strip()}")
    except Exception as e:
        print(f" -> FAILED: {e}")
