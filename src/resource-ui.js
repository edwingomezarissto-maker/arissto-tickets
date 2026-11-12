import { webAddress } from './resource-fields.mjs';

export const byId = id => document.getElementById(id);
export const searchable = value => value.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export function action(label, handler, className = 'secondary-button') {
  const button = element('button', label, className);
  button.type = 'button';
  button.addEventListener('click', handler);
  return button;
}

export function externalLink(value, label) {
  const href = webAddress(value);
  if (!href) return document.createTextNode('');
  const anchor = element('a', label);
  anchor.href = href;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.referrerPolicy = 'no-referrer';
  return anchor;
}
