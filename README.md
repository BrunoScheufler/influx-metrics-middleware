# influx-metrics-middleware

[![CircleCI](https://circleci.com/gh/BrunoScheufler/influx-metrics-middleware.svg?style=svg)](https://circleci.com/gh/BrunoScheufler/influx-metrics-middleware)

> A customizable, unopinionated express middleware for InfluxDB metrics built on top of [node-influx](https://github.com/node-influx/node-influx)

## Installation

```bash
npm i influx-metrics-middleware

# or if you prefer yarn

yarn add influx-metrics-middleware
```

## Usage

This middleware uses a `handleRequest` method similar to an express request handler to handle each request express passes to it. You can utilize everything you love from express and simply call the `addToBatch` method to add records to a batch which will be sent to the given InfluxDB instance once a certain threshold is reached.

### API

- `handle(options: CombinedOptions)`
  - passes [options](#configuration) to middleware, configures node-influx
  - returns actual middleware
- `handleRequest({ req: express.Request, res: express.Response }, { addToBatch: (point: IPoint | IPoint[]) => void })`
  - exposes [req](http://expressjs.com/en/4x/api.html#req) & [res](http://expressjs.com/en/4x/api.html#res) objects from request
  - allows for addToBatch to be invoked with a single [point](https://node-influx.github.io/typedef/index.html#static-typedef-IPoint) point or a collection of many

### Example

The snippet below is a simple express application with metrics collection for basic request details.

```typescript
import { createServer } from 'http';
import express from 'express';
import influxMetrics, { FieldType, CombinedOptions } from 'influx-metrics-middleware';

const app = express();
const server = createServer(app);

const influxMetricsOptions: CombinedOptions = {
  host: 'localhost',
  username: 'sample-influx-user',
  password: 'sample-password',
  database: 'sample-database',
  handleRequest: ({ req, res }, { addToBatch }) => {
    // this method will be called on every request
    const start = Date.now();
    res.on('finish', () => {
      // once the request is done, push the related data to the InfluxDB batch
      addToBatch([
        {
          measurement: 'request_data',
          fields: {
            duration: Date.now() - start
          },
          tags: {
            ip: req.ip,
            status: res.statusCode.toString(),
            path: req.originalUrl
          }
        }
      ]);
    });
  },
  batchLimit: 10000,
  disableBatch: false,
  throwErrors: true,
  schema: [
    {
      measurement: 'request_data',
      tags: ['ip', 'status', 'path'],
      fields: {
        duration: FieldType.INTEGER
      }
    }
  ]
};

// initialize the middleware
app.use(influxMetrics.handle(influxMetricsOptions));

app.get('/', (req, res) => {
  res.sendStatus(200);
});

server.listen(3000);
```

## Configuration

Because this package uses [node-influx](https://github.com/node-influx/node-influx) as its foundation, all options for this library can be added to the init options. In addition to that, influx-metrics-middleware contains a few options for its behaviour:

| **name**         | **default** | **description**                                                                                                       |
|------------------|-------------|-----------------------------------------------------------------------------------------------------------------------|
| batchLimit       | `1000`      | Push data to InfluxDB after this limit of records is reached. For performance reasons, a higher limit will be better. |
| disableBatch     | `false`     | Disable batching completely and send each new record directly                                                         |
| throwErrors      | `true`      | Throw middleware errors                                                                                               |
| queueFailedBatch | `true`      | Retry failed record upload to InfluxDB                                                                                |
