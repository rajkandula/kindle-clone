"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const Markdown = memo(function Markdown({ content }: { content: string }) {
  return (
    <div className="prose-ink">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
