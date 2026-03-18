import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { Message } from "../lib/types";
import { Bot, User, Copy, Check } from "lucide-react";
import { useState, useCallback } from "react";

function CopyButton({
  text,
  label = "Copy",
  className = "top-2 right-2",
  group,
}: {
  text: string;
  label?: string;
  className?: string;
  group?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  const hoverClass = group
    ? `opacity-0 group-hover/${group}:opacity-100`
    : "opacity-0 group-hover/msg:opacity-100";

  return (
    <button
      onClick={handleCopy}
      className={`absolute ${className} p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 ${hoverClass} transition-opacity z-10`}
      title={label}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

export function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 px-4 py-3 ${isUser ? "" : "bg-gray-900/50"}`}>
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
          isUser ? "bg-blue-600" : "bg-emerald-600"
        }`}
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>
      <div className="flex-1 min-w-0 prose prose-invert prose-sm max-w-none prose-pre:bg-gray-800 prose-pre:border prose-pre:border-gray-700 prose-pre:rounded-lg prose-code:before:content-none prose-code:after:content-none prose-code:bg-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-emerald-400 prose-code:text-xs prose-table:border-collapse prose-th:border prose-th:border-gray-700 prose-th:px-3 prose-th:py-2 prose-th:bg-gray-800 prose-td:border prose-td:border-gray-700 prose-td:px-3 prose-td:py-2 prose-blockquote:border-blue-500 prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline">
        {message.role === "system" ? (
          <p className="text-gray-500 italic text-xs">[system context]</p>
        ) : isUser ? (
          <p className="whitespace-pre-wrap">{message.content || "..."}</p>
        ) : (
          <div className="relative group/msg">
            <CopyButton text={message.content || ""} label="Copy response" className="top-0 right-0" />
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                pre({ children, ...props }) {
                  const codeText =
                    typeof children === "object" &&
                    children !== null &&
                    "props" in (children as React.ReactElement)
                      ? ((children as React.ReactElement).props as { children?: string })
                          .children || ""
                      : "";
                  return (
                    <div className="relative group/code">
                      <CopyButton text={String(codeText)} label="Copy code" className="top-2 right-2" group="code" />
                      <pre {...props}>{children}</pre>
                    </div>
                  );
                },
              }}
            >
              {message.content || "..."}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
