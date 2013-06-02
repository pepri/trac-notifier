var link;
var guideHref = '/wiki/TracGuide';

if (document.doctype &&
		document.documentElement.namespaceURI == 'http://www.w3.org/1999/xhtml' &&
		(link = document.querySelector('link[rel=help]')) && link.href.substr(-guideHref.length) == guideHref) {
	var base = link.href.slice(0, -guideHref.length);
	var rssLink = document.querySelector('link[type="application/rss+xml"]');
	chrome.extension.onMessage.addListener(function(message, sender, sendResponse) {
		var command = message && message.command;
		switch (command) {
			case 'getBase':
				sendResponse({
					base: base,
					href: rssLink ? rssLink.href : null
				});
				break;
			default:
				sendResponse();
		}
	});
	chrome.extension.sendRequest({
		command: 'showPageAction',
		base: base
	});
}
