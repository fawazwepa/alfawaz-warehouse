/* =============================================================
   Al-Fawaz Pharmaceutical Warehouse - Real Gemini Multi-Turn AI Assistant
   - Multi-turn conversation thread with full memory
   - Role-specific system instructions & dynamic model selection:
     * gemini-3.1-pro-preview (Clinical & Complex Pharmacology)
     * gemini-3.5-flash (General Warehouse & Bonus Advisor)
     * gemini-3.1-flash-lite (Fast Lookup & Instant Price Checks)
   - Real Audio Transcription via Microphone & gemini-3.5-flash
   ============================================================= */

const STORAGE_KEY_GEMINI_API_KEY = 'alfawaz_gemini_api_key';
const STORAGE_KEY_GEMINI_MODEL = 'alfawaz_gemini_model';
const STORAGE_KEY_GEMINI_ROLE = 'alfawaz_gemini_active_role';
const STORAGE_KEY_CHAT_HISTORY = 'alfawaz_gemini_chat_history_v2';

let customGeminiApiKey = localStorage.getItem(STORAGE_KEY_GEMINI_API_KEY) || '';
let selectedAiModel = localStorage.getItem(STORAGE_KEY_GEMINI_MODEL) || 'default';
let activeChatRole = localStorage.getItem(STORAGE_KEY_GEMINI_ROLE) || 'general'; // 'general' | 'clinical' | 'fast'
let chatHistory = [];

// Audio Recording state for gemini-3.5-flash transcription
let mediaRecorder = null;
let audioChunks = [];
let isAudioRecording = false;
let recordingTimerInterval = null;
let recordingSeconds = 0;
let activeAudioTarget = 'chat'; // 'chat' | 'search'

// Role definitions
const CHATBOT_ROLES = {
    general: {
        id: 'general',
        title: 'مستشار المستودع والبونص',
        subtitle: 'استشارات الأسعار، العروض، البدائل المتاحة وتعظيم البونص',
        icon: 'fas fa-warehouse',
        defaultModel: 'gemini-3.5-flash',
        modelDisplay: 'Gemini 3.5 Flash',
        color: '#0d9488',
        quickChips: [
            { text: 'ما هي أعلى عروض البونص المتاحة حالياً؟', label: '🎁 عروض البونص الأعلى' },
            { text: 'ما هي بدائل الأوفلوكساسين المتوفرة بالبروشور؟', label: '💊 بدائل الأوفلوكساسين' },
            { text: 'حلل سلة طلبيتي واقترح إضافات للبونص', label: '📊 تحليل سلة الطلبية', action: 'analyzeCart' },
            { text: 'ما هي أدوية شركة دومينا المتوفرة بأسعارها؟', label: '🏢 منتجات دومينا' }
        ]
    },
    clinical: {
        id: 'clinical',
        title: 'صيدلي سريري وطبي',
        subtitle: 'تحليل سريري، تداخلات دوائية، موانع الاستعمال والجرعات الدقيقة',
        icon: 'fas fa-user-doctor',
        defaultModel: 'gemini-3.1-pro-preview',
        modelDisplay: 'Gemini 3.1 Pro (تفكير سريري)',
        color: '#2563eb',
        quickChips: [
            { text: 'هل توجد تداخلات دوائية خطيرة بين أدويتي بالسلة؟', label: '⚠️ فحص التداخلات الدوائية' },
            { text: 'ما هي موانع استعمال مضادات الالتهاب غير الستيروئيدية لمرضى القرحة؟', label: '🩺 موانع الاستعمال' },
            { text: 'كيفية تعديل جرعات الصادات الحيوية لمرضى القصور الكلوي؟', label: '🧪 تعديل الجرعات الكلوية' },
            { text: 'ما هي المسكنات الآمنة للحوامل في الثلث الأول؟', label: '🤰 أدوية الحمل الآمنة' }
        ]
    },
    fast: {
        id: 'fast',
        title: 'استعلام فوري سريع',
        subtitle: 'بحث فوري خاطف عن الأسعار، العيارات والتوفر في ثوانٍ',
        icon: 'fas fa-bolt',
        defaultModel: 'gemini-3.1-flash-lite',
        modelDisplay: 'Gemini 3.1 Flash Lite (فائق السرعة)',
        color: '#ea580c',
        quickChips: [
            { text: 'سعر وبونص سيتامول أقراص وسيروب؟', label: '⚡ سعر سيتامول' },
            { text: 'توفر أوجمنتين وأسعار بدائله؟', label: '⚡ توفر أوجمنتين' },
            { text: 'سعر بروفين 400 و 600 ل.س؟', label: '⚡ سعر بروفين' },
            { text: 'أدوية الضغط المتوفرة سريعاً؟', label: '⚡ أدوية الضغط' }
        ]
    }
};

document.addEventListener('DOMContentLoaded', function() {
    initGeminiAssistant();
    checkAiServerStatus();
    loadChatHistory();
    renderRoleControls();
});

/* ---------------- Initialization ---------------- */
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

function loadChatHistory() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY_CHAT_HISTORY);
        if (saved) {
            chatHistory = JSON.parse(saved);
        } else {
            chatHistory = [];
        }
    } catch (e) {
        console.warn('Failed to load chat history:', e);
        chatHistory = [];
    }
    renderChatMessages();
}

function saveChatHistory() {
    try {
        // Keep last 30 turns
        if (chatHistory.length > 40) {
            chatHistory = chatHistory.slice(chatHistory.length - 40);
        }
        localStorage.setItem(STORAGE_KEY_CHAT_HISTORY, JSON.stringify(chatHistory));
    } catch (e) {
        console.warn('Failed to save chat history:', e);
    }
}

async function checkAiServerStatus() {
    const statusBadge = document.getElementById('aiServerStatusBadge');
    const headerStatusBadge = document.getElementById('headerServerStatus');

    try {
        const res = await fetch('/api/gemini/status');
        if (res.ok) {
            const data = await res.json();
            const currentRoleInfo = CHATBOT_ROLES[activeChatRole] || CHATBOT_ROLES.general;
            if (statusBadge) {
                statusBadge.innerHTML = `<i class="fas fa-circle-check"></i> متصل بسيرفر Gemini AI (${currentRoleInfo.modelDisplay})`;
                statusBadge.className = 'gemini-server-status online';
            }
            if (headerStatusBadge) {
                headerStatusBadge.innerHTML = `<i class="fas fa-plug-circle-check"></i> السيرفر متصل ومزامن (Google Gemini AI)`;
                headerStatusBadge.classList.add('online');
            }
        }
    } catch (e) {
        if (statusBadge) {
            statusBadge.innerHTML = `<i class="fas fa-triangle-exclamation"></i> وضع محلي`;
            statusBadge.className = 'gemini-server-status offline';
        }
    }
}

/* ---------------- Drawer & UI Controls ---------------- */
function toggleGeminiChat() {
    const drawer = document.getElementById('geminiChatDrawer');
    if (drawer) {
        drawer.classList.toggle('active');
        if (drawer.classList.contains('active')) {
            const input = document.getElementById('geminiInput');
            if (input) input.focus();
            scrollToBottom();
        }
    }
}

function closeGeminiChat() {
    const drawer = document.getElementById('geminiChatDrawer');
    if (drawer) {
        drawer.classList.remove('active');
    }
    if (isAudioRecording) {
        cancelAudioRecording();
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
        localStorage.setItem(STORAGE_KEY_GEMINI_API_KEY, customGeminiApiKey);
    }

    if (modelSelect) {
        selectedAiModel = modelSelect.value;
        localStorage.setItem(STORAGE_KEY_GEMINI_MODEL, selectedAiModel);
    }

    showToastNotification('تم حفظ إعدادات خادم وموديل Gemini AI بنجاح!');
    toggleGeminiKeySettings();
    checkAiServerStatus();
    renderRoleControls();
}

/* ---------------- Role Selection & Rendering ---------------- */
function setChatRole(roleId) {
    if (!CHATBOT_ROLES[roleId]) return;
    activeChatRole = roleId;
    localStorage.setItem(STORAGE_KEY_GEMINI_ROLE, roleId);
    
    renderRoleControls();
    renderQuickChips();
    checkAiServerStatus();
    showToastNotification(`تم التبديل إلى دور: ${CHATBOT_ROLES[roleId].title}`);
}

function renderRoleControls() {
    const roleContainer = document.getElementById('geminiRoleSelector');
    if (!roleContainer) return;

    const roles = Object.values(CHATBOT_ROLES);
    roleContainer.innerHTML = roles.map(role => `
        <button type="button" class="gemini-role-pill ${role.id === activeChatRole ? 'active' : ''}" 
                onclick="setChatRole('${role.id}')" 
                title="${role.subtitle} - يستخدم موديل ${role.defaultModel}">
            <i class="${role.icon}"></i>
            <span>${role.title}</span>
        </button>
    `).join('');

    // Update active model badge
    const activeModelBadge = document.getElementById('geminiActiveModelBadge');
    if (activeModelBadge) {
        const cur = CHATBOT_ROLES[activeChatRole] || CHATBOT_ROLES.general;
        activeModelBadge.innerHTML = `<i class="fas fa-microchip"></i> ${cur.modelDisplay}`;
    }

    renderQuickChips();
}

function renderQuickChips() {
    const chipsContainer = document.getElementById('geminiQuickChipsContainer');
    if (!chipsContainer) return;

    const currentRole = CHATBOT_ROLES[activeChatRole] || CHATBOT_ROLES.general;
    chipsContainer.innerHTML = currentRole.quickChips.map(chip => {
        if (chip.action === 'analyzeCart') {
            return `<button type="button" class="gemini-chip" onclick="analyzeCartWithGemini()"><i class="fas fa-chart-pie"></i> ${chip.label}</button>`;
        }
        return `<button type="button" class="gemini-chip" onclick="sendQuickGeminiPrompt('${escapeAttribute(chip.text)}')">${chip.label}</button>`;
    }).join('');
}

function sendQuickGeminiPrompt(text) {
    const input = document.getElementById('geminiInput');
    if (input) {
        input.value = text;
        handleGeminiSend();
    }
}

/* ---------------- Multi-Turn Chat Messaging ---------------- */
function renderChatMessages() {
    const container = document.getElementById('geminiMessagesContainer');
    if (!container) return;

    if (chatHistory.length === 0) {
        const role = CHATBOT_ROLES[activeChatRole] || CHATBOT_ROLES.general;
        container.innerHTML = `
            <div class="gemini-welcome-card">
                <div class="welcome-header">
                    <div class="welcome-icon"><i class="${role.icon}"></i></div>
                    <div>
                        <h4>أهلاً بك في محادثة Gemini AI متعددة الجولات 👋</h4>
                        <p class="welcome-subtitle">الدور النشط: <strong>${role.title}</strong> (${role.subtitle})</p>
                    </div>
                </div>
                <div class="welcome-features-list">
                    <div class="w-feat"><i class="fas fa-check-circle"></i> ذاكرة محادثة كاملة تحتفظ بسياق استفساراتك الطبية والمالية</div>
                    <div class="w-feat"><i class="fas fa-check-circle"></i> تفريغ صوتي مباشر عبر الميكروفون بواسطة <strong>Gemini 3.5 Flash</strong></div>
                    <div class="w-feat"><i class="fas fa-check-circle"></i> دعم أدوار متخصصة (سريري Pro 3.1، مستودع Flash 3.5، استعلام سريع Flash Lite)</div>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = chatHistory.map((msg, index) => {
        const isBot = msg.role === 'model' || msg.role === 'assistant';
        const formattedText = formatMarkdown(msg.content);
        const timeStr = msg.time || '';
        const modelTag = msg.modelUsed ? `<span class="gemini-msg-model-tag"><i class="fas fa-microchip"></i> ${msg.modelUsed}</span>` : '';
        const roleTag = msg.roleUsed ? `<span class="gemini-msg-role-tag">${CHATBOT_ROLES[msg.roleUsed]?.title || msg.roleUsed}</span>` : '';

        return `
            <div class="gemini-msg ${isBot ? 'bot' : 'user'}" data-index="${index}">
                <div class="gemini-msg-avatar">
                    <i class="${isBot ? 'fas fa-robot' : 'fas fa-user-md'}"></i>
                </div>
                <div class="gemini-msg-content-wrap">
                    <div class="gemini-msg-meta">
                        <span class="gemini-msg-sender">${isBot ? 'مساعد الفواز (Gemini)' : 'أنت (صيدلي)'}</span>
                        ${roleTag}
                        ${modelTag}
                        <span class="gemini-msg-time">${timeStr}</span>
                    </div>
                    <div class="gemini-msg-body">${formattedText}</div>
                    ${isBot ? `
                        <div class="gemini-msg-actions">
                            <button type="button" class="gemini-action-btn" onclick="copyMessageText(${index})" title="نسخ الرد">
                                <i class="fas fa-copy"></i> نسخ
                            </button>
                            <button type="button" class="gemini-action-btn" onclick="speakMessageText(${index})" title="قراءة الرد صوتياً">
                                <i class="fas fa-volume-up"></i> استماع
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    scrollToBottom();
}

async function handleGeminiSend() {
    const input = document.getElementById('geminiInput');
    if (!input) return;

    const userPrompt = input.value.trim();
    if (!userPrompt) return;

    input.value = '';

    const timeNow = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    // Add User Message to Multi-turn History
    const userMsgObj = {
        role: 'user',
        content: userPrompt,
        time: timeNow
    };
    chatHistory.push(userMsgObj);
    saveChatHistory();
    renderChatMessages();

    // Prepare History payload for Gemini API
    const historyPayload = chatHistory.slice(0, -1).map(m => ({
        role: m.role === 'model' || m.role === 'assistant' ? 'model' : 'user',
        content: m.content
    }));

    // Append Typing Indicator
    const typingId = appendTypingIndicator();

    try {
        const roleInfo = CHATBOT_ROLES[activeChatRole] || CHATBOT_ROLES.general;
        const requestedModel = selectedAiModel !== 'default' ? selectedAiModel : roleInfo.defaultModel;

        const response = await fetch('/api/gemini/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: userPrompt,
                history: historyPayload,
                role: activeChatRole,
                modelName: requestedModel,
                customApiKey: customGeminiApiKey,
                currentCart: typeof cart !== 'undefined' ? cart : []
            })
        });

        removeTypingIndicator(typingId);

        const data = await response.json();

        if (response.ok && data.success) {
            const botMsgObj = {
                role: 'model',
                content: data.reply,
                time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
                modelUsed: data.modelUsed || requestedModel,
                roleUsed: data.roleUsed || activeChatRole
            };
            chatHistory.push(botMsgObj);
            saveChatHistory();
            renderChatMessages();
        } else if (data.error === 'MISSING_API_KEY') {
            appendErrorMessage('⚠️ ' + data.message);
            toggleGeminiKeySettings();
        } else {
            appendErrorMessage('❌ ' + (data.message || 'حدث خطأ أثناء التواصل مع سيرفر Gemini.'));
        }
    } catch (err) {
        removeTypingIndicator(typingId);
        console.error('Gemini Multi-turn fetch error:', err);
        appendErrorMessage('❌ تعذر الاتصال بسيرفر الذكاء الاصطناعي. يرجى التحقق من اتصالك بالشبكة.');
    }
}

function clearGeminiChatHistory() {
    if (chatHistory.length === 0) return;
    if (confirm('هل أنت متأكد من رغبتك في بدء محادثة جديدة ومسح سجل الرسائل السابقة؟')) {
        chatHistory = [];
        saveChatHistory();
        renderChatMessages();
        showToastNotification('تم بدء محادثة جديدة بنجاح!');
    }
}

function copyMessageText(index) {
    if (chatHistory[index] && chatHistory[index].content) {
        navigator.clipboard.writeText(chatHistory[index].content).then(() => {
            showToastNotification('تم نسخ نص الرد إلى الحافظة!');
        }).catch(() => {
            showToastNotification('تعذر النسخ التلقائي.');
        });
    }
}

function speakMessageText(index) {
    if (!('speechSynthesis' in window)) {
        alert('ميزة القراءة الصوتية غير مدعومة في متصفحك.');
        return;
    }
    if (chatHistory[index] && chatHistory[index].content) {
        window.speechSynthesis.cancel();
        // Clean markdown symbols for natural speech
        const plain = chatHistory[index].content
            .replace(/\*\*/g, '')
            .replace(/[*_#`]/g, '')
            .replace(/•/g, '')
            .slice(0, 500); // Read first portion
        const utterance = new SpeechSynthesisUtterance(plain);
        utterance.lang = 'ar-SA';
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
    }
}

/* ---------------- Audio Recording & Transcription (gemini-3.5-flash) ---------------- */
async function startAudioRecording(target = 'chat') {
    activeAudioTarget = target;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('الميكروفون أو تسجيل الصوت غير مدعوم في متصفحك الحالي.');
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            } 
        });

        audioChunks = [];
        let mimeType = 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
            mimeType = 'audio/ogg';
        }

        mediaRecorder = new MediaRecorder(stream, { mimeType });

        mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            // Stop all audio tracks to release microphone
            stream.getTracks().forEach(track => track.stop());
            if (audioChunks.length > 0) {
                const audioBlob = new Blob(audioChunks, { type: mimeType });
                await processAudioTranscription(audioBlob, mimeType);
            }
        };

        mediaRecorder.start(250);
        isAudioRecording = true;
        recordingSeconds = 0;
        showRecordingUI();

        recordingTimerInterval = setInterval(() => {
            recordingSeconds++;
            updateRecordingTimerUI();
            if (recordingSeconds >= 60) { // Max 1 min recording
                stopAudioRecording();
            }
        }, 1000);

    } catch (err) {
        console.error('Error accessing microphone:', err);
        alert('تعذر الوصول إلى الميكروفون. يرجى التأكد من منح الإذن في المتصفح.');
    }
}

function stopAudioRecording() {
    if (mediaRecorder && isAudioRecording) {
        mediaRecorder.stop();
    }
    clearInterval(recordingTimerInterval);
    isAudioRecording = false;
    hideRecordingUI();
}

function cancelAudioRecording() {
    if (mediaRecorder && isAudioRecording) {
        audioChunks = [];
        mediaRecorder.stop();
    }
    clearInterval(recordingTimerInterval);
    isAudioRecording = false;
    hideRecordingUI();
    showToastNotification('تم إلغاء التسجيل الصوتي.');
}

function toggleAudioRecording(target = 'chat') {
    if (isAudioRecording) {
        stopAudioRecording();
    } else {
        startAudioRecording(target);
    }
}

function showRecordingUI() {
    const chatMicBtn = document.getElementById('geminiVoiceBtn');
    if (chatMicBtn) chatMicBtn.classList.add('recording');

    const searchMicBtn = document.getElementById('searchVoiceBtn');
    if (searchMicBtn) searchMicBtn.classList.add('recording');

    const recOverlay = document.getElementById('geminiAudioRecordingOverlay');
    if (recOverlay) {
        recOverlay.style.display = 'flex';
    }

    const timerText = document.getElementById('recordingTimerText');
    if (timerText) timerText.textContent = '00:00';
}

function hideRecordingUI() {
    const chatMicBtn = document.getElementById('geminiVoiceBtn');
    if (chatMicBtn) chatMicBtn.classList.remove('recording');

    const searchMicBtn = document.getElementById('searchVoiceBtn');
    if (searchMicBtn) searchMicBtn.classList.remove('recording');

    const recOverlay = document.getElementById('geminiAudioRecordingOverlay');
    if (recOverlay) {
        recOverlay.style.display = 'none';
    }
}

function updateRecordingTimerUI() {
    const timerText = document.getElementById('recordingTimerText');
    if (!timerText) return;
    const mins = String(Math.floor(recordingSeconds / 60)).padStart(2, '0');
    const secs = String(recordingSeconds % 60).padStart(2, '0');
    timerText.textContent = `${mins}:${secs}`;
}

async function processAudioTranscription(audioBlob, mimeType) {
    showTranscribingStatus(true);

    try {
        // Convert Blob to Base64
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(audioBlob);
        });

        const base64Audio = await base64Promise;

        // Send to Server using gemini-3.5-flash
        const response = await fetch('/api/gemini/transcribe-audio', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                audioData: base64Audio,
                mimeType: mimeType,
                customApiKey: customGeminiApiKey
            })
        });

        showTranscribingStatus(false);

        const data = await response.json();

        if (response.ok && data.success && data.text) {
            const transcribedText = data.text.trim();
            handleTranscriptionResult(transcribedText);
        } else {
            showToastNotification('⚠️ ' + (data.message || 'تعذر استخراج نص الصوت. حاول التحدث بصوت أوضح.'));
        }

    } catch (err) {
        showTranscribingStatus(false);
        console.error('Audio transcription processing error:', err);
        showToastNotification('❌ فشل تفريغ الصوت عبر Gemini 3.5 Flash.');
    }
}

function handleTranscriptionResult(transcribedText) {
    if (!transcribedText) return;

    if (activeAudioTarget === 'search') {
        const searchInput = document.getElementById('medicineSearchInput') || document.getElementById('mainSearchInput');
        if (searchInput) {
            searchInput.value = transcribedText;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            showToastNotification(`🎙️ تم تفريغ الصوت: "${transcribedText}"`);
        }
    } else {
        const chatInput = document.getElementById('geminiInput');
        if (chatInput) {
            chatInput.value = transcribedText;
            chatInput.focus();
            showToastNotification(`🎙️ تم تفريغ الصوت عبر Gemini 3.5 Flash!`);
            // Offer instant send
            handleGeminiSend();
        }
    }
}

function showTranscribingStatus(isTranscribing) {
    const statusBox = document.getElementById('geminiTranscribingStatus');
    if (statusBox) {
        statusBox.style.display = isTranscribing ? 'flex' : 'none';
    }
}

/* ---------------- Cart Analysis & Alternatives ---------------- */
async function analyzeCartWithGemini() {
    if (typeof cart === 'undefined' || cart.length === 0) {
        alert('سلة الطلبية فارغة! أضف أدوية أولاً لتحليلها بالذكاء الاصطناعي.');
        return;
    }

    toggleGeminiChat();
    
    // Add user question
    const userMsg = {
        role: 'user',
        content: `🔍 تحليل شامل لسلة الطلبية الحالية (${cart.length} أصناف) وتوصيات تعظيم البونص والأمان الطبي.`,
        time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    };
    chatHistory.push(userMsg);
    saveChatHistory();
    renderChatMessages();

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
            const botMsg = {
                role: 'model',
                content: `📊 **تقرير التحليل الصيدلاني والتجاري لسلة الطلبية (Gemini AI):**\n\n${data.analysis}`,
                time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
                modelUsed: 'gemini-3.5-flash',
                roleUsed: 'general'
            };
            chatHistory.push(botMsg);
            saveChatHistory();
            renderChatMessages();
        } else {
            appendErrorMessage(`⚠️ ${data.message || 'تعذر استكمال تحليل السلة.'}`);
        }
    } catch (err) {
        removeTypingIndicator(typingId);
        appendErrorMessage('❌ تعذر الاتصال بسيرفر تحليل السلة.');
    }
}

async function askAiForDrugAlternatives(medName, activeIng) {
    toggleGeminiChat();
    const prompt = `ما هي البدائل الصيدلانية والعلمية المتاحة لدواء "${medName}" (المادة الفعالة: ${activeIng}) في بروشور مستودع الفواز؟ مع بيان العيارات والأسعار والبونص.`;
    
    const userMsg = {
        role: 'user',
        content: prompt,
        time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    };
    chatHistory.push(userMsg);
    saveChatHistory();
    renderChatMessages();

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
            const botMsg = {
                role: 'model',
                content: `💊 **البدائل الصيدلانية المقترحة من بروشور الفواز:**\n\n${data.alternatives}`,
                time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
                modelUsed: 'gemini-3.5-flash',
                roleUsed: 'general'
            };
            chatHistory.push(botMsg);
            saveChatHistory();
            renderChatMessages();
        } else {
            appendErrorMessage(`⚠️ ${data.message || 'تعذر البحث عن بدائل.'}`);
        }
    } catch (err) {
        removeTypingIndicator(typingId);
        appendErrorMessage('❌ تعذر الاتصال بسيرفر البحث عن البدائل.');
    }
}

/* ---------------- Helper Functions ---------------- */
function appendTypingIndicator() {
    const container = document.getElementById('geminiMessagesContainer');
    if (!container) return null;

    const id = 'typing_' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    const roleInfo = CHATBOT_ROLES[activeChatRole] || CHATBOT_ROLES.general;
    div.className = 'gemini-typing-indicator';
    div.innerHTML = `<i class="fas fa-spinner fa-spin"></i> سيرفر Google Gemini (${roleInfo.modelDisplay}) يقوم بالتحليل والصياغة...`;

    container.appendChild(div);
    scrollToBottom();
    return id;
}

function removeTypingIndicator(id) {
    if (!id) return;
    const elem = document.getElementById(id);
    if (elem) elem.remove();
}

function appendErrorMessage(msg) {
    const botMsg = {
        role: 'model',
        content: msg,
        time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        modelUsed: 'System Notice',
        roleUsed: activeChatRole
    };
    chatHistory.push(botMsg);
    saveChatHistory();
    renderChatMessages();
}

function scrollToBottom() {
    const container = document.getElementById('geminiMessagesContainer');
    if (container) {
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 50);
    }
}

function formatMarkdown(text) {
    if (!text) return '';
    return escapeHtml(text)
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/^- (.*?)(<br>|$)/gm, '<div class="gemini-list-item">• $1</div>')
        .replace(/^[0-9]+\. (.*?)(<br>|$)/gm, '<div class="gemini-list-item"><strong>•</strong> $1</div>');
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeAttribute(str) {
    if (!str) return '';
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
