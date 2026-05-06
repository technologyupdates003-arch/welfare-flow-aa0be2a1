import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export function useNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Request notification permission
    const requestPermission = async () => {
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    };

    requestPermission();

    // Listen for new messages
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `user_id=neq.${user.id}`, // Only messages from others
        },
        async (payload) => {
          const message = payload.new;
          
          // Check if user is in this conversation
          const { data: participation } = await supabase
            .from('conversation_participants')
            .select('*')
            .eq('conversation_id', message.conversation_id)
            .eq('user_id', user.id)
            .single();

          if (!participation) return;

          // Get sender info
          const { data: sender } = await supabase
            .from('members')
            .select('name, profile_picture_url')
            .eq('user_id', message.user_id)
            .single();

          // Show notification if permission granted and page not visible
          if (
            Notification.permission === 'granted' && 
            document.visibilityState === 'hidden'
          ) {
            const notification = new Notification(
              sender?.name || 'New Message',
              {
                body: message.content,
                icon: sender?.profile_picture_url || '/favicon.png',
                badge: '/favicon.png',
                tag: `message-${message.id}`,
                data: {
                  conversationId: message.conversation_id,
                  messageId: message.id,
                  senderId: message.user_id
                },
              }
            );

            // Handle notification click
            notification.onclick = () => {
              window.focus();
              // Navigate to conversation (you can customize this)
              window.location.hash = `#chat/${message.conversation_id}`;
              notification.close();
            };

            // Auto close after 5 seconds
            setTimeout(() => notification.close(), 5000);
          }
        }
      )
      .subscribe();

    // Handle notification actions (for browsers that support it)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'NOTIFICATION_ACTION') {
          const { action, conversationId, messageId } = event.data;
          
          if (action === 'mark-read') {
            // Mark message as read
            supabase
              .from('messages')
              .update({ status: 'read' })
              .eq('id', messageId);
          } else if (action === 'reply') {
            // Open chat window
            window.focus();
            window.location.hash = `#chat/${conversationId}`;
          }
        }
      });
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
}