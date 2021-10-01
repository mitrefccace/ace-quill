// Pull in the required packages.
const crypto = require('crypto');
const querystring = require('query-string');
const WebSocket = require('ws');
const GrowingFile = require('growing-file');
const urlUtil = require('url');
const HttpsProxyAgent = require('https-proxy-agent');
const fs = require('fs');

const aceConfig = JSON.parse(
          fs.readFileSync('./configs/acequill.json'),
        );

const agent = new HttpsProxyAgent(urlUtil.parse(aceConfig.proxy));
const marshaller = require('@aws-sdk/eventstream-marshaller'); // for converting binary event stream messages to and from JSON
const utilUtf8Node = require('@aws-sdk/util-utf8-node'); // utilities for encoding and decoding UTF8
const AWS = require('aws-sdk');

const winston = require('winston');
const logger = require('../utils/logger');

const error = winston.loggers.get('error');
const info = winston.loggers.get('info');
const debug = winston.loggers.get('debug');

const eventStreamMarshaller = new marshaller.EventStreamMarshaller(
  utilUtf8Node.toUtf8,
  utilUtf8Node.fromUtf8,
);

function Amazon(configs) {
  this.file = configs.file;
  this.language = configs.language;
  this.sampleRate = '16400';
}

function toTime(time) {
  return new Date(time).toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function toDate(time) {
  return toTime(time).substring(0, 8);
}

function createCredentialScope(time, region, service) {
  return [toDate(time), region, service, 'aws4_request'].join('/');
}

function createSignedHeaders(headers) {
  return Object.keys(headers)
    .sort()
    .map((name) => name.toLowerCase().trim())
    .join(';');
}

function createCanonicalQueryString(params) {
  return Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
}

function createCanonicalHeaders(headers) {
  return Object.keys(headers)
    .sort()
    .map((name) => (
      `${name.toLowerCase().trim()}:${headers[name].toString().trim()}\n`
    ))
    .join('');
}

function createCanonicalRequest(method, pathname, query, headers, payload) {
  return [
    method.toUpperCase(),
    pathname,
    createCanonicalQueryString(query),
    createCanonicalHeaders(headers),
    createSignedHeaders(headers),
    payload,
  ].join('\n');
}

function hash(string, encoding) {
  return crypto.createHash('sha256').update(string, 'utf8').digest(encoding);
}

function createStringToSign(time, region, service, request) {
  return [
    'AWS4-HMAC-SHA256',
    toTime(time),
    createCredentialScope(time, region, service),
    hash(request, 'hex'),
  ].join('\n');
}

function hmac(key, string, encoding) {
  return crypto
    .createHmac('sha256', key)
    .update(string, 'utf8')
    .digest(encoding);
}

function createSignature(secret, time, region, service, stringToSign) {
  const h1 = hmac(`AWS4${secret}`, toDate(time)); // date-key
  const h2 = hmac(h1, region); // region-key
  const h3 = hmac(h2, service); // service-key
  const h4 = hmac(h3, 'aws4_request'); // signing-key
  return hmac(h4, stringToSign, 'hex');
}

function createPresignedUrl() {
  const host = 'transcribestreaming.us-east-1.amazonaws.com:8443';
  const path = '/stream-transcription-websocket';
  const service = 'transcribe';

  const options = {};
  options.headers = {};
  options.key = this.key;
  options.secret = this.secret;
  options.region = this.region;
  options.language = this.language;
  options.sampleRate = this.sampleRate;
  options.timestamp = Date.now();
  options.expires = 15;

  options.headers.Host = host;

  const query = {};
  query['language-code'] = options.language;
  query['media-encoding'] = 'pcm';
  query['sample-rate'] = options.sampleRate;
  query['X-Amz-Algorithm'] = 'AWS4-HMAC-SHA256';
  query['X-Amz-Credential'] = `${options.key}/${createCredentialScope(options.timestamp, options.region, service)}`;
  query['X-Amz-Date'] = toTime(options.timestamp);
  query['X-Amz-Expires'] = options.expires;
  query['X-Amz-SignedHeaders'] = createSignedHeaders(options.headers);
  if (options.sessionToken) {
    query['X-Amz-Security-Token'] = options.sessionToken;
  }

  const canonicalRequest = createCanonicalRequest(
    'GET',
    path,
    query,
    options.headers,
    crypto.createHash('sha256').update('', 'utf8').digest('hex'),
  );
  const stringToSign = createStringToSign(
    options.timestamp,
    options.region,
    service,
    canonicalRequest,
  );
  const signature = createSignature(
    options.secret,
    options.timestamp,
    options.region,
    service,
    stringToSign,
  );
  query['X-Amz-Signature'] = signature;
  return `wss://${host}${path}?${querystring.stringify(query)}`;
}

function getAudioEventMessage(buffer) {
  // wrap the audio data in a JSON envelope
  return {
    headers: {
      ':message-type': {
        type: 'string',
        value: 'event',
      },
      ':event-type': {
        type: 'string',
        value: 'AudioEvent',
      },
      ':content-type': {
        type: 'string',
        value: 'application/octet-stream',
      },
    },
    body: buffer,
  };
}

Amazon.prototype.start = function start(callback) {
  info.info('start amazon');
  const config = JSON.parse(fs.readFileSync('./configs/amazon/amazon.json'),);

  this.key = config.key;
  this.secret = config.secret;
  this.region = config.region;

  const url = createPresignedUrl.call(this);

  // open up our WebSocket connection
  const socket = new WebSocket(url, { agent });
  // var socket = new WebSocket(url, { rejectUnauthorized: false }); //no proxy option

  socket.onopen = () => {
    const gf = GrowingFile.open(this.file, {
      timeout: 25000,
      interval: 100,
    });
    gf.on('data', (data) => {
      const audioEventMessage = getAudioEventMessage(data);
      const binary = eventStreamMarshaller.marshall(audioEventMessage);
      if (socket.readyState === socket.OPEN) socket.send(binary);
    }).on('end', () => {
      info.info('Amazon FILE HAS ENDED');
      socket.close();
    });
  };

  // handle inbound messages from Amazon Transcribe
  socket.onmessage = function onmessage(message) {
    // convert the binary event stream message to JSON
    const messageWrapper = eventStreamMarshaller.unmarshall(
      Buffer.from(message.data),
    );
    const messageBody = JSON.parse(
      String.fromCharCode(...messageWrapper.body),
    );
    if (messageWrapper.headers[':message-type'].value === 'event') {
      if (
        messageBody.Transcript.Results[0]
        && messageBody.Transcript.Results[0].Alternatives[0]
      ) {
        const data = {
          transcript:
            messageBody.Transcript.Results[0].Alternatives[0].Transcript,
          final: !messageBody.Transcript.Results[0].IsPartial,
          timestamp: new Date(),
          raw: JSON.stringify(messageBody),
        };
        info.info('amazon raw', JSON.stringify(messageBody));
        callback(data);
      }
    } else {
      info.info('?????', messageBody.Message);
    }
  };

  socket.onerror = function onerror(err) {
    info.info('Socket Error:', err);
  };

  socket.onclose = function onclose(closeEvent) {
    info.info(`Socket Close: ${closeEvent}`);
  };
};

module.exports = Amazon;
