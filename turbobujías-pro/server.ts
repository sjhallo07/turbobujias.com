import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import Cloudflare from "cloudflare";
import puppeteer from "puppeteer";
import multer from "multer";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check for Cloud Run
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Upload parser endpoint
  app.post("/api/documents/parse", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    try {
      let text = "";
      if (req.file.mimetype === "application/pdf") {
        const pdfData = await pdfParse(req.file.buffer);
        text = pdfData.text;
      } else {
        text = req.file.buffer.toString("utf-8");
      }
      return res.json({ text });
    } catch (err: any) {
      console.error("Parse Error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // API routes
  app.post("/api/cloudflare/hostname-association", async (req, res) => {
    const { zone_id } = req.body;
    const token = process.env.TOKEN_FARE;
    
    if (!token || !zone_id) {
      return res.status(400).json({ error: "Missing Cloudflare API token or zone_id" });
    }

    try {
      const client = new Cloudflare({ apiToken: token });
      const hostnameAssociation = await client.certificateAuthorities.hostnameAssociations.get({
        zone_id: zone_id,
      });
      res.json({ hostnames: hostnameAssociation.hostnames });
    } catch (err: any) {
      console.error("Cloudflare API error:", err);
      res.status(500).json({ error: "Failed to connect to Cloudflare" });
    }
  });

  // Proxy for exchange rates with real-time BCV scraping
  app.get("/api/rates", async (req, res) => {
    try {
      console.log("Stage 1: Attempting to fetch rates via API...");
      const [usdRes, eurRes] = await Promise.all([
        fetch("https://ve.dolarapi.com/v1/dolares/oficial"),
        fetch("https://ve.dolarapi.com/v1/euros/oficial")
      ]);
      
      const usdData = await usdRes.json();
      const eurData = await eurRes.json();
      
      if (usdData?.promedio && eurData?.promedio) {
        console.log("Success: Rates fetched from DolarAPI.");
        return res.json({
          VES: parseFloat(usdData.promedio),
          EUR: parseFloat(eurData.promedio),
          lastUpdated: new Date().toLocaleString() + " (Official)",
          source: "DolarAPI"
        });
      }
    } catch (apiErr) {
      console.warn("API attempt failed:", apiErr instanceof Error ? apiErr.message : apiErr);
    }

    let browser;
    let attempts = 0;
    const maxAttempts = 1; // Only 1 attempt if API fails
    
    // Helper to extract rates from a page
    const extractRatesFromBCV = async (page: any) => {
      return await page.evaluate(`() => {
        const getRate = (id) => {
          const element = document.getElementById(id);
          if (!element) return null;
          const strong = element.querySelector("strong");
          const text = strong ? strong.innerText : element.innerText;
          if (!text) return null;
          // Robust parsing: extract only numbers and comma/dot, then unify to dot
          const val = text.replace(/[^\\d.,]/g, "").replace(",", ".");
          return parseFloat(val);
        };

        return {
          USD: getRate("dolar"),
          EUR: getRate("euro"),
        };
      }`);
    };

    // Helper to extract rates from Instagram
    const extractRatesFromInstagram = async (page: any) => {
      return await page.evaluate(`() => {
        // Look for common patterns in text
        const bodyText = document.body.innerText;
        
        // Regex patterns for USD and EUR rates usually posted by BCV
        const usdRegex = /(?:USD|Dolar|Dólar)\\s*[:]*\\s*([\\d.,]+)/i;
        const eurRegex = /(?:EUR|Euro)\\s*[:]*\\s*([\\d.,]+)/i;
        const fallbackRegex = /([\\d.,]+)\\s*Bs\\/(?:USD|EUR)/gi;

        const usdMatch = bodyText.match(usdRegex);
        const eurMatch = bodyText.match(eurRegex);
        
        const parseValue = (valStr) => {
          if (!valStr) return null;
          const cleaned = valStr.replace(/[^\\d.,]/g, "").replace(",", ".");
          return parseFloat(cleaned);
        };

        let usd = parseValue(usdMatch ? usdMatch[1] : null);
        let eur = parseValue(eurMatch ? eurMatch[1] : null);

        // Second pass if primary regexes failed
        if (!usd || !eur) {
          const matches = [...bodyText.matchAll(fallbackRegex)];
          if (matches.length > 0) {
            if (!usd) usd = parseValue(matches[0][1]);
            if (!eur && matches.length > 1) eur = parseValue(matches[1][1]);
          }
        }

        return { USD: usd, EUR: eur };
      }`);
    };
    
    while (attempts < maxAttempts) {
      try {
        console.log(`Fetching BCV rates (Attempt ${attempts + 1}/${maxAttempts})...`);
        browser = await puppeteer.launch({
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            "--disable-gpu",
            "--ignore-certificate-errors",
            "--window-size=1280,800"
          ],
          headless: true,
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        
        // Small timeouts for quicker fallback
        page.setDefaultNavigationTimeout(15000);
        page.setDefaultTimeout(15000);
        
        // Optimization: Block unnecessary resources
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          const resourceType = req.resourceType();
          if (['image', 'font', 'media', 'other'].includes(resourceType)) {
            req.abort();
          } else {
            req.continue();
          }
        });

        await page.setExtraHTTPHeaders({
          'Accept-Language': 'es-VE,es-ES;q=0.9,es;q=0.8,en;q=0.7',
          'Referer': 'https://www.google.com/'
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
        
        console.log("Stage 2: Attempting official BCV website...");
        try {
          await page.goto("https://www.bcv.org.ve/", { 
            waitUntil: "domcontentloaded", 
            timeout: 15000 
          });
          
          // Wait for any element that indicates page load
          await page.waitForSelector("body", { timeout: 5000 });
          
          // Small delay for dynamic content
          await new Promise(r => setTimeout(r, 2000));
          
          const rates = await extractRatesFromBCV(page);
          if (rates.USD && rates.EUR) {
            console.log("Success: Rates fetched from official website.");
            return res.json({
              VES: rates.USD,
              EUR: rates.EUR,
              lastUpdated: new Date().toLocaleString(),
              source: "Official BCV Website"
            });
          }
          console.warn("Website loaded but rates not found in expected selectors.");
        } catch (bcvErr) {
          console.warn("Website attempt failed or timed out:", bcvErr instanceof Error ? bcvErr.message : bcvErr);
        }

        console.log("Stage 3: Attempting official BCV Instagram...");
        try {
          // Official Instagram URL with no-js query or just standard slug
          await page.goto("https://www.instagram.com/bcv.org.ve/", { 
            waitUntil: "networkidle2", 
            timeout: 15000 
          });
          
          // Wait for Instagram's heavy JS
          await new Promise(r => setTimeout(r, 4000));
          
          const rates = await extractRatesFromInstagram(page);
          if (rates.USD) {
            console.log("Success: Rates fetched from Instagram.");
            return res.json({
              VES: rates.USD,
              EUR: rates.EUR || (rates.USD * 1.07), // Fallback EUR estimation if only USD found
              lastUpdated: new Date().toLocaleString(),
              source: "Official BCV Instagram"
            });
          }
          console.warn("Instagram loaded but no rates detected in text.");
        } catch (igErr) {
          console.warn("Instagram attempt failed:", igErr instanceof Error ? igErr.message : igErr);
        }

        console.log("All primary scraping sources failed or yielded no results. Proceeding to fallback...");

      } catch (err) {
        // Unexpected error in puppeteer
        console.warn(`Unexpected error during scraping cycle (Attempt ${attempts + 1}):`, err instanceof Error ? err.message : err);
      } finally {
        attempts++;
        if (browser) await browser.close();
        browser = undefined;
        
        if (attempts >= maxAttempts) {
          // Final Fallback: External Exchange API (dolarapi)
          try {
            console.log("Falling back to dolarapi.com (Last Resort)...");
            const [usdRes, eurRes] = await Promise.all([
              fetch("https://ve.dolarapi.com/v1/dolares/oficial"),
              fetch("https://ve.dolarapi.com/v1/euros/oficial")
            ]);
            
            const usdData = await usdRes.json();
            const eurData = await eurRes.json();
            
            return res.json({
              VES: parseFloat(usdData.promedio) || 36.5,
              EUR: parseFloat(eurData.promedio) || 39.2,
              lastUpdated: new Date().toLocaleString() + " (DolarAPI Fallback)",
              source: "DolarAPI"
            });
          } catch (fallbackErr) {
            console.warn("External fallback failed, returning hardcoded.");
            return res.json({
              VES: 36.5,
              EUR: 39.2,
              lastUpdated: new Date().toLocaleString() + " (Hardcoded Fallback)",
              source: "Static"
            });
          }
        }
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  });

  app.get("/api/crossref/:query", async (req, res) => {
    try {
      const query = req.params.query;
      const response = await fetch(`https://www.sparkplug-crossreference.com/search/${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error("Failed to fetch");
      const html = await response.text();
      res.send(html);
    } catch (err) {
      console.error("Cross ref error:", err);
      res.status(500).json({ error: "Failed to fetch cross reference" });
    }
  });

  app.post("/api/chat", async (req, res) => {
    const { prompt, systemInstruction, attachments, temperature = 0.5, model: requestedModel } = req.body;
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    const getProviderModel = (model: string, provider: 'openai' | 'anthropic' | 'openrouter') => {
      const mappings: Record<string, any> = {
        'gemini-3-flash-preview': {
          openrouter: 'google/gemini-2.0-flash-001',
          openai: 'gpt-3.5-turbo',
          anthropic: 'claude-3-5-sonnet-20241022'
        },
        'gemini-flash-latest': {
          openrouter: 'google/gemini-2.0-flash-001',
          openai: 'gpt-3.5-turbo',
          anthropic: 'claude-3-5-sonnet-20241022'
        },
        'gpt-4o': {
          openrouter: 'openai/gpt-4o',
          openai: 'gpt-4o',
          anthropic: 'claude-3-5-sonnet-20241022'
        },
        'claude-3-5-sonnet-20241022': {
          openrouter: 'anthropic/claude-3.5-sonnet',
          openai: 'gpt-4o',
          anthropic: 'claude-3-5-sonnet-20241022'
        }
      };

      const map = mappings[model] || mappings['gemini-3-flash-preview'];
      const targetModel = map ? map[provider] : null;
      console.log(`[AI Routing] Mapping requested model "${model}" to provider "${provider}" model: "${targetModel}"`);
      return targetModel;
    };

    // 1. Try Anthropic if requested or as fallback
    if (anthropicApiKey && (requestedModel?.includes('claude') || (!openaiApiKey && !requestedModel))) {
      try {
        const anthropic = new Anthropic({ apiKey: anthropicApiKey });
        const model = getProviderModel(requestedModel, 'anthropic');
        let userContent: any = prompt;
        
        // Anthropic content blocks for images if needed
        if (attachments && Array.isArray(attachments) && attachments.length > 0) {
           userContent = [
             { type: 'text', text: prompt },
             ...attachments.map(att => ({
               type: 'image',
               source: {
                 type: 'base64',
                 media_type: att.type || 'image/jpeg',
                 data: att.data
               }
             }))
           ];
        }

        const message = await anthropic.messages.create({
          model: model || "claude-3-5-sonnet-20241022",
          max_tokens: 4096,
          messages: [{ role: "user", content: userContent }],
          system: systemInstruction,
          temperature,
        });

        const textContent = message.content.find(c => c.type === 'text');
        return res.json({ text: (textContent as any)?.text || "Empty response from Claude" });
      } catch (err: any) {
        console.error("Anthropic Error:", err.message);
        // Continue to fallback
      }
    }

    // 2. Try OpenAI/OpenRouter
    if (openaiApiKey) {
      try {
        const isOpenRouter = openaiApiKey.startsWith('sk-or-');
        const openai = new OpenAI({ 
          apiKey: openaiApiKey,
          baseURL: isOpenRouter ? "https://openrouter.ai/api/v1" : undefined,
          defaultHeaders: isOpenRouter ? {
            "HTTP-Referer": "https://ais-build.run",
            "X-OpenRouter-Title": "TurboBujias Pro AI"
          } : undefined
        });

        const messages: any[] = [];
        if (systemInstruction) {
           messages.push({ role: 'system', content: systemInstruction });
        }
        
        // Handle images for GPT-4o if supported
        let userContent: any = prompt;
        if (attachments && Array.isArray(attachments) && attachments.length > 0) {
          userContent = [
            { type: "text", text: prompt },
            ...attachments.map(att => ({
              type: "image_url",
              image_url: { url: `data:${att.type || 'image/jpeg'};base64,${att.data}` }
            }))
          ];
        }

        messages.push({ role: 'user', content: userContent });
        
        const model = getProviderModel(requestedModel, isOpenRouter ? 'openrouter' : 'openai');
        const completion = await openai.chat.completions.create({
          model: model,
          messages,
          temperature,
          max_tokens: 2000,
        });
        
        return res.json({ text: completion.choices[0].message.content });
      } catch (err: any) {
        console.error("OpenAI/OpenRouter failed:", err.message);
      }
    }

    res.status(500).json({ error: "Failed to generate text from any fallback provider" });
  });

  app.post("/api/generate-image", async (req, res) => {
    res.status(501).json({ error: "Image generation should be handled by the frontend via Gemini SDK." });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    const indexPath = path.join(distPath, 'index.html');
    
    console.log(`[Production] Serving static files from: ${distPath}`);
    if (fs.existsSync(indexPath)) {
      console.log(`[Production] Found index.html at: ${indexPath}`);
    } else {
      console.warn(`[Production] WARNING: index.html NOT found at: ${indexPath}`);
    }

    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Application not built correctly. index.html missing.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
