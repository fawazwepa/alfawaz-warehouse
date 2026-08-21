/* =============================================================
   Al-Fawaz Pharmaceutical Warehouse - Real Gemini AI Assistant Logic
   Google Generative AI Integration, Voice Dictation, Cart Analysis
   ============================================================= */

let customGeminiApiKey = localStorage.getItem('alfawaz_gemini_api_key') || '';
let selectedAiModel = localStorage.getItem('alfawaz_gemini_model') || 'gemini-2.5-flash';
let speechRecognitionInstance = null;
let isRecordingVoice = false;

document.addEventListener('DOMContentLoaded', function() {
    initGeminiAssistant();
    checkAiServerStatus();
    setupSpeechRecognition();
});

function initGeminiAssistant() {
    const keyInput = document.getElementById('geminiCustomApiKeyInput');
    if (keyInput && customGeminiApiKey) {
        keyInput.value = customGeminiApiKey;
    }

    const modelSelect = document.getElementById('geminiModelSelect');
    if (modelSelect) {
        modelSelect.value = selectedAiModel;
    }
}

async function checkAiServerStatus() {
    const statusBadge = document.getElementById('aiServerStatusBadge');
    const headerStatusBadge = document.getElementById('headerServerStatus');

    try {
        const res = await fetch('/api/gemini/status');
        if (res.ok) {
            const data = await res.json();
            if (statusBadge) {
                statusBadge.innerHTML = `<i class="fas fa-circle-check"></i> متصل بسيرفر Google Gemini (${data.default_model})`;
                statusBadge.className = 'gemini-server-status online';
            }
            if (headerStatusBadge) {
                headerStatusBadge.innerHTML = `<i class="fas fa-plug-circle-check"></i> السيرفر متصل ومزامن (Google Gemini AI)`;
                headerStatusBadge.classList.add('online');
            }
        }
    } catch (e) {
        if (statusBadge) {
            statusBadge.innerHTML = `<i class="fas fa-triangle-exclamation"></i> وضع غير متصل بالسيرفر`;
            statusBadge.className = 'gemini-server-status offline';
        }
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
    const modelSelect = document.getElementById('geminiModelSelect');

    if (input) {
        customGeminiApiKey = input.value.trim();
        localStorage.setItem('alfawaz_gemini_api_key', customGeminiApiKey);
    }

    if (modelSelect) {
        selectedAiModel = modelSelect.value;
        localStorage.setItem('alfawaz_gemini_model', selectedAiModel);
    }

    showToastNotification('تم حفظ إعدادات وسيرفر Gemini AI بنجاح!');
    toggleGeminiKeySettings();
    checkAiServerStatus();
}

function sendQuickGeminiPrompt(text) {
    const input = document.getElementById('geminiInput');
    if (input) {
        input.value = text;
        handleGeminiSend();
    }
}

/* ---------------- Speech Recognition (Voice Input) ---------------- */
function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        const voiceBtn = document.getElementById('geminiVoiceBtn');
        if (voiceBtn) voiceBtn.style.display = 'none';
        return;
    }

    speechRecognitionInstance = new SpeechRecognition();
    speechRecognitionInstance.lang = 'ar-SA';
    speechRecognitionInstance.continuous = false;
    speechRecognitionInstance.interimResults = false;

    speechRecognitionInstance.onstart = function() {
        isRecordingVoice = true;
        const voiceBtn = document.getElementById('geminiVoiceBtn');
        if (voiceBtn) voiceBtn.classList.add('recording');
        const input = document.getElementById('geminiInput');
        if (input) input.placeholder = 'جاري الاستماع لصوتك... تكلم الآن...';
    };

    speechRecognitionInstance.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        const input = document.getElementById('geminiInput');
        if (input) {
            input.value = transcript;
            handleGeminiSend();
        }
    };

    speechRecognitionInstance.onerror = function(event) {
        console.warn('Speech recognition error:', event.error);
        stopVoiceRecording();
    };

    speechRecognitionInstance.onend = function() {
        stopVoiceRecording();
    };
}

function toggleVoiceRecording() {
    if (!speechRecognitionInstance) {
        alert('ميزة الإملاء الصوتي غير مدعومة في متصفحك الحالي.');
        return;
    }

    if (isRecordingVoice) {
        speechRecognitionInstance.stop();
        stopVoiceRecording();
    } else {
        try {
            speechRecognitionInstance.start();
        } catch (err) {
            console.warn('Speech start error:', err);
        }
    }
}

function stopVoiceRecording() {
    isRecordingVoice = false;
    const voiceBtn = document.getElementById('geminiVoiceBtn');
    if (voiceBtn) voiceBtn.classList.remove('recording');
    const input = document.getElementById('geminiInput');
    if (input) input.placeholder = 'اسأل عن دواء، مادة فعالة، أو بديل...';
}

/* ---------------- Send Message to Gemini AI Server ---------------- */
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
        const response = await fetch('/api/gemini/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: userPrompt,
                customApiKey: customGeminiApiKey,
                modelName: selectedAiModel,
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
            appendGeminiMessage('❌ ' + (data.message || 'حدث خطأ أثناء التواصل مع سيرفر Gemini.'), 'bot');
        }
    } catch (err) {
        removeTypingIndicator(typingId);
        console.error('Gemini fetch error:', err);
        appendGeminiMessage('❌ تعذر الاتصال بسيرفر الذكاء الاصطناعي. يرجى التحقق من اتصالك بالشبكة.', 'bot');
    }
}

/* ---------------- Analyze Cart with Gemini AI ---------------- */
async function analyzeCartWithGemini() {
    if (typeof cart === 'undefined' || cart.length === 0) {
        alert('سلة الطلبية فارغة! أضف أدوية أولاً لتحليلها بالذكاء الاصطناعي.');
        return;
    }

    toggleGeminiChat();
    appendGeminiMessage(`🔍 تحليل ذكي لسلة الطلبية الحالية (${cart.length} أصناف)...`, 'user');
    const typingId = appendTypingIndicator();

    try {
        const response = await fetch('/api/gemini/analyze-cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cart: cart,
                customApiKey: customGeminiApiKey
            })
        });

        removeTypingIndicator(typingId);
        const data = await response.json();

        if (response.ok && data.success) {
            appendGeminiMessage(`📊 **تقرير التحليل الصيدلاني لسلة الطلبية من Gemini AI:**\n\n${data.analysis}`, 'bot');
        } else {
            appendGeminiMessage(`⚠️ ${data.message || 'تعذر استكمال تحليل السلة.'}`, 'bot');
        }
    } catch (err) {
        removeTypingIndicator(typingId);
        appendGeminiMessage('❌ تعذر الاتصال بسيرفر تحليل السلة.', 'bot');
    }
}

/* ---------------- Quick Drug Alternatives Lookup ---------------- */
async function askAiForDrugAlternatives(medName, activeIng) {
    toggleGeminiChat();
    const prompt = `ما هي بدائل دواء "${medName}" (${activeIng}) في بروشور مستودع الفواز؟`;
    appendGeminiMessage(prompt, 'user');
    const typingId = appendTypingIndicator();

    try {
        const response = await fetch('/api/gemini/suggest-alternatives', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                medicineName: medName,
                activeIngredient: activeIng,
                customApiKey: customGeminiApiKey
            })
        });

        removeTypingIndicator(typingId);
        const data = await response.json();

        if (response.ok && data.success) {
            appendGeminiMessage(`💊 **البدائل الصيدلانية المقترحة من سيرفر الفواز:**\n\n${data.alternatives}`, 'bot');
        } else {
            appendGeminiMessage(`⚠️ ${data.message || 'تعذر البحث عن بدائل.'}`, 'bot');
        }
    } catch (err) {
        removeTypingIndicator(typingId);
        appendGeminiMessage('❌ تعذر الاتصال بسيرفر البحث عن البدائل.', 'bot');
    }
}

function appendGeminiMessage(text, sender) {
    const container = document.getElementById('geminiMessagesContainer');
    if (!container) return;

    const timeStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    // Format text with basic markdown styling
    let formattedText = escapeHtml(text)
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/- (.*?)(<br>|$)/g, '<div class="gemini-list-item">• $1</div>');

    const msgDiv = document.createElement('div');
    msgDiv.className = `gemini-msg ${sender}`;
    msgDiv.innerHTML = `
        <div class="gemini-msg-body">${formattedText}</div>
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
    div.innerHTML = `<i class="fas fa-spinner fa-spin"></i> سيرفر Google Gemini AI يقوم بالتحليل والصياغة...`;

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

