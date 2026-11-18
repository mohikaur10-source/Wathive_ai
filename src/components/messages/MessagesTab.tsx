import React, { useState } from 'react';
import {
  MessageSquare,
  Users,
  Send,
  Calendar,
  MapPin,
  ExternalLink,
  Shield,
  Ban,
  Flag,
  Sparkles,
  ArrowLeft,
  Check,
  X,
  AlertCircle,
  Clock,
  UserX,
  Heart,
  Lock,
  RotateCcw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Conversation, ConnectionRequest, AttendeeProfile } from '../../types';
import { ReportModal } from '../common/ReportModal';
import { EventDetailModal } from '../feed/EventDetailModal';

interface MessagesTabProps {
  onViewEvent?: (eventId: string) => void;
}

export const MessagesTab: React.FC<MessagesTabProps> = ({ onViewEvent }) => {
  const {
    user,
    conversations,
    connectionRequests,
    respondConnectionRequest,
    withdrawConnectionRequest,
    chatMessages,
    sendMessage,
    disconnectConversation,
    toggleStayConnected,
    simulatePartnerStayConnected,
    toggleChatPostEventClosed,
    toggleSimulateEventEnded,
    events,
    dailyBuddyRequestsCount,
    maxDailyRequests
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'conversations' | 'requests'>('conversations');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    conversations.length > 0 ? conversations[0].id : null
  );
  const [inputText, setInputText] = useState('');
  const [reportTarget, setReportTarget] = useState<{ type: 'user'; attendee: AttendeeProfile } | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [viewingEventId, setViewingEventId] = useState<string | null>(null);
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false);
  const [statusToast, setStatusToast] = useState('');

  // Incoming requests to me
  const incomingRequests = connectionRequests.filter(
    (r) => r.recipientId === user?.id
  );

  // Outgoing requests sent by me
  const outgoingRequests = connectionRequests.filter(
    (r) => r.senderId === user?.id
  );

  const selectedConversation = conversations.find(
    (c) => c.id === selectedConversationId
  );

  const currentMessages = selectedConversationId
    ? chatMessages[selectedConversationId] || []
    : [];

  // Associated event for the selected conversation
  const currentEvent = selectedConversation
    ? events.find((e) => e.id === selectedConversation.eventId)
    : null;

  const isEventEnded = currentEvent?.status === 'ended';

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !selectedConversationId) return;
    sendMessage(selectedConversationId, inputText);
    setInputText('');
  };

  const handlePromptClick = (prompt: string) => {
    if (!selectedConversationId) return;
    sendMessage(selectedConversationId, prompt);
  };

  const handleDisconnect = () => {
    if (!selectedConversationId) return;
    disconnectConversation(selectedConversationId);
    setDisconnectConfirmOpen(false);
    setStatusToast('You disconnected from this conversation.');
    setTimeout(() => setStatusToast(''), 3500);
  };

  const selectedEvent = viewingEventId
    ? events.find((e) => e.id === viewingEventId) || null
    : null;

  return (
    <div className="pb-20 md:pb-12 max-w-6xl mx-auto h-[calc(100vh-8.5rem)] md:h-[calc(100vh-6rem)] flex flex-col">
      {/* Prototype Simulated Notice Banner - Requirement 10 */}
      <div className="bg-stone-900 text-stone-300 px-4 py-2 text-[11px] flex items-center justify-between border-b border-stone-800 shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            <strong className="text-amber-300">Prototype Demo:</strong> Requests, mutual acceptances, daily limits ({dailyBuddyRequestsCount}/{maxDailyRequests}), disconnects, and simulated reports run locally.
          </span>
        </div>
        <span className="text-stone-400 hidden sm:inline">
          Server-side enforcement required for production
        </span>
      </div>

      {/* Top Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:py-3 sm:px-0 border-b border-stone-200 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-stone-950 tracking-tight">
              Event Messages & Buddies
            </h1>
            <span className="text-[11px] font-bold text-stone-950 bg-amber-400 px-2.5 py-0.5 rounded-full shadow-2xs">
              UW Demo
            </span>
          </div>
          <p className="text-xs text-stone-600 mt-0.5">
            Connections unlock only when a request is mutually accepted. Chatting without accepted requests is prohibited.
          </p>
        </div>

        {/* Sub-tab switcher */}
        <div className="flex items-center p-1 bg-stone-100 rounded-2xl w-fit self-start sm:self-auto border border-stone-200/60">
          <button
            onClick={() => setActiveSubTab('conversations')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
              activeSubTab === 'conversations'
                ? 'bg-stone-950 text-amber-300 shadow-xs'
                : 'text-stone-600 hover:text-stone-950'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Active Chats ({conversations.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('requests')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 relative ${
              activeSubTab === 'requests'
                ? 'bg-stone-950 text-amber-300 shadow-xs'
                : 'text-stone-600 hover:text-stone-950'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Requests</span>
            {incomingRequests.filter((r) => r.status === 'pending').length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-400 text-stone-950 text-[10px] font-black flex items-center justify-center">
                {incomingRequests.filter((r) => r.status === 'pending').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {statusToast && (
        <div className="mx-3 mt-2 p-2.5 bg-stone-950 text-amber-300 text-xs font-bold rounded-xl shadow-md border border-stone-800 flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-amber-400 stroke-[3]" />
          <span>{statusToast}</span>
        </div>
      )}

      {/* Main Tab Content */}
      {activeSubTab === 'requests' ? (
        <div className="flex-1 overflow-y-auto pt-4 space-y-6 px-3 sm:px-0">
          {/* Incoming Requests (Requirement 3: Accept/Decline without reason) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <span>Incoming Buddy Requests</span>
                <span className="text-xs font-normal text-stone-700">
                  ({incomingRequests.filter((r) => r.status === 'pending').length} pending)
                </span>
              </h2>
              <span className="text-[11px] text-stone-600">
                Accepting unlocks a shared chat
              </span>
            </div>

            {incomingRequests.length === 0 ? (
              <div className="p-8 bg-white rounded-2xl border border-stone-200 text-center space-y-1">
                <Users className="w-8 h-8 text-stone-300 mx-auto" />
                <p className="text-xs font-semibold text-stone-800">No incoming requests</p>
                <p className="text-[11px] text-stone-600">
                  When attendees invite you to go to an event together, their requests will appear here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {incomingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 bg-white rounded-2xl border border-amber-300/90 shadow-2xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <img
                          src={req.senderAvatar}
                          alt={req.senderName}
                          referrerPolicy="no-referrer"
                          className="w-11 h-11 rounded-full object-cover border-2 border-amber-400 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-bold text-stone-900 text-sm truncate">
                              {req.senderName}
                            </h4>
                            <span className="text-[10px] bg-stone-950 text-amber-300 font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <Shield className="w-2.5 h-2.5 text-amber-400" />
                              Verified Student
                            </span>
                            {req.compatibilityScore && (
                              <span className="text-[10px] bg-amber-400 text-stone-950 font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                                <Sparkles className="w-2.5 h-2.5" />
                                {req.compatibilityScore}% Match
                              </span>
                            )}
                          </div>
                          {(req.senderFaculty || req.senderYear) && (
                            <p className="text-xs text-stone-600">
                              {req.senderFaculty} {req.senderYear ? `(${req.senderYear})` : ''}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Block/Report button on incoming request */}
                      <button
                        type="button"
                        onClick={() => {
                          setReportTarget({
                            type: 'user',
                            attendee: {
                              id: req.senderId,
                              name: req.senderName,
                              avatar: req.senderAvatar,
                              faculty: req.senderFaculty,
                              year: req.senderYear,
                              isVerifiedUWStudent: true
                            }
                          });
                          setReportModalOpen(true);
                        }}
                        className="p-1.5 text-stone-400 hover:text-red-700 rounded-lg hover:bg-stone-100"
                        title="Block or report sender"
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Compatibility reasons if available */}
                    {req.compatibilityReasons && req.compatibilityReasons.length > 0 && (
                      <div className="p-2 bg-amber-50 rounded-xl border border-amber-200 text-[10px] text-stone-700 space-y-1">
                        <span className="font-bold uppercase tracking-wider text-amber-950 block">Mutual Compatibility:</span>
                        <div className="flex flex-wrap gap-1">
                          {req.compatibilityReasons.map((r, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-white rounded border border-amber-200 text-stone-800">
                              ✓ {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200/70 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-stone-900 truncate">
                        <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="truncate">{req.eventTitle}</span>
                      </div>
                      {req.introMessage && (
                        <p className="text-stone-600 italic text-[11px] pt-1">
                          &ldquo;{req.introMessage}&rdquo;
                        </p>
                      )}
                    </div>

                    {req.status === 'pending' ? (
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          onClick={() => respondConnectionRequest(req.id, 'decline')}
                          className="px-3.5 py-1.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-semibold transition-colors"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => {
                            respondConnectionRequest(req.id, 'accept');
                            setActiveSubTab('conversations');
                          }}
                          className="px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-stone-950 text-xs font-black flex items-center gap-1.5 transition-all shadow-2xs"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Accept & Connect</span>
                        </button>
                      </div>
                    ) : req.status === 'accepted' ? (
                      <div className="text-[11px] text-amber-900 font-bold bg-amber-100 px-3 py-1 rounded-xl text-center">
                        Request Accepted · Conversation Unlocked
                      </div>
                    ) : req.status === 'declined' ? (
                      <div className="text-[11px] text-stone-500 bg-stone-100 px-3 py-1 rounded-xl text-center">
                        Request Declined (Re-requesting disabled)
                      </div>
                    ) : (
                      <div className="text-[11px] text-stone-400 bg-stone-100 px-3 py-1 rounded-xl text-center">
                        Request {req.status}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outgoing Requests Sent by Me */}
          <div className="space-y-3 pt-3 border-t border-stone-200">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <span>Invitations You Sent</span>
                <span className="text-xs font-normal text-stone-700">
                  ({outgoingRequests.length})
                </span>
              </h2>
              <span className="text-[11px] text-stone-500">
                Daily limit: {dailyBuddyRequestsCount}/{maxDailyRequests}
              </span>
            </div>

            {outgoingRequests.length === 0 ? (
              <div className="p-6 bg-white rounded-2xl border border-stone-200 text-center text-xs text-stone-600">
                You haven&apos;t sent any buddy requests yet. Open an event in the Feed to find a buddy!
              </div>
            ) : (
              <div className="space-y-2">
                {outgoingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 bg-white rounded-xl border border-stone-200 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-stone-900 truncate">
                        To {req.recipientName} for {req.eventTitle}
                      </p>
                      <p className="text-[11px] text-stone-600 truncate">
                        Status:{' '}
                        <span
                          className={`font-semibold capitalize ${
                            req.status === 'accepted'
                              ? 'text-amber-700'
                              : req.status === 'declined'
                              ? 'text-red-700'
                              : req.status === 'expired'
                              ? 'text-stone-400'
                              : 'text-stone-700'
                          }`}
                        >
                          {req.status === 'expired' ? 'Expired (Event Ended)' : req.status}
                        </span>
                      </p>
                    </div>

                    {req.status === 'pending' && (
                      <button
                        onClick={() => withdrawConnectionRequest(req.id)}
                        className="text-[11px] text-red-700 hover:text-red-900 font-semibold px-2 py-1 hover:bg-red-50 rounded-lg shrink-0"
                      >
                        Withdraw
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Active Conversations View */
        <div className="flex-1 flex overflow-hidden pt-3 gap-4 px-3 sm:px-0">
          {/* Left: Conversations list */}
          <div
            className={`w-full md:w-80 lg:w-96 flex flex-col shrink-0 bg-white rounded-2xl border border-stone-200 overflow-hidden ${
              selectedConversationId ? 'hidden md:flex' : 'flex'
            }`}
          >
            <div className="p-3 border-b border-stone-100 bg-stone-50 text-xs font-bold text-stone-700 flex items-center justify-between">
              <span>Active Buddy Chats</span>
              <span className="text-[10px] text-stone-500 font-normal">Accepted requests only</span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-stone-100">
              {conversations.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-600 space-y-1">
                  <p className="font-medium text-stone-800">No active conversations</p>
                  <p className="text-[11px]">
                    Accept incoming requests or send a buddy invite on an event to start coordinating!
                  </p>
                </div>
              ) : (
                conversations.map((conv) => {
                  const isSelected = conv.id === selectedConversationId;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => setSelectedConversationId(conv.id)}
                      className={`p-3.5 hover:bg-stone-50 transition-colors cursor-pointer flex items-start gap-3 ${
                        isSelected ? 'bg-amber-500/10 border-l-4 border-l-amber-500' : ''
                      }`}
                    >
                      <img
                        src={conv.partner.avatar}
                        alt={conv.partner.name}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-full object-cover border-2 border-amber-400 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-xs text-stone-900 truncate">
                            {conv.partner.name}
                          </h4>
                          <span className="text-[10px] text-stone-600">{conv.lastMessageTime}</span>
                        </div>
                        <p className="text-[11px] font-bold text-amber-800 truncate">
                          {conv.eventTitle}
                        </p>
                        <p className="text-[11px] text-stone-600 truncate mt-0.5">
                          {conv.isDisconnected
                            ? 'Disconnected'
                            : conv.isBlocked
                            ? 'User Blocked'
                            : conv.lastMessage}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Active Chat Area */}
          <div
            className={`flex-1 flex flex-col bg-white rounded-2xl border border-stone-200 overflow-hidden ${
              !selectedConversationId ? 'hidden md:flex' : 'flex'
            }`}
          >
            {selectedConversation ? (
              <>
                {/* Chat Top Header with Event Banner & Safety Controls */}
                <div className="p-3.5 border-b border-stone-200 bg-stone-50/90 flex flex-col gap-2 shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Mobile Back Button to list */}
                      <button
                        onClick={() => setSelectedConversationId(null)}
                        className="md:hidden p-1.5 text-stone-500 hover:text-stone-800"
                        aria-label="Back to conversations"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>

                      <img
                        src={selectedConversation.partner.avatar}
                        alt={selectedConversation.partner.name}
                        referrerPolicy="no-referrer"
                        className="w-9 h-9 rounded-full object-cover border-2 border-amber-400 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-xs sm:text-sm text-stone-900 truncate">
                            {selectedConversation.partner.name}
                          </h3>
                          <span className="text-[10px] bg-stone-100 text-stone-700 px-1 py-0.2 rounded">
                            Demo verified
                          </span>
                        </div>
                        {(selectedConversation.partner.faculty || selectedConversation.partner.year) && (
                          <p className="text-[11px] text-stone-600 truncate">
                            {selectedConversation.partner.faculty} {selectedConversation.partner.year ? `(${selectedConversation.partner.year})` : ''}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Disconnect, Block & Report Controls - Requirement 4 */}
                    <div className="flex items-center gap-1.5">
                      {!selectedConversation.isDisconnected && (
                        <button
                          type="button"
                          onClick={() => setDisconnectConfirmOpen(true)}
                          className="px-2.5 py-1 text-stone-600 hover:text-red-700 hover:bg-red-50 rounded-lg text-xs font-semibold flex items-center gap-1 border border-stone-200 transition-colors"
                          title="Leave conversation / Disconnect without requiring approval"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Disconnect</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setReportTarget({
                            type: 'user',
                            attendee: selectedConversation.partner
                          });
                          setReportModalOpen(true);
                        }}
                        className="p-1.5 text-stone-400 hover:text-red-700 hover:bg-stone-100 rounded-lg text-xs flex items-center gap-1 transition-colors"
                        title="Block or report attendee"
                      >
                        <Flag className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Report</span>
                      </button>
                    </div>
                  </div>

                  {/* Linked Event Quick Banner */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-amber-50 border border-amber-200/90 text-xs">
                    <div className="flex items-center gap-2 truncate pr-2">
                      <Calendar className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span className="font-bold text-stone-950 truncate">
                        Attending together: {selectedConversation.eventTitle}
                      </span>
                    </div>

                    <button
                      onClick={() => setViewingEventId(selectedConversation.eventId)}
                      className="text-[11px] font-bold text-stone-950 hover:text-amber-800 underline shrink-0 flex items-center gap-1"
                    >
                      <span>View Event</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Requirement 6: Safety reminder in chat header */}
                <div className="px-3 py-1.5 bg-amber-50/50 border-b border-amber-100 text-[11px] text-stone-600 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3 h-3 text-amber-600 shrink-0" />
                    <span>&ldquo;You choose what to share. You can leave or block a conversation at any time.&rdquo;</span>
                  </div>
                  <span className="text-[10px] text-stone-400 hidden sm:inline">GPS location is never shared</span>
                </div>

                {/* Status Banners: Blocked / Disconnected / Event Ended */}
                {selectedConversation.isBlocked && (
                  <div className="p-3 bg-red-50 text-red-800 text-xs flex items-center gap-2 border-b border-red-100">
                    <Ban className="w-4 h-4 shrink-0 text-red-600" />
                    <span>This user has been blocked. Messages and invites are permanently disabled.</span>
                  </div>
                )}

                {selectedConversation.isDisconnected && (
                  <div className="p-3 bg-stone-100 text-stone-700 text-xs flex items-center gap-2 border-b border-stone-200">
                    <UserX className="w-4 h-4 shrink-0 text-stone-500" />
                    <span>You have disconnected from this buddy. Messages are closed.</span>
                  </div>
                )}

                {/* Requirement 9: Post-Event State & Mutual "Stay Connected" */}
                {isEventEnded && !selectedConversation.isBlocked && !selectedConversation.isDisconnected && (
                  <div className="p-3 bg-stone-100 border-b border-stone-200 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-stone-900">
                        <Clock className="w-3.5 h-3.5 text-amber-700" />
                        <span>Event Concluded — Post-Event Connection</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => toggleChatPostEventClosed(selectedConversation.id)}
                          className="text-[10px] text-stone-500 underline hover:text-stone-800"
                          title="Simulate 48 hours passed without mutual agreement"
                        >
                          {selectedConversation.isChatClosedPostEvent ? 'Reopen Window' : 'Simulate 48h Window Passed'}
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-stone-600">
                      Buddies must mutually choose &ldquo;Stay connected&rdquo; to keep messaging. If both have not agreed within 48 hours, new messages will close.
                    </p>

                    <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-stone-200 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleStayConnected(selectedConversation.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                            selectedConversation.stayConnectedUser
                              ? 'bg-amber-400 text-stone-950'
                              : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${selectedConversation.stayConnectedUser ? 'fill-stone-950' : ''}`} />
                          <span>{selectedConversation.stayConnectedUser ? 'You chose Stay Connected' : 'Stay Connected'}</span>
                        </button>

                        {/* Interactive toggle for partner's response in this prototype */}
                        <button
                          type="button"
                          onClick={() => simulatePartnerStayConnected(selectedConversation.id)}
                          className="text-[10px] text-stone-500 underline hover:text-stone-800"
                        >
                          (Partner: {selectedConversation.stayConnectedPartner ? 'Agreed ✓' : 'Not yet'})
                        </button>
                      </div>

                      <span className="text-[11px] font-semibold">
                        {selectedConversation.stayConnectedUser && selectedConversation.stayConnectedPartner ? (
                          <span className="text-emerald-700 font-bold">✓ Mutual Agreement (Chat open)</span>
                        ) : selectedConversation.isChatClosedPostEvent ? (
                          <span className="text-red-700 font-bold">Chat Closed (48h Expired)</span>
                        ) : (
                          <span className="text-amber-800">Awaiting mutual consent</span>
                        )}
                      </span>
                    </div>
                  </div>
                )}

                {/* Message Scroll Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  <div className="text-center py-2">
                    <span className="text-[10px] text-stone-600 bg-stone-100 px-3 py-1 rounded-full">
                      Connected for {selectedConversation.eventTitle}
                    </span>
                  </div>

                  {currentMessages.map((msg) => {
                    const isMe = msg.senderId === user?.id;
                    const isSystem = msg.senderId === 'system';

                    if (isSystem) {
                      return (
                        <div key={msg.id} className="text-center py-1">
                          <span className="text-[11px] text-stone-500 bg-stone-100 px-3 py-1 rounded-lg italic">
                            {msg.text}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed ${
                            isMe
                              ? 'bg-stone-950 text-amber-200 rounded-br-xs border border-stone-800 shadow-2xs font-medium'
                              : 'bg-stone-100 text-stone-900 rounded-bl-xs'
                          }`}
                        >
                          <p>{msg.text}</p>
                        </div>
                        <span className="text-[10px] text-stone-600 mt-1 px-1">
                          {msg.timestamp}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Helpful Public Meeting Starters - Requirement 6 */}
                {!selectedConversation.isBlocked &&
                  !selectedConversation.isDisconnected &&
                  !selectedConversation.isChatClosedPostEvent && (
                    <div className="px-4 py-2 bg-stone-50 border-t border-stone-100 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="text-[10px] font-bold text-stone-700 shrink-0">
                        Public spot starters:
                      </span>
                      <button
                        type="button"
                        onClick={() => handlePromptClick("Want to meet at the registration desk?")}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 hover:border-amber-400 hover:text-stone-950 shrink-0 transition-colors"
                      >
                        &ldquo;Want to meet at the registration desk?&rdquo;
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePromptClick("Is this your first time attending?")}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 hover:border-amber-400 hover:text-stone-950 shrink-0 transition-colors"
                      >
                        &ldquo;Is this your first time attending?&rdquo;
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePromptClick("Let's meet by the main doors 10 mins before.")}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 hover:border-amber-400 hover:text-stone-950 shrink-0 transition-colors"
                      >
                        &ldquo;Let&apos;s meet by the main doors 10 mins before.&rdquo;
                      </button>
                    </div>
                  )}

                {/* Text Input Area */}
                {!selectedConversation.isBlocked &&
                !selectedConversation.isDisconnected &&
                !selectedConversation.isChatClosedPostEvent ? (
                  <form
                    onSubmit={handleSendMessage}
                    className="p-3 border-t border-stone-200 bg-white flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Message your event buddy..."
                      className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs sm:text-sm text-stone-900"
                    />
                    <button
                      type="submit"
                      disabled={!inputText.trim()}
                      className="px-4 py-2.5 bg-stone-950 hover:bg-black disabled:opacity-40 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs border border-stone-800"
                    >
                      <Send className="w-3.5 h-3.5 text-amber-400" />
                      <span className="hidden sm:inline">Send</span>
                    </button>
                  </form>
                ) : (
                  <div className="p-3.5 bg-stone-50 border-t border-stone-200 text-xs text-stone-500 text-center">
                    Messaging is closed for this conversation. Message history remains accessible with block and report controls.
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-center text-xs text-stone-600">
                Select a conversation or open an event in the feed to connect with other attendees.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      {disconnectConfirmOpen && selectedConversation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-stone-100 space-y-4">
            <h3 className="font-bold text-stone-950 text-base">
              Disconnect from {selectedConversation.partner.name}?
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              You do not need the other person&apos;s approval to disconnect. This will immediately close the chat and remove your mutual connection for this event.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDisconnectConfirmOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-stone-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-xs"
              >
                Confirm Disconnect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safety Report Modal */}
      {reportTarget && (
        <ReportModal
          isOpen={reportModalOpen}
          targetType={reportTarget.type}
          attendee={reportTarget.attendee}
          onClose={() => {
            setReportModalOpen(false);
            setReportTarget(null);
          }}
          onSuccess={() => {
            setReportModalOpen(false);
            setStatusToast('Action processed locally.');
            setTimeout(() => setStatusToast(''), 3000);
          }}
        />
      )}

      {/* Event Details Viewer Modal */}
      {selectedEvent && (
        <EventDetailModal
          isOpen={Boolean(selectedEvent)}
          event={selectedEvent}
          onClose={() => setViewingEventId(null)}
        />
      )}
    </div>
  );
};
