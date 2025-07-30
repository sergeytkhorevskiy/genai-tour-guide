import os
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from .agent import agent_respond
from .tools import clear_cache

# Завантажуємо змінні середовища з .env файлу
load_dotenv()

app = FastAPI()
app.mount("/static", StaticFiles(directory="app/static"), name="static")

@app.get("/", response_class=HTMLResponse)
async def root():
    with open("app/static/index.html", "r", encoding="utf-8") as f:
        return HTMLResponse(f.read())

@app.post("/api/ask")
async def ask(request: Request):
    data = await request.json()
    question = data.get("question")
    city = data.get("city", "Kyiv")
    chat_history = data.get("chat_history", [])
    
    print(f"API request - question: {question}, city: {city}")
    
    answer, detected_city = agent_respond(question, city, chat_history)
    
    print(f"API response - detected_city: {detected_city}")
    
    return JSONResponse({
        "answer": answer,
        "detected_city": detected_city
    })

@app.post("/api/clear-cache")
async def clear_cache_endpoint():
    """Очищає кеш погоди та рекомендацій"""
    clear_cache()
    return JSONResponse({"message": "Кеш очищено успішно"})