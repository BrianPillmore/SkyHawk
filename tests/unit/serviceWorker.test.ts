/**
 * Unit tests for the service worker registration utility.
 * Run with: npx vitest run tests/unit/serviceWorker.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isServiceWorkerSupported,
  registerServiceWorker,
  unregisterServiceWorker,
} from '../../src/utils/serviceWorker';

describe('isServiceWorkerSupported', () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it('should return true when serviceWorker is in navigator', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        serviceWorker: {
          register: vi.fn(),
          getRegistration: vi.fn(),
          controller: null,
        },
      },
      writable: true,
      configurable: true,
    });
    expect(isServiceWorkerSupported()).toBe(true);
  });

  it('should return false when serviceWorker is not in navigator', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      writable: true,
      configurable: true,
    });
    expect(isServiceWorkerSupported()).toBe(false);
  });

  it('should return false when navigator is undefined', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    // isServiceWorkerSupported checks typeof navigator !== 'undefined'
    expect(isServiceWorkerSupported()).toBe(false);
  });
});

describe('registerServiceWorker', () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it('should return null when service workers are not supported', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      writable: true,
      configurable: true,
    });
    const result = await registerServiceWorker();
    expect(result).toBeNull();
  });

  it('should call navigator.serviceWorker.register with correct args', async () => {
    const mockRegistration = {
      installing: null,
      waiting: null,
      active: null,
      addEventListener: vi.fn(),
    };

    const mockRegister = vi.fn().mockResolvedValue(mockRegistration);

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        serviceWorker: {
          register: mockRegister,
          controller: null,
        },
      },
      writable: true,
      configurable: true,
    });

    const result = await registerServiceWorker();

    expect(mockRegister).toHaveBeenCalledWith('/sw.js', { scope: '/' });
    expect(result).toBe(mockRegistration);
  });

  it('should return null and not throw on registration failure', async () => {
    const mockRegister = vi.fn().mockRejectedValue(new Error('Registration failed'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        serviceWorker: {
          register: mockRegister,
          controller: null,
        },
      },
      writable: true,
      configurable: true,
    });

    const result = await registerServiceWorker();

    expect(result).toBeNull();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('should listen for updatefound events on the registration', async () => {
    const mockRegistration = {
      installing: null,
      waiting: null,
      active: null,
      addEventListener: vi.fn(),
    };
    const mockRegister = vi.fn().mockResolvedValue(mockRegistration);

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        serviceWorker: {
          register: mockRegister,
          controller: null,
        },
      },
      writable: true,
      configurable: true,
    });

    await registerServiceWorker();

    expect(mockRegistration.addEventListener).toHaveBeenCalledWith(
      'updatefound',
      expect.any(Function)
    );
  });
});

describe('unregisterServiceWorker', () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it('should return false when service workers are not supported', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      writable: true,
      configurable: true,
    });
    const result = await unregisterServiceWorker();
    expect(result).toBe(false);
  });

  it('should call unregister on existing registration', async () => {
    const mockUnregister = vi.fn().mockResolvedValue(true);
    const mockGetRegistration = vi.fn().mockResolvedValue({
      unregister: mockUnregister,
    });

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        serviceWorker: {
          getRegistration: mockGetRegistration,
        },
      },
      writable: true,
      configurable: true,
    });

    const result = await unregisterServiceWorker();

    expect(mockGetRegistration).toHaveBeenCalled();
    expect(mockUnregister).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('should return false when no registration exists', async () => {
    const mockGetRegistration = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        serviceWorker: {
          getRegistration: mockGetRegistration,
        },
      },
      writable: true,
      configurable: true,
    });

    const result = await unregisterServiceWorker();
    expect(result).toBe(false);
  });
});
