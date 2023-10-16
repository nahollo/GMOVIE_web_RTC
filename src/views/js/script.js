document.getElementById('sendMessageForm').addEventListener('submit', function(event) {
    event.preventDefault();

    const messageInput = document.getElementById('messageInput');
    const chatMessages = document.getElementById('chatMessages');

    // 메시지를 추가하기 전의 스크롤 위치 확인
    const wasScrolledToBottom = chatMessages.scrollTop + chatMessages.clientHeight >= chatMessages.scrollHeight;

    if (messageInput.value.trim() !== '') {
        const newMessage = document.createElement('li');
        newMessage.textContent = messageInput.value;
        chatMessages.appendChild(newMessage);

        messageInput.value = '';

        // 만약 사용자가 메시지를 추가하기 전에 스크롤이 맨 아래에 있었다면, 메시지 추가 후에도 스크롤을 맨 아래로 내린다.
        if (wasScrolledToBottom) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
});