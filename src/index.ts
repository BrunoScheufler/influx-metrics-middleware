import { InfluxDB, ISingleHostConfig, IPoint, IWriteOptions, FieldType } from 'influx';
import { RequestHandler, Request, Response } from 'express';

interface IMiddlewareRequestInfo {
	req: Request;
	res: Response;
}

interface IMiddlewareRequestHandlers {
	addToBatch(point: IPoint | IPoint[]): void;
}

interface IMiddlewareOptions {
	handleRequest: (info: IMiddlewareRequestInfo, handlers: IMiddlewareRequestHandlers) => any;
	batchLimit?: number;
	disableBatch?: boolean;
	writeOptions?: IWriteOptions;
	throwErrors?: boolean;
	queueFailedBatch?: boolean;
}

export type CombinedOptions = IMiddlewareOptions & ISingleHostConfig;

class InfluxMetricsMiddleware {
	private influxDB: InfluxDB | null = null;
	private options: CombinedOptions;

	private batch: IPoint[] = [];

	public handle(options: CombinedOptions): RequestHandler {
		// Create node-influx instance
		this.influxDB = new InfluxDB(options);

		// Apply default options
		if (typeof options.batchLimit === 'undefined') {
			options.batchLimit = 1000;
		}

		if (typeof options.disableBatch === 'undefined') {
			options.disableBatch = false;
		}

		if (typeof options.throwErrors === 'undefined') {
			options.throwErrors = true;
		}

		if (typeof options.queueFailedBatch === 'undefined') {
			options.queueFailedBatch = true;
		}

		// Store options
		this.options = options;

		const handlers: IMiddlewareRequestHandlers = { addToBatch: this.addToBatch };

		return (req, res, next) => {
			this.options.handleRequest({ req, res }, handlers);
			next();
		};
	}

	public getBatch() {
		return this.batch;
	}

	private addToBatch = (point: IPoint | IPoint[]) => {
		// Simply add point(s) to batch
		if (Array.isArray(point)) {
			// Add Date if not set
			const updatedPoints = point.map(pointEntry => ({ ...pointEntry, timestamp: pointEntry.timestamp || new Date() }));

			this.batch.push(...updatedPoints);
		} else {
			// Add Date if not set
			point.timestamp = point.timestamp || new Date();

			this.batch.push(point);
		}

		// and trigger push handler
		this.onBatchPush();
	};

	private async onBatchPush() {
		const { batchLimit, disableBatch, throwErrors, queueFailedBatch } = this.options;

		// Check if batch should be pushed
		const batchLimitExceeded = typeof batchLimit !== 'undefined' && this.batch.length > batchLimit;
		const shouldPush = disableBatch === true || batchLimitExceeded;

		if (shouldPush && this.influxDB !== null) {
			// Copy and empty current batch
			const batch = this.batch.slice(0);
			this.batch = [];

			try {
				// Write copied batch to InfluxDB
				await this.influxDB.writePoints(batch, this.options.writeOptions);
			} catch (err) {
				if (queueFailedBatch === true) {
					// Add items from batch and retry on next push
					this.batch.unshift(...batch);
				}

				if (throwErrors === true) {
					throw err;
				}
			}
		}
	}
}

export default new InfluxMetricsMiddleware();
export { FieldType };
