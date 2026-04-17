const ALLOWED_TAGS = new Set([
  'a', 'b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
  'hr', 'div', 'span',
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel', 'class']),
  '*': new Set(['class']),
};

export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  function sanitizeNode(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) return;
    if (node.nodeType !== Node.ELEMENT_NODE) {
      node.parentNode?.removeChild(node);
      return;
    }

    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    if (!ALLOWED_TAGS.has(tag)) {
      el.replaceWith(...Array.from(el.childNodes));
      return;
    }

    const allowed = new Set([...(ALLOWED_ATTRS['*'] || []), ...(ALLOWED_ATTRS[tag] || [])]);
    for (const attr of Array.from(el.attributes)) {
      if (!allowed.has(attr.name)) {
        el.removeAttribute(attr.name);
      }
    }

    if (tag === 'a') {
      const href = el.getAttribute('href') || '';
      if (href.startsWith('javascript:') || href.startsWith('data:')) {
        el.removeAttribute('href');
      }
      el.setAttribute('rel', 'noopener noreferrer');
    }

    Array.from(el.childNodes).forEach(sanitizeNode);
  }

  Array.from(doc.body.childNodes).forEach(sanitizeNode);
  return doc.body.innerHTML;
}
