import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { Message } from "../lib/types";
import { voteResponse } from "../lib/api";
import { useSettingsStore } from "../stores/settingsStore";
import {
  Bot,
  User,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Download,
  Sparkles,
} from "lucide-react";
import { useState, useCallback } from "react";

function CopyButton({
  text,
  label = "Copy",
  className = "top-2 right-2",
  group,
  size = 14,
}: {
  text: string;
  label?: string;
  className?: string;
  group?: string;
  size?: number;
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
      {copied ? <Check size={size} /> : <Copy size={size} />}
    </button>
  );
}

function ActionBar({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [vote, setVote] = useState<1 | -1 | 0>(0);
  const [copied, setCopied] = useState(false);
  const { model, provider, collection } = useSettingsStore();

  const handleVote = useCallback(
    async (v: 1 | -1) => {
      const newVote = vote === v ? 0 : v;
      setVote(newVote);
      if (newVote !== 0) {
        await voteResponse({
          question,
          answer,
          collection: collection || "default",
          model,
          provider,
          vote: newVote,
        });
      }
    },
    [vote, question, answer, model, provider, collection]
  );

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(answer).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [answer]);

  const handleSave = useCallback(() => {
    const blob = new Blob([answer], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `response-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [answer]);

  return (
    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover/msg:opacity-100 transition-opacity">
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
        title="Copy response"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? "Copied" : "Copy"}
      </button>

      <button
        onClick={handleSave}
        className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
        title="Save as markdown"
      >
        <Download size={12} />
        Save
      </button>

      <div className="w-px h-3 bg-gray-800 mx-1" />

      <button
        onClick={() => handleVote(1)}
        className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors ${
          vote === 1
            ? "text-emerald-400 bg-emerald-400/10"
            : "text-gray-500 hover:text-emerald-400 hover:bg-gray-800"
        }`}
        title="Good response — cache for other users"
      >
        <ThumbsUp size={12} />
        {vote === 1 && (
          <span className="flex items-center gap-0.5">
            <Sparkles size={10} />
            Cached
          </span>
        )}
      </button>

      <button
        onClick={() => handleVote(-1)}
        className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors ${
          vote === -1
            ? "text-red-400 bg-red-400/10"
            : "text-gray-500 hover:text-red-400 hover:bg-gray-800"
        }`}
        title="Bad response"
      >
        <ThumbsDown size={12} />
      </button>
    </div>
  );
}

export function ChatMessage({
  message,
  previousMessage,
}: {
  message: Message;
  previousMessage?: Message;
}) {
  const isUser = message.role === "user";
  const question = previousMessage?.role === "user" ? previousMessage.content : "";

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
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                pre({ children, ...props }) {
                  const codeText =
                    typeof children === "object" &&
                    children !== null &&
                    "props" in (children as React.ReactElement)
                      ? (
                          (children as React.ReactElement).props as {
                            children?: string;
                          }
                        ).children || ""
                      : "";
                  return (
                    <div className="relative group/code">
                      <CopyButton
                        text={String(codeText)}
                        label="Copy code"
                        className="top-2 right-2"
                        group="code"
                      />
                      <pre {...props}>{children}</pre>
                    </div>
                  );
                },
              }}
            >
              {message.content || "..."}
            </ReactMarkdown>

            {/* Action bar: copy, save, vote */}
            {message.content && message.content.length > 0 && (
              <ActionBar question={question} answer={message.content} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
