# influx-metrics-middleware

> A customizable, unopinionated express middleware for InfluxDB metrics built on top of [node-influx](https://github.com/node-influx/node-influx)

## Installation

```bash
npm i influx-metrics-middleware

# or if you prefer yarn

yarn add influx-metrics-middleware
```

## Usage

This middleware uses a `handleRequest` method similar to an express request handler to handle each request express passes to it. You can utilize everything you love from express and simply call the `addToBatch` method to add records to the batch.

### API

- `init(options: CombinedOptions)`
	- passes [options](#configuration) to middleware, configures node-influx
- `handleRequest({ req: express.Request, res: express.Response }, { addToBatch: (point: IPoint | IPoint[]) => void })`
	- exposes [req](http://expressjs.com/en/4x/api.html#req) & [res](http://expressjs.com/en/4x/api.html#res) objects from request
	- allows for addToBatch to be invoked with a single [point](https://node-influx.github.io/typedef/index.html#static-typedef-IPoint) point or a collection of many

### Example

The snippet below is a simple express application with metrics collection for some request details.

```typescript
import { createServer } from 'http';

import express from 'express';
import influxMetrics, { FieldType } from 'influx-metrics-middleware';

const app = express();
const server = createServer(app);

// Initialize middleware
influxMetrics.init({
	host: 'localhost',
	username: 'sample-user',
	password: 'sample-password',
	database: 'sample-database',
	handleRequest: ({ req, res }, { addToBatch }) => {
		const requestStarted = Date.now();
		res.on('finish', () => {
			addToBatch([
				{
					measurement: 'request_data',
					fields: {
						duration: Date.now() - requestStarted
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
	batchLimit: 1000,
	disableBatch: true,
	throwErrors: true,
	queueFailedBatch: true,
	schema: [
		{
			measurement: 'request_data',
			tags: ['ip', 'status', 'path'],
			fields: {
				duration: FieldType.INTEGER
			}
		}
	]
});

app.use(influxMetrics.handle());

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
