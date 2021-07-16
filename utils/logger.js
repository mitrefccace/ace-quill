const winston = require('winston');
const { format } = winston;
const { combine, label, json } = format;

winston.loggers.add('error', {

  // silent: false,
  format: combine(
    format.colorize(),
    format.printf((info) => `${Object.keys(info).reverse().reduce((acc, key, i) => {
      let acc2 = acc;
      if (typeof key === 'string') {
        if (i > 0) acc2 += ', ';
        acc2 += `"${key}": "${info[key]}"`;
      }

      return acc2;
    }, '{ ')} }`),
  ),
   transports: [
 new winston.transports.Console({
      silent:false
    }),  
    ],
});

winston.loggers.add('info', {
  // silent: false,
  format: combine(
    format.colorize(),
    format.printf((info) => `${Object.keys(info).reverse().reduce((acc, key, i) => {
      let acc2 = acc;
      if (typeof key === 'string') {
        if (i > 0) acc2 += ', ';
        acc2 += `"${key}": "${info[key]}"`;
      }

      return acc2;
    }, '{ ')} }`),
  ),
    transports: [
    new winston.transports.Console({
      silent:false
    }),
  ],
});

winston.loggers.add('debug', {
  // silent: false,
  format: format.combine(
    format.colorize(),
    format.printf((info) => `${Object.keys(info).reverse().reduce((acc, key, i) => {
      let acc2 = acc;
      if (typeof key === 'string') {
        if (i > 0) acc2 += ', ';
        acc2 += `"${key}": "${info[key]}"`;
      }

      return acc2;
    }, '{ ')} }`),
  ),
  transports: [
    new winston.transports.Console({
      silent:false
    }),  ],
});

