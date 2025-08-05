/**
 * User Service
 * 
 * This service handles user authentication and user information retrieval.
 */

export interface User {
  id: string;
  username: string;
  email?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Get current authenticated user information
 */
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const response = await fetch('/api/users/me', {
      credentials: 'include'
    });

    if (response.ok) {
      const userData = await response.json();
      console.log('🔐 Current user:', userData);
      return userData;
    }

    if (response.status === 401) {
      console.warn('🔐 User not authenticated');
      return null;
    }

    throw new Error(`HTTP error! status: ${response.status}`);
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

/**
 * Get current user ID (convenience function)
 */
export const getCurrentUserId = async (): Promise<string | null> => {
  try {
    const user = await getCurrentUser();
    return user?.id || null;
  } catch (error) {
    console.error('Error getting current user ID:', error);
    return null;
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const user = await getCurrentUser();
    return user !== null;
  } catch (error) {
    console.error('Error checking authentication:', error);
    return false;
  }
};

/**
 * Get user session information
 */
export const getSessionInfo = async (): Promise<any> => {
  try {
    const response = await fetch('/api/auth/session', {
      credentials: 'include'
    });

    if (response.ok) {
      const sessionData = await response.json();
      console.log('🔐 Session info:', sessionData);
      return sessionData;
    }

    return null;
  } catch (error) {
    console.error('Error getting session info:', error);
    return null;
  }
};

/**
 * Cached user data for performance
 */
let cachedUser: User | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get current user with caching
 */
export const getCachedCurrentUser = async (): Promise<User | null> => {
  const now = Date.now();
  
  // Return cached user if it's still valid
  if (cachedUser && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedUser;
  }

  // Fetch new user data and cache it
  cachedUser = await getCurrentUser();
  cacheTimestamp = now;
  
  return cachedUser;
};

/**
 * Clear user cache (useful when user logs out or session changes)
 */
export const clearUserCache = (): void => {
  cachedUser = null;
  cacheTimestamp = 0;
};

/**
 * Get current user ID with caching
 */
export const getCachedCurrentUserId = async (): Promise<string | null> => {
  try {
    const user = await getCachedCurrentUser();
    return user?.id || null;
  } catch (error) {
    console.error('Error getting cached current user ID:', error);
    return null;
  }
};
