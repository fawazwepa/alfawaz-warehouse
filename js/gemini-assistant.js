/* =============================================================
   Al-Fawaz Pharmaceutical Warehouse - Gemini AI Assistant Logic
   ============================================================= */

let customGeminiApiKey = localStorage.getItem('alfawaz_gemini_api_key') || '';

document.addEventListener('DOMContentLoaded', function() {
    initGeminiAssistant();
});

function initGeminiAssistant() {
    const keyInput = document.getElementById('geminiCustomApiKeyInput');
    if (keyInput && customGeminiApiKey) {
        keyInput.value = customGeminiApiKey;
    }
}

function toggleGeminiChat() {
    const drawer = document.getElementById('geminiChatDrawer');
    if (drawer) {
        drawer.classList.toggle('active');
        if (drawer.classList.contains('active')) {
            const input = document.getElementById('geminiInput');
            if (input) input.focus();
        }
    }
}

function closeGeminiChat() {
    const drawer = document.getElementById('geminiChatDrawer');
    if (drawer) {
        drawer.classList.remove('active');
    }
}

function toggleGeminiKeySettings() {
    const settingsBox = document.getElementById('geminiKeySettingsBox');
    if (settingsBox) {
        settingsBox.classList.toggle('active');
    }
}

function saveCustomGeminiApiKey() {
    const input = document.getElementById('geminiCustomApiKeyInput');
    if (input) {
        customGeminiApiKey = input.value.trim();
        localStorage.setItem('alfawaz_gemini_api_key', customGeminiApiKey);
        alert('تم حفظ مفتاح Gemini API بنجاح في متصفحك!');
        toggleGeminiKeySettings();
    }
}

function sendQuickGeminiPrompt(text) {
    const input = document.getElementById('geminiInput');
    if (input) {
        input.value = text;
        handleGeminiSend();
    }
}

async function handleGeminiSend() {
    const input = document.getElementById('geminiInput');
    if (!input) return;

    const userPrompt = input.value.trim();
    if (!userPrompt) return;

    input.value = '';

    // Append User Message
    appendGeminiMessage(userPrompt, 'user');

    // Append Typing Indicator
    const typingId = appendTypingIndicator();

    try {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: userPrompt,
                customApiKey: customGeminiApiKey,
                currentCart: typeof cart !== 'undefined' ? cart : []
            })
        });

        removeTypingIndicator(typingId);

        const data = await response.json();

        if (response.ok && data.success) {
            appendGeminiMessage(data.reply, 'bot');
        } else if (data.error === 'MISSING_API_KEY') {
            appendGeminiMessage('⚠️ ' + data.message, 'bot');
            toggleGeminiKeySettings();
        } else {
            appendGeminiMessage('❌ ' + (data.message || 'حدث خطأ أثناء التواصل مع الذكاء الاصطناعي.'), 'bot');
        }
    } catch (err) {
        removeTypingIndicator(typingId);
        console.error('Gemini fetch error:', err);
        appendGeminiMessage('❌ تعذر الاتصال بالخادم. يرجى التأكد من تشغيل الاتصال بالإنترنت.', 'bot');
    }
}

function appendGeminiMessage(text, sender) {
    const container = document.getElementById('geminiMessagesContainer');
    if (!container) return;

    const timeStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    // Format text with basic markdown/line breaks
    let formattedText = escapeHtml(text)
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');

    const msgDiv = document.createElement('div');
    msgDiv.className = `gemini-msg ${sender}`;
    msgDiv.innerHTML = `
        <div>${formattedText}</div>
        <div class="gemini-msg-time">${timeStr}</div>
    `;

    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

function appendTypingIndicator() {
    const container = document.getElementById('geminiMessagesContainer');
    if (!container) return null;

    const id = 'typing_' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'gemini-typing-indicator';
    div.innerHTML = `<i class="fas fa-spinner fa-spin"></i> جاري التحليل والرد بواسطة Gemini AI...`;

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return id;
}

function removeTypingIndicator(id) {
    if (!id) return;
    const elem = document.getElementById(id);
    if (elem) elem.remove();
}

function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
