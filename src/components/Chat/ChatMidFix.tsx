import React, { useEffect, useState, useMemo } from 'react';
import {
  useMessages,
  useSendMessage,
  useSetActiveConversation,
  useActiveConversation,
} from '@redhat-cloud-services/ai-react-state';
import {
  Chatbot,
  ChatbotHeader,
  ChatbotHeaderTitle,
  ChatbotHeaderActions,
  ChatbotHeaderOptionsDropdown,
  ChatbotContent,
  MessageBox,
  Message,
  ChatbotDisplayMode,
  ChatbotHeaderMain,
} from '@patternfly/chatbot';
import { Button, Divider, DropdownItem, DropdownList } from '@patternfly/react-core';
import { RhStandardThoughtBubbleIcon, RhUiShareAltIcon } from '@patternfly/react-icons';
import { useParams } from 'react-router-dom-v5-compat';
import { ChatLoading } from './ChatLoading';
import { ConversationNotFound } from './ConversationNotFound';
import { useChatBar } from '../ChatBarContext';
import './Chat.css';
import { useTranslation } from 'react-i18next';
import { toMessageQuickResponses } from '../new-chat/suggestions';
import { getConversationFromAPI } from '../getFromAPI';

export const Chat: React.FunctionComponent = () => {
  const bottomRef = React.createRef<HTMLDivElement>();
  const messagesFromHook = useMessages();
  const { conversationId } = useParams();
  const setActiveConversation = useSetActiveConversation();
  const activeConversation = useActiveConversation();
  const sendMessage = useSendMessage();
  const [isLoading, setIsLoading] = useState(false);
  const [isValidConversationId, setIsValidConversationId] = useState(true);
  const { setShowChatBar } = useChatBar();
  const { t } = useTranslation('plugin__genie-web-client');

  // Use only useMessages() hook - this is the source of truth
  // Keep a ref to preserve messages if useMessages temporarily clears
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messagesRef = React.useRef<{ conversationId: string | undefined; messages: any[] }>({
    conversationId: undefined,
    messages: [],
  });

  // Clear ref when conversation changes
  React.useEffect(() => {
    if (conversationId !== messagesRef.current.conversationId) {
      messagesRef.current = { conversationId, messages: [] };
    }
  }, [conversationId]);

  // Update ref when we have messages for the current conversation
  React.useEffect(() => {
    if (messagesFromHook.length > 0 && conversationId === messagesRef.current.conversationId) {
      messagesRef.current = { conversationId, messages: messagesFromHook };
    }
  }, [messagesFromHook, conversationId]);

  // Use messagesFromHook if available, otherwise use preserved messages (only if same conversation)
  const messages =
    messagesFromHook.length > 0
      ? messagesFromHook
      : messagesRef.current.conversationId === conversationId
      ? messagesRef.current.messages
      : [];
  useEffect(() => {
    if (conversationId) {
      const loadConversation = async () => {
        setIsLoading(true);
        try {
          await setActiveConversation(conversationId);
          setIsValidConversationId(true);

          // For comparison only - fetch API to verify useMessages is correct
          getConversationFromAPI(conversationId).then((conversationData) => {
            console.log('KKD MESSAGES from API (for comparison)', conversationData);
          });
        } catch (error) {
          setIsValidConversationId(false);
          setIsLoading(false);
        }
        // Don't set loading to false here - wait for messages to populate via useEffect below
      };

      loadConversation();
    }
  }, [conversationId, setActiveConversation]);

  // Wait for messages to populate after conversation is set
  // Stop loading when either messages are available OR activeConversation is set (conversation loaded)
  useEffect(() => {
    if (conversationId && isLoading) {
      if (messagesFromHook.length > 0) {
        // Messages have loaded from useMessages, stop loading state
        setIsLoading(false);
      } else if (activeConversation?.id === conversationId) {
        // Conversation is loaded, give useMessages a moment to update, then stop loading
        const timeout = setTimeout(() => {
          setIsLoading(false);
        }, 500); // Wait 500ms for useMessages to update
        return () => clearTimeout(timeout);
      }
    }
  }, [conversationId, messagesFromHook.length, activeConversation, isLoading]);

  useEffect(() => {
    setShowChatBar(isValidConversationId);
  }, [isValidConversationId, setShowChatBar]);

  // Debug: Track when messages changes
  useEffect(() => {
    console.log('KKD MESSAGES changed in useEffect', messages);
    console.log('KKD MESSAGES.length in useEffect', messages.length);
    console.log('KKD activeConversation.messages in useEffect', activeConversation?.messages);
    console.log('KKD messagesFromHook in useEffect', messagesFromHook);
  }, [messages, activeConversation, messagesFromHook]);

  // Convert Red Hat Cloud Services messages to PatternFly format
  // Use the computed messages value which handles all the fallback logic
  const formattedMessages = useMemo(() => {
    const messagesKey = `${messages.length}-${messages
      .map((m) => m?.id)
      .filter(Boolean)
      .join(',')}`;
    console.log('KKD MESSAGES from formatMessages - useMemo running', messages);
    console.log('KKD MESSAGES.length in useMemo', messages.length);
    console.log('KKD activeConversation.id', activeConversation?.id);
    console.log('KKD conversationId', conversationId);
    console.log('KKD messagesFromHook.length', messagesFromHook.length);
    console.log('KKD messagesKey', messagesKey);

    // If no messages, return empty array (don't render anything)
    if (!messages || messages.length === 0) {
      console.log('KKD No messages to format, returning empty array');
      return [];
    }

    return messages
      .filter((msg) => msg != null) // Filter out null/undefined messages
      .map((msg, index) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const message = msg as any; // Type assertion for Red Hat Cloud Services message format
        // Generate a unique key - use id if available, otherwise use a stable index-based key
        // Use String() to ensure it's always a string, never undefined
        const messageKey = String(message?.id || `msg-${index}`);
        const isBot = message?.role === 'bot';

        // Log message structure for debugging
        if (index === 0) {
          console.log('KKD First message in formatMessages', message);
        }

        // Extract content from various possible fields
        let content =
          message?.answer ||
          message?.response ||
          message?.query ||
          message?.message ||
          message?.content ||
          message?.text ||
          message?.prompt ||
          '';
        // Remove any prefix that might be in the content
        if (content) {
          content =
            content.split('=====The following is the user query that was asked:').pop() || '';
        }

        // Log content extraction for debugging
        if (index === 0) {
          console.log('KKD Extracted content for first message', content);
          console.log('KKD Content length', content.length);
        }

        // Map quick responses payload into Message quickResponses
        const quickResponses = toMessageQuickResponses(
          message?.additionalAttributes?.quickResponses?.items,
          t,
          (text) => sendMessage(text, { stream: true }),
        );

        const messageIsLoading = !content && !(quickResponses && quickResponses.length > 0);

        return (
          <Message
            key={messageKey}
            isLoading={messageIsLoading}
            name={isBot ? 'Genie' : 'You'}
            isPrimary={!isBot}
            role={isBot ? 'bot' : 'user'}
            timestamp={new Date(
              message?.timestamp || message?.createdAt || Date.now(),
            ).toLocaleTimeString()}
            content={content}
            quickResponses={quickResponses}
          />
        );
      });
  }, [messages, t, sendMessage]);

  // Debug: Log messages value directly to see current state
  console.log('KKD MESSAGES at component render level', messages);
  console.log('KKD activeConversation.messages at render', activeConversation?.messages);
  console.log('KKD messagesFromHook at render', messagesFromHook);

  return (
    <Chatbot displayMode={ChatbotDisplayMode.embedded}>
      <ChatbotHeader>
        <ChatbotHeaderMain>
          <RhStandardThoughtBubbleIcon />
          <ChatbotHeaderTitle>title</ChatbotHeaderTitle>
        </ChatbotHeaderMain>
        <ChatbotHeaderActions>
          <Button variant="primary" icon={<RhUiShareAltIcon />} aria-label={t('chat.share')}>
            {t('chat.share')}
          </Button>
          <ChatbotHeaderOptionsDropdown isCompact tooltipProps={{ content: 'More actions' }}>
            <DropdownList>
              <DropdownItem value="rename">{t('chat.rename')}</DropdownItem>
            </DropdownList>
          </ChatbotHeaderOptionsDropdown>
        </ChatbotHeaderActions>
      </ChatbotHeader>
      <Divider />
      <ChatbotContent>
        <MessageBox>
          {isLoading && messages.length === 0 && <ChatLoading />}
          {!isValidConversationId && <ConversationNotFound />}
          {formattedMessages && formattedMessages.length > 0 ? formattedMessages : null}
          <div ref={bottomRef}></div>
        </MessageBox>
      </ChatbotContent>
    </Chatbot>
  );
};
