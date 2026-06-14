import { useStore } from '../store';

export function useBalances() {
  const userBalanceSummary = useStore((state) => state.userBalanceSummary);
  const groupBalances = useStore((state) => state.groupBalances);
  const loading = useStore((state) => state.loadingBalances);
  const error = useStore((state) => state.errorBalances);
  const fetchBalances = useStore((state) => state.fetchBalances);
  const fetchUserBalanceSummary = useStore((state) => state.fetchUserBalanceSummary);
  const recordSettlement = useStore((state) => state.recordSettlement);

  return {
    userBalanceSummary,
    groupBalances,
    loading,
    error,
    fetchBalances,
    fetchUserBalanceSummary,
    recordSettlement,
  };
}

export default useBalances;
