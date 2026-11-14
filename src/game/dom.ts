type Attrs = Record<string, any>;
/** tiny DOM helper: h('div.panel#id', {onclick}, child, 'text') */
export function h(spec: string, attrs: Attrs = {}, ...kids: (Node | string | null | undefined | false)[]): HTMLElement {
  const tag = /^[a-z0-9]+/i.exec(spec)?.[0] ?? 'div';
  const id = /#([\w-]+)/.exec(spec)?.[1];
  const classes = [...spec.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
  const el = document.createElement(tag);
  if (id) el.id = id;
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, String(v));
  }
  for (const kid of kids) if (kid) el.append(kid);
  return el;
}
