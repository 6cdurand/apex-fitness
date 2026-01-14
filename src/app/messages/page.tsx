'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useTrainerStore } from '@/lib/store';
import { useMessageStore, Conversation } from '@/lib/messageStore';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  MessageCircle, 
  Send, 
  ArrowLeft, 
  Search,
  BadgeCheck,
  Check,
  CheckCheck
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

export default function MessagesPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { clients } = useTrainerStore();
  const { 
    conversations, 
    messages, 
    getOrCreateConversation, 
    getMessages, 
    sendMessage, 
    markAsRead,
    getConversationsForUser 
  } = useMessageStore();
  
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('apex-users') || '[]');
    setAllUsers(stored);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedConversation]);

  useEffect(() => {
    if (selectedConversation && user) {
      markAsRead(selectedConversation.id, user.id);
    }
  }, [selectedConversation, user, markAsRead]);

  if (!isAuthenticated || !user) return null;

  const userConversations = getConversationsForUser(user.id);
  
  const getOtherUser = (conversation: Conversation) => {
    const otherId = conversation.participants.find(p => p !== user.id);
    return allUsers.find(u => u.id === otherId);
  };

  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedConversation) return;
    
    const otherId = selectedConversation.participants.find(p => p !== user.id);
    if (!otherId) return;
    
    sendMessage(selectedConversation.id, user.id, otherId, messageText.trim());
    setMessageText('');
  };

  const startConversation = (otherUser: any) => {
    const conv = getOrCreateConversation(user.id, otherUser.id);
    setSelectedConversation(conv);
    setSearchQuery('');
  };

  const conversationMessages = selectedConversation 
    ? getMessages(selectedConversation.id) 
    : [];

  const filteredUsers = searchQuery
    ? allUsers.filter(u => 
        u.id !== user.id &&
        (u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()))
      ).slice(0, 10)
    : [];

  // Get clients for trainer
  const clientUsers = user.isTrainer 
    ? allUsers.filter(u => clients.some(c => c.clientId === u.id))
    : [];

  return (
    <MainLayout>
      <div className="flex flex-col h-[calc(100vh-80px)]">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-3 bg-gray-900/50">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setSelectedConversation(null)}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              {(() => {
                const otherUser = getOtherUser(selectedConversation);
                return (
                  <div className="flex items-center gap-3 flex-1">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={otherUser?.profilePhoto} />
                      <AvatarFallback className="bg-gray-800">
                        {otherUser?.displayName?.[0] || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white">
                          {otherUser?.displayName || otherUser?.username}
                        </p>
                        {otherUser?.isVerifiedTrainer && (
                          <BadgeCheck className="w-4 h-4 text-blue-400" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {otherUser?.isTrainer ? 'Trainer' : 'Member'}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-4">
              <div className="space-y-3">
                {conversationMessages.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageCircle className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                    <p className="text-gray-500">No messages yet</p>
                    <p className="text-sm text-gray-600">Send a message to start the conversation</p>
                  </div>
                ) : (
                  conversationMessages.map((msg) => {
                    const isOwn = msg.senderId === user.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                            isOwn
                              ? 'bg-emerald-500 text-white rounded-br-md'
                              : 'bg-gray-800 text-gray-200 rounded-bl-md'
                          }`}
                        >
                          <p className="text-sm">{msg.content}</p>
                          <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : ''}`}>
                            <span className={`text-xs ${isOwn ? 'text-emerald-200' : 'text-gray-500'}`}>
                              {format(new Date(msg.createdAt), 'HH:mm')}
                            </span>
                            {isOwn && (
                              msg.read 
                                ? <CheckCheck className="w-3 h-3 text-emerald-200" />
                                : <Check className="w-3 h-3 text-emerald-200" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="px-4 py-3 border-t border-gray-800 bg-gray-900/50">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 bg-gray-800 border-gray-700"
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!messageText.trim()}
                  className="bg-emerald-500 hover:bg-emerald-600"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <PageHeader title="Messages" subtitle="Chat with trainers and friends" />
            
            <div className="px-4 py-4">
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  placeholder="Search users to message..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                />
              </div>

              {/* Search Results */}
              {searchQuery && filteredUsers.length > 0 && (
                <div className="mb-4 space-y-2">
                  <p className="text-xs text-gray-500 mb-2">Search Results</p>
                  {filteredUsers.map((u) => (
                    <Card 
                      key={u.id} 
                      className="bg-gray-900 border-gray-800 cursor-pointer hover:bg-gray-800/50 transition-colors"
                      onClick={() => startConversation(u)}
                    >
                      <CardContent className="p-3 flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={u.profilePhoto} />
                          <AvatarFallback className="bg-gray-800">
                            {u.displayName?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium text-white">{u.displayName || u.username}</p>
                          <p className="text-xs text-gray-500">@{u.username}</p>
                        </div>
                        {u.isTrainer && (
                          <Badge variant="outline" className="border-emerald-500/50 text-emerald-400">
                            Trainer
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Quick Access: Clients (for trainers) */}
              {user.isTrainer && clientUsers.length > 0 && !searchQuery && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-2">Your Clients</p>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {clientUsers.map((client) => (
                      <button
                        key={client.id}
                        onClick={() => startConversation(client)}
                        className="flex flex-col items-center gap-1 min-w-[60px]"
                      >
                        <Avatar className="w-12 h-12 ring-2 ring-emerald-500/50">
                          <AvatarImage src={client.profilePhoto} />
                          <AvatarFallback className="bg-gray-800">
                            {client.displayName?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-gray-400 truncate w-full text-center">
                          {client.displayName?.split(' ')[0] || client.username}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Conversations List */}
              <div>
                <p className="text-xs text-gray-500 mb-2">Recent Conversations</p>
                {userConversations.length === 0 ? (
                  <Card className="bg-gray-900 border-gray-800">
                    <CardContent className="py-12 text-center">
                      <MessageCircle className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                      <p className="text-gray-400">No conversations yet</p>
                      <p className="text-sm text-gray-500">Search for someone to start chatting</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {userConversations.map((conv) => {
                      const otherUser = getOtherUser(conv);
                      const unreadCount = messages.filter(
                        m => m.conversationId === conv.id && m.receiverId === user.id && !m.read
                      ).length;
                      
                      return (
                        <Card 
                          key={conv.id}
                          className="bg-gray-900 border-gray-800 cursor-pointer hover:bg-gray-800/50 transition-colors"
                          onClick={() => setSelectedConversation(conv)}
                        >
                          <CardContent className="p-3 flex items-center gap-3">
                            <Avatar className="w-12 h-12">
                              <AvatarImage src={otherUser?.profilePhoto} />
                              <AvatarFallback className="bg-gray-800">
                                {otherUser?.displayName?.[0] || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-white truncate">
                                  {otherUser?.displayName || otherUser?.username}
                                </p>
                                {otherUser?.isVerifiedTrainer && (
                                  <BadgeCheck className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                )}
                              </div>
                              {conv.lastMessage && (
                                <p className="text-sm text-gray-500 truncate">
                                  {conv.lastMessage.senderId === user.id ? 'You: ' : ''}
                                  {conv.lastMessage.content}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {conv.lastMessage && (
                                <span className="text-xs text-gray-500">
                                  {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: false })}
                                </span>
                              )}
                              {unreadCount > 0 && (
                                <Badge className="bg-emerald-500 text-white text-xs px-2">
                                  {unreadCount}
                                </Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
