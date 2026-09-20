'use strict';

const https = require('https');
const http = require('http');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Gate, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const targetHost = req.query.host || process.env.TARGET_HOST || 'ichance.vercel.app';
  const targetProtocol = targetHost.startsWith('localhost') ? 'http:' : 'https:';
  const targetPath = req.query.path === 'path' ? '/api/admin/gate/path' : '/api/admin/gate';
  // ⚠ لا قيمة احتياطية مكتوبة هنا أبداً. كتابة المسار السرّي في الكود
  // تنشره لكل من يقرأ المستودع، ومن يقرأه يفتح لوحة الإدارة.
  // يصل من ترويسة الطلب، أو من متغيّر بيئة يُضبط في لوحة الاستضافة.
  const gateToken = req.headers['x-gate'] || req.query.gate || process.env.GATE_TOKEN || '';
  if (!gateToken) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'رمز البوابة مفقود — أدخله في الصفحة أو اضبط GATE_TOKEN' }));
    return;
  }

  try {
    const targetUrl = new URL(targetPath, `${targetProtocol}//${targetHost}`);
    const client = targetUrl.protocol === 'http:' ? http : https;

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Gate': gateToken
      }
    };

    const proxyReq = client.request(targetUrl, options, (proxyRes) => {
      let body = '';
      proxyRes.on('data', (chunk) => { body += chunk; });
      proxyRes.on('end', () => {
        res.statusCode = proxyRes.statusCode || 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(body);
      });
    });

    proxyReq.on('error', (err) => {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: `تعذّر الاتصال بخادم iCHANCE: ${err.message}` }));
    });

    proxyReq.end();
  } catch (err) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: err.message }));
  }
};
