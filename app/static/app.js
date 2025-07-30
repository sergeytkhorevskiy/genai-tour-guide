class ChatBot {
    constructor() {
        this.chatContainer = document.getElementById('chatContainer');
        this.chatForm = document.getElementById('chatForm');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.btnText = document.querySelector('.btn-text');
        this.btnLoading = document.querySelector('.btn-loading');
        this.clearChatBtn = document.getElementById('clearChatBtn');
        this.clearCacheBtn = document.getElementById('clearCacheBtn');
        this.currentCityDisplay = document.getElementById('currentCityDisplay');
        this.cityName = document.getElementById('cityName');
        
        this.chatHistory = this.loadChatHistory();
        this.currentCity = this.loadCurrentCity();
        this.isFirstMessage = this.chatHistory.length === 0;
        
        console.log('ChatBot initialized with:', {
            chatHistoryLength: this.chatHistory.length,
            currentCity: this.currentCity,
            isFirstMessage: this.isFirstMessage
        });
        
        this.init();
    }
    
    init() {
        this.chatForm.addEventListener('submit', (e) => this.handleSubmit(e));
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSubmit(e);
            }
        });
        
        this.clearChatBtn.addEventListener('click', () => {
            if (confirm('Ви впевнені, що хочете очистити історію чату?')) {
                this.clearChatHistory();
            }
        });
        
        this.clearCacheBtn.addEventListener('click', async () => {
            if (confirm('Ви впевнені, що хочете очистити кеш погоди та рекомендацій?')) {
                await this.clearCache();
            }
        });
        
        // Відновлюємо історію чату або показуємо привітання
        if (this.chatHistory.length > 0) {
            this.restoreChatHistory();
            this.updateCityDisplay();
        } else {
            this.addBotMessage("Привіт! 👋 Я твій AI туристичний гід. В яке місто ти плануєш подорож?");
        }
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        
        const message = this.messageInput.value.trim();
        if (!message) return;
        
        // Додаємо повідомлення користувача
        this.addUserMessage(message);
        this.messageInput.value = '';
        
        // Показуємо індикатор завантаження
        this.setLoading(true);
        
        try {
            let response;
            
            if (this.isFirstMessage) {
                // Перше повідомлення - визначаємо місто
                console.log('First message detected, setting city to:', message);
                this.currentCity = message;
                this.isFirstMessage = false;
                this.saveCurrentCity(); // Зберігаємо місто
                this.updateCityDisplay();
                
                // Запитуємо інформацію про місто
                response = await this.sendMessage(message, this.currentCity);
            } else {
                // Наступні повідомлення - перевіряємо чи змінилося місто
                const previousCity = this.currentCity;
                response = await this.sendMessage(message, this.currentCity);
                
                // Якщо місто змінилося, оновлюємо відображення
                if (this.currentCity !== previousCity) {
                    this.updateCityDisplay();
                }
            }
            
            // Додаємо відповідь бота
            this.addBotMessage(response);
            
        } catch (error) {
            console.error('Помилка:', error);
            this.addBotMessage("Вибачте, сталася помилка. Спробуйте ще раз.");
        } finally {
            this.setLoading(false);
        }
    }
    
    async sendMessage(message, city) {
        const response = await fetch('/api/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                question: message,
                city: city,
                chat_history: this.chatHistory
            })
        });
        
        if (!response.ok) {
            throw new Error('Помилка мережі');
        }
        
        const data = await response.json();
        console.log('Server response:', data);
        
        // Оновлюємо поточне місто, якщо воно змінилося
        if (data.detected_city && data.detected_city !== this.currentCity) {
            console.log('City changed from', this.currentCity, 'to', data.detected_city);
            this.currentCity = data.detected_city;
            this.saveCurrentCity();
        }
        
        // Зберігаємо в історію
        this.chatHistory.push({
            role: 'user',
            content: message
        });
        this.chatHistory.push({
            role: 'assistant',
            content: data.answer
        });
        
        // Зберігаємо в localStorage
        this.saveChatHistory();
        
        return data.answer;
    }
    
    // Методи для роботи з localStorage
    saveChatHistory() {
        localStorage.setItem('chatHistory', JSON.stringify(this.chatHistory));
    }
    
    loadChatHistory() {
        const saved = localStorage.getItem('chatHistory');
        return saved ? JSON.parse(saved) : [];
    }
    
    saveCurrentCity() {
        if (this.currentCity) {
            localStorage.setItem('currentCity', this.currentCity);
            console.log('Saved city to localStorage:', this.currentCity);
        }
    }
    
    loadCurrentCity() {
        const savedCity = localStorage.getItem('currentCity');
        console.log('Loading city from localStorage:', savedCity);
        
        // Очищаємо неправильні значення
        if (savedCity && ['погода', 'погоди', 'weather'].includes(savedCity.toLowerCase())) {
            console.log('Removing invalid city from localStorage:', savedCity);
            localStorage.removeItem('currentCity');
            return null;
        }
        
        return savedCity || null;
    }
    
    restoreChatHistory() {
        this.chatHistory.forEach(msg => {
            if (msg.role === 'user') {
                this.addUserMessage(msg.content, false);
            } else {
                this.addBotMessage(msg.content, false);
            }
        });
    }
    
    clearChatHistory() {
        this.chatHistory = [];
        this.currentCity = null;
        localStorage.removeItem('chatHistory');
        localStorage.removeItem('currentCity');
        this.chatContainer.innerHTML = '';
        this.isFirstMessage = true;
        this.currentCityDisplay.classList.add('d-none');
        this.addBotMessage("Привіт! 👋 Я твій AI туристичний гід. В яке місто ти плануєш подорож?");
    }
    
    async clearCache() {
        try {
            const response = await fetch('/api/clear-cache', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (response.ok) {
                alert('Кеш очищено успішно!');
            } else {
                alert('Помилка при очищенні кешу');
            }
        } catch (error) {
            console.error('Помилка:', error);
            alert('Помилка при очищенні кешу');
        }
    }
    
    updateCityDisplay() {
        console.log('updateCityDisplay called, currentCity:', this.currentCity);
        if (this.currentCity && this.currentCity.trim() !== '') {
            this.cityName.textContent = this.currentCity;
            this.currentCityDisplay.classList.remove('d-none');
            console.log('City display updated to:', this.currentCity);
        } else {
            this.currentCityDisplay.classList.add('d-none');
            console.log('City display hidden - no city');
        }
    }
    
    addUserMessage(message, save = true) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message user-message';
        messageElement.textContent = message;
        this.chatContainer.appendChild(messageElement);
        this.scrollToBottom();
    }
    
    addBotMessage(message, save = true) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message bot-message';
        messageElement.innerHTML = this.parseMessage(message);
        this.chatContainer.appendChild(messageElement);
        this.scrollToBottom();
    }
    
    parseMessage(message) {
        if (!message) return '';
        
        let parsed = message;
        
        // Захист від XSS
        parsed = this.escapeHtml(parsed);
        
        // Жирний текст (**текст** або __текст__)
        parsed = parsed.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        parsed = parsed.replace(/__(.*?)__/g, '<b>$1</b>');
        
        // Курсив (*текст* або _текст_)
        parsed = parsed.replace(/\*(.*?)\*/g, '<em>$1</em>');
        parsed = parsed.replace(/_(.*?)_/g, '<em>$1</em>');
        
        // Код (`код`)
        parsed = parsed.replace(/`(.*?)`/g, '<code>$1</code>');
        
        // Посилання [текст](url)
        parsed = parsed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        
        // Розділимо на рядки
        const lines = parsed.split('\n');
        const processedLines = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // Нумеровані списки (1. 2. 3. або 1) 2) 3))
            if (/^\d+[\.\)]\s+/.test(line)) {
                const number = line.match(/^(\d+[\.\)]\s+)/)[1];
                const content = line.replace(/^\d+[\.\)]\s+/, '');
                processedLines.push(`<li class="numbered">${number}${content}</li>`);
            }
            // Марковані списки (- або •)
            else if (/^[\-\•]\s+/.test(line)) {
                const content = line.replace(/^[\-\•]\s+/, '');
                processedLines.push(`<li>${content}</li>`);
            }
            // Звичайний текст
            else {
                processedLines.push(`<p>${line}</p>`);
            }
        }
        
        // Групуємо списки
        let result = '';
        let currentList = [];
        let inList = false;
        
        for (let i = 0; i < processedLines.length; i++) {
            const line = processedLines[i];
            
            if (line.startsWith('<li')) {
                if (!inList) {
                    inList = true;
                    currentList = [];
                }
                currentList.push(line);
            } else {
                if (inList) {
                    // Закриваємо попередній список
                    result += `<ul>${currentList.join('')}</ul>`;
                    currentList = [];
                    inList = false;
                }
                result += line;
            }
        }
        
        // Закриваємо останній список, якщо він є
        if (inList) {
            result += `<ul>${currentList.join('')}</ul>`;
        }
        
        return result;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    setLoading(isLoading) {
        this.messageInput.disabled = isLoading;
        this.sendButton.disabled = isLoading;
        
        if (isLoading) {
            this.btnText.classList.add('d-none');
            this.btnLoading.classList.remove('d-none');
        } else {
            this.btnText.classList.remove('d-none');
            this.btnLoading.classList.add('d-none');
        }
    }
    
    scrollToBottom() {
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }
    

}

// Ініціалізуємо чат-бот при завантаженні сторінки
document.addEventListener('DOMContentLoaded', () => {
    new ChatBot();
});
