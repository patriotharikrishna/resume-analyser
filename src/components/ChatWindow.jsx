export default function ChatWindow({ messages, className }) {
  return (
    <div className={`chat-window ${className || ''}`}>
      {messages.map((message, index) => (
        <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
          {message.text}
        </div>
      ))}
    </div>
  )
}
