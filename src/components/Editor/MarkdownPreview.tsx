import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useMemo } from "react";
import type { FontSize } from "../../stores/fontSizeStore";
import { isKnotImageUrl } from "../../lib/imageUtils";

interface MarkdownPreviewProps {
  content: string;
  fontSize: FontSize;
  onWikilinkClick: (title: string) => void;
}

const fontSizeMap: Record<FontSize, string> = {
  small: "13px",
  medium: "15px",
  large: "18px",
};

export function MarkdownPreview({ content, fontSize, onWikilinkClick }: MarkdownPreviewProps) {
  // Pre-process: convert [[Title]] to fragment links (fragment IDs bypass URL sanitization)
  const processedContent = useMemo(() => {
    return content.replace(
      /\[\[([^\]]+)\]\]/g,
      (_, title) => `[${title}](#wikilink:${encodeURIComponent(title)})`
    );
  }, [content]);

  return (
    <div
      className="flex-1 overflow-auto px-6 py-4 prose-container bg-gray-50 dark:bg-gray-900"
      style={{ fontSize: fontSizeMap[fontSize] }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        urlTransform={(url) => {
          // Allow knot-image URLs (default sanitizer strips custom protocols)
          // Windows: https://knot-image.localhost/{uuid}
          // macOS/Linux: knot-image://localhost/{uuid}
          if (isKnotImageUrl(url)) return url;
          return defaultUrlTransform(url);
        }}
        components={{
          a({ href, children, node, ...props }) {
            if (href?.startsWith("#wikilink:")) {
              const title = decodeURIComponent(href.replace("#wikilink:", ""));
              return (
                <span
                  {...props}
                  role="link"
                  tabIndex={0}
                  onClick={() => onWikilinkClick(title.trim())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onWikilinkClick(title.trim());
                  }}
                  className="text-blue-400 cursor-pointer underline decoration-dotted underline-offset-[3px] hover:text-blue-300 hover:decoration-solid"
                >
                  {children}
                </span>
              );
            }
            return (
              <a
                {...props}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            );
          },
          input({ node, type, checked, ...props }) {
            if (type === "checkbox") {
              return <input type="checkbox" checked={checked} disabled {...props} />;
            }
            return <input type={type} {...props} />;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
