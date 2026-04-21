const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('orderUrgency', {
  getOrders: () => ipcRenderer.invoke('orders:list'),
  seedDemoData: () => ipcRenderer.invoke('orders:seed-demo'),
  updateOrderStatus: (payload) => ipcRenderer.invoke('orders:update-status', payload),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (payload) => ipcRenderer.invoke('settings:save', payload),
  syncShopifyOrders: () => ipcRenderer.invoke('shopify:sync'),
});
