import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';
import morgan from 'morgan';
import cors from 'cors';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(morgan('combined'));

// const requiredEnvKeys = ['UPSTREAM_API_URL', 'UPSTREAM_API_KEY', 'ACCESS_TOKEN'];
// for (const key of requiredEnvKeys) {
//   if (!process.env[key]) {
//     console.error(`[Config Error] Missing env: ${key}`);
//     process.exit(1);
//   }
// }

const PORT = process.env.PORT || 5000;
// const UPSTREAM_API_URL = process.env.UPSTREAM_API_URL;
// const UPSTREAM_API_KEY = process.env.UPSTREAM_API_KEY;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PROMPT_ACCESS_TOKEN = process.env.PROMPT_ACCESS_TOKEN;

const MODEL_MAP = {
  deepseek: {
    'deepseek-ai/DeepSeek-V3': 'deepseek-chat',
    'deepseek-ai/DeepSeek-R1': 'deepseek-reasoner',
    'deepseek-chat': 'deepseek-chat',
    'deepseek-reasoner': 'deepseek-reasoner'
  }
}

const providerApiUrlMap = {
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  siliconflow: 'https://api.siliconflow.cn/v1/chat/completions',
  bailian: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
}

const UPSTREAM_LLMS = [
  {
    provider: 'deepseek',
    apiKey: process.env.DEEPSEEK_API_KEY,
    isProviderModel: (model) => MODEL_MAP.deepseek[model]
  },
  {
    provider: 'bailian',
    apiKey: process.env.BAILIAN_API_KEY,
    isProviderModel: (model) => model.startsWith('qwen')
  },
  {
    provider: 'siliconflow',
    apiKey: process.env.SILICONFLOW_API_KEY,
    isProviderModel: (model) => !['qwen', 'deepseek'].some(m => model.includes(m))
  },
]

// let lastLLMIndex = 0;
let totalIndex = 0;

// Prompt 存储管理
const PROMPTS_FILE = path.join(process.cwd(), 'temp', 'prompts.json');

// 初始化prompts文件
const initPromptsFile = () => {
  try {
    if (!fs.existsSync(path.dirname(PROMPTS_FILE))) {
      fs.mkdirSync(path.dirname(PROMPTS_FILE), { recursive: true });
    }
    if (!fs.existsSync(PROMPTS_FILE)) {
      fs.writeFileSync(PROMPTS_FILE, JSON.stringify({}), 'utf8');
    }
  } catch (err) {
    console.error('[Prompts Init Error]', err);
  }
};

initPromptsFile();

let userPrompts; 

// 读取所有prompts
const readPrompts = () => {
  try {
    if (!userPrompts) {
      const data = fs.readFileSync(PROMPTS_FILE, 'utf8');
      userPrompts = JSON.parse(data);
    }
    return userPrompts;
  } catch (err) {
    console.error('[Prompts Read Error]', err);
    return {};
  }
};

// 写入prompts
const writePrompts = (prompts) => {
  userPrompts = prompts;
  try {
    fs.writeFileSync(PROMPTS_FILE, JSON.stringify(prompts, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[Prompts Write Error]', err);
    return false;
  }
};

// 生成唯一ID
const generatePromptId = () => {
  return crypto.randomBytes(16).toString('hex');
};

// 替换prompt中的占位符参数
const replacePromptPlaceholders = (promptContent, params = {}) => {
  try {
    // 第一步：提取所有函数定义
    const functionDefinitions = {};
    const functionPattern = /\{\{\s*function\s+(\w+)\s*\(([^)]*)\)\s*\{([^}]*)\}\s*\}\}/g;
    
    // 扫描并提取函数定义
    let match;
    while ((match = functionPattern.exec(promptContent)) !== null) {
      const funcName = match[1];
      const funcParams = match[2].trim();
      const funcBody = match[3].trim();
      
      try {
        // 创建函数，函数体内可以访问 params 中的所有参数
        const paramKeys = Object.keys(params);
        const paramValues = Object.values(params);
        
        // 构建函数：先注入 params，再定义用户的函数
        const funcCode = `
          "use strict";
          return function ${funcName}(${funcParams}) {
            ${funcBody}
          };
        `;
        
        const compiledFunc = new Function(
          ...paramKeys,
          'Math', 'JSON', 'Array', 'Object', 'String', 'Number',
          funcCode
        );
        
        // 执行并保存函数
        functionDefinitions[funcName] = compiledFunc(
          ...paramValues,
          Math, JSON, Array, Object, String, Number
        );
        
        console.log(`[Function Defined] ${funcName}(${funcParams})`);
      } catch (err) {
        console.error(`[Function Definition Error] ${funcName}:`, err.message);
      }
    }
    
    // 第二步：替换所有占位符
    return promptContent.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, expression) => {
      try {
        const cleanExpr = expression.trim();
        
        // 如果是函数定义，返回空字符串（已经在第一步处理过了）
        if (cleanExpr.startsWith('function ')) {
          return '';
        }
        
        // 创建执行环境：包含 params、已定义的函数、全局对象
        const paramKeys = Object.keys(params);
        const paramValues = Object.values(params);
        const funcKeys = Object.keys(functionDefinitions);
        const funcValues = Object.values(functionDefinitions);
        
        // 使用 Function 构造器执行表达式
        const func = new Function(
          ...paramKeys,
          ...funcKeys,
          'Math', 'JSON', 'Array', 'Object', 'String', 'Number',
          `"use strict"; return (${cleanExpr});`
        );
        
        const result = func(
          ...paramValues,
          ...funcValues,
          Math, JSON, Array, Object, String, Number
        );
        
        // 处理返回值
        if (result === null || result === undefined) {
          return '';
        }
        if (typeof result === 'object') {
          return JSON.stringify(result);
        }
        return String(result);
      } catch (err) {
        console.error('[Placeholder Eval Error]', expression, err.message);
        // 如果表达式执行失败，返回原始占位符
        return match;
      }
    });
  } catch (err) {
    console.error('[Placeholder Replace Error]', err);
    return promptContent;
  }
};

const getUpstreamLLM = (model) => {
  // lastLLMIndex = (lastLLMIndex + 1) % UPSTREAM_LLMS.length;

  // while (!UPSTREAM_LLMS[lastLLMIndex].isProviderModel(model)) {
  //   lastLLMIndex = (lastLLMIndex + 1) % UPSTREAM_LLMS.length;
  // }

  let lastLLMIndex = UPSTREAM_LLMS.findIndex(llm => llm.isProviderModel(model));
  if (lastLLMIndex === -1) {
    lastLLMIndex = 1;
  }

  const llm = UPSTREAM_LLMS[lastLLMIndex];
  totalIndex = totalIndex + 1;
  if (totalIndex >= 1000000) {
    totalIndex = 0
  }
  const modelAlias = MODEL_MAP[llm.provider]?.[model] || model

  console.log(`
[Total Index]: ${totalIndex}  | [current Index]: ${lastLLMIndex}
[use LLMS]: ${llm.provider} | [use Model]: ${model} ${modelAlias !== model ? `--> ${modelAlias}` : ''}
    `.trim());
  return {
    ...llm,
    UPSTREAM_API_URL: providerApiUrlMap[llm.provider],
    UPSTREAM_API_KEY: llm.apiKey,
    modelAlias
  };
}

// CORS 设置：默认允许所有来源；如需限制，可设置 CORS_ORIGIN 为逗号分隔的域名列表
const corsOriginFromEnv = process.env.CORS_ORIGIN || '*';
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // 非浏览器或同源
    if (corsOriginFromEnv === '*') return callback(null, true);
    const allowedOrigins = corsOriginFromEnv.split(',').map(s => s.trim()).filter(Boolean);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: false,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Type'],
  maxAge: 86400,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.post('/api/v1/ai/chat/completions', async (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
  if (!bearer || bearer !== ACCESS_TOKEN) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  // 打印请求记录
  try {
    console.log('[Request] /api/v1/ai/chat/completions ->', JSON.stringify(req.body));
  } catch (_) {
    console.log('[Request] /api/v1/ai/chat/completions (body not serializable)');
  }

  const isStream = Boolean(req.body && req.body.stream);

  const { UPSTREAM_API_URL, UPSTREAM_API_KEY, modelAlias } = getUpstreamLLM(req.body.model);

  try {
    if (isStream) {
      const upstreamRes = await axios.post(UPSTREAM_API_URL, {
        ...req.body,
        model: modelAlias
      }, {
        headers: {
          'Authorization': `Bearer ${UPSTREAM_API_KEY}`,
          'Content-Type': 'application/json'
        },
        responseType: 'stream',
        validateStatus: () => true
      });

      res.status(upstreamRes.status);
      const contentType = upstreamRes.headers['content-type'] || 'text/event-stream; charset=utf-8';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', upstreamRes.headers['cache-control'] || 'no-cache');
      res.setHeader('Connection', upstreamRes.headers['connection'] || 'keep-alive');

      upstreamRes.data.on('error', (err) => {
        console.error('[Upstream Stream Error]', err && err.message ? err.message : err);
        try { res.end(); } catch {}
      });

      upstreamRes.data.pipe(res);
    } else {
      const upstreamRes = await axios.post(UPSTREAM_API_URL, {
        ...req.body,
        model: modelAlias
      }, {
        headers: {
          'Authorization': `Bearer ${UPSTREAM_API_KEY}`,
          'Content-Type': 'application/json'
        },
        validateStatus: () => true
      });

      Object.entries(upstreamRes.headers || {}).forEach(([k, v]) => {
        if (typeof v !== 'undefined' && k.toLowerCase() !== 'transfer-encoding') {
          try { res.setHeader(k, v); } catch {}
        }
      });
      res.status(upstreamRes.status).send(upstreamRes.data);
    }
  } catch (err) {
    const status = err?.response?.status || 500;
    const data = err?.response?.data || { error: { message: 'Internal Server Error' } };
    console.error('[Proxy Error]', err?.message || err, data);
    res.status(status).json(data);
  }
});

/**
 * 合并提示词
 * strategy：合并策略
prepend：默认值，默认提示词为主，最终：默认提示词+场景提示词
append：场景提示词为主，最终：场景提示词+默认提示词
ignore：优先场景提示词，最终：场景提示词 || 默认提示词
disable：关闭默认提示词，只使用场景提示词，最终：场景提示词 || 无提示词
override：只使用默认提示词，最终：默认提示词
 */
const getMergedPromptByStrategy = (processedPrompt, currentPrompt = '', strategy = 'prepend') => {
  switch (strategy) {
    case 'append':
      return currentPrompt + '\n\n' +  processedPrompt;
    case 'ignore':
      return currentPrompt || processedPrompt;
    case 'disable':
      return currentPrompt || '';
    case 'override':
      return processedPrompt;
    case 'prepend':
      return processedPrompt + '\n\n' + currentPrompt;
    default:
      return processedPrompt + '\n\n' + currentPrompt;
  }
}


// Prompt Chat 接口 - 使用预设的prompt作为系统提示词，支持占位符参数
app.post('/api/v1/ai/prompt/chat/completions', async (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
  if (!bearer || bearer !== ACCESS_TOKEN) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  const { prompt: promptConfig, ...restBody } = req.body;
  
  if (!promptConfig || !promptConfig.id) {
    return res.status(400).json({ error: { message: 'prompt.id is required' } });
  }

  const promptId = promptConfig.id;
  const promptParams = promptConfig.params || {};
  const dryRun = Boolean(promptConfig.dryRun);

  // 查询prompt
  const prompts = readPrompts();
  const prompt = prompts[promptId];
  
  if (!prompt) {
    return res.status(404).json({ error: { message: 'Prompt not found' } });
  }

  // 替换占位符参数
  const processedContent = replacePromptPlaceholders(prompt.content, promptParams);

  // 打印请求记录
  try {
    console.log('[Request] /api/v1/ai/prompt/chat/completions ->', JSON.stringify({ 
      promptId, 
      promptParams, 
      ...restBody 
    }));
    console.log('[Using Prompt]', prompt.name);
    console.log('[Original Content]', prompt.content.substring(0, 150) + '...');
    console.log('[Processed Content]', processedContent.substring(0, 150) + '...');
  } catch (_) {
    console.log('[Request] /api/v1/ai/prompt/chat/completions (body not serializable)');
  }

  // 构建新的消息数组，将prompt内容作为系统消息插入到开头
  const messages = restBody.messages || [];
  
  let newMessages = [...messages];
  const promptStrategy = promptConfig.strategy || 'prepend';  // 可选项： prepend/append/override/ignore/disable/
  const firstSystemIndex = newMessages.findIndex(m => m.role === 'system');
  const currentSystemPrompt = firstSystemIndex > -1 ? newMessages[firstSystemIndex].content : ''
  const systemPromptContent = getMergedPromptByStrategy(processedContent, currentSystemPrompt, promptStrategy).trim();

  if (systemPromptContent) {
    if (firstSystemIndex >= 0) {
      newMessages[firstSystemIndex] = {
        ...newMessages[firstSystemIndex],
        content: systemPromptContent
      };
    } else {
      newMessages.unshift({ role: 'system', content: systemPromptContent });
    }
  }

  const requestBody = {
    ...restBody,
    messages: newMessages
  };

  // DryRun 模式：只返回处理后的内容，不发送 LLM 请求
  if (dryRun) {
    console.log('[DryRun Mode] Returning processed content without LLM call');
    return res.json({
      dryRun: true,
      prompt: {
        id: promptId,
        name: prompt.name,
        strategy: promptStrategy,
        description: prompt.description,
        originalContent: prompt.content,
        processedContent: processedContent,
        finalContent: systemPromptContent,
        params: promptParams
      },
      messages: newMessages,
      model: requestBody.model
    });
  }

  const isStream = Boolean(requestBody.stream);
  const { UPSTREAM_API_URL, UPSTREAM_API_KEY, modelAlias } = getUpstreamLLM(requestBody.model);

  try {
    if (isStream) {
      const upstreamRes = await axios.post(UPSTREAM_API_URL, {
        ...requestBody,
        model: modelAlias
      }, {
        headers: {
          'Authorization': `Bearer ${UPSTREAM_API_KEY}`,
          'Content-Type': 'application/json'
        },
        responseType: 'stream',
        validateStatus: () => true
      });

      res.status(upstreamRes.status);
      const contentType = upstreamRes.headers['content-type'] || 'text/event-stream; charset=utf-8';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', upstreamRes.headers['cache-control'] || 'no-cache');
      res.setHeader('Connection', upstreamRes.headers['connection'] || 'keep-alive');

      upstreamRes.data.on('error', (err) => {
        console.error('[Upstream Stream Error]', err && err.message ? err.message : err);
        try { res.end(); } catch {}
      });

      upstreamRes.data.pipe(res);
    } else {
      const upstreamRes = await axios.post(UPSTREAM_API_URL, {
        ...requestBody,
        model: modelAlias
      }, {
        headers: {
          'Authorization': `Bearer ${UPSTREAM_API_KEY}`,
          'Content-Type': 'application/json'
        },
        validateStatus: () => true
      });

      Object.entries(upstreamRes.headers || {}).forEach(([k, v]) => {
        if (typeof v !== 'undefined' && k.toLowerCase() !== 'transfer-encoding') {
          try { res.setHeader(k, v); } catch {}
        }
      });
      res.status(upstreamRes.status).send(upstreamRes.data);
    }
  } catch (err) {
    const status = err?.response?.status || 500;
    const data = err?.response?.data || { error: { message: 'Internal Server Error' } };
    console.error('[Proxy Error]', err?.message || err, data);
    res.status(status).json(data);
  }
});

// 前端管理页面
app.get('/prompt/admin', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prompt 管理</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #333; margin-bottom: 30px; }
    .form-section {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .form-group { margin-bottom: 15px; }
    label { display: block; margin-bottom: 5px; font-weight: 500; color: #555; }
    input, textarea {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }
    textarea { min-height: 100px; resize: vertical; font-family: monospace; }
    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      margin-right: 10px;
    }
    .btn-primary { background: #007bff; color: white; }
    .btn-primary:hover { background: #0056b3; }
    .btn-success { background: #28a745; color: white; }
    .btn-success:hover { background: #218838; }
    .btn-danger { background: #dc3545; color: white; }
    .btn-danger:hover { background: #c82333; }
    .btn-secondary { background: #6c757d; color: white; }
    .btn-secondary:hover { background: #545b62; }
    .prompt-list { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .prompt-item {
      border: 1px solid #ddd;
      padding: 15px;
      margin-bottom: 15px;
      border-radius: 4px;
      background: #fafafa;
    }
    .prompt-header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 10px;
    }
    .prompt-name { font-weight: bold; color: #333; font-size: 16px; }
    .prompt-id { 
      font-size: 12px; 
      color: #666; 
      font-family: monospace;
      margin-top: 5px;
    }
    .prompt-desc { color: #666; margin-bottom: 10px; font-size: 14px; }
    .prompt-content {
      background: white;
      padding: 10px;
      border-radius: 4px;
      margin-bottom: 10px;
      white-space: pre-wrap;
      font-family: monospace;
      font-size: 13px;
      border: 1px solid #e0e0e0;
      max-height: 200px;
      overflow-y: auto;
    }
    .prompt-meta {
      font-size: 12px;
      color: #999;
      margin-bottom: 10px;
    }
    .prompt-actions { display: flex; gap: 10px; }
    .message {
      padding: 10px 15px;
      border-radius: 4px;
      margin-bottom: 15px;
    }
    .message.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
    .message.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎯 Prompt 管理</h1>
    
    <div id="message" class="message hidden"></div>
    
    <div class="form-section hidden" style="background: #f8f9fa; border-left: 4px solid #007bff;">
      <h3 style="margin-bottom: 15px; color: #333;">💡 使用说明</h3>
      <div style="font-size: 14px; line-height: 1.8; color: #555;">
        <p style="margin-bottom: 10px;"><strong>占位符语法：</strong>使用 <code style="background: #e9ecef; padding: 2px 6px; border-radius: 3px;">{{ expression }}</code> 格式</p>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li><strong>简单变量：</strong> <code style="background: #e9ecef; padding: 2px 6px; border-radius: 3px;">{{ name }}</code> → 输出 name 的值</li>
          <li><strong>数组操作：</strong> <code style="background: #e9ecef; padding: 2px 6px; border-radius: 3px;">{{ items.join('、') }}</code> → 将数组用中文顿号连接</li>
          <li><strong>数学运算：</strong> <code style="background: #e9ecef; padding: 2px 6px; border-radius: 3px;">{{ Math.max(a, b) }}</code> → 返回最大值</li>
          <li><strong>条件表达式：</strong> <code style="background: #e9ecef; padding: 2px 6px; border-radius: 3px;">{{ age >= 18 ? '成年' : '未成年' }}</code></li>
          <li><strong>字符串处理：</strong> <code style="background: #e9ecef; padding: 2px 6px; border-radius: 3px;">{{ text.toUpperCase() }}</code></li>
          <li><strong>🔥 函数定义：</strong> <code style="background: #e9ecef; padding: 2px 6px; border-radius: 3px;">{{ function format(x) { return x.toUpperCase() } }}</code></li>
        </ul>
        <p style="margin-top: 15px;"><strong>🎯 函数定义示例：</strong></p>
        <pre style="background: #f8f9fa; border: 1px solid #dee2e6; padding: 10px; border-radius: 4px; font-size: 12px; overflow-x: auto; margin-top: 8px;">{{ function formatItem(item, index) { return (index + 1) + '. ' + item } }}
{{ function bold(text) { return '**' + text + '**' } }}

你是{{ bold(role) }}，擅长：
{{ skills.map(formatItem).join('\n') }}</pre>
        <p style="margin-top: 15px;"><strong>API 调用示例：</strong></p>
        <pre style="background: #2d2d2d; color: #f8f8f2; padding: 12px; border-radius: 4px; font-size: 12px; overflow-x: auto; margin-top: 8px;">POST /api/v1/ai/prompt/chat/completions
{
  "prompt": {
    "id": "your-prompt-id",
    "params": {
      "role": "前端开发",
      "skills": ["React", "Vue", "TypeScript"],
      "level": 5
    }
  },
  "model": "deepseek-chat",
  "messages": [
    { "role": "user", "content": "帮我写一个组件" }
  ]
}</pre>
      </div>
    </div>
    
    <div class="form-section">
      <h2 id="formTitle">创建新 Prompt</h2>
      <form id="promptForm">
        <input type="hidden" id="editId" value="">
        <div class="form-group">
          <label for="name">名称 *</label>
          <input type="text" id="name" required>
        </div>
        <div class="form-group">
          <label for="description">描述</label>
          <input type="text" id="description">
        </div>
        <div class="form-group">
          <label for="content">Prompt 内容 * 
            <span style="font-size: 12px; color: #666; font-weight: normal;" class="hidden">
              (支持占位符和函数定义)
            </span>
          </label>
          <textarea id="content" required placeholder="例如：&#10;你是{{ role }}，擅长{{ skills }}。"></textarea>
        </div>
        <button type="submit" class="btn btn-primary" id="submitBtn">创建</button>
        <button type="button" class="btn btn-secondary" id="cancelBtn" onclick="cancelEdit()" style="display:none;">取消</button>
      </form>
    </div>
    
    <div class="prompt-list">
      <h2>Prompt 列表</h2>
      <div id="promptsList"></div>
    </div>
  </div>

  <script>
    const API_BASE = '/api/v1/ai/prompt';
    const TOKEN = localStorage.getItem('prompt_token') || prompt('请输入 Access Token:');
    if (TOKEN) localStorage.setItem('prompt_token', TOKEN);

    const showMessage = (msg, type = 'success') => {
      const el = document.getElementById('message');
      el.textContent = msg;
      el.className = 'message ' + type;
      el.classList.remove('hidden');
      setTimeout(() => el.classList.add('hidden'), 3000);
    };

    const fetchAPI = async (url, options = {}) => {
      const res = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + TOKEN,
          ...options.headers
        }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Request failed');
      }
      return res.json();
    };

    const loadPrompts = async () => {
      try {
        const data = await fetchAPI(API_BASE);
        const list = data.data || [];
        const html = list.length === 0 
          ? '<p style="color: #999;">暂无 Prompt</p>'
          : list.map(p => \`
            <div class="prompt-item">
              <div class="prompt-header">
                <div>
                  <div class="prompt-name">\${p.name}</div>
                  <div class="prompt-id">ID: \${p.id}</div>
                </div>
              </div>
              \${p.description ? \`<div class="prompt-desc">\${p.description}</div>\` : ''}
              <div class="prompt-content">\${p.content}</div>
              <div class="prompt-meta">
                创建: \${new Date(p.createdAt).toLocaleString('zh-CN')} | 
                更新: \${new Date(p.updatedAt).toLocaleString('zh-CN')}
              </div>
              <div class="prompt-actions">
                <button class="btn btn-success" onclick="editPrompt('\${p.id}')">编辑</button>
                <button class="btn btn-danger" onclick="deletePrompt('\${p.id}')">删除</button>
                <button class="btn btn-secondary" onclick="copyId('\${p.id}')">复制ID</button>
              </div>
            </div>
          \`).join('');
        document.getElementById('promptsList').innerHTML = html;
      } catch (err) {
        showMessage('加载失败: ' + err.message, 'error');
      }
    };

    const editPrompt = async (id) => {
      try {
        const data = await fetchAPI(API_BASE + '/' + id);
        const p = data.data;
        document.getElementById('editId').value = id;
        document.getElementById('name').value = p.name;
        document.getElementById('description').value = p.description || '';
        document.getElementById('content').value = p.content;
        document.getElementById('formTitle').textContent = '编辑 Prompt';
        document.getElementById('submitBtn').textContent = '更新';
        document.getElementById('cancelBtn').style.display = 'inline-block';
        window.scrollTo(0, 0);
      } catch (err) {
        showMessage('加载失败: ' + err.message, 'error');
      }
    };

    const deletePrompt = async (id) => {
      if (!confirm('确定要删除这个 Prompt 吗？')) return;
      try {
        await fetchAPI(API_BASE + '/' + id, { method: 'DELETE' });
        showMessage('删除成功');
        loadPrompts();
      } catch (err) {
        showMessage('删除失败: ' + err.message, 'error');
      }
    };

    const copyId = (id) => {
      navigator.clipboard.writeText(id).then(() => {
        showMessage('ID 已复制到剪贴板');
      });
    };

    const cancelEdit = () => {
      document.getElementById('editId').value = '';
      document.getElementById('promptForm').reset();
      document.getElementById('formTitle').textContent = '创建新 Prompt';
      document.getElementById('submitBtn').textContent = '创建';
      document.getElementById('cancelBtn').style.display = 'none';
    };

    document.getElementById('promptForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('editId').value;
      const data = {
        name: document.getElementById('name').value,
        description: document.getElementById('description').value,
        content: document.getElementById('content').value
      };
      
      try {
        if (id) {
          await fetchAPI(API_BASE + '/' + id, {
            method: 'PUT',
            body: JSON.stringify(data)
          });
          showMessage('更新成功');
          cancelEdit();
        } else {
          await fetchAPI(API_BASE, {
            method: 'POST',
            body: JSON.stringify(data)
          });
          showMessage('创建成功');
          document.getElementById('promptForm').reset();
        }
        loadPrompts();
      } catch (err) {
        showMessage('操作失败: ' + err.message, 'error');
      }
    });

    window.editPrompt = editPrompt;
    window.deletePrompt = deletePrompt;
    window.copyId = copyId;
    window.cancelEdit = cancelEdit;

    loadPrompts();
  </script>
</body>
</html>`);
});

// Prompt CRUD 接口

// 创建prompt
app.post('/api/v1/ai/prompt', (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
  if (!bearer || bearer !== PROMPT_ACCESS_TOKEN) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  const { name, content, description } = req.body;
  if (!name || !content) {
    return res.status(400).json({ error: { message: 'Name and content are required' } });
  }

  const prompts = readPrompts();
  const id = generatePromptId();
  const now = new Date().toISOString();
  
  prompts[id] = {
    id,
    name,
    content,
    description: description || '',
    createdAt: now,
    updatedAt: now
  };

  if (writePrompts(prompts)) {
    return res.json({ success: true, data: prompts[id] });
  } else {
    return res.status(500).json({ error: { message: 'Failed to save prompt' } });
  }
});

// 获取prompt列表
app.get('/api/v1/ai/prompt', (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
  if (!bearer || bearer !== PROMPT_ACCESS_TOKEN) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  const prompts = readPrompts();
  const list = Object.values(prompts).sort((a, b) => 
    new Date(b.updatedAt) - new Date(a.updatedAt)
  );
  
  res.json({ success: true, data: list });
});

// 获取单个prompt
app.get('/api/v1/ai/prompt/:id', (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
  if (!bearer || bearer !== PROMPT_ACCESS_TOKEN) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  const { id } = req.params;
  const prompts = readPrompts();
  
  if (!prompts[id]) {
    return res.status(404).json({ error: { message: 'Prompt not found' } });
  }
  
  res.json({ success: true, data: prompts[id] });
});

// 更新prompt
app.put('/api/v1/ai/prompt/:id', (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
  if (!bearer || bearer !== PROMPT_ACCESS_TOKEN) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  const { id } = req.params;
  const { name, content, description } = req.body;
  
  const prompts = readPrompts();
  
  if (!prompts[id]) {
    return res.status(404).json({ error: { message: 'Prompt not found' } });
  }

  if (name) prompts[id].name = name;
  if (content) prompts[id].content = content;
  if (description !== undefined) prompts[id].description = description;
  prompts[id].updatedAt = new Date().toISOString();

  if (writePrompts(prompts)) {
    return res.json({ success: true, data: prompts[id] });
  } else {
    return res.status(500).json({ error: { message: 'Failed to update prompt' } });
  }
});

// 删除prompt
app.delete('/api/v1/ai/prompt/:id', (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
  if (!bearer || bearer !== PROMPT_ACCESS_TOKEN) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  const { id } = req.params;
  const prompts = readPrompts();
  
  if (!prompts[id]) {
    return res.status(404).json({ error: { message: 'Prompt not found' } });
  }

  delete prompts[id];

  if (writePrompts(prompts)) {
    return res.json({ success: true, message: 'Prompt deleted' });
  } else {
    return res.status(500).json({ error: { message: 'Failed to delete prompt' } });
  }
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
