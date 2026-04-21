const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('orderUrgency', {
  getOrders: () => ipcRenderer.invoke('orders:list'),
  seedDemoData: () => ipcRenderer.invoke('orders:seed-demo'),
  addManualOrder: (payload) => ipcRenderer.invoke('orders:add-manual', payload),
  updateOrderStatus: (payload) => ipcRenderer.invoke('orders:update-status', payload),
  updateOrderNotes: (payload) => ipcRenderer.invoke('orders:update-notes', payload),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (payload) => ipcRenderer.invoke('settings:save', payload),
  syncShopifyOrders: () => ipcRenderer.invoke('shopify:sync'),
});
