import { useEffect, useState } from 'react';

export function useSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const next = await window.orderUrgency.getSettings();
        if (mounted) setSettings(next);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  async function save(nextSettings) {
    const saved = await window.orderUrgency.saveSettings(nextSettings);
    setSettings(saved);
    return saved;
  }

  async function testConnection(nextSettings) {
    return window.orderUrgency.testShopifyConnection(nextSettings);
  }

  return { settings, loading, save, testConnection };
}
