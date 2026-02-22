/**
 * Unit tests for store auth actions (login, logout, checkAuth).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useStore } from '../../src/store/useStore';
import { resetStore } from '../helpers/store';
import { setupFetchMock, mockResponse } from '../helpers/mocks';

describe('Store Auth', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetStore();
    fetchMock = setupFetchMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── login ─────────────────────────────────────────────────────

  describe('login', () => {
    it('should POST to /api/auth/login', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ token: 'jwt-123', username: 'testuser' }));

      await useStore.getState().login('testuser', 'password123');

      expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testuser', password: 'password123' }),
      }));
    });

    it('should set token on success', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ token: 'jwt-123', username: 'testuser' }));

      await useStore.getState().login('testuser', 'password123');

      expect(useStore.getState().token).toBe('jwt-123');
    });

    it('should set username on success', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ token: 'jwt-123', username: 'testuser' }));

      await useStore.getState().login('testuser', 'password123');

      expect(useStore.getState().username).toBe('testuser');
    });

    it('should set isAuthenticated on success', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ token: 'jwt-123', username: 'testuser' }));

      await useStore.getState().login('testuser', 'password123');

      expect(useStore.getState().isAuthenticated).toBe(true);
    });

    it('should throw on failed login (401)', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ error: 'Invalid credentials' }, { status: 401 }));

      await expect(useStore.getState().login('bad', 'wrong')).rejects.toThrow('Invalid credentials');
    });

    it('should throw on server error (500)', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ error: 'Internal error' }, { status: 500 }));

      await expect(useStore.getState().login('user', 'pass')).rejects.toThrow('Internal error');
    });

    it('should throw generic message when error body has no error field', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({}, { status: 401 }));

      await expect(useStore.getState().login('user', 'pass')).rejects.toThrow('Login failed');
    });
  });

  // ─── logout ────────────────────────────────────────────────────

  describe('logout', () => {
    it('should clear token', () => {
      useStore.setState({ token: 'jwt-123', username: 'testuser', isAuthenticated: true });
      useStore.getState().logout();
      expect(useStore.getState().token).toBeNull();
    });

    it('should clear username', () => {
      useStore.setState({ token: 'jwt-123', username: 'testuser', isAuthenticated: true });
      useStore.getState().logout();
      expect(useStore.getState().username).toBeNull();
    });

    it('should set isAuthenticated to false', () => {
      useStore.setState({ token: 'jwt-123', username: 'testuser', isAuthenticated: true });
      useStore.getState().logout();
      expect(useStore.getState().isAuthenticated).toBe(false);
    });
  });

  // ─── checkAuth ─────────────────────────────────────────────────

  describe('checkAuth', () => {
    it('should be a no-op when token is null', async () => {
      useStore.setState({ token: null, isAuthenticated: false });
      await useStore.getState().checkAuth();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(useStore.getState().isAuthenticated).toBe(false);
    });

    it('should GET /api/auth/me with Bearer token', async () => {
      useStore.setState({ token: 'jwt-123', isAuthenticated: true });
      fetchMock.mockResolvedValueOnce(mockResponse({ username: 'testuser' }));

      await useStore.getState().checkAuth();

      expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({
        headers: { Authorization: 'Bearer jwt-123' },
      }));
    });

    it('should set username on success', async () => {
      useStore.setState({ token: 'jwt-123', isAuthenticated: true });
      fetchMock.mockResolvedValueOnce(mockResponse({ username: 'newuser' }));

      await useStore.getState().checkAuth();

      expect(useStore.getState().username).toBe('newuser');
      expect(useStore.getState().isAuthenticated).toBe(true);
    });

    it('should clear auth on 401', async () => {
      useStore.setState({ token: 'expired-jwt', username: 'testuser', isAuthenticated: true });
      fetchMock.mockResolvedValueOnce(mockResponse({ error: 'Unauthorized' }, { status: 401 }));

      await useStore.getState().checkAuth();

      expect(useStore.getState().token).toBeNull();
      expect(useStore.getState().username).toBeNull();
      expect(useStore.getState().isAuthenticated).toBe(false);
    });

    it('should clear auth on network error', async () => {
      useStore.setState({ token: 'jwt-123', username: 'testuser', isAuthenticated: true });
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      await useStore.getState().checkAuth();

      expect(useStore.getState().token).toBeNull();
      expect(useStore.getState().isAuthenticated).toBe(false);
    });

    it('should clear auth on non-ok response', async () => {
      useStore.setState({ token: 'jwt-123', username: 'testuser', isAuthenticated: true });
      fetchMock.mockResolvedValueOnce(mockResponse({}, { status: 500 }));

      await useStore.getState().checkAuth();

      expect(useStore.getState().token).toBeNull();
      expect(useStore.getState().isAuthenticated).toBe(false);
    });

    it('should set isAuthenticated to false with null token (no fetch call)', async () => {
      useStore.setState({ token: null, isAuthenticated: true });
      await useStore.getState().checkAuth();
      expect(useStore.getState().isAuthenticated).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
