import express from 'express';
import fs from 'fs';
import { DB, Time, Math, constants } from '@mt-inc/utils';
import type { MAResult } from '@mt-inc/strategy/dist/esm/src/ma/simulation';
import type { TRIXResult } from '@mt-inc/strategy/dist/esm/src/trix/simulation';
import type { Request } from 'express';

type Pairs = constants.Pairs;

type Data = {
  pair: Pairs;
  results: (MAResult | TRIXResult)[];
  from: number | string;
  to: number | string;
  leverage?: number;
  wallet?: number;
};

const port = 5000;

const app = express();

const time = new Time();

const math = new Math();

app.use(express.json());

app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

app.options('/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', typeof req.headers.origin === 'string' ? req.headers.origin : '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  res.sendStatus(200);
});

app.post('/data', (req: Request<{}, {}, Data>, res) => {
  try {
    if (
      Object.keys(req.body).length > 0 &&
      req.body.pair &&
      req.body.from &&
      req.body.to &&
      req.body.results.length > 0
    ) {
      const db = new DB<Data[]>(`data/simulations/${req.body.pair}.json`);
      let tmp = db.read();
      if (tmp) {
        const find = tmp.findIndex(
          (item) => item.from === req.body.from && item.to === req.body.to && item.pair === req.body.pair,
        );
        if (find !== -1) {
          tmp.splice(find, 1);
        }
        tmp.push(req.body);
      } else if (!tmp) {
        tmp = [req.body];
      }
      db.write(tmp);
      return res.send({ status: 'OK', msg: 'data saved' });
    }
    return res.send({ status: 'NOTOK', msg: "body is empty or doesn't have required fields" });
  } catch (e) {
    return res.send({ status: 'NOTOK', msg: e });
  }
});

app.get('/data/:pair', (req, res) => {
  const pair = req.params.pair;
  const result: { pair: Pairs; data: Data[] }[] = [];
  if (fs.existsSync(`${__dirname}/db`)) {
    if (fs.existsSync(`${__dirname}/db/data`)) {
      if (fs.existsSync(`${__dirname}/db/data/simulations`)) {
        const db = new DB<Data[]>(`data/simulations/${pair}.json`);
        const data = db.read();
        const lRes: any[] = [];
        if (data) {
          data
            .filter((d) => d.pair === pair)
            .map((d) => {
              const results = d.results.map((formatRes) => {
                let opts = {};
                if (formatRes.type === 'trix') {
                  opts = Object.assign(opts, {
                    TRIX: formatRes.trix,
                    SMA: formatRes.sma,
                    'Верхня межа': formatRes.upper,
                    'Нижня межа': formatRes.lower,
                  });
                }
                if (
                  formatRes.type === 'ema' ||
                  formatRes.type === 'ema+rsi' ||
                  formatRes.type === 'sma' ||
                  formatRes.type === 'sma+rsi'
                ) {
                  opts = Object.assign(opts, {
                    'МА низька': formatRes.maLow,
                    'МА висока': formatRes.maHigh,
                    Поріг: formatRes.trs,
                    Амплітуда: formatRes.ampTrs,
                  });
                  if (formatRes.type === 'ema+rsi' || formatRes.type === 'sma+rsi') {
                    opts = Object.assign(opts, {
                      RSI: formatRes.rsi,
                      'Верхній RSI': formatRes.rsiUpper,
                      'Нижній RSI': formatRes.rsiUpper,
                    });
                  }
                }
                opts = Object.assign(opts, {
                  'Стоп лосс': formatRes.sl,
                  'Тейк профіт': formatRes.tp,
                  'Динамічний стоп-лосс': formatRes.tsl,
                  Період: formatRes.candle,
                  'Вікно історії': formatRes.history === '2c' ? 'Через 2 свічки' : 'Через 3 свічки',
                  Стратегія: formatRes.type.toUpperCase(),
                });
                return {
                  Опції: opts,
                  //@ts-ignore
                  Прибуток: formatRes.profit,
                  'Активна позиція': formatRes.ap,
                  Позиції: formatRes.positions,
                  //@ts-ignore
                  'Максимальне падіння': `${formatRes.fall || 'н/д'}`,
                  //@ts-ignore
                  'Профіт/Падіння': formatRes.fall ? formatRes.fallToProfit || 'Infinity' : undefined,
                  'Профіт/Лосс': `${
                    math.round(
                      (formatRes.probProfit * formatRes.positions * formatRes.avgProfit) /
                        (formatRes.probLoss * formatRes.positions * formatRes.avgLoss),
                      3,
                    ) || Infinity
                  }`,
                  '% прибуткових позицій': math.round(formatRes.probProfit * 100),
                  '% збиткових позицій': math.round(formatRes.probLoss * 100),
                  'Середній прибуток': formatRes.avgProfit,
                  'Середній збиток': formatRes.avgLoss,
                  Очікування: formatRes.expectation,
                };
              });
              lRes.push({
                results,
                from: time.format(d.from as number),
                to: time.format(d.to as number),
                leverage: d.leverage,
                wallet: d.wallet,
              });
            });
          if (lRes.length > 0) {
            result.push({ pair: pair as Pairs, data: lRes });
          }
        }
      }
    }
  }
  res.send({ status: 'OK', result });
});

app.listen(port, () => {
  console.log(`> Ready on http://localhost:${port}`);
});
