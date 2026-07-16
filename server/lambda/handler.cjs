'use strict';

/** CommonJS entry for AWS Lambda Node 20 container images with ESM sources. */
exports.handler = async (event) => {
  const { runClassifyJob } = await import('../lib/runClassifyJob.js');
  for (const record of event.Records || []) {
    const body = JSON.parse(record.body);
    await runClassifyJob(body.jobId);
  }
};
