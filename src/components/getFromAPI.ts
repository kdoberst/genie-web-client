const conversationsURL = 'http://localhost:8080/v2/conversations';

export const getConversationsFromAPI = async () => {
  const response = await fetch(conversationsURL);

  return response.json();
};

export const getConversationFromAPI = async (conversationId: string) => {
  const response = await fetch(`${conversationsURL}/${conversationId}`);
  return response.json();
};
