import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../../lib/logger.js';

describe('logger', () => {
  let stderrSpy;
  let stdoutSpy;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
  });

  it('info writes JSON to stdout', () => {
    logger.info('test message');
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('"msg":"test message"'));
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringMatching(/"level":"info"/));
  });

  it('info with meta includes meta in output', () => {
    logger.info('done', { count: 5 });
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('"count":5'));
  });

  it('error writes JSON to stderr', () => {
    logger.error('failed');
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('"msg":"failed"'));
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringMatching(/"level":"error"/));
  });

  it('error with Error instance includes error_message in meta', () => {
    logger.error('oops', new Error('something broke'));
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('something broke'));
  });
});
