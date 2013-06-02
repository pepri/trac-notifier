function $(id) {
	return document.getElementById(id);
}

var currentQuery = {
	currentWindow: true,
	active: true
};

function command(cmd) {
	return {
		command: cmd
	};
}

function getFollowed(callback) {
	chrome.tabs.query(currentQuery, function(tabs) {
		var tab = tabs[0];
		chrome.tabs.sendMessage(tab.id, command('getBase'), function(res) {
			var req = {
				command: 'getFollowed',
				base: res.base
			};
			chrome.extension.sendRequest(req, function(trac) {
				callback(tab, trac, res.href);
			});
		});
	});
}

function getInfo(base, url, callback) {
	var req = {
		command: 'getInfo',
		base: base,
		url: url
	};
	chrome.extension.sendRequest(req, function(info) {
		callback(info);
	});
}

function htmlEncode(str) {
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function removeFormatParam(url) {
	return url.replace(/(\?|&)format=rss(?:&|$)/g, '$1').replace(/\?$/g, '');
}

function createHtml(currentUrl, url, tracUrl) {
	var html = new Array;
	html.push(
		'<li', (currentUrl == url ? ' class="current">' : '>'),
		'<input type="checkbox"', (currentUrl ? ' checked="checked"' : ''), ' data-url="', htmlEncode(url) , '" /> ',
		'<span>',
		'<a href="', htmlEncode(tracUrl.link), '" target="_blank">', htmlEncode(tracUrl.title), '</a>',
		'<i title="', htmlEncode(tracUrl.description), '">', htmlEncode(tracUrl.description), '</i>',
		'</span>',
		'</li>');
	return html.join('');
}

getFollowed(function(tab, trac, currentUrl) {
	var list = $('urls');
	var hasCurrent = false;
	if (!currentUrl)
		currentUrl = trac.base + '/timeline?format=rss';
	var html = new Array;
	for (var url in trac.urls) {
		var tracUrl = trac.urls[url];
		hasCurrent |= currentUrl == url;
		console.log(url, currentUrl);
		html.push(createHtml(currentUrl, url, tracUrl));
	}
	list.insertAdjacentHTML('afterbegin', html.join(''));

	if (!hasCurrent) {
		document.body.className = 'loading'
		getInfo(trac.base, currentUrl, function(tracUrl) {
			if (tracUrl) {
				trac.urls[currentUrl] = tracUrl;
				var html = createHtml(null, currentUrl, tracUrl);
				list.insertAdjacentHTML('beforeend', html);
			}
			document.body.className = ''
		});
	}

	list.onclick = function(e) {
		if (e.target.tagName == 'INPUT' && e.target.type == 'checkbox') {
			var url = e.target.dataset.url;
			tracUrl = trac.urls[url];
			var req = {
				command: e.target.checked ? 'followTrac' : 'unfollowTrac',
				base: trac.base,
				path: url,
				title: tracUrl.title,
				description: tracUrl.description,
				link: tracUrl.link
			};
			chrome.extension.sendRequest(req, function(response) {
			});
		} else if (e.target.tagNAme == 'A') {
			open(e.target.href);
			close();
			return false;
		}
	};

	$('refresh').onchange = function() {
		var req = {
			command: 'setInterval',
			base: trac.base,
			interval: this.value
		};
		chrome.extension.sendRequest(req, function(response) {
		});
	};

	$('refresh').value = (trac.interval || 30000) / 1000;
});

$('done').onclick = function() {
	close();
};
