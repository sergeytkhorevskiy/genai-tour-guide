import os
import requests
import json
import time
from dotenv import load_dotenv
from transliterate import translit

# Завантажуємо змінні середовища з .env файлу
load_dotenv()

OPENWEATHER_API_KEY = os.getenv("WEATHER_API_KEY")
FOURSQUARE_API_KEY = os.getenv("FOURSQUARE_API_KEY")

# Кеш для зберігання даних
weather_cache = {}
recommendations_cache = {}
CACHE_DURATION = 1800  # 30 хвилин

def is_cache_valid(timestamp):
    """Перевіряє чи кеш ще дійсний"""
    return time.time() - timestamp < CACHE_DURATION

def get_weather(city):
    """Отримує поточну погоду для міста з кешуванням"""
    city_key = city.lower()
    
    # Перевіряємо кеш
    if city_key in weather_cache:
        cached_data = weather_cache[city_key]
        if is_cache_valid(cached_data['timestamp']):
            return cached_data['data']
    
    # Якщо кеш недійсний або відсутній, запитуємо нові дані
    url = (
        f"http://api.openweathermap.org/data/2.5/weather"
        f"?q={city}&units=metric&lang=ua&appid={OPENWEATHER_API_KEY}"
    )
    resp = requests.get(url)
    if resp.status_code != 200:
        return "Немає даних про погоду"
    
    data = resp.json()
    description = data['weather'][0]['description'].capitalize()
    temp = data['main']['temp']
    weather_info = f"{description}, {temp:+.1f}°C"
    
    # Зберігаємо в кеш
    weather_cache[city_key] = {
        'data': weather_info,
        'timestamp': time.time()
    }
    
    return weather_info

def get_weather_forecast(city, days=5):
    """Отримує прогноз погоди на кілька днів"""
    try:
        # Отримуємо координати міста
        coords = get_city_coordinates(city)
        if not coords:
            return "Не вдалося знайти координати міста"
        
        lat, lon = coords
        
        # Запитуємо прогноз
        url = (
            f"http://api.openweathermap.org/data/2.5/forecast"
            f"?lat={lat}&lon={lon}&units=metric&lang=ua&appid={OPENWEATHER_API_KEY}"
        )
        resp = requests.get(url)
        
        if resp.status_code != 200:
            return "Немає даних про прогноз погоди"
        
        data = resp.json()
        
        # Групуємо прогнози по днях
        daily_forecasts = {}
        for item in data['list']:
            date = item['dt_txt'].split(' ')[0]
            if date not in daily_forecasts:
                daily_forecasts[date] = []
            daily_forecasts[date].append(item)
        
        # Формуємо прогноз на кожен день
        forecast_text = f"Прогноз погоди в {city} на {days} днів:\n"
        
        for i, (date, items) in enumerate(list(daily_forecasts.items())[:days]):
            if i == 0:
                day_name = "Сьогодні"
            elif i == 1:
                day_name = "Завтра"
            else:
                # Конвертуємо дату в назву дня тижня
                from datetime import datetime
                date_obj = datetime.strptime(date, '%Y-%m-%d')
                day_name = date_obj.strftime('%A')  # Назва дня тижня
            
            # Беремо середню температуру та опис погоди
            temps = [item['main']['temp'] for item in items]
            descriptions = [item['weather'][0]['description'] for item in items]
            
            avg_temp = sum(temps) / len(temps)
            # Беремо найпоширеніший опис погоди
            from collections import Counter
            most_common_desc = Counter(descriptions).most_common(1)[0][0]
            
            forecast_text += f"• {day_name}: {most_common_desc.capitalize()}, {avg_temp:+.1f}°C\n"
        
        return forecast_text
        
    except Exception as e:
        print(f"Помилка отримання прогнозу: {e}")
        return "Помилка при отриманні прогнозу погоди"

def get_city_coordinates(city):
    """Отримує координати міста"""
    try:
        url = f"http://api.openweathermap.org/geo/1.0/direct?q={city}&limit=1&appid={OPENWEATHER_API_KEY}"
        resp = requests.get(url)
        
        if resp.status_code == 200:
            data = resp.json()
            if data and len(data) > 0:
                return data[0]['lat'], data[0]['lon']
        
        return None
    except Exception as e:
        print(f"Помилка отримання координат: {e}")
        return None

def transliterate_city(city):
    try:
        # Спробуємо транслітерувати з української чи російської
        return translit(city, 'uk', reversed=True)
    except Exception:
        # Якщо не вдалося — повертаємо як є (наприклад, уже латинка)
        return city

def get_recommendations(city, weather):
    """Отримує рекомендації для міста з кешуванням"""
    city_key = city.lower()
    
    # Перевіряємо кеш
    if city_key in recommendations_cache:
        cached_data = recommendations_cache[city_key]
        if is_cache_valid(cached_data['timestamp']):
            return cached_data['data']
    
    # Категорія залежить від погоди
    if "дощ" in weather.lower() or "похмур" in weather.lower():
        category = "Museum"
    else:
        category = "Park"

    city_latin = transliterate_city(city)

    url = "https://api.foursquare.com/v3/places/search"
    headers = {"Authorization": FOURSQUARE_API_KEY}
    params = {
        "near": city_latin,
        "categories": category,
        "limit": 3
    }
    resp = requests.get(url, headers=headers, params=params)
    if resp.status_code != 200:
        if category == "Museum":
            recommendations = "Радимо відвідати музей або кав'ярню."
        else:
            recommendations = "Варто прогулятись у місцевому парку або набережній."
    else:
        data = resp.json()
        places = [
            f"{p['name']} ({p['location']['formatted_address']})"
            for p in data.get('results', [])
        ]
        recommendations = " | ".join(places) if places else "Радимо пошукати цікаві місця на Google Maps."
    
    # Зберігаємо в кеш
    recommendations_cache[city_key] = {
        'data': recommendations,
        'timestamp': time.time()
    }
    
    return recommendations

def clear_cache():
    """Очищає кеш"""
    global weather_cache, recommendations_cache
    weather_cache.clear()
    recommendations_cache.clear()
