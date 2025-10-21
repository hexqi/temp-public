const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const axios = require('axios');
const RPCClient = require('@alicloud/pop-core').RPCClient;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

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

// ==================== 中间件配置 ====================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ==================== Multer 文件上传配置 ====================
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

// ==================== 路由 ====================

app.get('/api/asr/ping', async (req, res, next) => {
  return res.json({ success: true, data: 'ping success', timestamp: new Date().toISOString() })
})

// 获取阿里云Token接口
app.get('/api/token', async (req, res, next) => {
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
app.post('/api/asr/recognize', upload.single('audio'), validateAsrRequest, async (req, res, next) => {
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

// ==================== 错误处理 ====================
// 全局错误处理中间件
app.use((err, req, res, next) => {
  // Multer错误处理
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: 'FILE_TOO_LARGE',
      message: '文件大小超过限制(10MB)'
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
});

module.exports = app;
