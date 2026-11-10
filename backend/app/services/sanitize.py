"""HTML sanitizing for CMS bodies shown through dangerouslySetInnerHTML on the public site.

Defence in depth: the editor may be compromised or paste markup from Word, so the HTML is
cleaned on output, not only on input. Allowed: text structure, links (http/https/mailto/tel),
lists, tables, simple images. Everything else (script, style, iframe, on* handlers,
javascript: URLs, style attributes) is dropped.
"""

import nh3

_TAGS = {
    "a", "abbr", "b", "blockquote", "br", "caption", "cite", "code", "col", "colgroup", "dd", "div", "dl", "dt",
    "em", "figcaption", "figure", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "li", "mark", "ol", "p", "pre",
    "s", "small", "span", "strong", "sub", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul",
}
_ATTRIBUTES = {
    "a": {"href", "title"},
    "img": {"src", "alt", "title", "width", "height"},
    "td": {"colspan", "rowspan"},
    "th": {"colspan", "rowspan", "scope"},
    "*": {"lang"},
}
_URL_SCHEMES = {"http", "https", "mailto", "tel"}


def clean_html(html: str) -> str:
    # nh3 adds rel="noopener noreferrer" to links itself; relative URLs stay allowed.
    return nh3.clean(html, tags=_TAGS, attributes=_ATTRIBUTES, url_schemes=_URL_SCHEMES, link_rel="noopener noreferrer")
