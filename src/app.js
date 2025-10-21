const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const RPCClient = require('@alicloud/pop-core').RPCClient;
require('dotenv').config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3000;
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

// ==================== Token 服务类 ====================
class TokenService {
  constructor() {
    this.accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
    this.accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
    
    if (!this.accessKeyId || !this.accessKeySecret) {
      throw new Error('请配置阿里云 ACCESS_KEY_ID 和 ACCESS_KEY_SECRET');
    }

    // 初始化阿里云客户端
    this.client = new RPCClient({
      accessKeyId: this.accessKeyId,
      accessKeySecret: this.accessKeySecret,
      endpoint: 'https://nls-meta.cn-shanghai.aliyuncs.com',
      apiVersion: '2019-02-28'
    });
  }

  // 获取Token
  async createToken() {
    const result = await this.client.request('CreateToken', {}, {
      method: 'POST'
    });
    return result;
  }
}

// ==================== ASR 服务类 ====================
class AsrService {
  constructor() {
    this.baseUrl = process.env.ALIYUN_ASR_URL;
    this.appkey = process.env.ALIYUN_APPKEY;
    
    if (!this.appkey) {
      throw new Error('请配置阿里云APPKEY');
    }
  }

  buildRequestUrl(options) {
    const params = new URLSearchParams();
    params.append('appkey', this.appkey);
    
    if (options.format) params.append('format', options.format);
    if (options.sampleRate) params.append('sample_rate', options.sampleRate.toString());
    if (options.vocabularyId) params.append('vocabulary_id', options.vocabularyId);
    if (options.customizationId) params.append('customization_id', options.customizationId);
    if (options.enablePunctuationPrediction) params.append('enable_punctuation_prediction', 'true');
    if (options.enableInverseTextNormalization) params.append('enable_inverse_text_normalization', 'true');
    if (options.enableVoiceDetection) params.append('enable_voice_detection', 'true');
    if (options.disfluency) params.append('disfluency', 'true');

    return `${this.baseUrl}?${params.toString()}`;
  }

  buildHeaders(token, contentLength = null) {
    const headers = {
      'X-NLS-Token': token,
      'User-Agent': 'aliyun-asr-proxy/1.0.0'
    };

    if (contentLength !== null) {
      headers['Content-Type'] = 'application/octet-stream';
      headers['Content-Length'] = contentLength.toString();
    }

    return headers;
  }

  processResponse(response) {
    const { data } = response;
    
    if (data.status === 20000000) {
      return {
        taskId: data.task_id,
        result: data.result,
        status: data.status,
        message: data.message
      };
    } else {
      throw new Error(`阿里云ASR服务错误: ${data.message} (状态码: ${data.status})`);
    }
  }

  async recognizeSpeech(audioBuffer, token, options = {}) {
    try {
      const url = this.buildRequestUrl(options);
      const headers = this.buildHeaders(token, audioBuffer.length);

      console.log(`发送ASR请求: ${url}`);
      
      const response = await axios.post(url, audioBuffer, {
        headers,
        timeout: 60000,
        maxContentLength: 10 * 1024 * 1024,
        maxBodyLength: 10 * 1024 * 1024
      });

      return this.processResponse(response);
    } catch (error) {
      if (error.response) {
        const { data } = error.response;
        throw new Error(`阿里云ASR服务错误: ${data.message || error.message} (HTTP ${error.response.status})`);
      } else if (error.request) {
        throw new Error('网络请求失败，请检查网络连接');
      } else {
        throw new Error(`请求处理失败: ${error.message}`);
      }
    }
  }
}

const tokenService = new TokenService();
const asrService = new AsrService();

// ==================== Moonshot 文件服务类 ====================
class MoonshotFileService {
  constructor() {
    this.baseUrl = process.env.MOONSHOT_BASE_URL;
    this.apiKey = process.env.MOONSHOT_API_KEY;
    
    if (!this.baseUrl || !this.apiKey) {
      throw new Error('请配置 MOONSHOT_BASE_URL 和 MOONSHOT_API_KEY');
    }
  }

  // 上传文件到 Moonshot
  async uploadFile(fileBuffer, filename) {
    try {
      const formData = new FormData();
      formData.append('file', fileBuffer, filename);
      formData.append('purpose', 'file-extract');

      const response = await axios.post(`${this.baseUrl}/files`, formData, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          ...formData.getHeaders()
        },
        timeout: 60000
      });

      return response.data;
    } catch (error) {
      throw new Error(`Moonshot 文件上传失败: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  // 获取文件内容
  async getFileContent(fileId) {
    try {
      const response = await axios.get(`${this.baseUrl}/files/${fileId}/content`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        responseType: 'text'
      });

      return response.data;
    } catch (error) {
      throw new Error(`获取文件内容失败: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  // 删除文件
  async deleteFile(fileId) {
    try {
      await axios.delete(`${this.baseUrl}/files/${fileId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
    } catch (error) {
      throw new Error(`删除文件失败: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  // 获取文件信息
  async getFileInfo(fileId) {
    try {
      const response = await axios.get(`${this.baseUrl}/files/${fileId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`获取文件信息失败: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  // 获取文件列表
  async listFiles() {
    try {
      const response = await axios.get(`${this.baseUrl}/files`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`获取文件列表失败: ${error.response?.data?.error?.message || error.message}`);
    }
  }

}

// ==================== DashScope 文件服务类 ====================
class DashScopeFileService {
  constructor() {
    this.baseUrl = process.env.DASHSCOPE_BASE_URL;
    this.apiKey = process.env.DASHSCOPE_API_KEY;
    
    if (!this.baseUrl || !this.apiKey) {
      throw new Error('请配置 DASHSCOPE_BASE_URL 和 DASHSCOPE_API_KEY');
    }
  }

  // 上传文件到 DashScope
  async uploadFile(fileBuffer, filename) {
    try {
      const formData = new FormData();
      formData.append('file', fileBuffer, filename);
      formData.append('purpose', 'file-extract');

      const response = await axios.post(`${this.baseUrl}/files`, formData, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          ...formData.getHeaders()
        },
        timeout: 60000
      });

      return response.data;
    } catch (error) {
      throw new Error(`DashScope 文件上传失败: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  // 删除文件
  async deleteFile(fileId) {
    try {
      await axios.delete(`${this.baseUrl}/files/${fileId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
    } catch (error) {
      throw new Error(`删除文件失败: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  // 获取文件列表
  async listFiles() {
    try {
      const response = await axios.get(`${this.baseUrl}/files`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`获取文件列表失败: ${error.response?.data?.error?.message || error.message}`);
    }
  }

}

const moonshotFileService = new MoonshotFileService();
const dashscopeFileService = new DashScopeFileService();

// ==================== 中间件配置 ====================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ==================== Multer 文件上传配置 ====================
// 音频文件上传配置（用于 ASR）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB限制
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'audio/wav', 'audio/pcm', 'audio/mpeg', 'audio/mp3',
      'audio/aac', 'audio/amr', 'audio/opus', 'audio/speex'
    ];
    
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(wav|pcm|mp3|aac|amr|opus|speex)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的音频格式'), false);
    }
  }
});

// 文档文件上传配置（用于 Moonshot 和 DashScope）
const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 104857600, // 100MB限制
  },
  fileFilter: (req, file, cb) => {
    // 根据路径判断是 Moonshot 还是 DashScope
    const isMoonshot = req.path.includes('/moonshot/')
    const isDashScope = req.path.includes('/dashscope/')
    
    if (isMoonshot) {
      // Moonshot 支持的格式（与 Kimi 智能助手相同）
      const moonshotExtensions = /\.(pdf|txt|csv|doc|docx|xls|xlsx|ppt|pptx|md|jpeg|jpg|png|bmp|gif|svg|svgz|webp|ico|xbm|dib|pjp|tif|pjpeg|avif|dot|apng|epub|tiff|jfif|html|json|mobi|log|go|h|c|cpp|cxx|cc|cs|java|js|css|jsp|php|py|py3|asp|yaml|yml|ini|conf|ts|tsx)$/i
      
      if (file.originalname.match(moonshotExtensions)) {
        cb(null, true)
      } else {
        cb(new Error('Moonshot 不支持该文件格式'), false)
      }
    } else if (isDashScope) {
      // DashScope 支持的格式
      const dashscopeExtensions = /\.(txt|docx|pdf|xlsx|epub|mobi|md|csv|json|bmp|png|jpg|jpeg|gif)$/i
      
      if (file.originalname.match(dashscopeExtensions)) {
        cb(null, true)
      } else {
        cb(new Error('DashScope 不支持该文件格式'), false)
      }
    } else {
      // 默认支持常见格式
      const defaultExtensions = /\.(pdf|doc|docx|txt|md|xls|xlsx|ppt|pptx|csv|json|png|jpg|jpeg|gif|bmp)$/i
      
      if (file.originalname.match(defaultExtensions)) {
        cb(null, true)
      } else {
        cb(new Error('不支持的文件格式'), false)
      }
    }
  }
});

// ==================== 验证中间件 ====================
const validateAsrRequest = (req, res, next) => {
  const { sample_rate, format } = req.body;
  
  if (sample_rate && !['8000', '16000'].includes(sample_rate)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_SAMPLE_RATE',
      message: '采样率只支持8000或16000'
    });
  }
  
  const supportedFormats = ['pcm', 'wav', 'opus', 'speex', 'amr', 'mp3', 'aac'];
  if (format && !supportedFormats.includes(format.toLowerCase())) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_FORMAT',
      message: `不支持的音频格式，支持的格式: ${supportedFormats.join(', ')}`
    });
  }
  
  next();
};

const validateFileUpload = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_FILE',
      message: '请上传文件'
    });
  }
  next();
};

// ==================== 路由 ====================

// 健康检查接口
app.get(`${API_PREFIX}/ping`, async (req, res, next) => {
  return res.json({ 
    success: true, 
    data: 'pong',
    apiPrefix: API_PREFIX,
    timestamp: new Date().toISOString() 
  })
})

// 获取阿里云Token接口
app.get(`${API_PREFIX}/token`, async (req, res, next) => {
  try {
    const result = await tokenService.createToken();
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
})

// ASR 语音识别接口
app.post(`${API_PREFIX}/asr/recognize`, upload.single('audio'), validateAsrRequest, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_AUDIO_FILE',
        message: '请上传音频文件'
      });
    }

    if (!req.body.token) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_TOKEN',
        message: '请提供阿里云Token'
      });
    }

    const options = {
      format: req.body.format || 'wav',
      sampleRate: parseInt(req.body.sample_rate) || 16000,
      enablePunctuationPrediction: req.body.enable_punctuation_prediction === 'true',
      enableInverseTextNormalization: req.body.enable_inverse_text_normalization === 'true',
      enableVoiceDetection: req.body.enable_voice_detection === 'true',
      vocabularyId: req.body.vocabulary_id,
      customizationId: req.body.customization_id,
      disfluency: req.body.disfluency === 'true'
    };

    const result = await asrService.recognizeSpeech(req.file.buffer, req.body.token, options);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

// ==================== 文件上传 和 解析接口 ====================

// Moonshot 文件上传接口
app.post(`${API_PREFIX}/file-upload/moonshot/upload`, uploadDocument.single('file'), validateFileUpload, async (req, res, next) => {
  try {
    console.log(`[API] 收到 Moonshot 文件上传请求: ${req.file.originalname}`);
    
    const result = await moonshotFileService.uploadFile(
      req.file.buffer,
      req.file.originalname
    );
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

// Moonshot 获取文件信息接口
app.get(`${API_PREFIX}/file-upload/moonshot/files/:fileId`, async (req, res, next) => {
  try {
    const { fileId } = req.params;
    
    if (!fileId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FILE_ID',
        message: '请提供文件ID'
      });
    }

    console.log(`[API] 获取 Moonshot 文件信息: ${fileId}`);
    const result = await moonshotFileService.getFileInfo(fileId);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

// Moonshot 获取文件内容接口
app.get(`${API_PREFIX}/file-upload/moonshot/files/:fileId/content`, async (req, res, next) => {
  try {
    const { fileId } = req.params;
    
    if (!fileId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FILE_ID',
        message: '请提供文件ID'
      });
    }

    console.log(`[API] 获取 Moonshot 文件内容: ${fileId}`);
    const content = await moonshotFileService.getFileContent(fileId);
    
    res.json({
      success: true,
      data: content,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

// Moonshot 文件列表接口
app.get(`${API_PREFIX}/file-upload/moonshot/files`, async (req, res, next) => {
  try {
    console.log(`[API] 获取 Moonshot 文件列表`);
    const result = await moonshotFileService.listFiles();
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

// Moonshot 删除文件接口
app.delete(`${API_PREFIX}/file-upload/moonshot/files/:fileId`, async (req, res, next) => {
  try {
    const { fileId } = req.params;
    
    if (!fileId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FILE_ID',
        message: '请提供文件ID'
      });
    }

    console.log(`[API] 删除 Moonshot 文件: ${fileId}`);
    await moonshotFileService.deleteFile(fileId);
    
    res.json({
      success: true,
      message: '文件删除成功',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

// DashScope 文件上传接口
app.post(`${API_PREFIX}/file-upload/dashscope/upload`, uploadDocument.single('file'), validateFileUpload, async (req, res, next) => {
  try {
    console.log(`[API] 收到 DashScope 文件上传请求: ${req.file.originalname}`);
    
    const result = await dashscopeFileService.uploadFile(
      req.file.buffer,
      req.file.originalname
    );
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

// DashScope 获取文件信息接口
app.get(`${API_PREFIX}/file-upload/dashscope/files/:fileId`, async (req, res, next) => {
  try {
    const { fileId } = req.params;
    
    if (!fileId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FILE_ID',
        message: '请提供文件ID'
      });
    }

    console.log(`[API] 获取 DashScope 文件信息: ${fileId}`);
    
    const response = await axios.get(`${dashscopeFileService.baseUrl}/files/${fileId}`, {
      headers: {
        'Authorization': `Bearer ${dashscopeFileService.apiKey}`
      }
    });
    
    res.json({
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

// DashScope 文件列表接口
app.get(`${API_PREFIX}/file-upload/dashscope/files`, async (req, res, next) => {
  try {
    console.log(`[API] 获取 DashScope 文件列表`);
    const result = await dashscopeFileService.listFiles();
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

// DashScope 文件删除接口
app.delete(`${API_PREFIX}/file-upload/dashscope/files/:fileId`, async (req, res, next) => {
  try {
    const { fileId } = req.params;
    
    if (!fileId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FILE_ID',
        message: '请提供文件ID'
      });
    }

    console.log(`[API] 删除 DashScope 文件: ${fileId}`);
    await dashscopeFileService.deleteFile(fileId);
    
    res.json({
      success: true,
      message: '文件删除成功',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

// ==================== 错误处理 ====================
// 全局错误处理中间件
app.use((err, req, res, next) => {
  // Multer错误处理
  if (err.code === 'LIMIT_FILE_SIZE') {
    const maxSize = err.field === 'file' ? '50MB' : '10MB';
    return res.status(400).json({
      success: false,
      error: 'FILE_TOO_LARGE',
      message: `文件大小超过限制(${maxSize})`
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      error: 'INVALID_FILE_FIELD',
      message: '无效的文件字段名，请使用"audio"'
    });
  }

  // 网络超时错误
  if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
    return res.status(408).json({
      success: false,
      error: 'REQUEST_TIMEOUT',
      message: '请求超时，请稍后重试'
    });
  }

  // 阿里云API错误
  if (err.message.includes('阿里云ASR服务错误')) {
    return res.status(502).json({
      success: false,
      error: 'ALIYUN_API_ERROR',
      message: err.message
    });
  }

  // 文件上传服务错误
  if (err.message.includes('Moonshot') || err.message.includes('DashScope')) {
    return res.status(502).json({
      success: false,
      error: 'FILE_UPLOAD_ERROR',
      message: err.message
    });
  }

  // 文件处理超时
  if (err.message.includes('超时')) {
    return res.status(408).json({
      success: false,
      error: 'PROCESSING_TIMEOUT',
      message: err.message
    });
  }

  // 不支持的文档格式
  if (err.message.includes('不支持') && err.message.includes('格式')) {
    const isMoonshot = err.message.includes('Moonshot')
    const isDashScope = err.message.includes('DashScope')
    
    let supportedFormats = ''
    if (isMoonshot) {
      supportedFormats = 'Moonshot 支持：.pdf .txt .csv .doc .docx .xls .xlsx .ppt .pptx .md .jpeg .png .bmp .gif .svg .webp .html .json .epub .mobi .log 及各类代码文件等 60+ 种格式'
    } else if (isDashScope) {
      supportedFormats = 'DashScope 支持：.txt .docx .pdf .xlsx .epub .mobi .md .csv .json .bmp .png .jpg .jpeg .gif 共 14 种格式'
    } else {
      supportedFormats = '支持常见文档和图片格式'
    }
    
    return res.status(400).json({
      success: false,
      error: 'UNSUPPORTED_FORMAT',
      message: err.message,
      supportedFormats
    });
  }

  // 默认错误处理
  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: process.env.NODE_ENV === 'development' ? err.message : '服务器内部错误'
  });
});

// ==================== 启动服务 ====================
app.listen(PORT, () => {
  console.log(`🚀 阿里云ASR代理服务启动成功`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`🔗 API 前缀: ${API_PREFIX}`);
});

module.exports = app;