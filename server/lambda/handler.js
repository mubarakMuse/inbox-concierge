import { runClassifyJob } from '../lib/runClassifyJob.js';

export const handler = async (event) => {
  for (const record of event.Records || []) {
    const body = JSON.parse(record.body);
    await runClassifyJob(body.jobId);
  }
};
