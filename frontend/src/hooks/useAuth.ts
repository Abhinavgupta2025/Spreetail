import { useStore } from '../store';

export function useAuth() {
  const user = useStore((state) => state.user);
  const token = useStore((state) => state.token);
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const loading = useStore((state) => state.loadingAuth);
  const error = useStore((state) => state.errorAuth);
  const login = useStore((state) => state.login);
  const register = useStore((state) => state.register);
  const logout = useStore((state) => state.logout);
  const checkAuth = useStore((state) => state.checkAuth);

  return {
    user,
    token,
    isAuthenticated,
    loading,
    error,
    login,
    register,
    logout,
    checkAuth,
  };
}

export default useAuth;
