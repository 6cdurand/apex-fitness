'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useTrainerStore } from '@/lib/store';
import { useMessageStore, Conversation } from '@/lib/messageStore';
import {
  fetchUsersByIdsChunked,
  readProfileCache,
  writeProfileCache,
  isValidUUID,
} from '@/lib/userFetchUtils';
import Link from 'next/link';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  MessageCircle, 
  Send, 
  ArrowLeft, 
  Search,
  BadgeCheck,
  Check,
  CheckCheck,
  Loader2,
  Plus,
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
    retryMessage,
    markAsRead,
    getConversationsForUser,
    getUnreadCountForConversation
  } = useMessageStore();
  
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  // v16-D8 BUG-10: "+ New message" picker for starting a conversation with
  // someone the user hasn't messaged yet. The vertical conversation list
  // below now strictly filters to convos with at least one sent/received
  // message, so this picker is the dedicated way in to start a new thread.
  const [showNewMessagePicker, setShowNewMessagePicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  // D11: hydrate allUsers from all available sources so conversation headers
  // and list entries render real names + avatars even on a fresh device (no
  // localStorage). Previously this page only read `apex-users` from
  // localStorage, so a new login's first /messages visit rendered "?" for
  // every counterparty. Mirrors the pattern at community/page.tsx:48-64.
  //
  // Source precedence (later sources override individual defined fields, so
  // trainer flags from localStorage are preserved when Supabase returns only
  // id/displayName/username/profilePhoto):
  //   1. readProfileCache()               — sync, prevents '?' flash on reloads
  //   2. localStorage 'apex-users'        — legacy seed (rich trainer flags)
  //   3. useTrainerStore().clients        — covers trainer-side client search
  //   4. fetchUsersByIdsChunked(ids)      — authoritative names from Supabase
  useEffect(() => {
    if (!user?.id) return;

    // Per-id field merge: later sources override only DEFINED fields of
    // earlier sources. Keeps e.g. `isTrainer: true` from localStorage even
    // when the Supabase row doesn't carry that flag.
    const mergeById = (lists: any[][]): any[] => {
      const byId = new Map<string, any>();
      for (const list of lists) {
        for (const u of list || []) {
          if (!u?.id) continue;
          const existing = byId.get(u.id) ?? {};
          const next: any = { ...existing };
          for (const [k, v] of Object.entries(u)) {
            if (v !== undefined && v !== null && v !== '') next[k] = v;
          }
          byId.set(u.id, next);
        }
      }
      return Array.from(byId.values());
    };

    // --- Sync seeds (run before the await, so the first paint has names). ---
    const cacheSeed = Object.values(readProfileCache());
    const storedSeed: any[] = (() => {
      try { return JSON.parse(localStorage.getItem('apex-users') || '[]'); }
      catch { return []; }
    })();
    const clientSeed: any[] = (clients || []).map((c: any) => ({
      id: c.clientId,
      displayName: c.displayName || c.name || c.contactName,
      username: c.username,
      profilePhoto: c.profilePhoto,
    }));
    setAllUsers(mergeById([cacheSeed, storedSeed, clientSeed]));

    // --- Primary async: pull counterparty profiles for THIS user's
    //     conversations straight from Supabase in one chunked round-trip. ---
    const hydrate = async () => {
      try {
        const userConvos = getConversationsForUser(user.id);
        const participantIds = [
          ...new Set(
            userConvos
              .flatMap(c => c.participants)
              .filter(id => id && id !== user.id && isValidUUID(id)),
          ),
        ];
        if (participantIds.length === 0) return;

        const { usersById, failedIds } = await fetchUsersByIdsChunked(participantIds);
        const fetched = Object.values(usersById);
        if (fetched.length === 0) {
          if (failedIds.length > 0) {
            console.warn('[Messages] Could not resolve', failedIds.length, 'counterparty ids');
          }
          return;
        }

        // Persist for next visit so reload does NOT flash '?' → real-name.
        writeProfileCache(usersById);
        setAllUsers(prev => mergeById([prev, fetched]));
      } catch (e) {
        console.error('[Messages] Error hydrating user directory:', e);
      }
    };

    hydrate();
    // `conversations` is included so newly-created conversations trigger a
    // re-hydrate for any participant we have not yet resolved.
  }, [user?.id, conversations, clients, getConversationsForUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedConversation]);

  useEffect(() => {
    if (selectedConversation && user) {
      markAsRead(selectedConversation.id, user.id);
    }
  }, [selectedConversation, user, markAsRead]);

  // Pre-select conversation from ?with=<userId> query param
  useEffect(() => {
    if (!user || selectedConversation) return;
    const params = new URLSearchParams(window.location.search);
    const withUserId = params.get('with');
    if (withUserId) {
      // Find or create conversation with this user
      const existingConv = conversations.find(c => 
        c.participants.includes(user.id) && c.participants.includes(withUserId)
      );
      if (existingConv) {
        setSelectedConversation(existingConv);
      } else {
        // Create new conversation
        const conv = getOrCreateConversation(user.id, withUserId);
        setSelectedConversation(conv);
      }
    }
  }, [user, selectedConversation, conversations, getOrCreateConversation]);

  // v19-fix-01 hotfix (React #310): this useMemo MUST run before the auth
  // early-return. It previously sat after `if (!isAuthenticated || !user)
  // return null`; a trainer-store rehydrate (v19-fix-01 persisted
  // sessions/clientGroups) re-renders this subscriber, and the render that
  // took the early return had one fewer hook than the full render -> #310.
  // Roster is inlined + null-safe so it no longer depends on the post-guard
  // `clientUsers` const.
  const pickerCandidates = useMemo(() => {
    if (!user) return [] as any[];
    const roster = user.isTrainer
      ? allUsers.filter(u => clients.some(c => c.clientId === u.id))
      : allUsers.filter(u => u.id !== user.id);
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter(u =>
      u.displayName?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q)
    );
  }, [user, clients, allUsers, pickerSearch]);

  if (!isAuthenticated || !user) return null;

  // v16-D8 BUG-10: filter out conversations that have never had a message
  // sent or received. `getOrCreateConversation` creates an empty conv
  // record when a trainer taps a client in the "Your Clients" strip (or
  // someone is pre-selected via ?with=<userId>), and those empty records
  // were polluting the vertical list and making it look like the full
  // client roster. The conversation projection in messageStore.ts already
  // populates `lastMessage` whenever any message exists in either
  // direction, so `lastMessage` is the single source of truth for
  // "this conversation has real content."
  //
  // Sort: unread first, then by lastMessage.createdAt (most recent send
  // OR receive at the top). updatedAt is bumped to message.createdAt on
  // every send (messageStore.ts:371), so falling back to updatedAt for
  // safety still yields the correct ordering when lastMessage is set.
  const userConversations = getConversationsForUser(user.id)
    .filter(c => !!c.lastMessage)
    .sort((a, b) => {
      const aUnread = getUnreadCountForConversation(a.id, user.id);
      const bUnread = getUnreadCountForConversation(b.id, user.id);
      if (aUnread > 0 && bUnread === 0) return -1;
      if (bUnread > 0 && aUnread === 0) return 1;
      const aTs = a.lastMessage?.createdAt ?? a.updatedAt;
      const bTs = b.lastMessage?.createdAt ?? b.updatedAt;
      return new Date(bTs).getTime() - new Date(aTs).getTime();
    });
  
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

  const handlePickRecipient = (otherUser: any) => {
    const conv = getOrCreateConversation(user.id, otherUser.id);
    setSelectedConversation(conv);
    setShowNewMessagePicker(false);
    setPickerSearch('');
  };

  return (
    <MainLayout>
      <div className="flex flex-col h-[calc(100vh-80px)]">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3 bg-white/95 backdrop-blur-sm">
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
                    <Link href={otherUser?.id ? `/profile/${otherUser.id}` : '#'}>
                      <Avatar className="w-10 h-10 hover:ring-2 hover:ring-sky-500/50 transition-all cursor-pointer">
                        <AvatarImage src={otherUser?.profilePhoto} />
                        <AvatarFallback className="bg-gray-100 text-gray-900">
                          {otherUser?.displayName?.[0] || '?'}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    <div>
                      <div className="flex items-center gap-2">
                        <Link href={otherUser?.id ? `/profile/${otherUser.id}` : '#'} className="font-semibold text-gray-900 hover:text-sky-500 hover:underline transition-colors">
                          {otherUser?.displayName || otherUser?.username}
                        </Link>
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
                              ? 'bg-sky-500 text-white rounded-br-md'
                              : 'bg-gray-100 text-gray-900 rounded-bl-md'
                          }`}
                        >
                          <p className="text-sm">{msg.content}</p>
                          <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : ''}`}>
                            <span className={`text-xs ${isOwn ? 'text-sky-200' : 'text-gray-500'}`}>
                              {format(new Date(msg.createdAt), 'HH:mm')}
                            </span>
                            {isOwn && (
                              msg.status === 'failed' ? (
                                <button
                                  onClick={() => retryMessage(msg.id)}
                                  className="text-xs text-red-200 hover:text-red-100 underline flex items-center gap-1"
                                  title="Tap to retry"
                                >
                                  Failed • Retry
                                </button>
                              ) : msg.status === 'pending' ? (
                                <Loader2 className="w-3 h-3 text-sky-200 animate-spin" />
                              ) : msg.read ? (
                                <CheckCheck className="w-3 h-3 text-sky-200" />
                              ) : (
                                <Check className="w-3 h-3 text-sky-200" />
                              )
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
            <div className="px-4 py-3 border-t border-gray-200 bg-white">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 bg-gray-50 border-gray-200 text-gray-900"
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!messageText.trim()}
                  className="bg-sky-500 hover:bg-sky-600"
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
              {/* v16-D8 BUG-10: "+ New message" button is the explicit way
                  to start a conversation with someone the user hasn't
                  messaged yet. Sits next to the search bar so it's the
                  primary affordance on this empty/recent state. */}
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    placeholder="Search users to message..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-gray-50 border-gray-200 text-gray-900"
                  />
                </div>
                <Button
                  onClick={() => { setPickerSearch(''); setShowNewMessagePicker(true); }}
                  className="bg-sky-500 hover:bg-sky-600 text-white flex-shrink-0"
                  title="Start a new conversation"
                >
                  <Plus className="w-4 h-4 mr-1" /> New
                </Button>
              </div>

              {/* Search Results */}
              {searchQuery && filteredUsers.length > 0 && (
                <div className="mb-4 space-y-2">
                  <p className="text-xs text-gray-500 mb-2">Search Results</p>
                  {filteredUsers.map((u) => (
                    <Card 
                      key={u.id} 
                      className="bg-white border-gray-200 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => startConversation(u)}
                    >
                      <CardContent className="p-3 flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={u.profilePhoto} />
                          <AvatarFallback className="bg-gray-100 text-gray-900">
                            {u.displayName?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{u.displayName || u.username}</p>
                          <p className="text-xs text-gray-500">@{u.username}</p>
                        </div>
                        {u.isTrainer && (
                          <Badge variant="outline" className="border-sky-500/50 text-sky-400">
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
                        <Avatar className="w-12 h-12 ring-2 ring-sky-500/50">
                          <AvatarImage src={client.profilePhoto} />
                          <AvatarFallback className="bg-gray-100 text-gray-900">
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
                  <Card className="bg-white border-gray-200 shadow-sm">
                    <CardContent className="py-12 text-center">
                      <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No conversations yet</p>
                      <p className="text-sm text-gray-500">Search for someone to start chatting</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {userConversations.map((conv) => {
                      const otherUser = getOtherUser(conv);
                      const unreadCount = getUnreadCountForConversation(conv.id, user.id);
                      
                      return (
                        <Card 
                          key={conv.id}
                          className="bg-white border-gray-200 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => setSelectedConversation(conv)}
                        >
                          <CardContent className="p-3 flex items-center gap-3">
                            <div className="relative">
                              <Avatar className="w-12 h-12">
                                <AvatarImage src={otherUser?.profilePhoto} />
                                <AvatarFallback className="bg-gray-100 text-gray-900">
                                  {otherUser?.displayName?.[0] || '?'}
                                </AvatarFallback>
                              </Avatar>
                              {unreadCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-sky-500 rounded-full border-2 border-white" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900 truncate">
                                  {otherUser?.displayName || otherUser?.username}
                                </p>
                                {otherUser?.isVerifiedTrainer && (
                                  <BadgeCheck className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                )}
                              </div>
                              {conv.lastMessage && (
                                <p className={`text-sm truncate ${unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
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
                                <Badge className="bg-sky-500 text-white text-xs px-2">
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

      {/* v16-D8 BUG-10: "+ New message" picker dialog. Shows full client
          roster (trainer) or hydrated user directory (member) so users
          can start a NEW conversation with someone they haven't messaged
          yet. Tapping a row creates the conversation via
          getOrCreateConversation and opens the empty thread; once a
          message is sent the conv joins the vertical list. */}
      <Dialog open={showNewMessagePicker} onOpenChange={setShowNewMessagePicker}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start a conversation</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder={user.isTrainer ? 'Search clients…' : 'Search users…'}
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              className="pl-10 bg-gray-50 border-gray-200 text-gray-900"
              autoFocus
            />
          </div>
          <ScrollArea className="max-h-80">
            {pickerCandidates.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">
                {user.isTrainer
                  ? 'No clients match that search.'
                  : 'No users match that search.'}
              </div>
            ) : (
              <div className="space-y-1">
                {pickerCandidates.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handlePickRecipient(u)}
                    className="w-full flex items-center gap-3 p-2 rounded hover:bg-gray-50 text-left transition-colors"
                  >
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={u.profilePhoto} />
                      <AvatarFallback className="bg-gray-100 text-gray-900">
                        {u.displayName?.[0] || u.username?.[0] || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {u.displayName || u.username}
                      </p>
                      {u.username && (
                        <p className="text-xs text-gray-500 truncate">@{u.username}</p>
                      )}
                    </div>
                    {u.isTrainer && (
                      <Badge variant="outline" className="border-sky-500/50 text-sky-500 flex-shrink-0">
                        Trainer
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
