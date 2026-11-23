import katex from 'katex';
import { useMemo } from 'react';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderInlineFormatting(text: string): string {
  const escaped = escapeHtml(text);
  // **bold**
  return escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />');
}

function renderMathString(input: string): string {
  // Tokenize $$...$$ (display) and $...$ (inline)
  const regex = /(\$\$[\s\S]+?\$\$|\$(?:\\.|[^$\\])+\$)/g;
  let lastIndex = 0;
  let html = '';
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      html += renderInlineFormatting(input.slice(lastIndex, match.index));
    }
    const token = match[0];
    const isDisplay = token.startsWith('$$') && token.endsWith('$$');
    const expr = isDisplay ? token.slice(2, -2).trim() : token.slice(1, -1).trim();
    try {
      const rendered = katex.renderToString(expr, {
        displayMode: isDisplay,
        throwOnError: false,
        strict: false,
      });
      html += isDisplay ? `<div class="math-block">${rendered}</div>` : rendered;
    } catch {
      html += `<code>${escapeHtml(expr)}</code>`;
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < input.length) {
    html += renderInlineFormatting(input.slice(lastIndex));
  }
  return html;
}

interface MathTextProps {
  text: string;
  className?: string;
}

export function MathText({ text, className }: MathTextProps) {
  const html = useMemo(() => renderMathString(text), [text]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
