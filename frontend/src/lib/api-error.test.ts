import { describe, it, expect } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { getErrorMessage } from '@/lib/api-error';

describe('getErrorMessage', () => {
  const fallback = 'Something went wrong';

  it('should return string message from AxiosError response', () => {
    const error = new AxiosError('fail', '400', undefined, undefined, {
      data: { message: 'Email already exists' },
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: { headers: new AxiosHeaders() },
    });

    expect(getErrorMessage(error, fallback)).toBe('Email already exists');
  });

  it('should return first element when message is an array', () => {
    const error = new AxiosError('fail', '400', undefined, undefined, {
      data: { message: ['email must be valid', 'name is required'] },
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: { headers: new AxiosHeaders() },
    });

    expect(getErrorMessage(error, fallback)).toBe('email must be valid');
  });

  it('should return fallback when message is not a string or array', () => {
    const error = new AxiosError('fail', '400', undefined, undefined, {
      data: { message: 42 },
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: { headers: new AxiosHeaders() },
    });

    expect(getErrorMessage(error, fallback)).toBe(fallback);
  });

  it('should return fallback when response has no data', () => {
    const error = new AxiosError('fail', '500', undefined, undefined, {
      data: {},
      status: 500,
      statusText: 'Internal Server Error',
      headers: {},
      config: { headers: new AxiosHeaders() },
    });

    expect(getErrorMessage(error, fallback)).toBe(fallback);
  });

  it('should return fallback for non-AxiosError', () => {
    expect(getErrorMessage(new Error('generic'), fallback)).toBe(fallback);
  });

  it('should return fallback for null/undefined', () => {
    expect(getErrorMessage(null, fallback)).toBe(fallback);
    expect(getErrorMessage(undefined, fallback)).toBe(fallback);
  });

  it('should return fallback when message array is empty', () => {
    const error = new AxiosError('fail', '400', undefined, undefined, {
      data: { message: [] },
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: { headers: new AxiosHeaders() },
    });

    expect(getErrorMessage(error, fallback)).toBe(fallback);
  });
});
