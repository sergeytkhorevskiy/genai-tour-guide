import os
from dotenv import load_dotenv
from openai import OpenAI
from .tools import get_weather, get_weather_forecast, get_recommendations

# Завантажуємо змінні середовища з .env файлу
load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_API_KEY)



def agent_respond(query: str, city: str = "Kyiv", chat_history: list = None) -> tuple[str, str]:
    if chat_history is None:
        chat_history = []
    
    # Викликаємо кастомний tool для погоди
    weather = get_weather(city)
    # Викликаємо кастомний tool для рекомендацій
    recs = get_recommendations(city, weather)
    
    # Перевіряємо, чи користувач запитує прогноз погоди
    query_lower = query.lower()
    weather_keywords = ['прогноз', 'завтра', 'тиждень', 'наступні дні', 'forecast', 'weather forecast']
    is_forecast_request = any(keyword in query_lower for keyword in weather_keywords)
    
    # Додаємо прогноз погоди, якщо потрібно
    weather_info = weather
    if is_forecast_request:
        forecast = get_weather_forecast(city, days=5)
        weather_info = f"{weather}\n\n{forecast}"
    
    # Створюємо системний промпт з інструкціями для OpenAI
    system_prompt = (
        f"Ти туристичний гід у місті {city}. "
        f"Погода: {weather_info}. "
        f"Ось кілька порад: {recs}. "
        "Відповідай дружньо, коротко, як сучасний гід. "
        "Пам'ятай всю попередню розмову з користувачем. "
        f"Якщо користувач запитує про інше місто, автоматично переключайся на нього. "
        f"Якщо користувач запитує прогноз погоди, надай детальну інформацію про погоду на кілька днів. "
        f"ВАЖЛИВО: Якщо користувач згадує інше місто, починай відповідь з '[CITY:назва_міста]' "
        f"наприклад '[CITY:Київ]' або '[CITY:Львів]'. Якщо місто не змінюється, не додавай цей тег. "
        f"ФОРМАТУВАННЯ: Використовуй markdown для красивого відображення: "
        f"**жирний текст** для важливих моментів, "
        f"списки з • або 1. 2. 3., "
        f"розділяй параграфи порожніми рядками."
    )
    
    # Формуємо повідомлення для OpenAI API
    messages = [{"role": "system", "content": system_prompt}]
    
    # Додаємо історію чату
    for msg in chat_history:
        messages.append({"role": msg["role"], "content": msg["content"]})
    
    # Додаємо поточне питання
    messages.append({"role": "user", "content": query})
    
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages
    )
    
    answer = response.choices[0].message.content
    
    # Перевіряємо, чи OpenAI вказав зміну міста
    import re
    city_match = re.search(r'\[CITY:([^\]]+)\]', answer)
    if city_match:
        new_city = city_match.group(1).strip()
        # Видаляємо тег з відповіді
        answer = re.sub(r'\[CITY:[^\]]+\]\s*', '', answer)
        print(f"OpenAI detected city change: {city} -> {new_city}")
        return answer, new_city
    
    return answer, city
