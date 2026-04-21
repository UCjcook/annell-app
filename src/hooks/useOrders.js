import { useCallback, useEffect, useState } from 'react';

export function useOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      if (!window.orderUrgency) {
        throw new Error('Desktop bridge not available');
      }
      const existing = await window.orderUrgency.getOrders();
      if (!existing.length) {
        await window.orderUrgency.seedDemoData();
      }
      const rows = await window.orderUrgency.getOrders();
      setOrders(rows);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { orders, loading, error, reload: load, setError };
}
