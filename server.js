import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(__dirname));

// SSE Connected Clients for Real-time Live Updates
let sseClients = [];

function notifyClients(eventType, data) {
  const payload = JSON.stringify({ type: eventType, data, timestamp: new Date().toISOString() });
  sseClients.forEach(client => {
    try {
      client.res.write(`event: ${eventType}\ndata: ${payload}\n\n`);
    } catch (err) {
      console.error('SSE client write error:', err.message);
    }
  });
}

// In-memory cache and file paths
const MEDICINES_FILE = path.join(__dirname, 'data', 'medicines.json');
const MANUFACTURERS_FILE = path.join(__dirname, 'data', 'manufacturers.json');

let medicinesData = [];
let manufacturersData = [];
let lastSyncTimestamp = new Date().toISOString();
let dataVersion = Date.now();

function loadLocalData() {
  try {
    if (fs.existsSync(MEDICINES_FILE)) {
      const rawData = fs.readFileSync(MEDICINES_FILE, 'utf-8');
      const parsed = JSON.parse(rawData);
      medicinesData = parsed.medicines || [];
    }
  } catch (err) {
    console.error('Error loading medicines.json:', err.message);
  }

  try {
    if (fs.existsSync(MANUFACTURERS_FILE)) {
      const rawMfg = fs.readFileSync(MANUFACTURERS_FILE, 'utf-8');
      const parsedMfg = JSON.parse(rawMfg);
      manufacturersData = parsedMfg.manufacturers || [];
    }
  } catch (err) {
    console.error('Error loading manufacturers.json:', err.message);
  }
}

function saveMedicinesFile() {
  try {
    const payload = {
      updated_at: new Date().toISOString(),
      version: ++dataVersion,
      total_count: medicinesData.length,
      medicines: medicinesData
    };
    fs.writeFileSync(MEDICINES_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    lastSyncTimestamp = new Date().toISOString();
    return true;
  } catch (err) {
    console.error('Error saving medicines file:', err.message);
    return false;
  }
}

loadLocalData();

// Helper to get Google Gemini Model instance with fallbacks
function getGeminiModel(customApiKey, preferredModel = 'gemini-2.5-flash') {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error('MISSING_API_KEY');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const systemInstruction = `أنت "مساعد الفواز الذكي" (Al-Fawaz Smart Pharmacy AI Assistant) - الخبير الصيدلاني والطبي المعتمد لمستودع الفواز للأدوية البشرية.
مهماتك ومسؤولياتك الأساسية:
1. الإجابة الدقيقة والاحترافية على استفسارات الأطباء والصيادلة حول الأدوية المتاحة في بروشور مستودع الفواز.
2. توفير بدائل علمية دقيقة بناءً على المادة الفعالة (Active Ingredient)، مع توضيح الشركة المصنعة والأسعار الصافية (النت) والبونصات المتاحة.
3. تفصيل الجرعات الدوائية، الأشكال الصيدلانية، دواعي الاستعمال، التداخلات الدوائية، والتحذيرات الطبية المعتمدة.
4. تحليل وتدقيق سلة الطلبية الحالية، واقتراح طرق لزيادة البونص المجاني (مثلاً تكميل الحصص للحصول على بونص إضافي).
5. تقديم الردود دائماً باللغة العربية بأسلوب صيدلاني مهني، واضح، منظم وجذاب، مدعماً بالقوائم والنقاط البارزة.
6. إذا اقترحت أدوية متوفرة في المستودع، اذكر اسمها وسعرها بالليرة السورية والبونص المتوفر.

معلومات المستودع وقاعدة البيانات الحالية:
- عدد الأصناف المسجلة: ${medicinesData.length} مستحضر دوائي.
- أبرز الشركات والوكالات: دومينا (Domina)، بركات (Barakat)، ميديكو (Medico)، هابي كيور (Happy Cure)، سيليا (Celia)، لاما (Lama)، ابن رشد (Ibn Rushd)، المتحدة (Allied)، وغيرها.
- التواصل والطلبيات المباشرة: واتساب: 0995711536 | هاتف: 0933907943`;

  return {
    genAI,
    model: genAI.getGenerativeModel({
      model: preferredModel,
      systemInstruction
    })
  };
}

// -------------------------------------------------------------
// Google Gemini AI Endpoints
// -------------------------------------------------------------

// 1. Check Gemini Status & Server Connection
app.get('/api/gemini/status', (req, res) => {
  const hasEnvKey = Boolean(process.env.GEMINI_API_KEY || process.env.API_KEY);
  res.json({
    status: 'online',
    google_server_connected: true,
    has_server_api_key: hasEnvKey,
    catalog_items_loaded: medicinesData.length,
    default_model: 'gemini-2.5-flash',
    supported_models: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'],
    timestamp: new Date().toISOString()
  });
});

// 2. Main Gemini Conversational Endpoint
app.post(['/api/gemini', '/api/gemini/chat'], async (req, res) => {
  try {
    const { prompt, customApiKey, currentCart, modelName } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({
        error: 'EMPTY_PROMPT',
        message: 'يرجى كتابة أو إرسال استفسار للذكاء الاصطناعي.'
      });
    }

    let modelInstance;
    try {
      modelInstance = getGeminiModel(customApiKey, modelName || 'gemini-2.5-flash');
    } catch (err) {
      if (err.message === 'MISSING_API_KEY') {
        return res.status(400).json({
          error: 'MISSING_API_KEY',
          message: 'مفتاح Gemini API غير متاح في السيرفر حالياً. يمكنك إدخال مفتاح Gemini الخاص بك في نافذة الإعدادات داخل المحادثة.'
        });
      }
      throw err;
    }

    // Contextual Matching from Medicines Catalog
    let contextSnippet = '';
    const cleanSearchTerms = prompt.toLowerCase().split(/[\s,،-]+/).filter(t => t.length >= 2);
    
    if (cleanSearchTerms.length > 0) {
      const matched = medicinesData.filter(m => {
        const fullStr = `${m.اسم_الدواء} ${m.الشركة_المصنعة_عربي || ''} ${m.الشركة_المصنعة || ''} ${m.المادة_الفعالة || ''} ${m.الشكل_الصيدلاني || ''} ${m.التركيزة || ''} ${m.كود_المنتج || ''}`.toLowerCase();
        return cleanSearchTerms.some(term => fullStr.includes(term));
      }).slice(0, 20);

      if (matched.length > 0) {
        contextSnippet = `\n\n[أصناف مطابقة من مستودع الفواز ذات صلة باستفسار الصيدلي]:\n` + matched.map(m =>
          `- ${m.اسم_الدواء} (الشركة: ${m.الشركة_المصنعة_عربي || m.الشركة_المصنعة}) | المادة الفعالة: [${m.المادة_الفعالة || '-'}] | العيار: [${m.التركيزة || '-'}] | السعر الصافي: [${m.السعر ? m.السعر.toLocaleString('ar-EG') : 0} ل.س] | البونص: [${m.البونص || 'بدون'}] | التوفر: [${m.الكمية || 100}]`
        ).join('\n');
      }
    }

    let cartSnippet = '';
    if (currentCart && Array.isArray(currentCart) && currentCart.length > 0) {
      cartSnippet = `\n\n[محتويات سلة الطلبية الحالية للصيدلية]:\n` + currentCart.map((c, i) =>
        `${i + 1}. ${c.name} (${c.manufacturer}) - الكمية: ${c.quantity} عبوة - السعر: ${c.price} ل.س - البونص: ${c.bonus}`
      ).join('\n');
    }

    const fullPrompt = `${prompt.trim()}${contextSnippet}${cartSnippet}`;

    let result;
    try {
      result = await modelInstance.model.generateContent(fullPrompt);
    } catch (apiError) {
      // Fallback model if primary model fails
      console.warn('Primary Gemini model failed, trying fallback:', apiError.message);
      const fallback = getGeminiModel(customApiKey, 'gemini-1.5-flash');
      result = await fallback.model.generateContent(fullPrompt);
    }

    const responseText = result.response.text();

    res.json({
      success: true,
      reply: responseText,
      server_timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Gemini API Error:', error);
    res.status(500).json({
      error: 'GEMINI_SERVER_ERROR',
      message: `تعذر إكمال طلب الذكاء الاصطناعي: ${error.message || 'خطأ غير متوقع'}`
    });
  }
});

// 3. AI Order Analysis & Bonus Maximizer Endpoint
app.post('/api/gemini/analyze-cart', async (req, res) => {
  try {
    const { cart, customApiKey } = req.body;
    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({
        error: 'EMPTY_CART',
        message: 'سلة الطلبية فارغة حالياً لتحليلها.'
      });
    }

    const modelInstance = getGeminiModel(customApiKey, 'gemini-2.5-flash');
    const prompt = `يرجى تحليل سلة طلبية الأدوية التالية لصيدلية، وتقديم:
1. ملخص القيمة الإجمالية والبونصات الممنوحة.
2. نصائح ذكية لزيادة البونص المجاني (مثلاً إن كان بونص الصنف 10+1 ولديه 8، اقترح زيادة 2 للحصول على المجانية).
3. فحص أي تداخلات دوائية خطيرة بين الأدوية المطلوبة في السلة إن وُجدت.
4. اقتراح مستحضرات مكملة أو سريعة التصريف من بروشور الفواز.

قائمة أدوية السلة:
${cart.map((c, i) => `${i + 1}. ${c.name} (${c.manufacturer}) - الكمية المطلوبة: ${c.quantity} - السعر: ${c.price} ل.س - البونص: ${c.bonus}`).join('\n')}`;

    const result = await modelInstance.model.generateContent(prompt);
    res.json({
      success: true,
      analysis: result.response.text(),
      analyzed_items_count: cart.length
    });
  } catch (error) {
    console.error('Cart Analysis Error:', error);
    res.status(500).json({
      error: 'ANALYSIS_ERROR',
      message: error.message
    });
  }
});

// 4. AI Drug Alternatives Finder
app.post('/api/gemini/suggest-alternatives', async (req, res) => {
  try {
    const { medicineName, activeIngredient, customApiKey } = req.body;
    const modelInstance = getGeminiModel(customApiKey, 'gemini-2.5-flash');

    const prompt = `ما هي البدائل الصيدلانية والعلمية المعتمدة للدواء: "${medicineName || ''}" (المادة الفعالة: "${activeIngredient || ''}")؟
ابحث واقترح من شركات الأدوية السورية المتوفرة (مثل دومينا، بركات، ميديكو، لاما، هابي كيور، سيليا، وغيرها) مع توضيح العيار والفوائد.`;

    const result = await modelInstance.model.generateContent(prompt);
    res.json({
      success: true,
      alternatives: result.response.text()
    });
  } catch (error) {
    res.status(500).json({ error: 'ALTERNATIVES_ERROR', message: error.message });
  }
});

// -------------------------------------------------------------
// Real-time Data Synchronization & Warehouse Endpoints
// -------------------------------------------------------------

// 1. Real-time Server-Sent Events (SSE) for Live Data Feed
app.get('/api/sync/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  sseClients.push(newClient);

  // Send initial connection handshake
  res.write(`event: connected\ndata: ${JSON.stringify({ message: 'Connected to Al-Fawaz Live Server Feed', clientId, version: dataVersion })}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

// 2. Fetch Complete Synced Medicines & Manufacturers
app.get('/api/sync/data', (req, res) => {
  res.json({
    success: true,
    version: dataVersion,
    last_sync: lastSyncTimestamp,
    total_medicines: medicinesData.length,
    total_manufacturers: manufacturersData.length,
    medicines: medicinesData,
    manufacturers: manufacturersData
  });
});

// 3. Update / Edit Medicine Price, Bonus, or Details
app.post('/api/sync/update-medicine', (req, res) => {
  try {
    const updatedMed = req.body;
    if (!updatedMed || !updatedMed.id) {
      return res.status(400).json({ error: 'INVALID_DATA', message: 'مطلوب معرف الدواء المطلوب تحديثه.' });
    }

    const index = medicinesData.findIndex(m => Number(m.id) === Number(updatedMed.id));
    if (index === -1) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'الدواء غير موجود في قاعدة البيانات.' });
    }

    // Merge changes
    medicinesData[index] = {
      ...medicinesData[index],
      ...updatedMed,
      id: Number(updatedMed.id)
    };

    saveMedicinesFile();

    // Broadcast live event to all connected clients
    notifyClients('medicine_updated', {
      medicine: medicinesData[index],
      action: 'update'
    });

    res.json({
      success: true,
      message: 'تم تحديث بيانات الدواء بنجاح في السيرفر وقاعدة البيانات.',
      medicine: medicinesData[index],
      version: dataVersion
    });
  } catch (error) {
    res.status(500).json({ error: 'UPDATE_ERROR', message: error.message });
  }
});

// 4. Add New Medicine to Server Catalog
app.post('/api/sync/add-medicine', (req, res) => {
  try {
    const newMed = req.body;
    if (!newMed || !newMed.اسم_الدواء) {
      return res.status(400).json({ error: 'INVALID_DATA', message: 'مطلوب اسم الدواء والشركة المصنعة.' });
    }

    const newId = medicinesData.length > 0 ? Math.max(...medicinesData.map(m => Number(m.id) || 0)) + 1 : 1;
    const entry = {
      id: newId,
      كود_المنتج: newMed.كود_المنتج || `MED${String(newId).padStart(3, '0')}`,
      اسم_الدواء: newMed.اسم_الدواء,
      الشركة_المصنعة: newMed.الشركة_المصنعة || 'عام',
      الشركة_المصنعة_عربي: newMed.الشركة_المصنعة_عربي || newMed.الشركة_المصنعة || 'عام',
      التركيزة: newMed.التركيزة || 'حسب المواصفات',
      الشكل_الصيدلاني: newMed.الشكل_الصيدلاني || 'مستحضر صيدلاني',
      المادة_الفعالة: newMed.المادة_الفعالة || 'تركيبة دوائية',
      الكمية: Number(newMed.الكمية) || 100,
      السعر: Number(newMed.السعر) || 0,
      تاريخ_الانتهاء: newMed.تاريخ_الانتهاء || '2028-12-31',
      الوصف: newMed.الوصف || 'مستحضر دوائي معتمد من مستودع الفواز للأدوية البشرية.',
      البونص: newMed.البونص || 'بدون بونص',
      طريقة_الاستخدام: newMed.طريقة_الاستخدام || 'حسب إرشادات الطبيب.',
      التحذيرات: newMed.التحذيرات || 'يحفظ بعيداً عن متناول الأطفال.',
      التخزين: newMed.التخزين || 'يحفظ في مكان جاف وبارد.'
    };

    medicinesData.unshift(entry);
    saveMedicinesFile();

    notifyClients('medicine_added', {
      medicine: entry,
      action: 'add'
    });

    res.json({
      success: true,
      message: 'تمت إضافة الدواء بنجاح إلى المستودع.',
      medicine: entry,
      version: dataVersion
    });
  } catch (error) {
    res.status(500).json({ error: 'ADD_ERROR', message: error.message });
  }
});

// 5. Delete Medicine from Catalog
app.post('/api/sync/delete-medicine', (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'مطلوب رقم معرّف الدواء.' });
    }

    const index = medicinesData.findIndex(m => Number(m.id) === Number(id));
    if (index === -1) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'الدواء غير موجود.' });
    }

    const deleted = medicinesData.splice(index, 1)[0];
    saveMedicinesFile();

    notifyClients('medicine_deleted', {
      id: Number(id),
      name: deleted.اسم_الدواء,
      action: 'delete'
    });

    res.json({
      success: true,
      message: `تم حذف الدواء "${deleted.اسم_الدواء}" من السيرفر.`,
      version: dataVersion
    });
  } catch (error) {
    res.status(500).json({ error: 'DELETE_ERROR', message: error.message });
  }
});

// 6. Bulk Import / Sync from AppSheet or Google Sheets JSON
app.post('/api/sync/bulk-import', (req, res) => {
  try {
    const { medicines } = req.body;
    if (!medicines || !Array.isArray(medicines) || medicines.length === 0) {
      return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'مطلوب مصفوفة أدوية صالحة للتحديث الجماعي.' });
    }

    medicinesData = medicines;
    saveMedicinesFile();

    notifyClients('bulk_sync', {
      total: medicinesData.length,
      timestamp: lastSyncTimestamp
    });

    res.json({
      success: true,
      message: `تمت المزامنة الجماعية بنجاح (${medicinesData.length} صنف).`,
      total: medicinesData.length,
      version: dataVersion
    });
  } catch (error) {
    res.status(500).json({ error: 'BULK_SYNC_ERROR', message: error.message });
  }
});

// 7. Export Database
app.get('/api/sync/export', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=alfawaz_medicines_export.json');
  res.send(JSON.stringify({
    warehouse: 'مستودع الفواز للأدوية البشرية',
    export_date: new Date().toISOString(),
    total_count: medicinesData.length,
    medicines: medicinesData
  }, null, 2));
});

// 8. General Health & Server Info
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime_seconds: process.uptime(),
    timestamp: new Date().toISOString(),
    google_gemini: {
      status: 'ready',
      api_key_configured: Boolean(process.env.GEMINI_API_KEY || process.env.API_KEY)
    },
    database: {
      total_medicines: medicinesData.length,
      total_manufacturers: manufacturersData.length,
      last_sync: lastSyncTimestamp,
      version: dataVersion
    },
    live_connections: sseClients.length
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Al-Fawaz Warehouse Server & Google Gemini AI is running on http://0.0.0.0:${PORT}`);
  console.log(`📦 Loaded ${medicinesData.length} medicines, ${manufacturersData.length} manufacturers.`);
});


