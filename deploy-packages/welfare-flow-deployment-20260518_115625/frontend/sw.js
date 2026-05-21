// Service Worker for advanced notification features
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const { conversationId, messageId, action } = event.notification.data || {};
  
  if (event.action === 'reply') {
    // Open chat window focused on conversation
    event.waitUntil(
      clients.openWindow(`/#chat/${conversationId}`)
    );
  } else if (event.action === 'mark-read') {
    // Send message to mark as read
    event.waitUntil(
      self.registration.showNotification('Message marked as read', {
        icon: '/favicon.png',
        badge: '/favicon.png',
        tag: 'mark-read-success'
      })
    );
    
    // Notify the main app
    event.waitUntil(
      clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'NOTIFICATION_ACTION',
            action: 'mark-read',
            conversationId,
            messageId
          });
        });
      })
    );
  } else {
    // Default click - open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon || '/favicon.png',
        badge: '/favicon.png',
        tag: data.tag,
        data: data.data,
        actions: [
          {
            action: 'reply',
            title: 'Reply'
          },
          {
            action: 'mark-read',
            title: 'Mark as Read'
          }
        ]
      })
    );
  }
});