!(function (e, n) {
  'object' == typeof exports && 'undefined' != typeof module
    ? (module.exports = n())
    : 'function' == typeof define && define.amd
      ? define(n)
      : ((e = e || self).getXPath = n());
})(this, function () {
  function e() {
    return (e = Object.assign
      ? Object.assign.bind()
      : function (e) {
          for (var n = 1; n < arguments.length; n++) {
            var o = arguments[n];
            for (var r in o) ({}).hasOwnProperty.call(o, r) && (e[r] = o[r]);
          }
          return e;
        }).apply(null, arguments);
  }
  var n = { ignoreId: !1 },
    o = 'undefined' != typeof Node,
    r = o ? Node.ELEMENT_NODE : 1,
    i = o ? Node.TEXT_NODE : 3,
    t = o ? Node.DOCUMENT_TYPE_NODE : 10;
  return function (o, d) {
    var f = e({}, n, d),
      a = o;
    if (a && a.id && !f.ignoreId) return '//*[@id="' + a.id + '"]';
    for (var p = []; a && (r === a.nodeType || i === a.nodeType); ) {
      for (var u = 0, l = !1, N = a.previousSibling; N; )
        N.nodeType !== t && N.nodeName === a.nodeName && u++, (N = N.previousSibling);
      for (N = a.nextSibling; N; ) {
        if (N.nodeName === a.nodeName) {
          l = !0;
          break;
        }
        N = N.nextSibling;
      }
      var s = u || l ? '[' + (u + 1) + ']' : '';
      p.push(a.nodeType != i ? (a.prefix ? a.prefix + ':' : '') + a.localName + s : 'text()' + (s || '[1]')),
        (a = a.parentNode);
    }
    return p.length ? '/' + p.reverse().join('/') : '';
  };
});
//# sourceMappingURL=index.umd.js.map

function isElementNode(node) {
  return node.nodeType === Node.ELEMENT_NODE;
}

function isTextNode(node) {
  return node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim());
}

const leafElementDenyList = ['SVG', 'IFRAME', 'SCRIPT', 'STYLE', 'LINK'];

const interactiveElementTypes = [
  'A',
  'BUTTON',
  'DETAILS',
  'EMBED',
  'INPUT',
  'LABEL',
  'MENU',
  'MENUITEM',
  'OBJECT',
  'SELECT',
  'TEXTAREA',
  'SUMMARY',
];

const interactiveRoles = [
  'button',
  'menu',
  'menuitem',
  'link',
  'checkbox',
  'radio',
  'slider',
  'tab',
  'tabpanel',
  'textbox',
  'combobox',
  'grid',
  'listbox',
  'option',
  'progressbar',
  'scrollbar',
  'searchbox',
  'switch',
  'tree',
  'treeitem',
  'spinbutton',
  'tooltip',
];
const interactiveAriaRoles = ['menu', 'menuitem', 'button'];

/*
 * Checks if an element is visible and therefore relevant for LLMs to consider. We check:
 * - Size
 * - Display properties
 * - Opacity
 * If the element is a child of a previously hidden element, it should not be included, so we don't consider downstream effects of a parent element here
 */
const isVisible = element => {
  const rect = element.getBoundingClientRect();
  // Ensure the element is within the viewport
  if (rect.width === 0 || rect.height === 0 || rect.top < 0 || rect.top > window.innerHeight) {
    return false;
  }
  if (!isTopElement(element, rect)) {
    return false;
  }

  const visible = element.checkVisibility({
    checkOpacity: true,
    checkVisibilityCSS: true,
  });

  return visible;
};

const isTextVisible = element => {
  const range = document.createRange();
  range.selectNodeContents(element);
  const rect = range.getBoundingClientRect();

  if (rect.width === 0 || rect.height === 0 || rect.top < 0 || rect.top > window.innerHeight) {
    return false;
  }
  const parent = element.parentElement;
  if (!parent) {
    return false;
  }

  const visible = parent.checkVisibility({
    checkOpacity: true,
    checkVisibilityCSS: true,
  });

  return visible;
};

function isTopElement(elem, rect) {
  const points = [
    { x: rect.left + rect.width * 0.25, y: rect.top + rect.height * 0.25 },
    { x: rect.left + rect.width * 0.75, y: rect.top + rect.height * 0.25 },
    { x: rect.left + rect.width * 0.25, y: rect.top + rect.height * 0.75 },
    { x: rect.left + rect.width * 0.75, y: rect.top + rect.height * 0.75 },
    { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
  ];

  return points.some(point => {
    const topEl = document.elementFromPoint(point.x, point.y);
    let current = topEl;
    while (current && current !== document.body) {
      if (current.isSameNode(elem)) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  });
}

const isActive = element => {
  if (
    element.hasAttribute('disabled') ||
    element.hasAttribute('hidden') ||
    element.getAttribute('aria-disabled') === 'true'
  ) {
    return false;
  }

  return true;
};
const isInteractiveElement = element => {
  const elementType = element.tagName;
  const elementRole = element.getAttribute('role');
  const elementAriaRole = element.getAttribute('aria-role');

  return (
    (elementType && interactiveElementTypes.includes(elementType)) ||
    (elementRole && interactiveRoles.includes(elementRole)) ||
    (elementAriaRole && interactiveAriaRoles.includes(elementAriaRole))
  );
};

/**
 * Collects essential attributes from an element.
 * @param element The DOM element.
 * @returns A string of formatted attributes.
 */
function collectEssentialAttributes(element) {
  const essentialAttributes = [
    'id',
    'class',
    'href',
    'src',
    'aria-label',
    'aria-name',
    'aria-role',
    'aria-description',
    'aria-expanded',
    'aria-haspopup',
    'type',
    'value',
  ];

  const attrs = essentialAttributes
    .map(attr => {
      const value = element.getAttribute(attr);
      return value ? `${attr}="${value}"` : '';
    })
    .filter(attr => attr !== '');

  Array.from(element.attributes).forEach(attr => {
    if (attr.name.startsWith('data-')) {
      attrs.push(`${attr.name}="${attr.value}"`);
    }
  });

  return attrs.join(' ');
}

const isLeafElement = element => {
  if (element.textContent === '') {
    return false;
  }

  if (element.childNodes.length === 0) {
    return !leafElementDenyList.includes(element.tagName);
  }

  // This case ensures that extra context will be included for simple element nodes that contain only text
  if (element.childNodes.length === 1 && isTextNode(element.childNodes[0])) {
    return true;
  }

  return false;
};

const xpathCache = new Map();
function collect(rootEl, indexOffset = 0) {
  const DOMCrawlQueue = [...rootEl.childNodes];

  let shouldAdd = false;
  const candidateElements = [];

  while (DOMCrawlQueue.length > 0) {
    const node = DOMCrawlQueue.pop();

    if (node && isElementNode(node)) {
      for (let i = node.childNodes.length - 1; i >= 0; i--) {
        DOMCrawlQueue.push(node.childNodes[i]);
      }

      if (isInteractiveElement(node)) {
        if (isActive(node) && isVisible(node)) {
          shouldAdd = true;
        }
      }
      if (isLeafElement(node)) {
        if (isActive(node) && isVisible(node)) {
          shouldAdd = true;
        }
      }
    }

    if (shouldAdd) {
      candidateElements.push(node);
    }
  }

  const selectorMap = {};
  let outputString = '';
  const xpathLists = candidateElements.map(elem => {
    if (xpathCache.has(elem)) {
      return xpathCache.get(elem);
    }

    return getXPath(elem);
  });

  candidateElements.forEach((elem, idx) => {
    const xpaths = xpathLists[idx];
    let elemOutput = '';

    if (isTextNode(elem)) {
      const textContent = elem.textContent?.trim();
      if (textContent) {
        elemOutput += `${idx + indexOffset}:${textContent}\n`;
      }
    } else if (isElementNode(elem)) {
      const tagName = elem.tagName.toLowerCase();
      const attributes = collectEssentialAttributes(elem);
      const opening = `<${tagName}${attributes ? ' ' + attributes : ''}>`;
      const closing = `</${tagName}>`;
      const textContent = elem.textContent?.trim() || '';
      elemOutput += `${idx + indexOffset}:${opening}${textContent}${closing}\n`;
    }

    outputString += elemOutput;
    selectorMap[idx + indexOffset] = xpaths;
  });

  return { outputString, selectorMap };
}

window.collect = collect;
