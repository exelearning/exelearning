const eventListeners = new WeakMap();

function resolveContext(context) {
  if (!context) return [document];
  if (context === window) return [document];
  if (typeof context === 'string') {
    return Array.from(document.querySelectorAll(context));
  }
  if (context instanceof Node) return [context];
  if (Array.isArray(context) || context instanceof NodeList) {
    return Array.from(context);
  }
  if (typeof context[Symbol.iterator] === 'function') {
    return Array.from(context);
  }
  if (context.elements) return Array.from(context.elements);
  return [document];
}

function createCollection(nodes, jquery) {
  const elements = Array.from(nodes || []).filter(Boolean);

  const collection = {
    get length() {
      return elements.length;
    },
    get 0() {
      return elements[0];
    },
    each(callback) {
      elements.forEach((node, index) => callback.call(node, index, node));
      return collection;
    },
    eq(index) {
      const node = elements[index];
      return createCollection(node ? [node] : [], jquery);
    },
    find(selector) {
      const results = [];
      elements.forEach((node) => {
        if (node && node.querySelectorAll) {
          results.push(...Array.from(node.querySelectorAll(selector)));
        }
      });
      return createCollection(results, jquery);
    },
    addClass(cls) {
      const classes = String(cls).split(/\s+/).filter(Boolean);
      elements.forEach((node) => {
        if (node && node.classList) {
          classes.forEach((c) => node.classList.add(c));
        }
      });
      return collection;
    },
    removeClass(cls) {
      const classes = String(cls).split(/\s+/).filter(Boolean);
      elements.forEach((node) => {
        if (node && node.classList) {
          classes.forEach((c) => node.classList.remove(c));
        }
      });
      return collection;
    },
    hasClass(cls) {
      return !!elements[0]?.classList?.contains(cls);
    },
    css(prop, value) {
      if (typeof prop === 'object') {
        elements.forEach((node) => {
          if (node && node.style) {
            Object.entries(prop).forEach(([key, val]) => {
              node.style[key] = val;
            });
          }
        });
        return collection;
      }
      const node = elements[0];
      if (!node) return '';
      if (value === undefined) {
        return window.getComputedStyle(node).getPropertyValue(prop);
      }
      elements.forEach((item) => {
        if (item && item.style) item.style[prop] = value;
      });
      return collection;
    },
    attr(name, value) {
      if (!elements.length) return undefined;
      if (value === undefined) {
        return elements[0].getAttribute?.(name);
      }
      elements.forEach((node) => node.setAttribute?.(name, value));
      return collection;
    },
    removeAttr(name) {
      elements.forEach((node) => node.removeAttribute?.(name));
      return collection;
    },
    html(value) {
      if (value === undefined) {
        return elements[0]?.innerHTML ?? '';
      }
      elements.forEach((node) => {
        if (node) node.innerHTML = value;
      });
      return collection;
    },
    text(value) {
      if (value === undefined) {
        return elements[0]?.textContent ?? '';
      }
      elements.forEach((node) => {
        if (node) node.textContent = value;
      });
      return collection;
    },
    val(value) {
      if (value === undefined) {
        return elements[0]?.value ?? '';
      }
      elements.forEach((node) => {
        if ('value' in node) node.value = value;
      });
      return collection;
    },
    append(content) {
      elements.forEach((node) => {
        if (!node) return;
        if (typeof content === 'string') {
          node.insertAdjacentHTML('beforeend', content);
        } else if (content instanceof Node) {
          node.appendChild(content);
        }
      });
      return collection;
    },
    prepend(content) {
      elements.forEach((node) => {
        if (!node) return;
        if (typeof content === 'string') {
          node.insertAdjacentHTML('afterbegin', content);
        } else if (content instanceof Node) {
          node.insertBefore(content, node.firstChild);
        }
      });
      return collection;
    },
    after(content) {
      elements.forEach((node) => {
        if (!node || !node.parentNode) return;
        if (typeof content === 'string') {
          node.insertAdjacentHTML('afterend', content);
        } else if (content instanceof Node) {
          node.parentNode.insertBefore(content, node.nextSibling);
        }
      });
      return collection;
    },
    before(content) {
      elements.forEach((node) => {
        if (!node || !node.parentNode) return;
        if (typeof content === 'string') {
          node.insertAdjacentHTML('beforebegin', content);
        } else if (content instanceof Node) {
          node.parentNode.insertBefore(content, node);
        }
      });
      return collection;
    },
    toggleClass(cls) {
      const classes = String(cls).split(/\s+/).filter(Boolean);
      elements.forEach((node) => {
        if (!node || !node.classList) return;
        classes.forEach((c) => node.classList.toggle(c));
      });
      return collection;
    },
    remove() {
      elements.forEach((node) => node?.remove());
      return collection;
    },
    height() {
      if (!elements.length) return 0;
      const node = elements[0];
      if (node === window) return window.innerHeight;
      return node.offsetHeight || 0;
    },
    width() {
      if (!elements.length) return 0;
      const node = elements[0];
      if (node === window) return window.innerWidth;
      return node.offsetWidth || 0;
    },
    show() {
      elements.forEach((node) => {
        if (node && node.style) node.style.display = '';
      });
      return collection;
    },
    hide() {
      elements.forEach((node) => {
        if (node && node.style) node.style.display = 'none';
      });
      return collection;
    },
    slideUp() {
      return this.hide();
    },
    slideDown() {
      return this.show();
    },
    animate(props, duration, callback) {
      if (typeof props === 'object') {
        this.css(props);
      }
      if (typeof duration === 'function') {
        duration();
      }
      if (typeof callback === 'function') {
        callback();
      }
      return collection;
    },
    on(event, selectorOrHandler, handler) {
      elements.forEach((node) => {
        if (!node) return;
        const listeners = eventListeners.get(node) || [];
        if (typeof selectorOrHandler === 'string' && typeof handler === 'function') {
          const delegate = (evt) => {
            if (evt.target instanceof Element && evt.target.matches(selectorOrHandler)) {
              handler.call(evt.target, evt);
            }
          };
          node.addEventListener(event, delegate);
          listeners.push({ event, handler: delegate });
        } else if (typeof selectorOrHandler === 'function') {
          node.addEventListener(event, selectorOrHandler);
          listeners.push({ event, handler: selectorOrHandler });
        }
        eventListeners.set(node, listeners);
      });
      return collection;
    },
    off(event) {
      elements.forEach((node) => {
        const listeners = eventListeners.get(node) || [];
        listeners
          .filter((entry) => !event || entry.event === event)
          .forEach((entry) => node.removeEventListener(entry.event, entry.handler));
        const remaining = listeners.filter((entry) => event && entry.event !== event);
        eventListeners.set(node, remaining);
      });
      return collection;
    },
    click(handler) {
      if (typeof handler === 'function') {
        return this.on('click', handler);
      }
      this.trigger('click');
      return collection;
    },
    change(handler) {
      if (typeof handler === 'function') {
        return this.on('change', handler);
      }
      this.trigger('change');
      return collection;
    },
    trigger(eventName) {
      const event = new Event(eventName, { bubbles: true });
      elements.forEach((node) => node?.dispatchEvent(event));
      return collection;
    },
    parent(selector) {
      const parents = elements.map((node) => node?.parentElement).filter(Boolean);
      const filtered = selector ? parents.filter((node) => node.matches(selector)) : parents;
      return createCollection(filtered, jquery);
    },
    parents(selector) {
      const results = [];
      elements.forEach((node) => {
        let current = node?.parentElement;
        while (current) {
          if (!selector || current.matches(selector)) {
            results.push(current);
          }
          current = current.parentElement;
        }
      });
      return createCollection(results, jquery);
    },
    children(selector) {
      const results = [];
      elements.forEach((node) => {
        if (!node) return;
        Array.from(node.children).forEach((child) => {
          if (!selector || child.matches(selector)) {
            results.push(child);
          }
        });
      });
      return createCollection(results, jquery);
    },
    findParent(selector) {
      const filtered = [];
      elements.forEach((node) => {
        const parent = node?.closest(selector);
        if (parent) filtered.push(parent);
      });
      return createCollection(filtered, jquery);
    },
    is(selector) {
      if (!elements.length) return false;
      return elements[0].matches(selector);
    },
    htmlContent() {
      return elements[0]?.innerHTML ?? '';
    },
    ready(callback) {
      if (typeof callback === 'function') callback();
      return collection;
    },
    appendTo(parent) {
      const parents = Array.from(resolveCollection(parent));
      parents.forEach((target) => {
        elements.forEach((node) => target.appendChild(node));
      });
      return collection;
    },
  };

  collection[Symbol.iterator] = function () {
    return elements[Symbol.iterator]();
  };

  return collection;
}

function resolveCollection(input) {
  if (!input) return [];
  if (input instanceof HTMLElement || input instanceof Document || input === window) return [input];
  if (Array.isArray(input) || input instanceof NodeList) return Array.from(input);
  if (typeof input === 'object' && 'length' in input) return Array.from(input);
  return [];
}

function getIndexedItem(collection, index) {
  if (!collection) return undefined;
  if (collection[index] !== undefined) return collection[index];
  if (typeof collection.item === 'function') return collection.item(index);
  return undefined;
}

export function createDomJQuery() {
  const jquery = function (selector, context) {
    if (typeof selector === 'function') {
      selector();
      return createCollection([], jquery);
    }
    if (selector === window || selector === document) {
      return createCollection([selector], jquery);
    }
    const nodes = [];
    if (selector && typeof selector === 'string') {
      const trimmed = selector.trim();
      if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
        const template = document.createElement('template');
        template.innerHTML = trimmed;
        nodes.push(...Array.from(template.content.children));
      } else {
        const roots = resolveContext(context);
        roots.forEach((root) => {
          if (root && root.querySelectorAll) {
            nodes.push(...Array.from(root.querySelectorAll(selector)));
          }
        });
      }
    } else if (selector instanceof Node) {
      nodes.push(selector);
    } else if (selector && typeof selector.length === 'number') {
      nodes.push(...Array.from(selector));
    }
    return createCollection(nodes, jquery);
  };

  jquery.extend = function (target, ...sources) {
    if (!target || typeof target !== 'object') target = {};
    sources.forEach((source) => {
      if (!source || typeof source !== 'object') return;
      Object.keys(source).forEach((key) => {
        target[key] = source[key];
      });
    });
    return target;
  };

  jquery.each = function (collection, callback) {
    if (!collection) return collection;
    if (Array.isArray(collection) || typeof collection.length === 'number') {
      for (let i = 0; i < collection.length; i++) {
        const item = getIndexedItem(collection, i);
        callback.call(item, i, item);
      }
    } else {
      Object.keys(collection).forEach((key) => callback.call(collection[key], key, collection[key]));
    }
    return collection;
  };

  jquery.map = function (collection, callback) {
    if (!collection) return [];
    const items = [];
    if (typeof collection.length === 'number') {
      for (let i = 0; i < collection.length; i++) {
        const item = getIndexedItem(collection, i);
        if (item !== undefined) items.push(item);
      }
    } else if (typeof collection[Symbol.iterator] === 'function') {
      for (const item of collection) {
        items.push(item);
      }
    } else {
      Object.keys(collection).forEach((key) => items.push(collection[key]));
    }
    return items
      .map((item, index) => callback.call(item, index, item))
      .filter((value) => value !== undefined);
  };

  jquery.ajax = () => ({
    then: () => {},
  });

  jquery.fn = {};

  return jquery;
}
