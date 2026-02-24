import { describe, it, expect, vi } from 'vitest';
import { requireFields, requireUuidParam, parseNumericQuery } from '../../server/middleware/validate';
import type { Request, Response, NextFunction } from 'express';

function mockReqResNext(body: Record<string, unknown> = {}, params: Record<string, string> = {}, queryObj: Record<string, string> = {}) {
  const req = {
    body,
    params,
    query: queryObj,
  } as unknown as Request;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as unknown as NextFunction;

  return { req, res, next };
}

describe('requireFields middleware', () => {
  it('calls next when all required fields are present', () => {
    const { req, res, next } = mockReqResNext({ name: 'test', email: 'a@b.com' });
    requireFields('name', 'email')(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 400 when a field is missing', () => {
    const { req, res, next } = mockReqResNext({ name: 'test' });
    requireFields('name', 'email')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('email') }),
    );
  });

  it('returns 400 when a field is null', () => {
    const { req, res, next } = mockReqResNext({ name: null });
    requireFields('name')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when a field is empty string', () => {
    const { req, res, next } = mockReqResNext({ name: '' });
    requireFields('name')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('lists all missing fields', () => {
    const { req, res, next } = mockReqResNext({});
    requireFields('a', 'b', 'c')(req, res, next);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('a, b, c') }),
    );
  });

  it('accepts 0 as a valid value', () => {
    const { req, res, next } = mockReqResNext({ count: 0 });
    requireFields('count')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('accepts false as a valid value', () => {
    const { req, res, next } = mockReqResNext({ active: false });
    requireFields('active')(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('requireUuidParam middleware', () => {
  const validUuid = '123e4567-e89b-12d3-a456-426614174000';

  it('calls next for valid UUID', () => {
    const { req, res, next } = mockReqResNext({}, { id: validUuid });
    requireUuidParam('id')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 400 for invalid UUID', () => {
    const { req, res, next } = mockReqResNext({}, { id: 'not-a-uuid' });
    requireUuidParam('id')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('id') }),
    );
  });

  it('returns 400 for missing param', () => {
    const { req, res, next } = mockReqResNext({}, {});
    requireUuidParam('id')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('validates multiple params', () => {
    const { req, res, next } = mockReqResNext({}, { id: validUuid, mid: validUuid });
    requireUuidParam('id', 'mid')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects if any param is invalid', () => {
    const { req, res, next } = mockReqResNext({}, { id: validUuid, mid: 'bad' });
    requireUuidParam('id', 'mid')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('accepts uppercase UUIDs', () => {
    const { req, res, next } = mockReqResNext({}, { id: validUuid.toUpperCase() });
    requireUuidParam('id')(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('parseNumericQuery middleware', () => {
  it('calls next when no query params are present', () => {
    const { req, res, next } = mockReqResNext({}, {}, {});
    parseNumericQuery('limit', 'offset')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('parses valid numeric query params', () => {
    const { req, res, next } = mockReqResNext({}, {}, { limit: '10', offset: '20' });
    parseNumericQuery('limit', 'offset')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 400 for non-numeric values', () => {
    const { req, res, next } = mockReqResNext({}, {}, { limit: 'abc' });
    parseNumericQuery('limit')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('limit') }),
    );
  });
});
