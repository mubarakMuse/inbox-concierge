import { logger } from './logger.js';
import { runClassifyJob } from './runClassifyJob.js';

const getDriver = () => (process.env.QUEUE_DRIVER || 'local').toLowerCase();

export async function enqueueJob({ jobId, userId, type }) {
  const driver = getDriver();

  if (driver === 'sqs') {
    const queueUrl = process.env.SQS_QUEUE_URL;
    if (!queueUrl) {
      throw new Error('SQS_QUEUE_URL is required when QUEUE_DRIVER=sqs');
    }
    const { SQSClient, SendMessageCommand } = await import('@aws-sdk/client-sqs');
    const client = new SQSClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    await client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify({ jobId, userId, type }),
      })
    );
    logger.info('Enqueued job to SQS', { jobId, userId, type });
    return;
  }

  setImmediate(() => {
    runClassifyJob(jobId).catch((err) => {
      logger.error('Local queue job failed', err, { jobId, userId, type });
    });
  });
  logger.info('Enqueued job locally', { jobId, userId, type });
}
