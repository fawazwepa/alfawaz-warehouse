import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// Load Medicines Catalog Context
let medicinesData = [];
try {
  const rawData = fs.readFileSync(path.join(__dirname, 'data', 'medicines.json'), 'utf-8');
  const parsed = JSON.parse(rawData);
  medicinesData = parsed.medicines || [];
} catch (err) {
  console.error('Error loading medicines.json:', err.message);
}

// API Endpoint for Gemini AI Pharmacy Assistant
app.post('/api/gemini', async (req, res) => {
  try {
    const { prompt, history, customApiKey, currentCart } = req.body;
    
    const apiKey = customApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        error: 'MISSING_API_KEY',
        message: 'مطلوب مفتاح Gemini API. يمكنك إدخال المفتاح الخاص بك في إعدادات الذكاء الاصطناعي بالموقع.'
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Use gemini-2.5-flash or gemini-1.5-flash
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      systemInstruction: `أنت "مساعد الفواز الذكي" (Gemini AI Pharmacy Assistant) الخبير الطبي والصيدلاني لمستودع الفواز للأدوية البشرية.
مهمتك الرئيسية:
1. الإجابة الدقيقة على أسئلة الصيدلي والدكتور حول الأدوية المتوفرة بروشور مستودع الفواز.
2. اقتراح البدائل الدوائية حسب المادة الفعالة والشركة المصنعة (مثل دومينا، بركات، ميديكو، لاما، هابي كيور، سيليا، وغيرها).
3. توضيح الاستطبابات، الشدة والعيار، الشكل الصيدلاني، طريقة الاستخدام، التداخلات الدوائية والتحذيرات الطبية.
4. حساب واستعراض الأسعار الصافية (النت) والبونصات المتاحة لدى مستودع الفواز.
5. المساعدة في اقتراح تشكيلات أدوية للطلبيات بناءً على العروض والاحتياجات.
6. الرد دائماً باللغة العربية بأسلوب صيدلاني راقٍ، دقيق، منظم وودود.

بيانات بروشور مستودع الفواز الحالية:
يحتوي المستودع على ${medicinesData.length} مستحضر دواء، ومن أبرز الشركات المعتمدة: دومينا، بركات، ميديكو، هابي كيور، سيليا، لاما، ابن رشد، المتحدة، وغيرها.`
    });

    // Construct Contextual Prompt with Catalog Search
    let contextSnippet = '';
    if (prompt) {
      const searchTerms = prompt.toLowerCase().split(' ').filter(t => t.length > 2);
      const matchedMeds = medicinesData.filter(m => {
        const fullStr = `${m.اسم_الدواء} ${m.الشركة_المصنعة} ${m.الشركة_المصنعة_عربي} ${m.المادة_الفعالة} ${m.الشكل_الصيدلاني}`.toLowerCase();
        return searchTerms.some(term => fullStr.includes(term));
      }).slice(0, 15);

      if (matchedMeds.length > 0) {
        contextSnippet = `\n\nأصناف مطابقة من بروشور مستودع الفواز للبحث:\n` + matchedMeds.map(m => 
          `- ${m.اسم_الدواء} (${m.الشركة_المصنعة_عربي || m.الشركة_المصنعة}): المادة الفعالة: [${m.المادة_الفعالة}], السعر الصافي: [${m.السعر} ل.س], البونص: [${m.البونص}], الكمية بالمستودع: [${m.الكمية}]`
        ).join('\n');
      }
    }

    let cartSnippet = '';
    if (currentCart && currentCart.length > 0) {
      cartSnippet = `\n\nعناصر سلة الطلبية الحالية للصيدلية:\n` + currentCart.map(c => 
        `- ${c.name} (${c.manufacturer}): الكمية: ${c.quantity} عبوة, السعر الصافي: ${c.price} ل.س, البونص: ${c.bonus}`
      ).join('\n');
    }

    const fullUserPrompt = `${prompt}${contextSnippet}${cartSnippet}`;

    const result = await model.generateContent(fullUserPrompt);
    const responseText = result.response.text();

    res.json({ success: true, reply: responseText });
  } catch (error) {
    console.error('Gemini API Error:', error);
    res.status(500).json({
      error: 'GEMINI_ERROR',
      message: `حدث خطأ أثناء الاتصال بـ Gemini AI: ${error.message}`
    });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});

